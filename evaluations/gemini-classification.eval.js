// BrainTrust Evaluation Script for Gemini Music Classification
// This script runs evaluations on songs from the test dataset

require('dotenv').config();
const { Eval } = require('braintrust');
const { classifySongWithGemini } = require('./gemini-client');
const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Configuration from environment
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TEST_SONG_LIMIT = parseInt(process.env.TEST_SONG_LIMIT) || 10;
const CSV_PATH = process.env.CSV_PATH || './test-data/test-data-10-13/Raina Unlabelled Sample Dataset.csv';
const RATE_LIMIT_DELAY = parseInt(process.env.RATE_LIMIT_DELAY) || 1000; // 1 second delay between requests

/**
 * Sleep utility for rate limiting
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Shuffle array using Fisher-Yates algorithm
 * @param {Array} array - Array to shuffle
 * @returns {Array} Shuffled array
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
 * Load songs from CSV file with randomization
 * @param {number} limit - Maximum number of songs to load
 * @returns {Array} Array of song objects
 */
function loadSongsFromCSV(limit = TEST_SONG_LIMIT) {
  try {
    const fileContent = fs.readFileSync(CSV_PATH, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    // Parse all songs - handle multiple CSV formats
    const allSongs = records.map((record, index) => ({
      id: index + 1,
      artist: record['Artist Name ']?.trim() || record['Artist Name']?.trim() || record['Artist']?.trim(),
      title: record['Song Title']?.trim() || record['Name']?.trim()
    })).filter(song => song.artist && song.title); // Filter out invalid entries

    // Randomize and take N songs
    const shuffled = shuffleArray(allSongs);
    const songs = shuffled.slice(0, limit);

    console.log(`Total songs in CSV: ${allSongs.length}`);
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
    description: 'Gemini evaluation with randomized song selection, web search, and rate limiting',
    model: 'gemini-flash-latest',
    test_song_limit: TEST_SONG_LIMIT,
    csv_source: CSV_PATH,
    randomized: true,
    rate_limit_delay_ms: RATE_LIMIT_DELAY,
    date: new Date().toISOString()
  }
});

console.log(`\n🚀 Starting BrainTrust evaluation...`);
console.log(`📊 Testing with ${TEST_SONG_LIMIT} songs`);
console.log(`🔑 Project: ${process.env.BRAINTRUST_PROJECT_NAME}`);
console.log(`📁 Source: ${CSV_PATH}`);
console.log(`⏱️  Rate limit delay: ${RATE_LIMIT_DELAY}ms between requests\n`);
