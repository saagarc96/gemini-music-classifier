import { VercelRequest, VercelResponse } from '@vercel/node';
import { submitExplicitTaskAsync } from '../../src/classifiers/explicit-classifier.cjs';

interface SongInput {
  artist: string;
  title: string;
}

interface ExplicitSubmission {
  index: number;
  runId: string | null;
  artist: string;
  title: string;
  status: 'submitted' | 'error';
  error?: string;
}

interface SubmitExplicitRequest {
  songs: SongInput[];
}

interface SubmitExplicitResponse {
  submitted: number;
  total: number;
  submissions: ExplicitSubmission[];
}

/**
 * POST /api/songs/submit-explicit
 *
 * Submit explicit content detection tasks for all songs upfront.
 * Returns runIds for polling later after Gemini processing completes.
 *
 * Request body:
 * {
 *   songs: Array<{ artist, title }>
 * }
 *
 * Response:
 * {
 *   submitted: number,
 *   total: number,
 *   submissions: Array<{ index, runId, artist, title, status, error? }>
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { songs } = req.body as SubmitExplicitRequest;

    if (!songs || songs.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: songs'
      });
    }

    // Validate song objects have required fields
    for (const song of songs) {
      if (!song.artist || typeof song.artist !== 'string' || !song.title || typeof song.title !== 'string') {
        return res.status(400).json({
          error: 'Each song must have artist and title strings'
        });
      }
    }

    console.log(`[SubmitExplicit] Submitting ${songs.length} explicit tasks...`);

    // Submit all explicit tasks in parallel - fire-and-forget pattern for async processing
    const submissions = await Promise.all(
      songs.map(async (song, index): Promise<ExplicitSubmission> => {
        try {
          const result = await submitExplicitTaskAsync(song.artist, song.title);
          return {
            index,
            runId: result.runId || null,
            artist: song.artist,
            title: song.title,
            status: result.status === 'submitted' ? 'submitted' : 'error',
            error: result.error
          };
        } catch (error: any) {
          return {
            index,
            runId: null,
            artist: song.artist,
            title: song.title,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    const submittedCount = submissions.filter(s => s.status === 'submitted').length;
    console.log(`[SubmitExplicit] Complete: ${submittedCount}/${songs.length} submitted`);

    const response: SubmitExplicitResponse = {
      submitted: submittedCount,
      total: songs.length,
      submissions
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[SubmitExplicit] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}
