import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../lib/auth.js';

const prisma = new PrismaClient();

/**
 * GET /api/songs/upload-status
 *
 * Get the status of an upload batch by batchId
 *
 * Query params:
 * - batchId: The upload batch ID to check
 *
 * Response:
 * {
 *   batchId: string,
 *   playlistId: string,
 *   playlistName: string,
 *   total: number,
 *   processed: number,
 *   complete: boolean,
 *   newSongs: number,
 *   duplicateSongs: number
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Require authentication
  const user = await requireAuth(req, res);
  if (!user) {
    return; // requireAuth already sent 401 response
  }

  const { batchId } = req.query;

  if (!batchId || typeof batchId !== 'string') {
    return res.status(400).json({ error: 'batchId is required' });
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(batchId)) {
    return res.status(400).json({ error: 'Invalid batchId format' });
  }

  try {
    // Find the playlist by uploadBatchId
    const playlist = await prisma.playlist.findFirst({
      where: { uploadBatchId: batchId }
    });

    if (!playlist) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Count processed songs via PlaylistSong junction table
    const processedCount = await prisma.playlistSong.count({
      where: { playlistId: playlist.id }
    });

    // Determine if processing is complete
    // Note: totalSongs is set at the end of processing, so if it's > 0 and matches processedCount, we're done
    const complete = playlist.totalSongs > 0 && processedCount >= playlist.totalSongs;

    return res.status(200).json({
      batchId,
      playlistId: playlist.id,
      playlistName: playlist.name,
      total: playlist.totalSongs,
      processed: processedCount,
      complete,
      newSongs: playlist.newSongs,
      duplicateSongs: playlist.duplicateSongs
    });

  } catch (error: any) {
    console.error('Error getting upload status:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
