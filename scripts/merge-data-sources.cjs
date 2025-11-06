#!/usr/bin/env node

/**
 * Multi-Source Data Merger Script
 *
 * Merges data from multiple sources with priority-based field resolution:
 *
 * Priority 1: User-corrected values (Accessibility, Energy feedback)
 * Priority 2: Existing explicit scores (from cache)
 * Priority 3: New Gemini classifications
 * Priority 4: Original energy scores
 *
 * Features:
 * - ISRC-based exact matching
 * - Fuzzy matching on Artist + Title for songs without ISRC
 * - Multi-artist format handling (commas, ampersands)
 * - Confidence scoring for fuzzy matches
 * - Detailed merge reporting and provenance tracking
 *
 * Usage:
 *   node scripts/merge-data-sources.cjs
 *   node scripts/merge-data-sources.cjs --cache=path/to/cache.csv
 *   node scripts/merge-data-sources.cjs --enriched=path/to/enriched.csv
 *   node scripts/merge-data-sources.cjs --output=path/to/output.csv
 *   node scripts/merge-data-sources.cjs --report=path/to/report.json
 *   node scripts/merge-data-sources.cjs --threshold=0.85
 *   node scripts/merge-data-sources.cjs --mode=conservative
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { createObjectCsvWriter } = require('csv-writer');
const { distance: levenshteinDistance } = require('fastest-levenshtein');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  cache: args.find(a => a.startsWith('--cache='))?.split('=')[1] ||
         'test-data/Raina Cache Masterlist - Cache.csv',
  enriched: args.find(a => a.startsWith('--enriched='))?.split('=')[1] || null,
  output: args.find(a => a.startsWith('--output='))?.split('=')[1] ||
          'outputs/merged-data.csv',
  reportOutput: args.find(a => a.startsWith('--report='))?.split('=')[1] ||
                'outputs/merge-report.json',
  threshold: parseFloat(args.find(a => a.startsWith('--threshold='))?.split('=')[1] || '0.85'),
  mode: args.find(a => a.startsWith('--mode='))?.split('=')[1] || 'balanced'
};

// Validate mode
const VALID_MODES = ['conservative', 'balanced', 'aggressive'];
if (!VALID_MODES.includes(options.mode)) {
  console.error(`Invalid mode: ${options.mode}. Must be one of: ${VALID_MODES.join(', ')}`);
  process.exit(1);
}

// Adjust thresholds based on mode
const thresholds = {
  conservative: { artist: 0.90, title: 0.90, combined: 0.92 },
  balanced: { artist: 0.85, title: 0.85, combined: 0.87 },
  aggressive: { artist: 0.75, title: 0.80, combined: 0.80 }
};

const matchThresholds = thresholds[options.mode];

console.log('='.repeat(80));
console.log('Multi-Source Data Merger');
console.log('='.repeat(80));
console.log(`Cache source:    ${options.cache}`);
console.log(`Enriched source: ${options.enriched || '[AUTO-DETECT]'}`);
console.log(`Output:          ${options.output}`);
console.log(`Report:          ${options.reportOutput}`);
console.log(`Match mode:      ${options.mode}`);
console.log(`Thresholds:      Artist=${matchThresholds.artist}, Title=${matchThresholds.title}, Combined=${matchThresholds.combined}`);
console.log('='.repeat(80));
console.log('');

/**
 * Normalizes a string for matching
 * @param {string} str - String to normalize
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ');   // Normalize whitespace
}

/**
 * Normalizes artist names, handling multi-artist formats
 * @param {string} artist - Artist string
 * @returns {string[]} Array of normalized artist names
 */
function normalizeArtists(artist) {
  if (!artist) return [];

  // Split on commas or ampersands
  const artists = artist
    .split(/[,&]/)
    .map(a => normalizeString(a))
    .filter(a => a.length > 0);

  return artists;
}

/**
 * Calculates similarity score between two strings (0-1)
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score (0-1, higher is better)
 */
function similarity(str1, str2) {
  const norm1 = normalizeString(str1);
  const norm2 = normalizeString(str2);

  if (norm1 === norm2) return 1.0;
  if (!norm1 || !norm2) return 0.0;

  const maxLen = Math.max(norm1.length, norm2.length);
  if (maxLen === 0) return 1.0;

  const dist = levenshteinDistance(norm1, norm2);
  return 1.0 - (dist / maxLen);
}

