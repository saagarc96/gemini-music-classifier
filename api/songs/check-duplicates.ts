import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { calculateSongSimilarity, areSongsDuplicate } from '../../src/utils/fuzzy-matcher.cjs';

const prisma = new PrismaClient();

/**
 * POST /api/songs/check-duplicates
 *
 * Check if a song is a potential duplicate of existing songs in the database
 *
 * Request body:
 * {
 *   artist: string,
 *   title: string,
 *   isrc?: string
 * }
 *
 * Response:
 * {
 *   exactMatch: Song | null,           // ISRC exact match
 *   fuzzyMatches: Array<{              // Artist+title fuzzy matches
 *     song: Song,
 *     similarity: number,
 *     matchType: 'fuzzy'
 *   }>,
 *   matchType: 'exact' | 'fuzzy' | 'none'
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { artist, title, isrc } = req.body;

    // Validate required fields
    if (!artist || !title) {
      return res.status(400).json({
        error: 'Missing required fields: artist and title are required'
      });
    }

    // Check for exact ISRC match first
    let exactMatch = null;
    if (isrc) {
      exactMatch = await prisma.song.findUnique({
        where: { isrc }
      });

      if (exactMatch) {
        return res.status(200).json({
          exactMatch,
          fuzzyMatches: [],
          matchType: 'exact'
        });
      }
    }

    // Check for fuzzy artist+title matches
    const fuzzyMatches: Array<{
      song: any;
      similarity: number;
      matchType: 'fuzzy';
    }> = [];

    // Get all songs for comparison (optimize this for large datasets)
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
        aiSubgenre3: true,
        createdAt: true,
        modifiedAt: true
      }
    });

    // Check each song for fuzzy match (70% threshold)
    for (const existingSong of allSongs) {
      const isDuplicate = areSongsDuplicate(
        { artist, title },
        { artist: existingSong.artist || '', title: existingSong.title || '' },
        70 // 70% threshold
      );

      if (isDuplicate) {
        const similarity = calculateSongSimilarity(
          { artist, title },
          { artist: existingSong.artist || '', title: existingSong.title || '' }
        );

        fuzzyMatches.push({
          song: existingSong,
          similarity,
          matchType: 'fuzzy'
        });
      }
    }

    // Sort by similarity (highest first)
    fuzzyMatches.sort((a, b) => b.similarity - a.similarity);

    const matchType = fuzzyMatches.length > 0 ? 'fuzzy' : 'none';

    return res.status(200).json({
      exactMatch: null,
      fuzzyMatches,
      matchType
    });

  } catch (error: any) {
    console.error('Error checking duplicates:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
