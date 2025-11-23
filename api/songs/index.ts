/**
 * GET /api/songs
 *
 * Fetches songs with pagination and filtering support using Prisma.
 *
 * Query Parameters:
 *   - page: Page number (default: 1)
 *   - limit: Songs per page (default: 50, max: 200)
 *   - subgenre: Filter by subgenre (searches aiSubgenre1/2/3)
 *   - status: Filter by aiStatus (SUCCESS, ERROR, etc.)
 *   - reviewStatus: Filter by reviewed (all, reviewed, unreviewed)
 *   - energy: Filter by aiEnergy
 *   - accessibility: Filter by aiAccessibility
 *   - playlistId: Filter by playlist ID
 *   - search: Search by artist, title, or ISRC (case-insensitive partial match)
 *   - sortBy: Field to sort by (createdAt, title, artist, etc.) (default: createdAt)
 *   - sortOrder: Sort direction (asc, desc) (default: desc)
 *
 * Response:
 *   {
 *     data: Song[],
 *     pagination: { page, limit, total, totalPages }
 *   }
 */

import { PrismaClient } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) {
    return; // requireAuth already sent 401 response
  }

  try {
    // Parse query parameters
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
    const offset = (page - 1) * limit;

    const subgenre = req.query.subgenre as string;
    const status = req.query.status as string;
    const reviewStatus = req.query.reviewStatus as string;
    const energy = req.query.energy as string;
    const accessibility = req.query.accessibility as string;
    const explicit = req.query.explicit as string;
    const uploadBatchId = req.query.uploadBatchId as string;
    const playlistId = req.query.playlistId as string;
    const search = req.query.search as string;
    const sortBy = (req.query.sortBy as string) || 'createdAt';
    const sortOrder = (req.query.sortOrder as string) || 'desc';

    // Build Prisma where clause
    const where: any = {};
    const andConditions: any[] = [];

    // Subgenre filter (searches across all 3 subgenre columns with case-insensitive matching)
    if (subgenre && subgenre !== 'all') {
      andConditions.push({
        OR: [
          { aiSubgenre1: { equals: subgenre, mode: 'insensitive' } },
          { aiSubgenre2: { equals: subgenre, mode: 'insensitive' } },
          { aiSubgenre3: { equals: subgenre, mode: 'insensitive' } },
        ]
      });
    }

    // Search filter (searches artist, title, and ISRC with AND logic)
    if (search && search.trim()) {
      const searchTerms = search.trim().split(/\s+/); // Split by whitespace

      // Each search term must match in at least one field (artist, title, or ISRC)
      searchTerms.forEach(term => {
        andConditions.push({
          OR: [
            { artist: { contains: term, mode: 'insensitive' } },
            { title: { contains: term, mode: 'insensitive' } },
            { isrc: { contains: term, mode: 'insensitive' } },
          ]
        });
      });
    }

    // Status filter
    if (status && status !== 'all') {
      where.aiStatus = status;
    }

    // Review status filter
    if (reviewStatus && reviewStatus !== 'all') {
      if (reviewStatus === 'reviewed') {
        where.reviewed = true;
      } else if (reviewStatus === 'unreviewed') {
        where.reviewed = false;
      }
    }

    // Energy filter
    if (energy && energy !== 'all') {
      where.aiEnergy = energy;
    }

    // Accessibility filter
    if (accessibility && accessibility !== 'all') {
      where.aiAccessibility = accessibility;
    }

    // Explicit content filter
    if (explicit && explicit !== 'all') {
      where.aiExplicit = explicit;
    }

    // Upload batch filter
    if (uploadBatchId && uploadBatchId !== 'all') {
      where.uploadBatchId = uploadBatchId;
    }

    // Playlist filter (filter by songs that belong to a specific playlist)
    if (playlistId && playlistId !== 'all') {
      where.playlists = {
        some: {
          playlistId: playlistId
        }
      };
    }

    // Combine AND conditions if any exist
    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    // Get total count for pagination
    const total = await prisma.song.count({ where });
    const totalPages = Math.ceil(total / limit);

    // Validate and map sortBy field to Prisma field name
    const fieldMapping: Record<string, string> = {
      createdAt: 'createdAt',
      title: 'title',
      artist: 'artist',
      energy: 'aiEnergy',
      accessibility: 'aiAccessibility',
    };

    const prismaField = fieldMapping[sortBy] || 'createdAt';
    const prismaOrder = sortOrder === 'asc' ? 'asc' : 'desc';

    // Get paginated songs with dynamic sorting
    const songs = await prisma.song.findMany({
      where,
      orderBy: { [prismaField]: prismaOrder },
      skip: offset,
      take: limit,
    });

    // Transform Prisma response to match API interface
    // (Prisma uses camelCase, API uses snake_case for some fields)
    const data = songs.map(song => ({
      id: song.id,
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      energy: song.energy,
      bpm: song.bpm,
      subgenre: song.subgenre,
      artwork: song.artworkUrl || song.artwork,
      source_file: song.s3Url || song.sourceFile,
      spotify_track_id: song.spotifyTrackId,
      spotify_preview_url: song.spotifyPreviewUrl,
      spotify_artwork_url: song.spotifyArtworkUrl,
      ai_status: song.aiStatus,
      ai_error_message: song.aiErrorMessage,
      ai_reasoning: song.aiReasoning,
      ai_context_used: song.aiContextUsed,
      ai_energy: song.aiEnergy,
      ai_accessibility: song.aiAccessibility,
      ai_explicit: song.aiExplicit,
      ai_subgenre_1: song.aiSubgenre1,
      ai_subgenre_2: song.aiSubgenre2,
      ai_subgenre_3: song.aiSubgenre3,
      reviewed: song.reviewed,
      reviewed_by: song.reviewedBy,
      reviewed_at: song.reviewedAt?.toISOString() || null,
      curator_notes: song.curatorNotes,
      created_at: song.createdAt.toISOString(),
      modified_at: song.modifiedAt.toISOString(),
    }));

    // Return response
    return res.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });

  } catch (error: any) {
    console.error('Error fetching songs:', error);
    return res.status(500).json({
      error: 'Failed to fetch songs',
      message: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
}
