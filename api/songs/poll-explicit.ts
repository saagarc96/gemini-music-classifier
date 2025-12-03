import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { pollExplicitResult } from '../../src/classifiers/explicit-classifier.cjs';

const prisma = new PrismaClient();

interface PollInput {
  runId: string;
  isrc: string;
  artist: string;
  title: string;
}

interface ExplicitResult {
  isrc: string;
  classification: string | null;
  status: 'success' | 'error';
  error?: string;
}

interface PollExplicitRequest {
  submissions: PollInput[];
}

interface PollExplicitResponse {
  polled: number;
  successful: number;
  results: ExplicitResult[];
}

/**
 * POST /api/songs/poll-explicit
 *
 * Poll explicit content detection results and update database.
 * Called after all Gemini processing is complete.
 *
 * Request body:
 * {
 *   submissions: Array<{ runId, isrc, artist, title }>
 * }
 *
 * Response:
 * {
 *   polled: number,
 *   successful: number,
 *   results: Array<{ isrc, classification, status, error? }>
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { submissions } = req.body as PollExplicitRequest;

    if (!submissions || submissions.length === 0) {
      return res.status(400).json({
        error: 'Missing required field: submissions'
      });
    }

    console.log(`[PollExplicit] Polling ${submissions.length} explicit results...`);

    // Poll all explicit results in parallel
    const results = await Promise.all(
      submissions.map(async (submission): Promise<ExplicitResult> => {
        if (!submission.runId) {
          return {
            isrc: submission.isrc,
            classification: null,
            status: 'error',
            error: 'No runId provided'
          };
        }

        try {
          const result = await pollExplicitResult(
            submission.runId,
            submission.artist,
            submission.title
          );

          // Update DB with explicit classification
          if (result.classification && submission.isrc) {
            await prisma.song.update({
              where: { isrc: submission.isrc },
              data: { aiExplicit: result.classification }
            });
          }

          return {
            isrc: submission.isrc,
            classification: result.classification,
            status: 'success'
          };
        } catch (error: any) {
          console.error(`[PollExplicit] Error for ${submission.artist} - ${submission.title}:`, error.message);
          return {
            isrc: submission.isrc,
            classification: null,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    const successCount = results.filter(r => r.status === 'success').length;
    console.log(`[PollExplicit] Complete: ${successCount}/${submissions.length} successful`);

    const response: PollExplicitResponse = {
      polled: submissions.length,
      successful: successCount,
      results
    };

    return res.status(200).json(response);

  } catch (error: any) {
    console.error('[PollExplicit] Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
