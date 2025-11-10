import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import formidable from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { calculateSongSimilarity, areSongsDuplicate } from '../../src/utils/fuzzy-matcher.cjs';
import { classifySong } from '../../src/classifiers/gemini-classifier.cjs';
import { classifyExplicitContent } from '../../src/classifiers/explicit-classifier.cjs';

const prisma = new PrismaClient();

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false
  }
};

interface ParsedSong {
  artist: string;
  title: string;
  isrc?: string;
  bpm?: number;
  spotifyTrackId?: string;
}

interface DuplicateMatch {
  song: any;
  similarity: number;
  matchType: 'exact' | 'fuzzy';
}

interface UploadResult {
  batchId: string;
  summary: {
    total: number;
    successful: number;
    duplicates: number;
    blocked: number;
    errors: number;
  };
  results: {
    successful: Array<any>;
    duplicates: Array<{
      newSong: ParsedSong;
      existingSong: any;
      similarity: number;
    }>;
    blocked: Array<{
      song: ParsedSong;
      reason: string;
      existingIsrc: string;
    }>;
    errors: Array<{
      song: ParsedSong;
      error: string;
    }>;
  };
}

/**
 * POST /api/songs/upload
 *
 * Upload and process a CSV file with songs
 *
 * Multipart form data:
 * - file: CSV file (max 250 songs for web uploads)
 *
 * Response: UploadResult
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const uploadBatchId = uuidv4();

  try {
    // Parse multipart form data
    const { file, songs } = await parseFormData(req);

    if (!file || !songs || songs.length === 0) {
      return res.status(400).json({
        error: 'No CSV file provided or file is empty'
      });
    }

    // Enforce 250 song limit for web uploads
    if (songs.length > 250) {
      return res.status(400).json({
        error: `Too many songs. Maximum 250 songs per upload. You provided ${songs.length} songs.`
      });
    }

    // Initialize result structure
    const result: UploadResult = {
      batchId: uploadBatchId,
      summary: {
        total: songs.length,
        successful: 0,
        duplicates: 0,
        blocked: 0,
        errors: 0
      },
      results: {
        successful: [],
        duplicates: [],
        blocked: [],
        errors: []
      }
    };

    // Process each song
    for (const song of songs) {
      try {
        // Check for duplicates
        const duplicate = await findDuplicate(song);

        if (duplicate) {
          if (duplicate.matchType === 'exact') {
            // Exact ISRC match - block
            result.results.blocked.push({
              song,
              reason: 'Exact ISRC match',
              existingIsrc: duplicate.song.isrc
            });
            result.summary.blocked++;
          } else {
            // Fuzzy match - flag for review
            result.results.duplicates.push({
              newSong: song,
              existingSong: duplicate.song,
              similarity: duplicate.similarity
            });
            result.summary.duplicates++;
          }
          continue;
        }

        // No duplicate - enrich and save
        const enrichedSong = await enrichAndSaveSong(song, uploadBatchId);
        result.results.successful.push(enrichedSong);
        result.summary.successful++;

      } catch (error: any) {
        result.results.errors.push({
          song,
          error: error.message
        });
        result.summary.errors++;
      }
    }

    return res.status(200).json(result);

  } catch (error: any) {
    console.error('Error processing upload:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Parse multipart form data and extract CSV file
 */
async function parseFormData(req: VercelRequest): Promise<{
  file: formidable.File | null;
  songs: ParsedSong[];
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        return reject(err);
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;

      if (!file) {
        return resolve({ file: null, songs: [] });
      }

      try {
        const songs = await parseCSV(file.filepath);
        resolve({ file, songs });
      } catch (error) {
        reject(error);
      }
    });
  });
}

/**
 * Parse CSV file and extract songs
 */
async function parseCSV(filePath: string): Promise<ParsedSong[]> {
  return new Promise((resolve, reject) => {
    const songs: ParsedSong[] = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        // Support multiple column name variations
        const artist = row.Artist || row.artist || row.ARTIST;
        const title = row.Title || row.title || row.TITLE || row.Name || row.name;
        const isrc = row.ISRC || row.isrc;
        const bpmValue = row.BPM || row.bpm;
        const bpm = bpmValue ? parseInt(bpmValue, 10) : undefined;
        const spotifyTrackId = row['Spotify Track ID'] || row.spotify_track_id;

        if (artist && title) {
          songs.push({
            artist,
            title,
            isrc,
            bpm,
            spotifyTrackId
          });
        }
      })
      .on('end', () => resolve(songs))
      .on('error', reject);
  });
}

/**
 * Find duplicate for a song
 */
async function findDuplicate(song: ParsedSong): Promise<DuplicateMatch | null> {
  // Check for exact ISRC match
  if (song.isrc) {
    const exactMatch = await prisma.song.findUnique({
      where: { isrc: song.isrc }
    });

    if (exactMatch) {
      return {
        song: exactMatch,
        similarity: 100,
        matchType: 'exact'
      };
    }
  }

  // Check for fuzzy match (70% threshold)
  const allSongs = await prisma.song.findMany({
    select: {
      id: true,
      isrc: true,
      artist: true,
      title: true,
      bpm: true,
      reviewed: true,
      aiEnergy: true,
      aiAccessibility: true,
      aiSubgenre1: true,
      aiSubgenre2: true,
      aiSubgenre3: true
    }
  });

  for (const existingSong of allSongs) {
    const isDuplicate = areSongsDuplicate(
      { artist: song.artist, title: song.title },
      { artist: existingSong.artist || '', title: existingSong.title || '' },
      70
    );

    if (isDuplicate) {
      const similarity = calculateSongSimilarity(
        { artist: song.artist, title: song.title },
        { artist: existingSong.artist || '', title: existingSong.title || '' }
      );

      return {
        song: existingSong,
        similarity,
        matchType: 'fuzzy'
      };
    }
  }

  return null;
}

/**
 * Enrich a song with AI classification and save to database
 */
async function enrichAndSaveSong(song: ParsedSong, uploadBatchId: string) {
  // Run Gemini classification
  const geminiResult = await classifySong(song.artist, song.title, {
    bpm: song.bpm
  });

  // Run Parallel AI explicit check
  const explicitResult = await classifyExplicitContent(song.artist, song.title);

  // Create enriched song object
  const enrichedSong = {
    isrc: song.isrc || `TEMP-${uuidv4().substring(0, 8).toUpperCase()}`, // Generate temp ISRC if missing
    title: song.title,
    artist: song.artist,
    bpm: song.bpm || null,
    spotifyTrackId: song.spotifyTrackId || null,
    // Gemini results
    aiEnergy: geminiResult?.energy || null,
    aiAccessibility: geminiResult?.accessibility || null,
    aiSubgenre1: geminiResult?.subgenre1 || null,
    aiSubgenre2: geminiResult?.subgenre2 || null,
    aiSubgenre3: geminiResult?.subgenre3 || null,
    aiReasoning: geminiResult?.reasoning || null,
    aiContextUsed: geminiResult?.context || null,
    // Parallel AI results
    aiExplicit: explicitResult?.classification || null,
    // Status
    aiStatus: geminiResult?.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
    aiErrorMessage: geminiResult?.error_message || null,
    // Upload tracking
    uploadBatchId,
    reviewed: false
  };

  // Save to database
  const savedSong = await prisma.song.upsert({
    where: { isrc: enrichedSong.isrc },
    update: enrichedSong,
    create: enrichedSong
  });

  return savedSong;
}
