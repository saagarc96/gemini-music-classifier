// BrainTrust Evaluation Script for Gemini Music Classification
// Quick test evaluation using the quick test CSV

require('dotenv').config();
const { Eval } = require('braintrust');
const { classifySongWithGemini } = require('./gemini-client');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEST_SONG_LIMIT = parseInt(process.env.TEST_SONG_LIMIT) || 10;
const RATE_LIMIT_DELAY = parseInt(process.env.RATE_LIMIT_DELAY) || 1500;
const CSV_PATH = './docs/sample-csv/quick test csv.csv';

/**
 * Sleep utility for rate limiting
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Load songs from the quick test CSV (CSV with JSON strings in each row)
 */
function loadSongsFromCSV(limit = TEST_SONG_LIMIT) {
  try {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');

    // Parse CSV - each row contains a single JSON string
    const records = parse(fileContent, {
      skip_empty_lines: true,
      relax_column_count: true
    });

    // Parse JSON from each row
    const allSongs = records.map((record, index) => {
      try {
        // Each row is an array with one element containing the JSON string
        const jsonData = JSON.parse(record[0]);

        return {
          id: index + 1,
          artist: jsonData.artist?.trim(),
          title: jsonData.title?.trim()
        };
      } catch (e) {
        console.error(`Error parsing row ${index + 1}:`, e.message);
        return null;
      }
    }).filter(song => song && song.artist && song.title && song.artist !== '#REF!' && song.title !== '#REF!');

    // Randomize and take N songs
    const shuffled = shuffleArray(allSongs);
    const songs = shuffled.slice(0, limit);

    console.log(`Total valid songs in CSV: ${allSongs.length}`);
    console.log(`Randomly selected ${songs.length} songs for evaluation`);
    return songs;

  } catch (error) {
    console.error('Error loading CSV:', error);
    throw error;
  }
}

/**
 * Main evaluation function
 */
Eval('Music Classification - Gemini', {
  // Load test data
  data: () => {
    const songs = loadSongsFromCSV(TEST_SONG_LIMIT);

    return songs.map(song => ({
      input: {
        artist: song.artist,
        title: song.title
      },
      metadata: {
        song_id: song.id
      }
    }));
  },

  // Task function - calls Gemini API with rate limiting
  task: async (input) => {
    const { artist, title } = input;

    console.log(`\nProcessing: ${artist} - ${title}`);

    try {
      // Add delay before each request to avoid rate limiting
      await sleep(RATE_LIMIT_DELAY);

      const result = await classifySongWithGemini(artist, title, GEMINI_API_KEY);

      console.log(`✓ Completed in ${result.latency_ms}ms`);

      return {
        classification: result.classification,
        latency_ms: result.latency_ms,
        model: result.model
      };

    } catch (error) {
      console.error(`✗ Error: ${error.message}`);
      return {
        error: error.message,
        classification: null
      };
    }
  },

  // No scoring yet - manual annotation in BrainTrust UI
  scores: [],

  // Experiment metadata
  metadata: {
    description: 'Quick test evaluation with new markdown-based prompt system',
    model: 'gemini-flash-latest',
    test_song_limit: TEST_SONG_LIMIT,
    csv_source: CSV_PATH,
    randomized: true,
    rate_limit_delay_ms: RATE_LIMIT_DELAY,
    prompt_source: 'docs/gemini-prompt/classification-prompt.md',
    date: new Date().toISOString()
  }
});

console.log(`\n🚀 Starting BrainTrust evaluation with quick test CSV...`);
console.log(`📊 Testing with ${TEST_SONG_LIMIT} songs`);
console.log(`📁 Source: ${CSV_PATH}`);
console.log(`📝 Prompt: docs/gemini-prompt/classification-prompt.md`);
console.log(`⏱️  Rate limit delay: ${RATE_LIMIT_DELAY}ms between requests\n`);
