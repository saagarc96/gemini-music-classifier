/**
 * Batch Processing Helper for Explicit Content Classification
 *
 * Enables parallel processing of multiple songs with concurrency control
 * Adapted from music-energy-tagger/src/explicitBatch.js
 */

const { classifyExplicitContent } = require('./explicit-classifier');

/**
 * Process a batch of songs for explicit content in parallel
 * @param {Array} songs - Array of {artist, title, isrc} objects
 * @param {Object} options - Processing options
 * @param {number} options.concurrency - Max concurrent API calls (default: 10)
 * @param {function} options.onProgress - Progress callback(current, total)
 * @returns {Promise<Array>} Array of classification results
 */
async function classifyExplicitBatch(songs, options = {}) {
  const concurrency = options.concurrency || 10;
  const onProgress = options.onProgress || (() => {});
  const results = [];

  console.log(`[Explicit Batch] Processing ${songs.length} songs with concurrency: ${concurrency}`);

  // Process in batches to respect concurrency limit
  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(songs.length / concurrency);

    console.log(`[Explicit Batch] Processing batch ${batchNumber}/${totalBatches} (${batch.length} songs)`);

    // Process batch in parallel
    const batchResults = await Promise.all(
      batch.map(async (song) => {
        try {
          const result = await classifyExplicitContent(song.artist, song.title);
          return {
            ...song,
            ...result,
            status: 'success'
          };
        } catch (error) {
          console.error(`[Explicit Batch] Failed for ${song.artist} - ${song.title}:`, error.message);
          return {
            ...song,
            classification: 'Unknown',
            first_example: '',
            error_details: error.message,
            status: 'error'
          };
        }
      })
    );

    results.push(...batchResults);

    // Report progress
    const processed = Math.min(i + concurrency, songs.length);
    onProgress(processed, songs.length);
    console.log(`[Explicit Batch] Progress: ${processed}/${songs.length}`);

    // Brief pause between batches to be API-friendly
    if (i + concurrency < songs.length) {
      await sleep(1000);
    }
  }

  const success = results.filter(r => r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`[Explicit Batch] Complete! Success: ${success}, Errors: ${errors}`);

  return results;
}

/**
 * Process songs with advanced batch control (submit all, then poll all)
 * More efficient for large batches
 */
async function classifyExplicitBatchAdvanced(songs, options = {}) {
  const concurrency = options.concurrency || 20;
  const onProgress = options.onProgress || (() => {});

  console.log(`[Explicit Batch Advanced] Processing ${songs.length} songs`);

  // Phase 1: Submit all tasks in parallel with concurrency control
  console.log('[Explicit Batch Advanced] Phase 1: Submitting tasks...');
  const submissions = await submitTasksBatch(songs, concurrency);

  // Phase 2: Poll all results in parallel
  console.log('[Explicit Batch Advanced] Phase 2: Polling for results...');
  const results = await pollBatchResults(submissions, onProgress);

  const success = results.filter(r => r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error').length;

  console.log(`[Explicit Batch Advanced] Complete! Success: ${success}, Errors: ${errors}`);

  return results;
}

/**
 * Submit all tasks in batches
 */
async function submitTasksBatch(songs, concurrency) {
  const submissions = [];

  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);

    const batchSubmissions = await Promise.all(
      batch.map(async (song) => {
        try {
          // Import submit function directly from classifier
          const axios = require('axios');
          const PARALLEL_AI_ENDPOINT = process.env.PARALLEL_AI_ENDPOINT || 'https://api.parallel.ai/v1/tasks/runs';
          const PARALLEL_AI_API_KEY = process.env.PARALLEL_AI_API_KEY;

          const requestBody = {
            input: `Analyze the song '${song.title}' by ${song.artist} for explicit content`,
            processor: "lite",
            task_spec: {
              output_schema: {
                json_schema: {
                  additionalProperties: false,
                  properties: {
                    explicit: { type: "boolean", description: "..." },
                    suggestive: { type: "boolean", description: "..." },
                    family_friendly: { type: "boolean", description: "..." },
                    first_example: { type: "string", description: "..." }
                  },
                  required: ["explicit", "suggestive", "family_friendly", "first_example"],
                  type: "object"
                },
                type: "json"
              }
            }
          };

          const response = await axios.post(PARALLEL_AI_ENDPOINT, requestBody, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PARALLEL_AI_API_KEY
            }
          });

          if (!response.data.run_id) {
            throw new Error('No run_id returned');
          }

          return {
            song,
            runId: response.data.run_id,
            status: 'submitted'
          };
        } catch (error) {
          return {
            song,
            runId: null,
            status: 'error',
            error: error.message
          };
        }
      })
    );

    submissions.push(...batchSubmissions);
    console.log(`[Submit] Progress: ${submissions.length}/${songs.length}`);
  }

  return submissions;
}

