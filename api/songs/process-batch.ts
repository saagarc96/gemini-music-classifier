import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { classifySong } from '../../src/classifiers/gemini-classifier.cjs';
import { submitExplicitTaskAsync, pollExplicitResult } from '../../src/classifiers/explicit-classifier.cjs';

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
  aiExplicit?: string | null;
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
 * Process a batch of songs using 3-phase parallel processing:
 * 1. Submit all explicit tasks to Parallel AI (non-blocking)
 * 2. Run Gemini classification for all songs in parallel
 * 3. Poll all explicit results and update DB
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

    if (!batchId || !playlistId || !songs || songs.length === 0) {
      return res.status(400).json({
        error: 'Missing required fields: batchId, playlistId, songs'
      });
    }

    console.log(`[ProcessBatch] Starting batch ${batchId} with ${songs.length} songs`);

    const results: ProcessedSong[] = [];
    const errors: Array<{ artist: string; title: string; error: string }> = [];

    // ===== PHASE 1: Submit ALL explicit tasks (fast, non-blocking) =====
    console.log(`[ProcessBatch] Phase 1: Submitting ${songs.length} explicit tasks...`);

    const explicitSubmissions = await Promise.all(
      songs.map(song => submitExplicitTaskAsync(song.artist, song.title))
    );

    const submittedCount = explicitSubmissions.filter(s => s.status === 'submitted').length;
    console.log(`[ProcessBatch] Phase 1 complete: ${submittedCount}/${songs.length} submitted`);

    // ===== PHASE 2: Run Gemini classification + save to DB =====
    console.log(`[ProcessBatch] Phase 2: Running Gemini classification...`);

    const geminiResults = await Promise.all(
      songs.map(async (song, index) => {
        try {
          // Run Gemini classification
          const geminiResult = await classifySong(song.artist, song.title, {
            bpm: song.bpm
          });

          // Generate ISRC if missing
          const isrc = song.isrc || `TEMP-${uuidv4().substring(0, 8).toUpperCase()}`;

          // Save to database with aiExplicit: null (will be updated in Phase 3)
          const enrichedSong = {
            isrc,
            title: song.title,
            artist: song.artist,
            bpm: song.bpm || null,
            spotifyTrackId: song.spotifyTrackId || null,
            s3Url: song.s3Url || null,
            artwork: song.spotifyArtworkUrl || song.artworkUrl || null,
            artworkUrl: song.artworkUrl || null,
            spotifyPreviewUrl: song.spotifyPreviewUrl || null,
            spotifyArtworkUrl: song.spotifyArtworkUrl || null,
            // Gemini results
            aiEnergy: geminiResult?.energy || null,
            aiAccessibility: geminiResult?.accessibility || null,
            aiSubgenre1: geminiResult?.subgenre1 || null,
            aiSubgenre2: geminiResult?.subgenre2 || null,
            aiSubgenre3: geminiResult?.subgenre3 || null,
            aiReasoning: geminiResult?.reasoning || null,
            aiContextUsed: geminiResult?.context || null,
            // Explicit will be updated in Phase 3
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

    console.log(`[ProcessBatch] Phase 2 complete: ${geminiResults.filter(r => r.success).length}/${songs.length} classified`);

    // ===== PHASE 3: Poll all explicit results + update DB =====
    console.log(`[ProcessBatch] Phase 3: Polling explicit results...`);

    const explicitResults = await Promise.all(
      explicitSubmissions.map(async (submission, index) => {
        if (submission.status !== 'submitted' || !submission.runId) {
          return { index, classification: null, error: submission.error };
        }

        try {
          const result = await pollExplicitResult(
            submission.runId,
            submission.artist,
            submission.title
          );
          return { index, classification: result.classification, error: null };
        } catch (error: any) {
          return { index, classification: null, error: error.message };
        }
      })
    );

    // Update DB with explicit results
    for (let i = 0; i < songs.length; i++) {
      const song = songs[i];
      const geminiRes = geminiResults[i];
      const explicitRes = explicitResults[i];

      if (geminiRes.success && geminiRes.isrc) {
        // Update explicit result in DB
        if (explicitRes.classification) {
          try {
            await prisma.song.update({
              where: { isrc: geminiRes.isrc },
              data: { aiExplicit: explicitRes.classification }
            });
          } catch (error: any) {
            console.error(`[ProcessBatch] Failed to update explicit for ${geminiRes.isrc}:`, error.message);
          }
        }

        results.push({
          isrc: geminiRes.isrc,
          title: song.title,
          artist: song.artist,
          aiEnergy: geminiRes.geminiResult?.energy,
          aiAccessibility: geminiRes.geminiResult?.accessibility,
          aiSubgenre1: geminiRes.geminiResult?.subgenre1,
          aiSubgenre2: geminiRes.geminiResult?.subgenre2,
          aiSubgenre3: geminiRes.geminiResult?.subgenre3,
          aiExplicit: explicitRes.classification,
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

    console.log(`[ProcessBatch] Phase 3 complete. Results: ${results.length} success, ${errors.length} errors`);

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
