/**
 * Shared helpers for batch explicit content processing
 * Used by both enrich-playlist.cjs and enrich-spotify-playlist.cjs
 */

const { submitExplicitTaskAsync, pollExplicitResult } = require('../classifiers/explicit-classifier.cjs');

/**
 * Submit all explicit content analysis tasks in parallel batches (Phase 1)
 *
 * Submits songs to Parallel AI for explicit content analysis without waiting
 * for results. This non-blocking submission allows Gemini classification to
 * proceed in parallel while the API processes results asynchronously.
 *
 * @param {Array<{artist: string, title: string, isrc: string}>} songs - Songs to analyze
 * @param {number} concurrency - Number of concurrent submissions per batch
 * @returns {Promise<Array<{runId?: string, artist: string, title: string, isrc: string, status: 'submitted'|'error', error?: string}>>}
 */
async function submitAllExplicitTasks(songs, concurrency) {
  const submissions = [];

  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);
    const batchSubmissions = await Promise.all(
      batch.map(async (song) => {
        const sub = await submitExplicitTaskAsync(song.artist, song.title);
        return { ...sub, isrc: song.isrc };
      })
    );
    submissions.push(...batchSubmissions);
    console.log(`    Submitted ${Math.min(i + concurrency, songs.length)}/${songs.length}`);
  }

  // Report failures with details
  const failed = submissions.filter(s => s.status === 'error');
  if (failed.length > 0) {
    console.warn(`  \u26A0 ${failed.length} submissions failed:`);
    failed.slice(0, 5).forEach(f =>
      console.warn(`    - ${f.artist} - ${f.title}: ${f.error}`)
    );
    if (failed.length > 5) {
      console.warn(`    ... and ${failed.length - 5} more`);
    }
  }

  return submissions;
}

/**
 * Poll all explicit results and update DB records + results array (Phase 3)
 *
 * Polls Parallel AI for completed results and updates both the database
 * and the results array. Only updates results array if DB update succeeds
 * to ensure CSV export matches database state.
 *
 * @param {Array<{runId?: string, artist: string, title: string, isrc: string, status: string}>} submissions - Submission results from Phase 1
 * @param {Array<{isrc: string, aiExplicit?: string}>} results - Results array to update for CSV export
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client instance
 * @returns {Promise<{updated: number, failed: number}>}
 */
async function pollAndUpdateExplicitResults(submissions, results, prisma) {
  const validSubmissions = submissions.filter(s => s.status === 'submitted');
  if (validSubmissions.length === 0) {
    return { updated: 0, failed: 0 };
  }

  // Poll all in parallel
  const explicitResults = await Promise.all(
    validSubmissions.map(sub => pollExplicitResult(sub.runId, sub.artist, sub.title))
  );

  let updated = 0;
  let failed = 0;

  for (let i = 0; i < validSubmissions.length; i++) {
    const sub = validSubmissions[i];
    const explicitResult = explicitResults[i];

    try {
      await prisma.song.update({
        where: { isrc: sub.isrc },
        data: { aiExplicit: explicitResult.classification }
      });
      updated++;

      // Only update results array if DB update succeeded
      const resultEntry = results.find(r => r.isrc === sub.isrc);
      if (resultEntry) {
        resultEntry.aiExplicit = explicitResult.classification;
      } else {
        console.error(`    Warning: Could not find result entry for ISRC ${sub.isrc} (${sub.artist} - ${sub.title})`);
      }
    } catch (error) {
      console.error(`    Failed to update ${sub.artist} - ${sub.title}: ${error.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.warn(`  \u26A0 ${failed} DB updates failed - CSV may not match database for those songs`);
  }

  return { updated, failed };
}

module.exports = {
  submitAllExplicitTasks,
  pollAndUpdateExplicitResults
};
