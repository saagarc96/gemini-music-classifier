/**
 * Gemini Standard API Classifier
 *
 * Classifies songs for energy, accessibility, and subgenres using Gemini's standard API
 * Replaces the batch API approach with real-time classification
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { initLogger } = require('braintrust');
const fs = require('fs');
const path = require('path');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

if (!GEMINI_API_KEY) {
  console.warn('Warning: GEMINI_API_KEY not set in environment');
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Initialize BrainTrust logger for this session
const BRAINTRUST_PROJECT_NAME = process.env.BRAINTRUST_PROJECT_NAME || 'Music Classification - Gemini';
const BRAINTRUST_PROJECT_ID = process.env.BRAINTRUST_PROJECT_ID;
const experimentName = `csv-enrichment-${Date.now()}`;

let braintrustLogger = null;
if (process.env.BRAINTRUST_API_KEY) {
  console.log(`[BrainTrust] Initializing project: ${BRAINTRUST_PROJECT_NAME}`);
  console.log(`[BrainTrust] Experiment: ${experimentName}`);
  braintrustLogger = initLogger({
    project: BRAINTRUST_PROJECT_NAME,
    experiment: experimentName,
    projectId: BRAINTRUST_PROJECT_ID
  });
} else {
  console.warn('[BrainTrust] API key not set, logging disabled');
}

// Load system instruction once at module load
const SYSTEM_INSTRUCTION = loadSystemInstruction();

function loadSystemInstruction() {
  const promptPath = path.join(__dirname, '../../prompts/classification-prompt.md');
  try {
    return fs.readFileSync(promptPath, 'utf8');
  } catch (error) {
    console.error(`[Gemini] Failed to load system instruction from ${promptPath}:`, error.message);
    throw new Error('System instruction file not found');
  }
}

/**
 * Classifies a song using Gemini API
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {Object} metadata - Additional song metadata (bpm, energy, etc)
 * @returns {Promise<Object>} Classification result
 */
async function classifySong(artist, title, metadata = {}) {
  try {
    console.log(`[Gemini] Classifying: ${artist} - ${title}`);

    const model = genAI.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: SYSTEM_INSTRUCTION,
      tools: [{ googleSearch: {} }]  // Enable web search
    });

    const prompt = buildPrompt(artist, title, metadata);

    // Make API call with retry logic
    const result = await callGeminiWithRetry(() =>
      model.generateContent(prompt)
    );

    const responseText = result.response.text();
    const classification = parseGeminiResponse(responseText);

    console.log(`[Gemini] Success: ${artist} - ${title} → ${classification.energy} / ${classification.accessibility} / ${classification.subgenre1}`);

    // Log to BrainTrust if available
    if (braintrustLogger) {
      braintrustLogger.log({
        input: {
          artist,
          title,
          metadata
        },
        output: classification,
        metadata: {
          status: 'SUCCESS',
          model: GEMINI_MODEL,
          has_energy: !!classification.energy,
          has_accessibility: !!classification.accessibility,
          subgenre_count: [classification.subgenre1, classification.subgenre2, classification.subgenre3].filter(Boolean).length
        }
      });
    }

    return {
      ...classification,
      status: 'SUCCESS'
    };

  } catch (error) {
    console.error(`[Gemini] Error classifying ${artist} - ${title}:`, error.message);

    const errorResult = {
      energy: null,
      accessibility: null,
      subgenre1: null,
      subgenre2: null,
      subgenre3: null,
      reasoning: null,
      context: null,
      status: 'ERROR',
      error_message: error.message
    };

    // Log error to BrainTrust if available
    if (braintrustLogger) {
      braintrustLogger.log({
        input: {
          artist,
          title,
          metadata
        },
        output: errorResult,
        metadata: {
          status: 'ERROR',
          model: GEMINI_MODEL,
          error_message: error.message
        }
      });
    }

    return errorResult;
  }
}

/**
 * Builds the prompt for Gemini
 */
function buildPrompt(artist, title, metadata) {
  let prompt = `Please classify the following song:\n\n`;
  prompt += `Artist: ${artist}\n`;
  prompt += `Title: ${title}\n`;

  if (metadata.bpm) {
    prompt += `BPM: ${metadata.bpm}\n`;
  }

  if (metadata.energy) {
    prompt += `Pre-analyzed Energy: ${metadata.energy}\n`;
  }

  prompt += `\nProvide your classification in the following JSON format:\n`;
  prompt += `{\n`;
  prompt += `  "energy": "Very Low|Low|Medium|High|Very High",\n`;
  prompt += `  "accessibility": "Eclectic|Timeless|Commercial|Cheesy",\n`;
  prompt += `  "subgenre1": "Primary subgenre",\n`;
  prompt += `  "subgenre2": "Secondary subgenre (or null)",\n`;
  prompt += `  "subgenre3": "Tertiary subgenre (or null)",\n`;
  prompt += `  "reasoning": "Brief explanation of your classification",\n`;
  prompt += `  "context_used": "Summary of web search findings used for classification"\n`;
  prompt += `}\n`;

  return prompt;
}

/**
 * Parses Gemini response into structured classification
 */
function parseGeminiResponse(responseText) {
  try {
    // Remove markdown code blocks if present
    let jsonText = responseText.trim();

    // Handle ```json wrapper
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    }
    // Handle ``` wrapper
    else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsed = JSON.parse(jsonText);

    // Validate required fields
    if (!parsed.energy || !parsed.accessibility || !parsed.subgenre1) {
      throw new Error('Missing required fields in response');
    }

    return {
      energy: parsed.energy,
      accessibility: parsed.accessibility,
      subgenre1: parsed.subgenre1,
      subgenre2: parsed.subgenre2 || null,
      subgenre3: parsed.subgenre3 || null,
      reasoning: parsed.reasoning || '',
      context: parsed.context_used || ''
    };

  } catch (error) {
    console.error('[Gemini] Failed to parse response:', responseText.substring(0, 200));
    throw new Error(`Response parsing failed: ${error.message}`);
  }
}

/**
 * Calls Gemini with exponential backoff retry
 */
async function callGeminiWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Don't retry on certain errors
      if (error.message && error.message.includes('API key')) {
        throw error;
      }

      if (i === maxRetries - 1) {
        throw error;
      }

      const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
      console.log(`[Gemini] Retry ${i + 1}/${maxRetries} after ${delay}ms...`);
      await sleep(delay);
    }
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Flush BrainTrust logs on process exit
process.on('beforeExit', async () => {
  if (braintrustLogger) {
    console.log('[BrainTrust] Flushing logs...');
    await braintrustLogger.flush();
  }
});

module.exports = {
  classifySong
};
