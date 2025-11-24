/**
 * GET /api/playlists
 *
 * Fetches all playlists sorted by upload date (most recent first).
 * Returns simplified playlist data for dropdown filtering.
 *
 * Response:
 *   {
 *     playlists: [
 *       {
 *         id: string,
 *         name: string,
 *         uploadedAt: string,
 *         uploadedByName: string | null,
 *         totalSongs: number,
 *         newSongs: number,
 *         duplicateSongs: number
 *       }
 *     ]
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
    // Fetch all playlists
    const playlists = await prisma.playlist.findMany({
      orderBy: {
        uploadedAt: 'desc' // Most recent first
      },
      select: {
        id: true,
        name: true,
        uploadedAt: true,
        uploadedByName: true,
        totalSongs: true,
        newSongs: true,
        duplicateSongs: true
      }
    });

    return res.status(200).json({ playlists });

  } catch (error: any) {
    console.error('Error fetching playlists:', error);
    return res.status(500).json({
      error: 'Failed to fetch playlists',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