/**
 * Calculates artist similarity, handling multi-artist formats
 * @param {string} artist1 - First artist string
 * @param {string} artist2 - Second artist string
 * @returns {number} Best similarity score across all artist combinations
 */
function artistSimilarity(artist1, artist2) {
  const artists1 = normalizeArtists(artist1);
  const artists2 = normalizeArtists(artist2);

  if (artists1.length === 0 || artists2.length === 0) return 0.0;

  // Find best match among all combinations
  let bestScore = 0.0;
  for (const a1 of artists1) {
    for (const a2 of artists2) {
      const score = similarity(a1, a2);
      bestScore = Math.max(bestScore, score);
    }
  }

  return bestScore;
}

/**
 * Calculates combined match score for a song pair
 * @param {Object} song1 - First song
 * @param {Object} song2 - Second song
 * @returns {Object} Match result with scores
 */
function calculateMatchScore(song1, song2) {
  const artistScore = artistSimilarity(song1.Artist, song2.Artist);
  const titleScore = similarity(song1.Title, song2.Title);

  // Combined score (weighted average: 40% artist, 60% title)
  const combinedScore = (artistScore * 0.4) + (titleScore * 0.6);

  return {
    artistScore,
    titleScore,
    combinedScore,
    isMatch: artistScore >= matchThresholds.artist &&
             titleScore >= matchThresholds.title &&
             combinedScore >= matchThresholds.combined
  };
}

/**
 * Loads CSV file into array of objects
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Array>} Array of row objects
 */
