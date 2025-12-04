import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { classifySong } from '../../src/classifiers/gemini-classifier.cjs';

const prisma = new PrismaClient();

interface SongToProcess {
  artist: string;
  title: string;
  isrc?: string;
  bpm?: number;
  spotifyTrackId?: string;
  s3Url?: string;
  artworkUrl?: string;
  spotifyPreviewUrl?: string;
  spotifyArtworkUrl?: string;
}

interface ProcessedSong {
  isrc: string;
  title: string;
  artist: string;
  aiEnergy?: string | null;
  aiAccessibility?: string | null;
  aiSubgenre1?: string | null;
  aiSubgenre2?: string | null;
  aiSubgenre3?: string | null;
  status: 'success' | 'error';
  error?: string;
}

interface ProcessBatchRequest {
  batchId: string;
  playlistId: string;
  uploadBatchName: string;
  songs: SongToProcess[];
}

interface ProcessBatchResponse {
  batchId: string;
  processed: number;
  results: ProcessedSong[];
  errors: Array<{ artist: string; title: string; error: string }>;
}

/**
 * POST /api/songs/process-batch
 *
 * Process a batch of songs with Gemini classification only.
 * Explicit detection is handled separately via submit-explicit and poll-explicit endpoints.
 *
 * Request body:
 * {
 *   batchId: string,
 *   playlistId: string,
 *   uploadBatchName: string,
 *   songs: Array<{ artist, title, isrc?, bpm?, spotifyTrackId?, ... }>
 * }
 *
 * Response:
 * {
 *   batchId: string,
 *   processed: number,
 *   results: Array<ProcessedSong>,
 *   errors: Array<{ artist, title, error }>
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { batchId, playlistId, uploadBatchName, songs } = req.body as ProcessBatchRequest;

    if (!batchId || !playlistId || !uploadBatchName || !songs || songs.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: batchId, playlistId, uploadBatchName, songs'
      });
    }

    console.log(`[ProcessBatch] Starting Gemini batch with ${songs.length} songs`);

    const results: ProcessedSong[] = [];
    const errors: Array<{ artist: string; title: string; error: string }> = [];

    // Run Gemini classification for all songs in parallel
    const geminiResults = await Promise.all(
      songs.map(async (song, index) => {
        try {
          // Run Gemini classification
          const geminiResult = await classifySong(song.artist, song.title, {
            bpm: song.bpm
          });

          // Generate ISRC if missing
          const isrc = song.isrc || `TEMP-${uuidv4().substring(0, 8).toUpperCase()}`;

          // Helper to truncate strings to database column limits
          const truncate = (str: string | null | undefined, maxLen: number): string | null => {
            if (!str) return null;
            return str.length > maxLen ? str.substring(0, maxLen) : str;
          };

          // Save to database with aiExplicit: null (updated later by poll-explicit)
          const enrichedSong = {
            isrc,
            title: truncate(song.title, 500),
            artist: truncate(song.artist, 500),
            bpm: song.bpm || null,
            spotifyTrackId: truncate(song.spotifyTrackId, 50),
            s3Url: song.s3Url || null,
            artwork: song.spotifyArtworkUrl || song.artworkUrl || null,
            artworkUrl: song.artworkUrl || null,
            spotifyPreviewUrl: song.spotifyPreviewUrl || null,
            spotifyArtworkUrl: song.spotifyArtworkUrl || null,
            // Gemini results - truncate to match DB column limits
            aiEnergy: truncate(geminiResult?.energy, 20),
            aiAccessibility: truncate(geminiResult?.accessibility, 20),
            aiSubgenre1: truncate(geminiResult?.subgenre1, 100),
            aiSubgenre2: truncate(geminiResult?.subgenre2, 100),
            aiSubgenre3: truncate(geminiResult?.subgenre3, 100),
            aiReasoning: truncate(geminiResult?.reasoning, 5000),
            aiContextUsed: truncate(geminiResult?.context, 2000),
            // Explicit will be updated by poll-explicit endpoint
            aiExplicit: null,
            // Status
            aiStatus: geminiResult?.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
            aiErrorMessage: geminiResult?.error_message || null,
            // Upload tracking
            uploadBatchId: batchId,
            uploadBatchName: uploadBatchName,
            reviewed: false
          };

          // Upsert to handle duplicates
          const savedSong = await prisma.song.upsert({
            where: { isrc: enrichedSong.isrc },
            update: enrichedSong,
            create: enrichedSong
          });

          // Create playlist association
          await prisma.playlistSong.upsert({
            where: {
              playlistId_songIsrc: {
                playlistId: playlistId,
                songIsrc: savedSong.isrc
              }
            },
            update: { wasNew: true },
            create: {
              playlistId: playlistId,
              songIsrc: savedSong.isrc,
              wasNew: true
            }
          });

          return {
            index,
            isrc: savedSong.isrc,
            geminiResult,
            success: true
          };

        } catch (error: any) {
          console.error(`[ProcessBatch] Gemini error for ${song.artist} - ${song.title}:`, error.message);
          return {
            index,
            isrc: song.isrc,
            error: error.message,
            success: false
          };
        }
      })
    );

    console.log(`[ProcessBatch] Complete: ${geminiResults.filter(r => r.success).length}/${songs.length} classified`);

    // Build response
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const geminiRes = geminiResults[i];

      if (geminiRes.success && geminiRes.isrc) {
        results.push({
          isrc: geminiRes.isrc,
          title: song.title,
          artist: song.artist,
          aiEnergy: geminiRes.geminiResult?.energy,
          aiAccessibility: geminiRes.geminiResult?.accessibility,
          aiSubgenre1: geminiRes.geminiResult?.subgenre1,
          aiSubgenre2: geminiRes.geminiResult?.subgenre2,
          aiSubgenre3: geminiRes.geminiResult?.subgenre3,
          status: 'success'
        });
      } else {
        errors.push({
          artist: song.artist,
          title: song.title,
          error: geminiRes.error || 'Unknown error'
        });
      }
    }

    // Update playlist stats after processing this batch
    try {
      await prisma.playlist.update({
        where: { id: playlistId },
        data: {
          totalSongs: { increment: songs.length },
          newSongs: { increment: results.length }
        }
      });
    } catch (statsError: any) {
      console.error(`[ProcessBatch] Failed to update playlist stats:`, statsError.message);
      // Non-fatal - don't fail the batch for stats update failure
    }

    const response: ProcessBatchResponse = {
      batchId,
      processed: results.length,
      results,
      errors
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[ProcessBatch] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
