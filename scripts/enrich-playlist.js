#!/usr/bin/env node

/**
 * Unified CSV Playlist Enrichment Script
 *
 * Processes a CSV playlist file by:
 * 1. Running Gemini classification (energy, accessibility, subgenres)
 * 2. Running Parallel AI explicit content check
 * 3. Combining results and saving to database
 * 4. Exporting enriched CSV
 *
 * Usage:
 *   node scripts/enrich-playlist.js path/to/playlist.csv
 *   node scripts/enrich-playlist.js path/to/playlist.csv --force
 *   node scripts/enrich-playlist.js path/to/playlist.csv --concurrency=10
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { PrismaClient } = require('@prisma/client');
const { classifySong } = require('../src/classifiers/gemini-classifier');
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const csvPath = args[0];

if (!csvPath) {
  console.error('Usage: node scripts/enrich-playlist.js <path-to-csv> [options]');
  console.error('Options:');
  console.error('  --force              Force reprocess all songs');
  console.error('  --concurrency=N      Process N songs at a time (default: 5)');
  console.error('  --skip-existing      Skip songs already in database');
  console.error('  --gemini-only        Only run Gemini classification');
  console.error('  --explicit-only      Only run explicit content check');
  process.exit(1);
}

const options = {
  force: args.includes('--force'),
  skipExisting: args.includes('--skip-existing'),
  geminiOnly: args.includes('--gemini-only'),
  explicitOnly: args.includes('--explicit-only'),
  concurrency: parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5')
};

console.log('='.repeat(60));
console.log('CSV Playlist Enrichment Script');
console.log('='.repeat(60));
console.log(`Input: ${csvPath}`);
console.log(`Options:`, options);
console.log('='.repeat(60));
console.log('');

/**
 * Main enrichment function
 */
async function enrichPlaylist() {
  try {
    // 1. Load CSV
    console.log('[1/5] Loading CSV...');
    const songs = await loadCSV(csvPath);
    console.log(`  ✓ Loaded ${songs.length} songs\n`);

    // 2. Process songs in batches
    console.log(`[2/5] Processing songs (concurrency: ${options.concurrency})...`);
    const results = [];

    for (let i = 0; i < songs.length; i += options.concurrency) {
      const batch = songs.slice(i, i + options.concurrency);
      const batchNumber = Math.floor(i / options.concurrency) + 1;
      const totalBatches = Math.ceil(songs.length / options.concurrency);

      console.log(`  Batch ${batchNumber}/${totalBatches} (${batch.length} songs):`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(song => enrichSong(song, options))
      );

      results.push(...batchResults);

      const processed = Math.min(i + options.concurrency, songs.length);
      console.log(`  Progress: ${processed}/${songs.length}\n`);
    }

    // 3. Save to database
    console.log('[3/5] Saving to database...');
    const saved = results.filter(r => r.status === 'success').length;
    console.log(`  ✓ Saved ${saved} songs to database\n`);

    // 4. Export enriched CSV
    console.log('[4/5] Exporting enriched CSV...');
    const outputPath = await exportEnrichedCSV(results, csvPath);
    console.log(`  ✓ Exported to: ${outputPath}\n`);

    // 5. Summary
    console.log('[5/5] Summary:');
    const summary = generateSummary(results);
    console.log(`  Total: ${summary.total}`);
    console.log(`  Success: ${summary.success} (${summary.successPercent}%)`);
    console.log(`  Errors: ${summary.errors}`);
    console.log(`  Skipped: ${summary.skipped}`);
    console.log('');

    if (summary.errors > 0) {
      console.log('  Error details:');
      results
        .filter(r => r.status === 'error')
        .forEach(r => {
          console.log(`    - ${r.artist} - ${r.title}: ${r.error_message}`);
        });
      console.log('');
    }

    console.log('='.repeat(60));
    console.log('✓ Enrichment complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Enriches a single song
 */
async function enrichSong(song, options) {
  const logPrefix = `    ${song.artist} - ${song.title}`;

  try {
    // Check if already processed
    if (options.skipExisting && !options.force) {
      const existing = await prisma.song.findUnique({
        where: { isrc: song.isrc }
      });

      if (existing && existing.aiStatus === 'SUCCESS' && isRecent(existing.modifiedAt)) {
        console.log(`${logPrefix} → Skipped (already processed)`);
        return { ...song, status: 'skipped' };
      }
    }

    let geminiResult = null;
    let explicitResult = null;

    // Run Gemini classification
    if (!options.explicitOnly) {
      console.log(`${logPrefix} → Gemini...`);
      geminiResult = await classifySong(song.artist, song.title, {
        bpm: song.bpm,
        energy: song.energy
      });
    }

    // Run Parallel AI explicit check
    if (!options.geminiOnly) {
      console.log(`${logPrefix} → Parallel AI...`);
      explicitResult = await classifyExplicitContent(song.artist, song.title);
    }

    // Combine results
    const enrichedSong = {
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      bpm: song.bpm || null,
      energy: song.energy || null,
      subgenre: song.subgenre || null,
      artwork: song.artwork || null,
      sourceFile: song.source_file || null,
      // Gemini results
      aiEnergy: geminiResult?.energy || null,
      aiAccessibility: geminiResult?.accessibility || null,
      aiSubgenre1: geminiResult?.subgenre1 || null,
      aiSubgenre2: geminiResult?.subgenre2 || null,
      aiSubgenre3: geminiResult?.subgenre3 || null,
      aiReasoning: geminiResult?.reasoning || null,
      aiContextUsed: geminiResult?.context || null,
      // Parallel AI results
      aiExplicit: explicitResult?.classification || null,
      // Status
      aiStatus: (geminiResult?.status === 'SUCCESS' || options.explicitOnly) ? 'SUCCESS' : 'ERROR',
      aiErrorMessage: geminiResult?.error_message || null
    };

    // Save to database
    await prisma.song.upsert({
      where: { isrc: song.isrc },
      update: enrichedSong,
      create: enrichedSong
    });

    console.log(`${logPrefix} → ✓ Success`);

    return {
      ...song,
      ...enrichedSong,
      status: 'success'
    };

  } catch (error) {
    console.log(`${logPrefix} → ✗ Error: ${error.message}`);

    // Save error to database
    try {
      await prisma.song.upsert({
        where: { isrc: song.isrc },
        update: {
          aiStatus: 'ERROR',
          aiErrorMessage: error.message
        },
        create: {
          isrc: song.isrc,
          title: song.title,
          artist: song.artist,
          aiStatus: 'ERROR',
          aiErrorMessage: error.message
        }
      });
    } catch (dbError) {
      console.error(`      Failed to save error to database: ${dbError.message}`);
    }

    return {
      ...song,
      status: 'error',
      error_message: error.message
    };
  }
}

/**
 * Loads songs from CSV
 */
function loadCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const songs = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        songs.push({
          isrc: row.isrc || row.ISRC,
          title: row.title || row.Title,
          artist: row.artist || row.Artist,
          bpm: row.bpm || row.BPM || null,
          energy: row.energy || row.Energy || null,
          subgenre: row.subgenre || row.Subgenre || null,
          artwork: row.artwork || row.Artwork || null,
          source_file: row.source_file || row['Source File'] || null
        });
      })
      .on('end', () => resolve(songs))
      .on('error', reject);
  });
}