/**
 * Poll all submitted tasks for results
 */
async function pollBatchResults(submissions, onProgress) {
  // Filter out failed submissions
  const validSubmissions = submissions.filter(sub => sub.status === 'submitted');
  const results = new Array(submissions.length).fill(null);

  const timeout = 60000; // 60 seconds
  const pollInterval = 2000; // 2 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    // Get incomplete tasks
    const incomplete = validSubmissions.filter((sub, idx) => {
      const originalIndex = submissions.indexOf(sub);
      return results[originalIndex] === null;
    });

    if (incomplete.length === 0) {
      console.log('[Poll] All tasks completed');
      break;
    }

    console.log(`[Poll] Checking ${incomplete.length} incomplete tasks`);

    // Poll incomplete tasks in parallel
    await Promise.all(
      incomplete.map(async (submission) => {
        const originalIndex = submissions.indexOf(submission);

        try {
          const axios = require('axios');
          const PARALLEL_AI_ENDPOINT = process.env.PARALLEL_AI_ENDPOINT || 'https://api.parallel.ai/v1/tasks/runs';
          const PARALLEL_AI_API_KEY = process.env.PARALLEL_AI_API_KEY;

          const response = await axios.get(`${PARALLEL_AI_ENDPOINT}/${submission.runId}/result`, {
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': PARALLEL_AI_API_KEY
            }
          });

          const resultData = response.data;

          if (resultData.run && resultData.run.status === 'completed' && resultData.output && resultData.output.content) {
            const content = resultData.output.content;

            // Process to single classification
            let classification;
            if (content.explicit === true) {
              classification = "Explicit";
            } else if (content.suggestive === true) {
              classification = "Suggestive";
            } else {
              classification = "Family Friendly";
            }

            results[originalIndex] = {
              ...submission.song,
              classification,
              first_example: content.first_example || "",
              status: 'success'
            };
          } else if (resultData.run && resultData.run.status === 'failed') {
            results[originalIndex] = {
              ...submission.song,
              classification: 'Unknown',
              first_example: '',
              error_details: resultData.run.status_message || 'Task failed',
              status: 'error'
            };
          }
          // If still running, leave as null to poll again

        } catch (error) {
          // Ignore 404s (task not ready yet)
          if (error.response && error.response.status !== 404) {
            results[originalIndex] = {
              ...submission.song,
              classification: 'Unknown',
              first_example: '',
              error_details: error.message,
              status: 'error'
            };
          }
        }
      })
    );

    // Report progress
    const completed = results.filter(r => r !== null).length;
    onProgress(completed, submissions.length);

    await sleep(pollInterval);
  }

  // Handle timeouts
  results.forEach((result, index) => {
    if (result === null) {
      const submission = submissions[index];
      results[index] = {
        ...submission.song,
        classification: 'Unknown',
        first_example: '',
        error_details: 'Timeout waiting for result',
        status: 'error'
      };
    }
  });

  return results;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  classifyExplicitBatch,
  classifyExplicitBatchAdvanced
};
