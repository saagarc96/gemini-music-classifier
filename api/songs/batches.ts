/**
 * GET /api/songs/batches
 *
 * Fetches all upload batches with aggregated metadata using Prisma.
 *
 * Response:
 *   {
 *     batches: [
 *       {
 *         uploadBatchId: string,
 *         uploadBatchName: string,
 *         uploadDate: string,
 *         totalSongs: number,
 *         reviewedSongs: number,
 *         unreviewedSongs: number
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
    // Get all unique batches with aggregated data
    const batches = await prisma.song.groupBy({
      by: ['uploadBatchId', 'uploadBatchName'],
      where: {
        uploadBatchId: { not: null }
      },
      _count: {
        id: true
      },
      _max: {
        createdAt: true
      }
    });

    // For each batch, get reviewed counts
    const batchesWithCounts = await Promise.all(
      batches.map(async (batch) => {
        const reviewedCount = await prisma.song.count({
          where: {
            uploadBatchId: batch.uploadBatchId,
            reviewed: true
          }
        });

        return {
          uploadBatchId: batch.uploadBatchId,
          uploadBatchName: batch.uploadBatchName || 'Unknown Upload',
          uploadDate: batch._max.createdAt,
          totalSongs: batch._count.id,
          reviewedSongs: reviewedCount,
          unreviewedSongs: batch._count.id - reviewedCount
        };
      })
    );

    // Sort by most recent first
    batchesWithCounts.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );

    return res.status(200).json({ batches: batchesWithCounts });

  } catch (error: any) {
    console.error('Error fetching batches:', error);
    return res.status(500).json({
      error: 'Failed to fetch batches',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
