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
const readline = require('readline');
const { createObjectCsvWriter } = require('csv-writer');
const { PrismaClient } = require('@prisma/client');
const { initLogger } = require('braintrust');
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier.cjs');
const { calculateSongSimilarity, areSongsDuplicate } = require('../src/utils/fuzzy-matcher.cjs');
const { v4: uuidv4 } = require('uuid');

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
  console.error('  --force-duplicates   Skip duplicate detection (import all songs)');
  console.error('  --dry-run            Preview duplicates without processing');
  console.error('  --batch-name=NAME    Custom batch name for uploadBatchId');
  process.exit(1);
}

const options = {
  force: args.includes('--force'),
  skipExisting: args.includes('--skip-existing'),
  geminiOnly: args.includes('--gemini-only'),
  explicitOnly: args.includes('--explicit-only'),
  forceDuplicates: args.includes('--force-duplicates'),
  dryRun: args.includes('--dry-run'),
  concurrency: parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5'),
  batchName: args.find(a => a.startsWith('--batch-name='))?.split('=')[1]
};

console.log('='.repeat(60));
console.log('CSV Playlist Enrichment Script');
console.log('='.repeat(60));
console.log(`Input: ${csvPath}`);
console.log(`Options:`, options);
console.log('='.repeat(60));
console.log('');

// Generate unique batch ID for this upload
// Use custom batch name if provided, otherwise generate UUID
const uploadBatchId = options.batchName || uuidv4();
console.log(`Upload Batch ID: ${uploadBatchId}\n`);

// Extract batch name from CSV filename (remove .csv extension)
const batchName = path.basename(csvPath, '.csv');

// Global state for "always new" mode
let alwaysNewMode = false;

/**
 * Main enrichment function
 */