/**
 * Exports enriched results to CSV
 */
async function exportEnrichedCSV(results, originalPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const basename = path.basename(originalPath, '.csv');
  const outputPath = path.join('outputs', `${basename}-enriched-${timestamp}.csv`);

  // Ensure output directory exists
  if (!fs.existsSync('outputs')) {
    fs.mkdirSync('outputs', { recursive: true });
  }

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'artist', title: 'Artist' },
      { id: 'title', title: 'Title' },
      { id: 'isrc', title: 'ISRC' },
      { id: 'bpm', title: 'BPM' },
      { id: 'energy', title: 'Original Energy' },
      { id: 'aiEnergy', title: 'AI Energy' },
      { id: 'aiAccessibility', title: 'AI Accessibility' },
      { id: 'aiExplicit', title: 'AI Explicit' },
      { id: 'aiSubgenre1', title: 'AI Subgenre 1' },
      { id: 'aiSubgenre2', title: 'AI Subgenre 2' },
      { id: 'aiSubgenre3', title: 'AI Subgenre 3' },
      { id: 'aiReasoning', title: 'AI Reasoning' },
      { id: 'aiContextUsed', title: 'AI Context Used' },
      { id: 'aiStatus', title: 'AI Status' },
      { id: 'status', title: 'Processing Status' }
    ]
  });

  await csvWriter.writeRecords(results);

  return outputPath;
}

/**
 * Generates summary statistics
 */
function generateSummary(results) {
  const total = results.length;
  const success = results.filter(r => r.status === 'success').length;
  const errors = results.filter(r => r.status === 'error').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  const successPercent = Math.round((success / total) * 100);

  return { total, success, errors, skipped, successPercent };
}

/**
 * Checks if a date is recent (within last 7 days)
 */
function isRecent(date) {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  return new Date(date) > sevenDaysAgo;
}

// Run the script
enrichPlaylist().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
