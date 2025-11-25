/**
 * GET /api/songs/export
 *
 * Exports songs to CSV format with optional filtering and configuration.
 * By default, exports all non-REJECTED songs (soft approve model).
 *
 * Query Parameters:
 *   - subgenre: Filter by subgenre (searches aiSubgenre1/2/3)
 *   - status: Filter by aiStatus (SUCCESS, ERROR, etc.)
 *   - reviewStatus: Filter by reviewed (all, reviewed, unreviewed)
 *   - approvalStatus: Filter by approval status (default: non-REJECTED songs)
 *   - includeAll: Set to 'true' to export all songs including REJECTED
 *   - energy: Filter by aiEnergy
 *   - accessibility: Filter by aiAccessibility
 *   - explicit: Filter by aiExplicit
 *   - playlistName: Optional playlist name to prepend to subgenres
 *   - includeAccessibility: Include ACCESSIBILITY column (default: true)
 *   - includeExplicit: Include EXPLICIT column (default: true)
 *   - preview: Return only first 5 rows for preview (default: false)
 *
 * Response:
 *   - Content-Type: text/csv
 *   - CSV file download
 */

import { PrismaClient } from '@prisma/client';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../lib/auth.js';
import {
  exportSongsToCSV,
  generateExportFilename,
  type ExportOptions,
  type SongExportData,
} from '../lib/csv-exporter.js';

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
    // Parse filter parameters (same as GET /api/songs)
    const subgenre = req.query.subgenre as string;
    const status = req.query.status as string;
    const reviewStatus = req.query.reviewStatus as string;
    const approvalStatus = req.query.approvalStatus as string;
    const energy = req.query.energy as string;
    const accessibility = req.query.accessibility as string;
    const explicit = req.query.explicit as string;

    // Parse export-specific parameters
    const playlistName = req.query.playlistName as string;
    const includeAccessibility = req.query.includeAccessibility !== 'false'; // Default: true
    const includeExplicit = req.query.includeExplicit !== 'false'; // Default: true
    const includeAll = req.query.includeAll === 'true'; // Default: false (only approved)
    const preview = req.query.preview === 'true'; // Default: false
    const isrcs = req.query.isrcs as string; // Comma-separated list of ISRCs

    // Build Prisma where clause (same logic as GET /api/songs)
    const where: any = {};

    // If ISRCs are provided, only export those specific songs
    if (isrcs && isrcs.trim()) {
      const isrcList = isrcs.split(',').map(i => i.trim()).filter(i => i);
      if (isrcList.length > 0) {
        where.isrc = { in: isrcList };
        // When exporting specific ISRCs, ignore other filters
        // Return early to avoid adding other filter conditions
        const songs = await prisma.song.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          ...(preview ? { take: 5 } : {}),
          select: {
            artist: true,
            title: true,
            aiEnergy: true,
            bpm: true,
            aiSubgenre1: true,
            aiSubgenre2: true,
            aiSubgenre3: true,
            isrc: true,
            aiAccessibility: true,
            aiExplicit: true,
          },
        });

        const exportData: SongExportData[] = songs.map((song) => ({
          artist: song.artist,
          title: song.title,
          aiEnergy: song.aiEnergy,
          bpm: song.bpm,
          aiSubgenre1: song.aiSubgenre1,
          aiSubgenre2: song.aiSubgenre2,
          aiSubgenre3: song.aiSubgenre3,
          isrc: song.isrc,
          aiAccessibility: song.aiAccessibility,
          aiExplicit: song.aiExplicit,
        }));

        const exportOptions: ExportOptions = {
          playlistName,
          includeAccessibility,
          includeExplicit,
        };

        const csv = exportSongsToCSV(exportData, exportOptions);

        if (preview) {
          return res.status(200).json({
            preview: csv.split('\n').slice(0, 6),
            totalSongs: exportData.length,
            exportOptions,
          });
        }

        const filename = generateExportFilename(playlistName);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Cache-Control', 'no-cache');
        return res.status(200).send(csv);
      }
    }

    // Subgenre filter (searches across all 3 subgenre columns)
    if (subgenre && subgenre !== 'all') {
      where.OR = [
        { aiSubgenre1: subgenre },
        { aiSubgenre2: subgenre },
        { aiSubgenre3: subgenre },
      ];
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

    // Approval status filter (defaults to non-REJECTED unless includeAll is true)
    if (!includeAll) {
      if (approvalStatus && approvalStatus !== 'all') {
        if (approvalStatus === 'active') {
          // Active = all non-rejected songs
          where.approvalStatus = { not: 'REJECTED' };
        } else {
          // Use explicit filter if provided
          where.approvalStatus = approvalStatus.toUpperCase();
        }
      } else {
        // Default: export all non-rejected songs (soft approve model)
        where.approvalStatus = { not: 'REJECTED' };
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

    // Fetch all matching songs (no pagination for export)
    const songs = await prisma.song.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      // Limit to 5 for preview mode
      ...(preview ? { take: 5 } : {}),
      // Select only fields needed for export
      select: {
        artist: true,
        title: true,
        aiEnergy: true,
        bpm: true,
        aiSubgenre1: true,
        aiSubgenre2: true,
        aiSubgenre3: true,
        isrc: true,
        aiAccessibility: true,
        aiExplicit: true,
      },
    });

    // Transform to export format
    const exportData: SongExportData[] = songs.map((song) => ({
      artist: song.artist,
      title: song.title,
      aiEnergy: song.aiEnergy,
      bpm: song.bpm,
      aiSubgenre1: song.aiSubgenre1,
      aiSubgenre2: song.aiSubgenre2,
      aiSubgenre3: song.aiSubgenre3,
      isrc: song.isrc,
      aiAccessibility: song.aiAccessibility,
      aiExplicit: song.aiExplicit,
    }));

    // Build export options
    const exportOptions: ExportOptions = {
      playlistName,
      includeAccessibility,
      includeExplicit,
    };

    // Generate CSV
    const csv = exportSongsToCSV(exportData, exportOptions);

    // If preview mode, return JSON instead of CSV download
    if (preview) {
      return res.status(200).json({
        preview: csv.split('\n').slice(0, 6), // Return first 6 lines (header + 5 rows)
        totalSongs: exportData.length,
        exportOptions,
      });
    }

    // Generate filename
    const filename = generateExportFilename(playlistName);

    // Set headers for CSV download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'no-cache');

    // Return CSV
    return res.status(200).send(csv);

  } catch (error: any) {
    console.error('Error exporting songs:', error);
    return res.status(500).json({
      error: 'Failed to export songs',
      message: error.message,
    });
  } finally {
    await prisma.$disconnect();
  }
}