async function enrichPlaylist() {
  // Initialize BrainTrust logger
  let braintrustLogger = null;
  if (process.env.BRAINTRUST_API_KEY) {
    const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'Music Classification - Gemini';
    const experimentName = `csv-enrichment-batch-${Date.now()}`;

    console.log(`[BrainTrust] Project: ${projectName}`);
    console.log(`[BrainTrust] Experiment: ${experimentName}\n`);

    braintrustLogger = initLogger({
      project: projectName,
      experiment: experimentName,
      projectId: process.env.BRAINTRUST_PROJECT_ID
    });
  }

  try {
    // 1. Load CSV
    console.log('[1/5] Loading CSV...');
    const songs = await loadCSV(csvPath);
    console.log(`  ✓ Loaded ${songs.length} songs\n`);

    // 1.5. Detect duplicates (unless --force-duplicates is set)
    let songsToProcess = songs;
    let duplicateDecisions = {};

    if (!options.forceDuplicates && !options.dryRun) {
      console.log('[1.5/5] Checking for duplicates...');
      const duplicateCheck = await detectAndResolveDuplicates(songs, options);
      songsToProcess = duplicateCheck.songsToProcess;
      duplicateDecisions = duplicateCheck.decisions;
      console.log(`  ✓ ${songsToProcess.length} songs to process after duplicate resolution\n`);
    } else if (options.dryRun) {
      console.log('[DRY RUN] Checking for duplicates...');
      await detectAndPreviewDuplicates(songs);
      console.log('\n[DRY RUN] Complete. No songs were processed.');
      process.exit(0);
    }

    // Log batch metadata to BrainTrust
    if (braintrustLogger) {
      braintrustLogger.log({
        input: {
          csv_path: csvPath,
          song_count: songs.length,
          options
        },
        metadata: {
          type: 'batch_start',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 2. Process songs in batches
    console.log(`[2/5] Processing songs (concurrency: ${options.concurrency})...`);
    const results = [];

    for (let i = 0; i < songsToProcess.length; i += options.concurrency) {
      const batch = songsToProcess.slice(i, i + options.concurrency);
      const batchNumber = Math.floor(i / options.concurrency) + 1;
      const totalBatches = Math.ceil(songsToProcess.length / options.concurrency);

      console.log(`  Batch ${batchNumber}/${totalBatches} (${batch.length} songs):`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(song => enrichSong(song, options, duplicateDecisions[song.isrc], uploadBatchId))
      );

      results.push(...batchResults);

      const processed = Math.min(i + options.concurrency, songsToProcess.length);
      console.log(`  Progress: ${processed}/${songsToProcess.length}\n`);
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

    // Log batch completion to BrainTrust
    if (braintrustLogger) {
      braintrustLogger.log({
        output: {
          summary,
          output_path: outputPath
        },
        metadata: {
          type: 'batch_complete',
          timestamp: new Date().toISOString()
        }
      });

      console.log('[BrainTrust] Flushing logs...');
      await braintrustLogger.flush();
      console.log('[BrainTrust] ✓ Logs uploaded\n');
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
async function enrichSong(song, options, duplicateDecision, uploadBatchId) {
  const logPrefix = `    ${song.artist} - ${song.title}`;

  try {
    // Check if already processed
    if (options.skipExisting && !options.force && !duplicateDecision) {
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
      aiErrorMessage: geminiResult?.error_message || null,
      // Upload tracking
      uploadBatchId: uploadBatchId,
      uploadBatchName: batchName
    };

    // Handle duplicate decisions
    if (duplicateDecision) {
      if (duplicateDecision.action === 'update') {
        // Update existing song
        await prisma.song.update({
          where: { isrc: duplicateDecision.existingSong.isrc },
          data: {
            ...enrichedSong,
            isrc: duplicateDecision.existingSong.isrc, // Keep original ISRC
            reviewed: false // Mark for re-review
          }
        });
        console.log(`${logPrefix} → ✓ Updated existing`);
      } else if (duplicateDecision.action === 'new') {
        // Save as new duplicate version
        await prisma.song.create({
          data: {
            ...enrichedSong,
            isDuplicate: true,
            originalIsrc: duplicateDecision.existingSong.isrc
          }
        });
        console.log(`${logPrefix} → ✓ Saved as new duplicate`);
      }
    } else {
      // Normal upsert for non-duplicates
      await prisma.song.upsert({
        where: { isrc: song.isrc },
        update: enrichedSong,
        create: enrichedSong
      });
      console.log(`${logPrefix} → ✓ Success`);
    }

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
    let skippedNoISRC = 0;

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Skip rows without ISRC
        const isrc = row.isrc || row.ISRC;
        if (!isrc || isrc.trim() === '') {
          skippedNoISRC++;
          return;
        }

        // Parse BPM as integer
        const bpmValue = row.bpm || row.BPM;
        const bpm = bpmValue ? parseInt(bpmValue, 10) : null;

        songs.push({
          isrc: isrc.trim(),
          title: row.title || row.Title || row.Song,
          artist: row.artist || row.Artist,
          bpm: bpm,
          energy: row.energy || row.Energy || null,
          subgenre: row.subgenre || row.Subgenre || null,
          artwork: row.artwork || row.Artwork || null,
          source_file: row.source_file || row['Source File'] || null
        });
      })
      .on('end', () => {
        if (skippedNoISRC > 0) {
          console.log(`  ⚠ Skipped ${skippedNoISRC} songs without ISRC`);
        }
        resolve(songs);
      })
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

/**
 * Detects duplicates and prompts for resolution
 */
async function detectAndResolveDuplicates(songs, options) {
  const songsToProcess = [];
  const decisions = {};
  let autoSkippedISRC = 0;
  let autoSkippedFuzzy = 0;
  let fuzzyPrompted = 0;

  for (const song of songs) {
    // When --force-duplicates is used, only check for ISRC matches
    if (options.forceDuplicates) {
      // Only check for exact ISRC match in database
      if (song.isrc) {
        const existing = await prisma.song.findUnique({
          where: { isrc: song.isrc }
        });

        if (existing) {
          console.log(`  ✓ Auto-skipped: ${song.artist} - ${song.title} (ISRC exists: ${song.isrc})`);
          autoSkippedISRC++;
          continue; // Skip this song entirely
        }
      }

      // No ISRC match found, proceed with enrichment
      songsToProcess.push(song);
      continue;
    }

    // Default behavior: Full duplicate detection with fuzzy matching
    const duplicate = await findDuplicate(song);

    if (!duplicate) {
      // No duplicate found, proceed with enrichment
      songsToProcess.push(song);
      continue;
    }

    // Auto-skip 100% exact duplicates without prompting
    if (duplicate.similarity === 100) {
      console.log(`  ✓ Auto-skipped: ${song.artist} - ${song.title} (100% exact match)`);
      autoSkippedISRC++;
      continue; // Don't add to songsToProcess, don't prompt
    }

    // Duplicate found - handle based on "always new" mode
    if (alwaysNewMode) {
      songsToProcess.push(song);
      decisions[song.isrc] = {
        action: 'new',
        existingSong: duplicate.song
      };
      autoSkippedFuzzy++;
      continue;
    }

    // Show duplicate prompt for fuzzy matches (<100%)
    fuzzyPrompted++;
    console.log('\n' + '='.repeat(60));
    console.log('🔍 Found potential duplicate');
    console.log(`   Similarity: ${duplicate.similarity.toFixed(2)}%`);
    console.log('='.repeat(60));
    console.log('');
    console.log('NEW SONG:');
    console.log(`  Artist: ${song.artist}`);
    console.log(`  Title: ${song.title}`);
    console.log(`  ISRC: ${song.isrc || '(none)'}`);
    console.log(`  BPM: ${song.bpm || '(none)'}`);
    console.log('');
    console.log('EXISTING IN DATABASE:');
    console.log(`  Artist: ${duplicate.song.artist}`);
    console.log(`  Title: ${duplicate.song.title}`);
    console.log(`  ISRC: ${duplicate.song.isrc}`);
    console.log(`  BPM: ${duplicate.song.bpm || '(none)'}`);
    console.log(`  Reviewed: ${duplicate.song.reviewed ? 'Yes ✅' : 'No'}`);
    console.log('');

    const choice = await promptUser(
      'How do you want to handle this?\n' +
      '  [S]kip - Don\'t import (keep existing)\n' +
      '  [U]pdate - Merge into existing song\n' +
      '  [N]ew - Save as new duplicate version\n' +
      '  [A]lways new - Skip all duplicate checks\n' +
      '  [Q]uit\n' +
      '\n' +
      'Your choice (S/U/N/A/Q): '
    );

    const normalizedChoice = choice.trim().toUpperCase();

    if (normalizedChoice === 'S' || normalizedChoice === 'SKIP') {
      console.log('  → Skipped\n');
      // Don't add to songsToProcess
    } else if (normalizedChoice === 'U' || normalizedChoice === 'UPDATE') {
      console.log('  → Will update existing song\n');
      songsToProcess.push(song);
      decisions[song.isrc] = {
        action: 'update',
        existingSong: duplicate.song
      };
    } else if (normalizedChoice === 'N' || normalizedChoice === 'NEW') {
      console.log('  → Will save as new version\n');
      songsToProcess.push(song);
      decisions[song.isrc] = {
        action: 'new',
        existingSong: duplicate.song
      };
    } else if (normalizedChoice === 'A' || normalizedChoice === 'ALWAYS') {
      console.log('  → Enabled "Always New" mode for remaining songs\n');
      alwaysNewMode = true;
      songsToProcess.push(song);
      decisions[song.isrc] = {
        action: 'new',
        existingSong: duplicate.song
      };
    } else if (normalizedChoice === 'Q' || normalizedChoice === 'QUIT') {
      console.log('  → Quitting...\n');
      process.exit(0);
    } else {
      console.log('  → Invalid choice, skipping song\n');
    }
  }

  // Print summary
  if (autoSkippedISRC > 0 || autoSkippedFuzzy > 0 || fuzzyPrompted > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('Duplicate Resolution Summary:');
    if (autoSkippedISRC > 0) {
      console.log(`  Auto-skipped (ISRC match): ${autoSkippedISRC}`);
    }
    if (autoSkippedFuzzy > 0) {
      console.log(`  Auto-skipped (fuzzy, always-new mode): ${autoSkippedFuzzy}`);
    }
    if (fuzzyPrompted > 0) {
      console.log(`  User prompted (fuzzy match): ${fuzzyPrompted}`);
    }
    console.log('='.repeat(60));
    console.log('');
  }

  return { songsToProcess, decisions };
}

/**
 * Detects and previews duplicates without processing (dry run)
 */
async function detectAndPreviewDuplicates(songs) {
  let duplicateCount = 0;

  for (const song of songs) {
    const duplicate = await findDuplicate(song);

    if (duplicate) {
      duplicateCount++;
      console.log(`\n[${duplicateCount}] Duplicate found (${duplicate.similarity.toFixed(2)}% match):`);
      console.log(`  New: ${song.artist} - ${song.title} [${song.isrc || 'no ISRC'}]`);
      console.log(`  Existing: ${duplicate.song.artist} - ${duplicate.song.title} [${duplicate.song.isrc}]`);
    }
  }

  console.log(`\n✓ Found ${duplicateCount} potential duplicates out of ${songs.length} songs`);
}

/**
 * Finds a duplicate for a given song
 */
async function findDuplicate(song) {
  // First check for exact ISRC match
  if (song.isrc) {
    const exactMatch = await prisma.song.findUnique({
      where: { isrc: song.isrc }
    });

    if (exactMatch) {
      return {
        song: exactMatch,
        similarity: 100,
        matchType: 'isrc'
      };
    }
  }

  // Check for fuzzy artist+title match (70% threshold)
  const allSongs = await prisma.song.findMany({
    select: {
      isrc: true,
      artist: true,
      title: true,
      bpm: true,
      reviewed: true,
      aiEnergy: true,
      aiAccessibility: true
    }
  });

  for (const existingSong of allSongs) {
    const isDuplicate = areSongsDuplicate(
      { artist: song.artist, title: song.title },
      { artist: existingSong.artist, title: existingSong.title },
      70 // 70% threshold
    );

    if (isDuplicate) {
      const similarity = calculateSongSimilarity(
        { artist: song.artist, title: song.title },
        { artist: existingSong.artist, title: existingSong.title }
      );

      return {
        song: existingSong,
        similarity,
        matchType: 'fuzzy'
      };
    }
  }

  return null;
}

/**
 * Prompts user for input
 */
function promptUser(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// Run the script
enrichPlaylist().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
