#!/usr/bin/env node

/**
 * Curator CSV Smart Enrichment Script
 *
 * Processes curator-enriched CSV files by:
 * 1. Merging ISRCs from isrc_output CSV files (matched by Artist + Title)
 * 2. Preserving ALL existing curator data (subgenres, ACCESSIBILITY, EXPLICIT)
 * 3. Running Gemini ONLY for songs missing musical subgenres or ACCESSIBILITY
 * 4. Running Parallel AI ONLY for songs missing EXPLICIT
 * 5. Outputting enriched CSV maintaining original format
 *
 * Usage:
 *   node scripts/merge-and-enrich-curator-csvs.cjs path/to/curator-playlist.csv --isrc-source path/to/isrc_output.csv
 *   node scripts/merge-and-enrich-curator-csvs.cjs path/to/curator-playlist.csv --isrc-source path/to/isrc_output.csv --concurrency=10
 *   node scripts/merge-and-enrich-curator-csvs.cjs path/to/curator-playlist.csv --isrc-source path/to/isrc_output.csv --dry-run
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { initLogger } = require('braintrust');
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier.cjs');

// Known playlist names to filter from musical subgenres
const KNOWN_PLAYLISTS = [
  'Bazaar Meat (Late)',
  "Benny's Evening",
  'The Longboard (Evening)',
  'The Wild Ones (Late)',
  'Municipal Bar (Late Night)',
  'Municipal Bar (Afternoon)',
  'Close Company (Early)',
  'Close Company Late Night',
  "Capon's Chophouse (Lunch)",
  "Capon's Chophouse (Dinner)",
  'Cathedrale (John)',
  'DTF (Soultronica)',
  'Nexus Club (Happy Hour)',
  'Cabana Sass (Dinner)',
  "Waymore's (Punk, Ska & Adjacent)",
  'Moxy Mid-Morning (NYC 2025)',
];

// Parse command line arguments
const args = process.argv.slice(2);
const csvPath = args[0];

if (!csvPath) {
  console.error('Usage: node scripts/merge-and-enrich-curator-csvs.cjs <path-to-curator-csv> [options]');
  console.error('Options:');
  console.error('  --isrc-source=PATH   Path to isrc_output CSV file for merging ISRCs');
  console.error('  --concurrency=N      Process N songs at a time (default: 5)');
  console.error('  --dry-run            Show what would be enriched without making API calls');
  process.exit(1);
}

const options = {
  isrcSourcePath: args.find(a => a.startsWith('--isrc-source='))?.split('=')[1],
  concurrency: parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5'),
  dryRun: args.includes('--dry-run')
};

console.log('='.repeat(60));
console.log('Curator CSV Smart Enrichment Script');
console.log('='.repeat(60));
console.log(`Input: ${csvPath}`);
console.log(`Options:`, options);
console.log('='.repeat(60));
console.log('');

/**
 * Main enrichment function
 */
