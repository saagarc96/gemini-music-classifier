import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import formidable from 'formidable';
import fs from 'fs';
import csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { classifySong } from '../../src/classifiers/gemini-classifier.cjs';
import { classifyExplicitContent } from '../../src/classifiers/explicit-classifier.cjs';
import { requireAuth } from '../lib/auth.js';

const prisma = new PrismaClient();

// Spotify API token cache
let spotifyToken: { token: string; expires: number } | null = null;

/**
 * Get Spotify API access token using Client Credentials flow
 */
async function getSpotifyToken(): Promise<string> {
  // Return cached token if still valid
  if (spotifyToken && spotifyToken.expires > Date.now()) {
    return spotifyToken.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Spotify API credentials not configured');
  }

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  });

  if (!response.ok) {
    throw new Error(`Spotify auth failed: ${response.statusText}`);
  }

  const data = await response.json();

  // Cache token (expires in 1 hour, refresh 5 min early)
  spotifyToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 300) * 1000
  };

  return data.access_token;
}

/**
 * Fetch Spotify track data in batches (preview URL and artwork)
 */
async function fetchSpotifyTrackData(trackIds: string[]): Promise<Map<string, { previewUrl: string | null; artworkUrl: string | null }>> {
  const result = new Map();

  if (trackIds.length === 0) return result;

  try {
    const token = await getSpotifyToken();

    // Batch fetch up to 50 tracks at a time
    const batchSize = 50;
    for (let i = 0; i < trackIds.length; i += batchSize) {
      const batch = trackIds.slice(i, i + batchSize);
      const idsParam = batch.join(',');

      const response = await fetch(`https://api.spotify.com/v1/tracks?ids=${idsParam}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        console.error(`Spotify API error: ${response.statusText}`);
        continue;
      }

      const data = await response.json();

      for (const track of data.tracks) {
        if (track) {
          result.set(track.id, {
            previewUrl: track.preview_url || null,
            artworkUrl: track.album?.images?.[0]?.url || null
          });
        }
      }
    }
  } catch (error: any) {
    console.error('Error fetching Spotify data:', error.message);
  }

  return result;
}

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
  s3Url?: string;
  artworkUrl?: string;
  spotifyPreviewUrl?: string;
  spotifyArtworkUrl?: string;
}

interface UploadResult {
  batchId: string;
  playlistId: string;
  playlistName: string;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  results: {
    imported: Array<any>;
    skipped: Array<{
      isrc: string;
      title: string;
      artist: string;
    }>;
    errors: Array<{
      title: string;
      artist: string;
      error: string;
    }>;
  };
}

/**
 * Get existing ISRCs from database in a single batch query
 */
async function getExistingIsrcs(isrcs: string[]): Promise<Set<string>> {
  const validIsrcs = isrcs.filter(Boolean);
  if (validIsrcs.length === 0) return new Set();

  const existing = await prisma.song.findMany({
    where: { isrc: { in: validIsrcs } },
    select: { isrc: true }
  });
  return new Set(existing.map(s => s.isrc));
}

/**
 * POST /api/songs/upload
 *
 * Upload and process a CSV file with songs
 * - ISRC-based deduplication (skip songs that already exist)
 * - Creates playlist record from CSV filename
 * - AI enrichment with Gemini + Parallel AI
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

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) {
    return; // requireAuth already sent 401 response
  }

  const uploadBatchId = uuidv4();

  try {
    // Parse multipart form data
    const { file, songs, batchName } = await parseFormData(req);

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

    // Create playlist record (following enrich-playlist.cjs pattern)
    const playlist = await prisma.playlist.create({
      data: {
        name: batchName,
        uploadBatchId: uploadBatchId,
        uploadedByName: null, // Could be enhanced with auth later
        sourceFile: file.originalFilename || batchName + '.csv',
        totalSongs: 0,
        newSongs: 0,
        duplicateSongs: 0
      }
    });

    // Fetch Spotify track data for songs with Spotify Track IDs
    const spotifyTrackIds = songs
      .map(s => s.spotifyTrackId)
      .filter((id): id is string => !!id);

    const spotifyData = await fetchSpotifyTrackData(spotifyTrackIds);

    // Merge Spotify data into songs
    songs.forEach(song => {
      if (song.spotifyTrackId && spotifyData.has(song.spotifyTrackId)) {
        const data = spotifyData.get(song.spotifyTrackId)!;
        if (!song.spotifyPreviewUrl) {
          song.spotifyPreviewUrl = data.previewUrl || undefined;
        }
        if (!song.spotifyArtworkUrl) {
          song.spotifyArtworkUrl = data.artworkUrl || undefined;
        }
      }
    });

    // Batch check which ISRCs already exist (single DB query)
    const allIsrcs = songs.map(s => s.isrc).filter((isrc): isrc is string => !!isrc);
    const existingIsrcs = await getExistingIsrcs(allIsrcs);

    // Separate songs into: to process vs skipped
    const songsToProcess: ParsedSong[] = [];
    const skippedSongs: Array<{ isrc: string; title: string; artist: string }> = [];

    for (const song of songs) {
      if (song.isrc && existingIsrcs.has(song.isrc)) {
        // Song already exists - skip but still create playlist association
        skippedSongs.push({
          isrc: song.isrc,
          title: song.title,
          artist: song.artist
        });

        // Create playlist association for skipped song
        try {
          await prisma.playlistSong.create({
            data: {
              playlistId: playlist.id,
              songIsrc: song.isrc,
              wasNew: false
            }
          });
        } catch (error: any) {
          // Ignore duplicate key errors (already associated)
          if (error.code !== 'P2002') {
            console.error(`Failed to create playlist association for ${song.isrc}:`, error.message);
          }
        }
      } else {
        songsToProcess.push(song);
      }
    }

    // Initialize result structure
    const result: UploadResult = {
      batchId: uploadBatchId,
      playlistId: playlist.id,
      playlistName: batchName,
      summary: {
        total: songs.length,
        imported: 0,
        skipped: skippedSongs.length,
        errors: 0
      },
      results: {
        imported: [],
        skipped: skippedSongs,
        errors: []
      }
    };

    // Process new songs in parallel (concurrency: 7)
    const CONCURRENCY = 7;

    const processSong = async (song: ParsedSong) => {
      try {
        const enrichedSong = await enrichAndSaveSong(song, uploadBatchId, batchName, playlist.id);
        return { type: 'imported' as const, data: enrichedSong };
      } catch (error: any) {
        return {
          type: 'error' as const,
          data: {
            title: song.title,
            artist: song.artist,
            error: error.message
          }
        };
      }
    };

    // Process in batches
    for (let i = 0; i < songsToProcess.length; i += CONCURRENCY) {
      const batch = songsToProcess.slice(i, i + CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processSong));

      for (const res of batchResults) {
        if (res.type === 'imported') {
          result.results.imported.push(res.data);
          result.summary.imported++;
        } else if (res.type === 'error') {
          result.results.errors.push(res.data);
          result.summary.errors++;
        }
      }
    }

    // Update playlist stats
    await prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        totalSongs: songs.length,
        newSongs: result.summary.imported,
        duplicateSongs: result.summary.skipped
      }
    });

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
  batchName: string;
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({
      multiples: false,
      maxFileSize: 5 * 1024 * 1024, // 5MB limit
    });

    form.parse(req, async (err, fields, files) => {
      if (err) {
        // Handle file size limit error
        if ((err as any).code === 'LIMIT_FILE_SIZE' || err.message?.includes('maxFileSize')) {
          return reject(new Error('File too large. Maximum size is 5MB.'));
        }
        return reject(err);
      }

      const file = Array.isArray(files.file) ? files.file[0] : files.file;

      if (!file) {
        return resolve({ file: null, songs: [], batchName: 'Unknown Upload' });
      }

      // Extract batch name from filename (remove .csv extension)
      const batchName = (file.originalFilename || 'Unknown Upload')
        .replace(/\.csv$/i, '')
        .trim();

      try {
        const songs = await parseCSV(file.filepath);
        resolve({ file, songs, batchName });
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
        const title = row.Title || row.title || row.TITLE || row.Name || row.name || row.Song || row.song || row.SONG;
        const isrc = row.ISRC || row.isrc;
        const bpmValue = row.BPM || row.bpm;
        let bpm = bpmValue ? parseInt(bpmValue, 10) : undefined;
        // Normalize BPM to 50-170 range (Raina platform requirement)
        if (bpm) {
          if (bpm < 50) bpm = bpm * 2;
          if (bpm > 170) bpm = Math.floor(bpm / 2);
        }
        const spotifyTrackId = row['Spotify Track Id'] || row['Spotify Track ID'] || row.spotify_track_id || row.spotifyTrackId;
        const s3Url = row.s3_url || row.S3_URL || row['S3 URL'] || row.source_file || row.SOURCE_FILE || row['Source File'];
        const artworkUrl = row.artwork_url || row.ARTWORK_URL || row['Artwork URL'] || row.artwork || row.ARTWORK || row.Artwork;
        const spotifyPreviewUrl = row.spotify_preview_url || row['Spotify Preview URL'] || row.spotifyPreviewUrl;
        const spotifyArtworkUrl = row.spotify_artwork_url || row['Spotify Artwork URL'] || row.spotifyArtworkUrl;

        if (artist && title) {
          songs.push({
            artist,
            title,
            isrc,
            bpm,
            spotifyTrackId,
            s3Url,
            artworkUrl,
            spotifyPreviewUrl,
            spotifyArtworkUrl
          });
        }
      })
      .on('end', () => resolve(songs))
      .on('error', reject);
  });
}

/**
 * Enrich a song with AI classification and save to database
 */
async function enrichAndSaveSong(song: ParsedSong, uploadBatchId: string, uploadBatchName: string, playlistId: string) {
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
    s3Url: song.s3Url || null,
    // Populate 'artwork' field (used by frontend) from Spotify artwork or CSV artwork
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
    // Parallel AI results
    aiExplicit: explicitResult?.classification || null,
    // Status
    aiStatus: geminiResult?.status === 'SUCCESS' ? 'SUCCESS' : 'ERROR',
    aiErrorMessage: geminiResult?.error_message || null,
    // Upload tracking
    uploadBatchId,
    uploadBatchName,
    reviewed: false
  };

  // Save to database
  const savedSong = await prisma.song.upsert({
    where: { isrc: enrichedSong.isrc },
    update: enrichedSong,
    create: enrichedSong
  });

  // Create playlist association
  await prisma.playlistSong.create({
    data: {
      playlistId: playlistId,
      songIsrc: savedSong.isrc,
      wasNew: true
    }
  });

  return savedSong;
}
