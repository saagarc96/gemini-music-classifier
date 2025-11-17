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

    // Fetch Spotify track data for songs with Spotify Track IDs
    const spotifyTrackIds = songs
      .map(s => s.spotifyTrackId)
      .filter((id): id is string => !!id);

    const spotifyData = await fetchSpotifyTrackData(spotifyTrackIds);

    // Merge Spotify data into songs
    songs.forEach(song => {
      if (song.spotifyTrackId && spotifyData.has(song.spotifyTrackId)) {
        const data = spotifyData.get(song.spotifyTrackId)!;
        // Only set if not already present in CSV
        if (!song.spotifyPreviewUrl) {
          song.spotifyPreviewUrl = data.previewUrl || undefined;
        }
        if (!song.spotifyArtworkUrl) {
          song.spotifyArtworkUrl = data.artworkUrl || undefined;
        }
      }
    });

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

    // Process songs in parallel (concurrency: 10)
    const CONCURRENCY = 10;
    const processSong = async (song: ParsedSong) => {
      try {
        // Check for duplicates
        const duplicate = await findDuplicate(song);

        if (duplicate) {
          if (duplicate.matchType === 'exact') {
            // Exact ISRC match - block
            return {
              type: 'blocked',
              data: {
                song,
                reason: 'Exact ISRC match',
                existingIsrc: duplicate.song.isrc
              }
            };
          } else {
            // Fuzzy match - flag for review
            return {
              type: 'duplicate',
              data: {
                newSong: song,
                existingSong: duplicate.song,
                similarity: duplicate.similarity
              }
            };
          }
        }

        // No duplicate - enrich and save
        const enrichedSong = await enrichAndSaveSong(song, uploadBatchId, batchName);
        return {
          type: 'successful',
          data: enrichedSong
        };

      } catch (error: any) {
        return {
          type: 'error',
          data: {
            song,
            error: error.message
          }
        };
      }
    };

    // Process in batches of CONCURRENCY
    for (let i = 0; i < songs.length; i += CONCURRENCY) {
      const batch = songs.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(processSong));

      // Categorize results
      for (const res of results) {
        if (res.type === 'successful') {
          result.results.successful.push(res.data);
          result.summary.successful++;
        } else if (res.type === 'duplicate') {
          result.results.duplicates.push(res.data);
          result.summary.duplicates++;
        } else if (res.type === 'blocked') {
          result.results.blocked.push(res.data);
          result.summary.blocked++;
        } else if (res.type === 'error') {
          result.results.errors.push(res.data);
          result.summary.errors++;
        }
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
  batchName: string;
}> {
  return new Promise((resolve, reject) => {
    const form = formidable({ multiples: false });

    form.parse(req, async (err, fields, files) => {
      if (err) {
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
async function enrichAndSaveSong(song: ParsedSong, uploadBatchId: string, uploadBatchName: string) {
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

  return savedSong;
}