async function enrichCuratorCSV() {
  // Initialize BrainTrust logger
  let braintrustLogger = null;
  if (process.env.BRAINTRUST_API_KEY && !options.dryRun) {
    const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'Music Classification - Gemini';
    const experimentName = `curator-enrichment-${Date.now()}`;

    console.log(`[BrainTrust] Project: ${projectName}`);
    console.log(`[BrainTrust] Experiment: ${experimentName}\n`);

    braintrustLogger = initLogger({
      project: projectName,
      experiment: experimentName,
      projectId: process.env.BRAINTRUST_PROJECT_ID
    });
  }

  try {
    // 1. Load CSVs and merge ISRCs
    console.log('[1/5] Loading curator CSV...');
    const songs = await loadCuratorCSV(csvPath);
    console.log(`  ✓ Loaded ${songs.length} songs\n`);

    if (options.isrcSourcePath) {
      console.log('[2/5] Loading ISRC source CSV and merging...');
      await mergeISRCs(songs, options.isrcSourcePath);
      const isrcCount = songs.filter(s => s.isrc).length;
      console.log(`  ✓ Merged ${isrcCount}/${songs.length} ISRCs\n`);
    } else {
      console.log('[2/5] No ISRC source provided, skipping merge\n');
    }

    // 3. Analyze gaps
    console.log('[3/5] Analyzing enrichment needs...');
    const analysis = analyzeSongs(songs);
    console.log(`  Total songs: ${analysis.total}`);
    console.log(`  Complete (no enrichment needed): ${analysis.complete}`);
    console.log(`  Need ACCESSIBILITY: ${analysis.needAccessibility}`);
    console.log(`  Need musical subgenres: ${analysis.needSubgenres}`);
    console.log(`  Need EXPLICIT: ${analysis.needExplicit}`);
    console.log(`  Need Gemini (ACCESSIBILITY or subgenres): ${analysis.needGemini}`);
    console.log('');

    if (options.dryRun) {
      console.log('[DRY RUN] Would enrich the following songs:');
      songs.filter(s => s.needsEnrichment).forEach(s => {
        const needs = [];
        if (s.needsAccessibility) needs.push('ACCESSIBILITY');
        if (s.needsSubgenres) needs.push('Subgenres');
        if (s.needsExplicit) needs.push('EXPLICIT');
        console.log(`  - ${s.artist} - ${s.title}: ${needs.join(', ')}`);
      });
      console.log('\n[DRY RUN] Exiting without making API calls');
      return;
    }

    // Log batch metadata to BrainTrust
    if (braintrustLogger) {
      braintrustLogger.log({
        input: {
          csv_path: csvPath,
          song_count: songs.length,
          analysis,
          options
        },
        metadata: {
          type: 'batch_start',
          timestamp: new Date().toISOString()
        }
      });
    }

    // 4. Process songs in batches
    console.log(`[4/5] Processing songs (concurrency: ${options.concurrency})...`);
    const results = [];

    for (let i = 0; i < songs.length; i += options.concurrency) {
      const batch = songs.slice(i, i + options.concurrency);
      const batchNumber = Math.floor(i / options.concurrency) + 1;
      const totalBatches = Math.ceil(songs.length / options.concurrency);

      console.log(`  Batch ${batchNumber}/${totalBatches} (${batch.length} songs):`);

      // Process batch in parallel
      const batchResults = await Promise.all(
        batch.map(song => enrichSongIfNeeded(song, braintrustLogger))
      );

      results.push(...batchResults);

      const processed = Math.min(i + options.concurrency, songs.length);
      console.log(`  Progress: ${processed}/${songs.length}\n`);
    }

    // 5. Export enriched CSV
    console.log('[5/5] Exporting enriched CSV...');
    const outputPath = await exportEnrichedCSV(results, csvPath);
    console.log(`  ✓ Exported to: ${outputPath}\n`);

    // 5. Summary
    console.log('Summary:');
    const summary = generateSummary(results);
    console.log(`  Total: ${summary.total}`);
    console.log(`  Skipped (complete): ${summary.skipped}`);
    console.log(`  Enriched: ${summary.enriched}`);
    console.log(`  - ACCESSIBILITY added: ${summary.accessibilityAdded}`);
    console.log(`  - Subgenres added: ${summary.subgenresAdded}`);
    console.log(`  - EXPLICIT added: ${summary.explicitAdded}`);
    console.log(`  Errors: ${summary.errors}`);
    console.log('');

    if (summary.errors > 0) {
      console.log('  Error details:');
      results
        .filter(r => r.enrichmentError)
        .forEach(r => {
          console.log(`    - ${r.artist} - ${r.title}: ${r.enrichmentError}`);
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
  }
}

/**
 * Normalizes artist/title for matching (removes special chars, lowercase, trim)
 */
function normalizeForMatching(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special characters
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();
}

/**
 * Merges ISRCs from isrc_output CSV into curator songs array
 * Matches by normalized Artist + Title
 */
async function mergeISRCs(curatorSongs, isrcSourcePath) {
  return new Promise((resolve, reject) => {
    const isrcMap = new Map();

    // Load ISRC source CSV and build a lookup map
    fs.createReadStream(isrcSourcePath)
      .pipe(csv())
      .on('data', (row) => {
        if (!row.Artist || !row.Name) return;

        const key = normalizeForMatching(row.Artist) + '|||' + normalizeForMatching(row.Name);
        isrcMap.set(key, {
          isrc: row.ISRC,
          artist: row.Artist,
          title: row.Name
        });
      })
      .on('end', () => {
        // Match ISRCs to curator songs
        let matchCount = 0;
        curatorSongs.forEach(song => {
          const key = normalizeForMatching(song.artist) + '|||' + normalizeForMatching(song.title);
          const match = isrcMap.get(key);

          if (match && match.isrc) {
            song.isrc = match.isrc;
            matchCount++;
          }
        });

        console.log(`  Matched ${matchCount}/${curatorSongs.length} songs with ISRCs from source`);
        resolve();
      })
      .on('error', reject);
  });
}

/**
 * Loads curator CSV and analyzes enrichment needs
 */
function loadCuratorCSV(csvPath) {
  return new Promise((resolve, reject) => {
    const songs = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on('data', (row) => {
        // Skip empty rows (padding at end of curator files)
        if (!row.Artist || row.Artist.trim() === '') {
          return;
        }

        // Parse subgenre column
        const subgenreRaw = row.Subgenre || '';
        const subgenreParts = subgenreRaw.split(';').map(s => s.trim()).filter(s => s);

        // Separate playlist names from musical subgenres
        const playlists = subgenreParts.filter(s => KNOWN_PLAYLISTS.includes(s));
        const musicalSubgenres = subgenreParts.filter(s => !KNOWN_PLAYLISTS.includes(s));

        // Parse BPM as integer
        const bpmValue = row.BPM;
        const bpm = bpmValue ? parseInt(bpmValue, 10) : null;

        // Determine what needs enrichment
        const needsAccessibility = !row.ACCESSIBILITY || row.ACCESSIBILITY.trim() === '';
        const needsSubgenres = musicalSubgenres.length === 0; // No musical subgenres, only playlist assignments
        const needsExplicit = !row.EXPLICIT || row.EXPLICIT.trim() === '';
        const needsEnrichment = needsAccessibility || needsSubgenres || needsExplicit;

        songs.push({
          // Original data
          artist: row.Artist,
          title: row.Name,
          energy: row.Energy || null,
          bpm: bpm,
          subgenreRaw: subgenreRaw,
          isrc: row.ISRC,
          accessibility: row.ACCESSIBILITY || null,
          explicit: row.EXPLICIT || null,
          tags: row.TAGS || null,

          // Parsed data
          playlists,
          musicalSubgenres,

          // Enrichment flags
          needsAccessibility,
          needsSubgenres,
          needsExplicit,
          needsEnrichment
        });
      })
      .on('end', () => resolve(songs))
      .on('error', reject);
  });
}

/**
 * Analyzes enrichment needs across all songs
 */
function analyzeSongs(songs) {
  const needAccessibility = songs.filter(s => s.needsAccessibility).length;
  const needSubgenres = songs.filter(s => s.needsSubgenres).length;
  const needExplicit = songs.filter(s => s.needsExplicit).length;
  const needGemini = songs.filter(s => s.needsAccessibility || s.needsSubgenres).length;
  const complete = songs.filter(s => !s.needsEnrichment).length;

  return {
    total: songs.length,
    complete,
    needAccessibility,
    needSubgenres,
    needExplicit,
    needGemini
  };
}

/**
 * Enriches a single song if needed
 */
async function enrichSongIfNeeded(song, braintrustLogger) {
  const logPrefix = `    ${song.artist} - ${song.title}`;

  try {
    // If no enrichment needed, skip
    if (!song.needsEnrichment) {
      console.log(`${logPrefix} → ✓ Complete (skipped)`);
      return {
        ...song,
        enrichmentStatus: 'skipped',
        accessibilityAdded: false,
        subgenresAdded: false,
        explicitAdded: false
      };
    }

    let geminiResult = null;
    let explicitResult = null;

    // Run Gemini if we need ACCESSIBILITY or subgenres
    if (song.needsAccessibility || song.needsSubgenres) {
      console.log(`${logPrefix} → Gemini (${song.needsAccessibility ? 'ACCESSIBILITY' : ''}${song.needsAccessibility && song.needsSubgenres ? ' + ' : ''}${song.needsSubgenres ? 'Subgenres' : ''})...`);

      geminiResult = await classifySong(song.artist, song.title, {
        bpm: song.bpm,
        energy: song.energy
      });

      // Log to BrainTrust
      if (braintrustLogger && geminiResult) {
        braintrustLogger.log({
          input: {
            artist: song.artist,
            title: song.title,
            needs: {
              accessibility: song.needsAccessibility,
              subgenres: song.needsSubgenres
            }
          },
          output: {
            accessibility: geminiResult.accessibility,
            subgenres: [geminiResult.subgenre1, geminiResult.subgenre2, geminiResult.subgenre3].filter(Boolean),
            reasoning: geminiResult.reasoning
          },
          metadata: {
            type: 'gemini_enrichment',
            status: geminiResult.status
          }
        });
      }
    }

    // Run Parallel AI if we need EXPLICIT
    if (song.needsExplicit) {
      console.log(`${logPrefix} → Parallel AI (EXPLICIT)...`);
      explicitResult = await classifyExplicitContent(song.artist, song.title);
    }

    // Merge results, preserving curator data
    const enrichedSong = {
      ...song,

      // Only update ACCESSIBILITY if it was missing
      accessibility: song.needsAccessibility && geminiResult?.accessibility
        ? geminiResult.accessibility
        : song.accessibility,

      // Only add musical subgenres if they were missing
      musicalSubgenres: song.needsSubgenres && geminiResult
        ? [geminiResult.subgenre1, geminiResult.subgenre2, geminiResult.subgenre3].filter(Boolean)
        : song.musicalSubgenres,

      // Only update EXPLICIT if it was missing
      explicit: song.needsExplicit && explicitResult?.classification
        ? explicitResult.classification
        : song.explicit,

      // Track what was added
      enrichmentStatus: 'enriched',
      accessibilityAdded: song.needsAccessibility && geminiResult?.accessibility ? true : false,
      subgenresAdded: song.needsSubgenres && geminiResult ? true : false,
      explicitAdded: song.needsExplicit && explicitResult?.classification ? true : false,

      // Store AI reasoning if available
      aiReasoning: geminiResult?.reasoning || null
    };

    // Rebuild subgenreRaw to include playlists + musical subgenres
    enrichedSong.subgenreRaw = [...enrichedSong.playlists, ...enrichedSong.musicalSubgenres].join(';');

    console.log(`${logPrefix} → ✓ Enriched`);

    return enrichedSong;

  } catch (error) {
    console.log(`${logPrefix} → ✗ Error: ${error.message}`);

    return {
      ...song,
      enrichmentStatus: 'error',
      enrichmentError: error.message,
      accessibilityAdded: false,
      subgenresAdded: false,
      explicitAdded: false
    };
  }
}

/**
 * Exports enriched results to CSV
 */
async function exportEnrichedCSV(results, originalPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const basename = path.basename(originalPath, '.csv');
  const outputDir = path.join('outputs', 'merged');

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, `${basename}-enriched-${timestamp}.csv`);

  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      { id: 'artist', title: 'Artist' },
      { id: 'title', title: 'Name' },
      { id: 'energy', title: 'Energy' },
      { id: 'bpm', title: 'BPM' },
      { id: 'subgenreRaw', title: 'Subgenre' },
      { id: 'isrc', title: 'ISRC' },
      { id: 'accessibility', title: 'ACCESSIBILITY' },
      { id: 'explicit', title: 'EXPLICIT' },
      { id: 'tags', title: 'TAGS' }
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
  const skipped = results.filter(r => r.enrichmentStatus === 'skipped').length;
  const enriched = results.filter(r => r.enrichmentStatus === 'enriched').length;
  const errors = results.filter(r => r.enrichmentStatus === 'error').length;

  const accessibilityAdded = results.filter(r => r.accessibilityAdded).length;
  const subgenresAdded = results.filter(r => r.subgenresAdded).length;
  const explicitAdded = results.filter(r => r.explicitAdded).length;

  return {
    total,
    skipped,
    enriched,
    errors,
    accessibilityAdded,
    subgenresAdded,
    explicitAdded
  };
}

// Run the script
enrichCuratorCSV().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
