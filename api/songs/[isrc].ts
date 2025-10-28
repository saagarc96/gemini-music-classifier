/**
 * PATCH /api/songs/:isrc
 *
 * Updates a song's classification using Prisma.
 * Allows curators to edit AI-generated classifications.
 *
 * Body Parameters (all optional except those marked required):
 *   - ai_energy: Energy level (required)
 *   - ai_accessibility: Accessibility type (required)
 *   - ai_subgenre_1: Primary subgenre (required)
 *   - ai_subgenre_2: Secondary subgenre (optional)
 *   - ai_subgenre_3: Tertiary subgenre (optional)
 *   - curator_notes: Curator's notes (optional)
 *
 * Response:
 *   { success: true, song: Song }
 */

import { PrismaClient } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const prisma = new PrismaClient();

// Valid enum values
const VALID_ENERGY = ['Very Low', 'Low', 'Medium', 'High', 'Very High'];
const VALID_ACCESSIBILITY = ['Eclectic', 'Timeless', 'Commercial', 'Cheesy'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow PATCH requests
  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isrc = req.query.isrc as string;

  if (!isrc) {
    return res.status(400).json({ error: 'ISRC is required' });
  }

  try {
    const payload = req.body;

    // Validate required fields
    if (!payload.ai_energy || !payload.ai_accessibility || !payload.ai_subgenre_1) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'ai_energy, ai_accessibility, and ai_subgenre_1 are required',
      });
    }

    // Validate energy value
    if (!VALID_ENERGY.includes(payload.ai_energy)) {
      return res.status(400).json({
        error: 'Invalid energy value',
        message: `Must be one of: ${VALID_ENERGY.join(', ')}`,
      });
    }

    // Validate accessibility value
    if (!VALID_ACCESSIBILITY.includes(payload.ai_accessibility)) {
      return res.status(400).json({
        error: 'Invalid accessibility value',
        message: `Must be one of: ${VALID_ACCESSIBILITY.join(', ')}`,
      });
    }

    // Update song using Prisma
    const updatedSong = await prisma.song.update({
      where: { isrc },
      data: {
        aiEnergy: payload.ai_energy,
        aiAccessibility: payload.ai_accessibility,
        aiSubgenre1: payload.ai_subgenre_1,
        aiSubgenre2: payload.ai_subgenre_2 || null,
        aiSubgenre3: payload.ai_subgenre_3 || null,
        curatorNotes: payload.curator_notes || null,
        reviewed: true,
        reviewedAt: new Date(),
        modifiedAt: new Date(),
      },
    });

    // Transform Prisma response to match API interface
    const song = {
      id: updatedSong.id,
      isrc: updatedSong.isrc,
      title: updatedSong.title,
      artist: updatedSong.artist,
      energy: updatedSong.energy,
      bpm: updatedSong.bpm,
      subgenre: updatedSong.subgenre,
      artwork: updatedSong.artwork,
      source_file: updatedSong.sourceFile,
      ai_status: updatedSong.aiStatus,
      ai_error_message: updatedSong.aiErrorMessage,
      ai_reasoning: updatedSong.aiReasoning,
      ai_context_used: updatedSong.aiContextUsed,
      ai_energy: updatedSong.aiEnergy,
      ai_accessibility: updatedSong.aiAccessibility,
      ai_subgenre_1: updatedSong.aiSubgenre1,
      ai_subgenre_2: updatedSong.aiSubgenre2,
      ai_subgenre_3: updatedSong.aiSubgenre3,
      reviewed: updatedSong.reviewed,
      reviewed_by: updatedSong.reviewedBy,
      reviewed_at: updatedSong.reviewedAt?.toISOString() || null,
      curator_notes: updatedSong.curatorNotes,
      created_at: updatedSong.createdAt.toISOString(),
      modified_at: updatedSong.modifiedAt.toISOString(),
    };

    return res.status(200).json({
      success: true,
      data: song,
    });

  } catch (error: any) {
    console.error(`Error updating song ${isrc}:`, error);

    // Handle "record not found" error from Prisma
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Song not found',
        message: `No song found with ISRC: ${isrc}`,
      });
    }

    return res.status(500).json({
      error: 'Failed to update song',
      message: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
}
