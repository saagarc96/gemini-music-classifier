/**
 * Parallel AI Explicit Content Classifier
 *
 * Classifies songs for explicit content using Parallel AI's web search capabilities.
 * Adapted from music-energy-tagger/src/explicit.js
 */

const axios = require('axios');

const PARALLEL_AI_ENDPOINT = process.env.PARALLEL_AI_ENDPOINT || 'https://api.parallel.ai/v1/tasks/runs';
const PARALLEL_AI_API_KEY = process.env.PARALLEL_AI_API_KEY;

if (!PARALLEL_AI_API_KEY) {
  console.warn('Warning: PARALLEL_AI_API_KEY not set in environment');
}

/**
 * Classifies a song for explicit content
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Promise<{classification: string, first_example: string}>}
 */
async function classifyExplicitContent(artist, title) {
  try {
    console.log(`[Explicit] Analyzing: ${artist} - ${title}`);

    // 1. Submit task to Parallel AI
    const runId = await submitExplicitTask(artist, title);

    // 2. Poll for result (2s interval, 60s timeout)
    const result = await pollForResult(runId, artist, title);

    // 3. Process response to single classification
    return processExplicitResponse(result);

  } catch (error) {
    console.error(`[Explicit] Error for ${artist} - ${title}:`, error.message);
    return createExplicitFallback(artist, title, error.message);
  }
}

/**
 * Submits explicit content analysis task to Parallel AI
 */
async function submitExplicitTask(artist, title) {
  const requestBody = buildExplicitPrompt(artist, title);

  try {
    const response = await axios.post(PARALLEL_AI_ENDPOINT, requestBody, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': PARALLEL_AI_API_KEY
      }
    });

    if (response.data.error) {
      throw new Error(`Parallel AI API Error: ${response.data.error.message || JSON.stringify(response.data.error)}`);
    }

    if (!response.data.run_id) {
      throw new Error('No run_id returned from Parallel AI API');
    }

    console.log(`[Explicit] Task submitted for ${artist} - ${title}, run_id: ${response.data.run_id}`);
    return response.data.run_id;

  } catch (error) {
    if (error.response) {
      throw new Error(`API request failed: ${error.response.status} - ${error.response.statusText}`);
    }
    throw error;
  }
}

/**
 * Polls for task completion result
 */
async function pollForResult(runId, artist, title, timeout = 60000) {
  const startTime = Date.now();
  const pollInterval = 2000; // 2 seconds

  while (Date.now() - startTime < timeout) {
    try {
      const response = await axios.get(`${PARALLEL_AI_ENDPOINT}/${runId}/result`, {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': PARALLEL_AI_API_KEY
        }
      });

      const resultData = response.data;

      // Check if completed
      if (resultData.run && resultData.run.status === 'completed' && resultData.output && resultData.output.content) {
        console.log(`[Explicit] Task completed for ${artist} - ${title}`);
        return resultData.output.content;
      }

      // Check if failed
      if (resultData.run && resultData.run.status === 'failed') {
        throw new Error(`Task failed: ${resultData.run.status_message || 'Unknown error'}`);
      }

      // Still running, wait and retry
      await sleep(pollInterval);

    } catch (error) {
      if (error.response && error.response.status === 404) {
        // Task not found yet, keep waiting
        await sleep(pollInterval);
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Timeout waiting for result after ${timeout}ms`);
}

/**
 * Builds the Parallel AI prompt structure (inline schema)
 */
function buildExplicitPrompt(artist, title) {
  return {
    input: `Analyze the song '${title}' by ${artist} for explicit content`,
    processor: "lite",
    task_spec: {
      output_schema: {
        json_schema: {
          additionalProperties: false,
          properties: {
            explicit: {
              description: "Boolean indicating whether the song contains any profanity from the provided list. Set to true if any of the listed explicit words are found in the song's lyrics, regardless of the language in which the song is sung. The check must be conducted in the language the song is sung in, and the same criteria applied.",
              type: "boolean"
            },
            family_friendly: {
              description: "Boolean indicating whether the song is completely family-friendly and suitable for a wide variety of environments. Set to true only if the song contains no explicit language and no suggestive content. If either explicit or suggestive is true, this must be false.",
              type: "boolean"
            },
            first_example: {
              description: "First example of profane language or a mention of profane language within the song. Only fill this if the song is marked explicit.",
              type: "string"
            },
            suggestive: {
              description: "Boolean indicating whether the song contains suggestive content related to violence, sex, alcohol, drugs, or other topics deemed unsafe for children or conservative audiences. This is true even if the song does not contain explicit language but implies such themes through lyrics or context.",
              type: "boolean"
            }
          },
          required: [
            "suggestive",
            "family_friendly",
            "first_example",
            "explicit"
          ],
          type: "object"
        },
        type: "json"
      }
    }
  };
}

/**
 * Processes Parallel AI response into single classification
 */
function processExplicitResponse(contentData) {
  try {
    // Convert boolean flags to single classification string
    if (contentData.explicit === true) {
      return {
        classification: "Explicit",
        first_example: contentData.first_example || ""
      };
    } else if (contentData.suggestive === true) {
      return {
        classification: "Suggestive",
        first_example: ""
      };
    } else {
      return {
        classification: "Family Friendly",
        first_example: ""
      };
    }
  } catch (error) {
    console.error('[Explicit] Failed to process response:', error);
    throw new Error(`Response processing failed: ${error.message}`);
  }
}

/**
 * Creates fallback result on error
 */
function createExplicitFallback(artist, title, errorMessage) {
  console.warn(`[Explicit] Creating fallback for ${artist} - ${title} due to: ${errorMessage}`);

  return {
    classification: "Unknown",
    first_example: "",
    error_details: errorMessage
  };
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  classifyExplicitContent
};