function loadCSV(filePath) {
  return new Promise((resolve, reject) => {
    const rows = [];

    if (!fs.existsSync(filePath)) {
      reject(new Error(`File not found: ${filePath}`));
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });
}

/**
 * Auto-detects the most recent enriched CSV file
 * @returns {string} Path to most recent enriched CSV
 */
function autoDetectEnrichedFile() {
  const outputDir = 'outputs';

  if (!fs.existsSync(outputDir)) {
    throw new Error(`Output directory not found: ${outputDir}`);
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.endsWith('.csv') && f.includes('enriched'))
    .map(f => ({
      name: f,
      path: path.join(outputDir, f),
      mtime: fs.statSync(path.join(outputDir, f)).mtime
    }))
    .sort((a, b) => b.mtime - a.mtime);

  if (files.length === 0) {
    throw new Error('No enriched CSV files found in outputs directory');
  }

  console.log(`Auto-detected enriched file: ${files[0].name}`);
  return files[0].path;
}

/**
 * Builds ISRC index for fast lookups
 * @param {Array} songs - Array of songs
 * @returns {Map} ISRC to song mapping
 */
function buildISRCIndex(songs) {
  const index = new Map();

  for (const song of songs) {
    const isrc = song.ISRC?.trim();
    if (isrc && isrc !== 'NULL' && isrc !== '') {
      index.set(isrc, song);
    }
  }

  return index;
}

/**
 * Finds best fuzzy match for a song
 * @param {Object} targetSong - Song to match
 * @param {Array} candidateSongs - Potential matches
 * @param {Set} usedIndices - Already matched song indices
 * @returns {Object|null} Match result or null
 */
function findFuzzyMatch(targetSong, candidateSongs, usedIndices) {
  let bestMatch = null;
  let bestScore = 0;
  let bestIndex = -1;

  for (let i = 0; i < candidateSongs.length; i++) {
    if (usedIndices.has(i)) continue;

    const candidate = candidateSongs[i];
    const matchResult = calculateMatchScore(targetSong, candidate);

    if (matchResult.isMatch && matchResult.combinedScore > bestScore) {
      bestScore = matchResult.combinedScore;
      bestMatch = { ...matchResult, candidate };
      bestIndex = i;
    }
  }

  if (bestMatch && bestIndex !== -1) {
    usedIndices.add(bestIndex);
  }

  return bestMatch;
}

/**
 * Determines if a value is user-corrected
 * @param {Object} cacheRow - Cache row data
 * @returns {boolean} True if user corrected
 */
function isUserCorrected(cacheRow) {
  const correctionStatus = cacheRow['Correction Status']?.trim();
  const energyFeedback = cacheRow['Energy Feedback Status']?.trim();
  return correctionStatus === 'User Corrected' || energyFeedback === 'User Corrected';
}

/**
 * Merges a single cache row with enriched data
 * @param {Object} cacheRow - Cache masterlist row
 * @param {Object|null} enrichedRow - Enriched data row (or null)
 * @param {Object} matchInfo - Match metadata
 * @returns {Object} Merged row with provenance
 */
function mergeRows(cacheRow, enrichedRow, matchInfo) {
  const userCorrected = isUserCorrected(cacheRow);

  // Build provenance tracking
  const provenance = {
    match_type: matchInfo.matchType,
    match_score: matchInfo.matchScore,
    user_corrected: userCorrected,
    has_cache_explicit: !!cacheRow['Explicit Scoring'],
    has_enriched_data: !!enrichedRow
  };

  // Priority 1: User-corrected values (Accessibility, Energy)
  const accessibility = userCorrected && cacheRow['Accessibility Score']?.trim()
    ? cacheRow['Accessibility Score'].trim()
    : enrichedRow?.['AI Accessibility'] || '';

  const energy = userCorrected && cacheRow['Energy Label']?.trim()
    ? cacheRow['Energy Label'].trim()
    : enrichedRow?.['AI Energy'] || cacheRow['Energy Label'] || '';

  // Priority 2: Existing explicit scores (from cache)
  const explicitScore = cacheRow['Explicit Scoring']?.trim() ||
                        enrichedRow?.['AI Explicit'] || '';

  // Track data sources for each field
  const dataSources = {
    accessibility_source: userCorrected && cacheRow['Accessibility Score']?.trim()
      ? 'user_corrected'
      : (enrichedRow?.['AI Accessibility'] ? 'gemini' : 'none'),
    energy_source: userCorrected && cacheRow['Energy Label']?.trim()
      ? 'user_corrected'
      : (enrichedRow?.['AI Energy'] ? 'gemini' : (cacheRow['Energy Label'] ? 'cache' : 'none')),
    explicit_source: cacheRow['Explicit Scoring']?.trim()
      ? 'cache'
      : (enrichedRow?.['AI Explicit'] ? 'parallel_ai' : 'none')
  };

  // Build merged row
  return {
    // Core identifiers
    Artist: cacheRow.Artist || enrichedRow?.Artist || '',
    Title: cacheRow.Title || enrichedRow?.Title || '',
    ISRC: enrichedRow?.ISRC || cacheRow.ISRC || '',

    // Energy data (Priority: User > Gemini > Cache)
    'Energy Score': cacheRow['Energy Score'] || '',
    'Energy Label': energy,
    'Energy Feedback Status': cacheRow['Energy Feedback Status'] || '',

    // Accessibility (Priority: User > Gemini)
    'Accessibility Score': cacheRow['Accessibility Score'] || '',
    Accessibility: accessibility,
    'Correction Status': cacheRow['Correction Status'] || '',

    // Explicit content (Priority: Cache > Parallel AI)
    'Explicit Scoring': explicitScore,
    'Explicit Instance': cacheRow['Explicit Instance'] || '',
    'Explicit Score Fuzzy Match': cacheRow['Explicit Score Fuzzy Match'] || '',

    // Gemini classifications (from enriched data)
    BPM: enrichedRow?.BPM || '',
    'Original Energy': enrichedRow?.['Original Energy'] || '',
    'AI Energy': enrichedRow?.['AI Energy'] || '',
    'AI Accessibility': enrichedRow?.['AI Accessibility'] || '',
    'AI Explicit': enrichedRow?.['AI Explicit'] || '',
    'AI Subgenre 1': enrichedRow?.['AI Subgenre 1'] || '',
    'AI Subgenre 2': enrichedRow?.['AI Subgenre 2'] || '',
    'AI Subgenre 3': enrichedRow?.['AI Subgenre 3'] || '',
    'AI Reasoning': enrichedRow?.['AI Reasoning'] || '',
    'AI Context Used': enrichedRow?.['AI Context Used'] || '',
    'AI Status': enrichedRow?.['AI Status'] || '',
    'Processing Status': enrichedRow?.['Processing Status'] || '',

    // Cache metadata
    Flags: cacheRow.Flags || '',
    'Tagged Date': cacheRow['Tagged Date'] || '',
    'Source Sheet': cacheRow['Source Sheet'] || '',

    // Provenance tracking (for reporting)
    'Match Type': provenance.match_type,
    'Match Score': provenance.match_score?.toFixed(4) || '',
    'Accessibility Source': dataSources.accessibility_source,
    'Energy Source': dataSources.energy_source,
    'Explicit Source': dataSources.explicit_source,
    'User Corrected': provenance.user_corrected ? 'Yes' : 'No'
  };
}

/**
 * Main merge function
 */
async function mergeDataSources() {
  const startTime = Date.now();

  // Initialize stats
  const stats = {
    cache_total: 0,
    enriched_total: 0,
    isrc_matches: 0,
    fuzzy_matches: 0,
    unmatched_cache: 0,
    unmatched_enriched: 0,
    user_corrected_preserved: 0,
    cache_explicit_preserved: 0,
    fuzzy_match_scores: [],
    match_type_breakdown: {}
  };

  try {
    // 1. Load cache masterlist
    console.log('[1/5] Loading cache masterlist...');
    const cacheRows = await loadCSV(options.cache);
    stats.cache_total = cacheRows.length;
    console.log(`  ✓ Loaded ${stats.cache_total.toLocaleString()} songs from cache\n`);

    // 2. Load enriched data
    console.log('[2/5] Loading enriched data...');
    const enrichedPath = options.enriched || autoDetectEnrichedFile();
    const enrichedRows = await loadCSV(enrichedPath);
    stats.enriched_total = enrichedRows.length;
    console.log(`  ✓ Loaded ${stats.enriched_total.toLocaleString()} songs from enriched data\n`);

    // 3. Build ISRC index for enriched data
    console.log('[3/5] Building ISRC index...');
    const enrichedISRCIndex = buildISRCIndex(enrichedRows);
    console.log(`  ✓ Indexed ${enrichedISRCIndex.size.toLocaleString()} songs by ISRC\n`);

    // 4. Merge data
    console.log('[4/5] Merging data sources...');
    console.log(`  Mode: ${options.mode}`);
    console.log(`  Thresholds: Artist=${matchThresholds.artist}, Title=${matchThresholds.title}, Combined=${matchThresholds.combined}\n`);

    const mergedRows = [];
    const usedEnrichedIndices = new Set();
    const matchDetails = [];

    // Process each cache row
    let processedCount = 0;
    const progressInterval = Math.max(1, Math.floor(cacheRows.length / 20));

    for (const cacheRow of cacheRows) {
      processedCount++;

      if (processedCount % progressInterval === 0 || processedCount === cacheRows.length) {
        const percent = ((processedCount / cacheRows.length) * 100).toFixed(1);
        process.stdout.write(`\r  Progress: ${processedCount.toLocaleString()} / ${stats.cache_total.toLocaleString()} (${percent}%)`);
      }

      let enrichedRow = null;
      let matchInfo = {
        matchType: 'none',
        matchScore: 0
      };

      // Try ISRC match first
      const isrc = cacheRow.ISRC?.trim();
      if (isrc && isrc !== 'NULL' && isrc !== '') {
        enrichedRow = enrichedISRCIndex.get(isrc);
        if (enrichedRow) {
          matchInfo = {
            matchType: 'isrc_exact',
            matchScore: 1.0
          };
          stats.isrc_matches++;

          // Mark this enriched row as used
          const enrichedIndex = enrichedRows.indexOf(enrichedRow);
          if (enrichedIndex !== -1) {
            usedEnrichedIndices.add(enrichedIndex);
          }
        }
      }

      // Try fuzzy match if no ISRC match
      if (!enrichedRow) {
        const fuzzyMatch = findFuzzyMatch(cacheRow, enrichedRows, usedEnrichedIndices);
        if (fuzzyMatch) {
          enrichedRow = fuzzyMatch.candidate;
          matchInfo = {
            matchType: 'fuzzy',
            matchScore: fuzzyMatch.combinedScore,
            artistScore: fuzzyMatch.artistScore,
            titleScore: fuzzyMatch.titleScore
          };
          stats.fuzzy_matches++;
          stats.fuzzy_match_scores.push(fuzzyMatch.combinedScore);

          matchDetails.push({
            cache_artist: cacheRow.Artist,
            cache_title: cacheRow.Title,
            enriched_artist: enrichedRow.Artist,
            enriched_title: enrichedRow.Title,
            artist_score: fuzzyMatch.artistScore.toFixed(4),
            title_score: fuzzyMatch.titleScore.toFixed(4),
            combined_score: fuzzyMatch.combinedScore.toFixed(4)
          });
        }
      }

      // Track user corrections
      if (isUserCorrected(cacheRow)) {
        stats.user_corrected_preserved++;
      }

      // Track cache explicit preservation
      if (cacheRow['Explicit Scoring']?.trim()) {
        stats.cache_explicit_preserved++;
      }

      // Track match types
      stats.match_type_breakdown[matchInfo.matchType] =
        (stats.match_type_breakdown[matchInfo.matchType] || 0) + 1;

      // Merge rows
      const mergedRow = mergeRows(cacheRow, enrichedRow, matchInfo);
      mergedRows.push(mergedRow);

      if (!enrichedRow) {
        stats.unmatched_cache++;
      }
    }

    console.log('\n');

    // Track unmatched enriched rows
    stats.unmatched_enriched = enrichedRows.length - usedEnrichedIndices.size;

    // 5. Export merged data
    console.log('[5/5] Exporting merged data...');

    // Ensure output directory exists
    const outputDir = path.dirname(options.output);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Define CSV columns
    const columns = [
      { id: 'Artist', title: 'Artist' },
      { id: 'Title', title: 'Title' },
      { id: 'ISRC', title: 'ISRC' },
      { id: 'BPM', title: 'BPM' },
      { id: 'Energy Score', title: 'Energy Score' },
      { id: 'Energy Label', title: 'Energy Label' },
      { id: 'Energy Feedback Status', title: 'Energy Feedback Status' },
      { id: 'Original Energy', title: 'Original Energy' },
      { id: 'AI Energy', title: 'AI Energy' },
      { id: 'Accessibility Score', title: 'Accessibility Score' },
      { id: 'Accessibility', title: 'Accessibility' },
      { id: 'Correction Status', title: 'Correction Status' },
      { id: 'AI Accessibility', title: 'AI Accessibility' },
      { id: 'Explicit Scoring', title: 'Explicit Scoring' },
      { id: 'Explicit Instance', title: 'Explicit Instance' },
      { id: 'Explicit Score Fuzzy Match', title: 'Explicit Score Fuzzy Match' },
      { id: 'AI Explicit', title: 'AI Explicit' },
      { id: 'AI Subgenre 1', title: 'AI Subgenre 1' },
      { id: 'AI Subgenre 2', title: 'AI Subgenre 2' },
      { id: 'AI Subgenre 3', title: 'AI Subgenre 3' },
      { id: 'AI Reasoning', title: 'AI Reasoning' },
      { id: 'AI Context Used', title: 'AI Context Used' },
      { id: 'AI Status', title: 'AI Status' },
      { id: 'Processing Status', title: 'Processing Status' },
      { id: 'Flags', title: 'Flags' },
      { id: 'Tagged Date', title: 'Tagged Date' },
      { id: 'Source Sheet', title: 'Source Sheet' },
      { id: 'Match Type', title: 'Match Type' },
      { id: 'Match Score', title: 'Match Score' },
      { id: 'Accessibility Source', title: 'Accessibility Source' },
      { id: 'Energy Source', title: 'Energy Source' },
      { id: 'Explicit Source', title: 'Explicit Source' },
      { id: 'User Corrected', title: 'User Corrected' }
    ];

    const csvWriter = createObjectCsvWriter({
      path: options.output,
      header: columns
    });

    await csvWriter.writeRecords(mergedRows);
    console.log(`  ✓ Exported ${mergedRows.length.toLocaleString()} merged rows to ${options.output}\n`);

    // 6. Generate detailed report
    console.log('[6/6] Generating merge report...');

    // Calculate fuzzy match statistics
    const fuzzyStats = stats.fuzzy_match_scores.length > 0 ? {
      count: stats.fuzzy_match_scores.length,
      min: Math.min(...stats.fuzzy_match_scores).toFixed(4),
      max: Math.max(...stats.fuzzy_match_scores).toFixed(4),
      avg: (stats.fuzzy_match_scores.reduce((a, b) => a + b, 0) / stats.fuzzy_match_scores.length).toFixed(4),
      median: stats.fuzzy_match_scores.sort((a, b) => a - b)[Math.floor(stats.fuzzy_match_scores.length / 2)].toFixed(4)
    } : null;

    const report = {
      metadata: {
        generated_at: new Date().toISOString(),
        cache_source: options.cache,
        enriched_source: enrichedPath,
        output_file: options.output,
        match_mode: options.mode,
        thresholds: matchThresholds,
        processing_time_seconds: ((Date.now() - startTime) / 1000).toFixed(2)
      },
      summary: {
        cache_total: stats.cache_total,
        enriched_total: stats.enriched_total,
        merged_total: mergedRows.length,
        match_rate: ((stats.isrc_matches + stats.fuzzy_matches) / stats.cache_total * 100).toFixed(2) + '%'
      },
      matches: {
        isrc_exact: stats.isrc_matches,
        fuzzy: stats.fuzzy_matches,
        total_matched: stats.isrc_matches + stats.fuzzy_matches,
        unmatched_cache: stats.unmatched_cache,
        unmatched_enriched: stats.unmatched_enriched
      },
      match_type_breakdown: stats.match_type_breakdown,
      fuzzy_match_statistics: fuzzyStats,
      data_preservation: {
        user_corrected_preserved: stats.user_corrected_preserved,
        cache_explicit_preserved: stats.cache_explicit_preserved
      },
      fuzzy_match_details: {
        total_count: matchDetails.length,
        sample_matches: matchDetails.slice(0, 20), // First 20 fuzzy matches
        low_confidence_matches: matchDetails
          .filter(m => parseFloat(m.combined_score) < (matchThresholds.combined + 0.05))
          .slice(0, 10) // First 10 low-confidence matches
      }
    };

    fs.writeFileSync(options.reportOutput, JSON.stringify(report, null, 2));
    console.log(`  ✓ Generated merge report: ${options.reportOutput}\n`);

    // 7. Print summary
    console.log('='.repeat(80));
    console.log('MERGE SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total cache songs:           ${stats.cache_total.toLocaleString()}`);
    console.log(`Total enriched songs:        ${stats.enriched_total.toLocaleString()}`);
    console.log(`Total merged rows:           ${mergedRows.length.toLocaleString()}`);
    console.log('');
    console.log('MATCHES:');
    console.log(`  ISRC exact matches:        ${stats.isrc_matches.toLocaleString()} (${(stats.isrc_matches/stats.cache_total*100).toFixed(2)}%)`);
    console.log(`  Fuzzy matches:             ${stats.fuzzy_matches.toLocaleString()} (${(stats.fuzzy_matches/stats.cache_total*100).toFixed(2)}%)`);
    console.log(`  Total matched:             ${(stats.isrc_matches + stats.fuzzy_matches).toLocaleString()} (${((stats.isrc_matches + stats.fuzzy_matches)/stats.cache_total*100).toFixed(2)}%)`);
    console.log(`  Unmatched cache:           ${stats.unmatched_cache.toLocaleString()} (${(stats.unmatched_cache/stats.cache_total*100).toFixed(2)}%)`);
    console.log(`  Unmatched enriched:        ${stats.unmatched_enriched.toLocaleString()}`);
    console.log('');

    if (fuzzyStats) {
      console.log('FUZZY MATCH QUALITY:');
      console.log(`  Min score:                 ${fuzzyStats.min}`);
      console.log(`  Max score:                 ${fuzzyStats.max}`);
      console.log(`  Average score:             ${fuzzyStats.avg}`);
      console.log(`  Median score:              ${fuzzyStats.median}`);
      console.log('');
    }

    console.log('DATA PRESERVATION:');
    console.log(`  User corrections preserved: ${stats.user_corrected_preserved.toLocaleString()}`);
    console.log(`  Cache explicit preserved:   ${stats.cache_explicit_preserved.toLocaleString()}`);
    console.log('');
    console.log(`Processing time:             ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
    console.log('='.repeat(80));
    console.log('');
    console.log(`✓ Merge complete!`);
    console.log(`  Output: ${options.output}`);
    console.log(`  Report: ${options.reportOutput}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Error during merge:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the merger
mergeDataSources().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
