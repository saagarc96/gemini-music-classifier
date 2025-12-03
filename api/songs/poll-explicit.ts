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

    // Process poll requests in batches to avoid overwhelming DB connection pool
    const POLL_BATCH_SIZE = 20;
    const results: ExplicitResult[] = [];

    for (let i = 0; i < submissions.length; i += POLL_BATCH_SIZE) {
      const batch = submissions.slice(i, i + POLL_BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async (submission): Promise<ExplicitResult> => {
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
            // Skip if classification is null (API returned no result) - preserves any existing value
            if (result.classification && submission.isrc) {
              try {
                await prisma.song.update({
                  where: { isrc: submission.isrc },
                  data: { aiExplicit: result.classification }
                });
              } catch (dbError: any) {
                console.error(`[PollExplicit] DB update failed for ${submission.isrc}:`, dbError.message);
                return {
                  isrc: submission.isrc,
                  classification: result.classification,
                  status: 'error',
                  error: `DB update failed: ${dbError.message}`
                };
              }
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

      results.push(...batchResults);
    }

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
