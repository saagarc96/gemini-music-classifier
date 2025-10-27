#!/usr/bin/env node

/**
 * Playlist Batch Runner
 *
 * Processes individual playlists from the isrc_output directory using
 * the Gemini Batch API. Designed for incremental processing of 5-6
 * playlists per day to manage quota limits.
 *
 * Usage:
 *   node src/playlist-batch-runner.js <playlist-name>
 *   node src/playlist-batch-runner.js "Afterwork Jazz - Downtime"
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

// Import existing batch processing functions
import { prepareBatchData } from './prepare-batch-data.js';
import { submitBatchJob } from './submit-batch-job.js';
import { monitorBatchJob } from './monitor-batch-job.js';

const PROGRESS_FILE = path.join(PROJECT_ROOT, 'playlists', 'processed', 'completed.json');
const INPUT_DIR = path.join(PROJECT_ROOT, 'playlists', 'input', 'isrc_output');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'outputs', 'by-playlist');

/**
 * Load progress tracking file
 */
async function loadProgress() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return { processed: [], lastUpdate: null };
    }
    throw err;
  }
}

/**
 * Save progress tracking file
 */
async function saveProgress(progress) {
  await fs.mkdir(path.dirname(PROGRESS_FILE), { recursive: true });
  await fs.writeFile(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

/**
 * Get list of available playlists
 */
async function getAvailablePlaylists() {
  const files = await fs.readdir(INPUT_DIR);
  return files.filter(f => f.endsWith('_high_confidence.csv'));
}

/**
 * Process a single playlist
 */
async function processPlaylist(playlistName) {
  console.log(`\n🎵 Processing playlist: ${playlistName}`);

  // Load progress
  const progress = await loadProgress();

  // Check if already processed
  if (progress.processed.includes(playlistName)) {
    console.log(`⚠️  Playlist already processed. Skipping.`);
    return;
  }

  // Prepare paths
  const inputPath = path.join(INPUT_DIR, playlistName);
  const outputPath = path.join(OUTPUT_DIR, playlistName.replace('.csv', '-classified.csv'));

  // Step 1: Prepare batch data
  console.log('\n📝 Step 1: Preparing batch data...');
  const config = {
    inputCsv: inputPath,
    outputDir: path.join(PROJECT_ROOT, 'outputs'),
    model: 'gemini-flash-latest',
    promptPath: path.join(PROJECT_ROOT, 'prompts', 'classification-prompt.md'),
    testMode: false
  };

  const prepareResult = await prepareBatchData(config);
  console.log(`✅ Prepared ${prepareResult.songCount} songs`);

  // Step 2: Submit batch job
  console.log('\n🚀 Step 2: Submitting batch job...');
  const submitResult = await submitBatchJob(config);
  console.log(`✅ Batch submitted: ${submitResult.batchId}`);
  console.log(`   Status: ${submitResult.state}`);

  // Step 3: Monitor batch job
  console.log('\n⏳ Step 3: Monitoring batch job...');
  console.log('   This may take 12-24 hours...');

  const monitorResult = await monitorBatchJob({
    batchId: submitResult.batchId,
    pollIntervalMs: 300000, // 5 minutes
    ...config
  });

  if (monitorResult.state === 'SUCCEEDED') {
    console.log('\n✅ Batch processing complete!');
    console.log(`   Processed: ${monitorResult.processedCount} songs`);
    console.log(`   Success rate: ${monitorResult.successRate}%`);
    console.log(`   Output: ${outputPath}`);

    // Move output to by-playlist directory
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    const defaultOutput = path.join(PROJECT_ROOT, 'outputs', 'classified-songs.csv');
    await fs.rename(defaultOutput, outputPath);

    // Update progress
    progress.processed.push(playlistName);
    progress.lastUpdate = new Date().toISOString();
    await saveProgress(progress);

    console.log('\n✨ Playlist processing complete!');
  } else {
    console.error('\n❌ Batch processing failed');
    console.error(`   State: ${monitorResult.state}`);
    throw new Error(`Batch processing failed: ${monitorResult.state}`);
  }
}

/**
 * Main execution
 */
async function main() {
  const playlistName = process.argv[2];

  if (!playlistName) {
    console.log('❌ Error: Playlist name required');
    console.log('\nUsage:');
    console.log('  node src/playlist-batch-runner.js <playlist-name>');
    console.log('\nAvailable playlists:');

    const playlists = await getAvailablePlaylists();
    const progress = await loadProgress();

    playlists.forEach(p => {
      const status = progress.processed.includes(p) ? '✅' : '⏳';
      console.log(`  ${status} ${p}`);
    });

    process.exit(1);
  }

  // Find matching playlist
  const playlists = await getAvailablePlaylists();
  const match = playlists.find(p =>
    p === playlistName ||
    p.includes(playlistName) ||
    playlistName.includes(p.replace('_high_confidence.csv', ''))
  );

  if (!match) {
    console.error(`❌ Playlist not found: ${playlistName}`);
    console.log('\nAvailable playlists:');
    playlists.forEach(p => console.log(`  - ${p}`));
    process.exit(1);
  }

  await processPlaylist(match);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
}

export { processPlaylist, getAvailablePlaylists, loadProgress };
