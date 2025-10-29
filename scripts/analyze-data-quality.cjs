/**
 * Data Quality Analysis Dashboard
 *
 * Analyzes the cache masterlist and generates comprehensive quality metrics:
 * - ISRC coverage
 * - Explicit content distribution
 * - User-corrected records
 * - Potential duplicates
 * - Cost savings estimates
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Configuration
const CACHE_PATH = process.env.CACHE_PATH || 'test-data/Raina Cache Masterlist - Cache.csv';
const PARALLEL_AI_COST_PER_SONG = 0.01; // Estimated $0.01 per song

/**
 * Normalize string for comparison
 */
function normalizeString(str) {
  if (!str) return '';
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Load and parse CSV data
 */
function loadCacheData() {
  console.log(`📂 Loading cache data from: ${CACHE_PATH}\n`);

  const fileContent = fs.readFileSync(CACHE_PATH, 'utf-8');
  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_quotes: true,
    relax_column_count: true
  });

  console.log(`✓ Loaded ${records.length.toLocaleString()} songs\n`);
  return records;
}

/**
 * Analyze ISRC coverage
 */
function analyzeISRCCoverage(records) {
  const withISRC = records.filter(r => r.ISRC && r.ISRC.trim() !== '');
  const withoutISRC = records.filter(r => !r.ISRC || r.ISRC.trim() === '');

  return {
    total: records.length,
    withISRC: withISRC.length,
    withoutISRC: withoutISRC.length,
    coverage: ((withISRC.length / records.length) * 100).toFixed(2)
  };
}

/**
 * Analyze explicit content distribution
 */
function analyzeExplicitContent(records) {
  const explicit = records.filter(r => r['Explicit Scoring'] === 'Explicit');
  const suggestive = records.filter(r => r['Explicit Scoring'] === 'Suggestive');
  const familyFriendly = records.filter(r => r['Explicit Scoring'] === 'Family Friendly');
  const unknown = records.filter(r => !r['Explicit Scoring'] || r['Explicit Scoring'].trim() === '');

  const withReasoning = records.filter(r =>
    r['Explicit Instance'] &&
    r['Explicit Instance'].trim() !== '' &&
    r['Explicit Instance'] !== 'null'
  );

  return {
    total: records.length,
    explicit: {
      count: explicit.length,
      percentage: ((explicit.length / records.length) * 100).toFixed(2),
      withReasoning: explicit.filter(r => r['Explicit Instance'] && r['Explicit Instance'] !== 'null').length
    },
    suggestive: {
      count: suggestive.length,
      percentage: ((suggestive.length / records.length) * 100).toFixed(2)
    },
    familyFriendly: {
      count: familyFriendly.length,
      percentage: ((familyFriendly.length / records.length) * 100).toFixed(2)
    },
    unknown: {
      count: unknown.length,
      percentage: ((unknown.length / records.length) * 100).toFixed(2)
    },
    totalWithExplicitScore: records.length - unknown.length,
    coverage: (((records.length - unknown.length) / records.length) * 100).toFixed(2),
    withReasoning: withReasoning.length
  };
}

/**
 * Analyze user-corrected records
 */
function analyzeUserCorrections(records) {
  const energyFeedback = records.filter(r =>
    r['Energy Feedback Status'] &&
    r['Energy Feedback Status'].includes('User Corrected')
  );

  const accessibilityCorrections = records.filter(r =>
    r['Correction Status'] &&
    r['Correction Status'].includes('User Corrected')
  );

  const totalUserCorrected = records.filter(r =>
    (r['Energy Feedback Status'] && r['Energy Feedback Status'].includes('User Corrected')) ||
    (r['Correction Status'] && r['Correction Status'].includes('User Corrected'))
  );

  // Extract accessibility values from corrected records
  const accessibilityValues = {};
  accessibilityCorrections.forEach(r => {
    const value = r['Accessibility Score'] || 'Unknown';
    accessibilityValues[value] = (accessibilityValues[value] || 0) + 1;
  });

  return {
    total: totalUserCorrected.length,
    energyFeedback: energyFeedback.length,
    accessibility: {
      count: accessibilityCorrections.length,
      values: accessibilityValues
    }
  };
}

/**
 * Detect potential duplicates
 */
function findPotentialDuplicates(records) {
  const seen = new Map();
  const duplicates = [];

  records.forEach((record, index) => {
    const key = normalizeString(record.Artist) + '|||' + normalizeString(record.Title);

    if (seen.has(key)) {
      duplicates.push({
        artist: record.Artist,
        title: record.Title,
        firstIndex: seen.get(key),
        duplicateIndex: index,
        isrc1: records[seen.get(key)].ISRC || 'N/A',
        isrc2: record.ISRC || 'N/A'
      });
    } else {
      seen.set(key, index);
    }
  });

  return duplicates;
}

/**
 * Analyze energy distribution
 */
function analyzeEnergyDistribution(records) {
  const distribution = {
    'Very Low': 0,
    'Low': 0,
    'Medium': 0,
    'High': 0,
    'Very High': 0,
    'Unknown': 0
  };

  records.forEach(r => {
    const label = r['Energy Label'] || 'Unknown';
    distribution[label] = (distribution[label] || 0) + 1;
  });

  // Calculate average numeric score
  const scores = records
    .map(r => parseFloat(r['Energy Score']))
    .filter(s => !isNaN(s));

  const avgScore = scores.length > 0
    ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2)
    : 'N/A';

  return {
    distribution,
    averageScore: avgScore,
    totalWithScore: scores.length
  };
}

/**
 * Calculate cost savings from existing explicit scores
 */
function calculateCostSavings(explicitData) {
  const existingScores = explicitData.totalWithExplicitScore;
  const estimatedSavings = existingScores * PARALLEL_AI_COST_PER_SONG;

  return {
    songsWithExistingScores: existingScores,
    costPerSong: PARALLEL_AI_COST_PER_SONG,
    estimatedSavings: estimatedSavings.toFixed(2),
    formatted: `$${estimatedSavings.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  };
}

/**
 * Generate and display dashboard
 */
function generateDashboard() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('           DATA QUALITY ANALYSIS DASHBOARD                 ');
  console.log('═══════════════════════════════════════════════════════════\n');

  const records = loadCacheData();

  // ISRC Coverage
  const isrcData = analyzeISRCCoverage(records);
  console.log('📊 ISRC COVERAGE');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Total Songs:           ${isrcData.total.toLocaleString()}`);
  console.log(`With ISRC:             ${isrcData.withISRC.toLocaleString()} (${isrcData.coverage}%)`);
  console.log(`Without ISRC:          ${isrcData.withoutISRC.toLocaleString()}`);
  console.log(`⚠️  Requires Fuzzy Matching: ${isrcData.withoutISRC.toLocaleString()} songs\n`);

  // Explicit Content
  const explicitData = analyzeExplicitContent(records);
  console.log('🔞 EXPLICIT CONTENT DISTRIBUTION');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Total Songs:           ${explicitData.total.toLocaleString()}`);
  console.log(`Coverage:              ${explicitData.coverage}%`);
  console.log('');
  console.log(`Family Friendly:       ${explicitData.familyFriendly.count.toLocaleString()} (${explicitData.familyFriendly.percentage}%)`);
  console.log(`Suggestive:            ${explicitData.suggestive.count.toLocaleString()} (${explicitData.suggestive.percentage}%)`);
  console.log(`Explicit:              ${explicitData.explicit.count.toLocaleString()} (${explicitData.explicit.percentage}%)`);
  console.log(`  └─ With reasoning:   ${explicitData.explicit.withReasoning.toLocaleString()}`);
  console.log(`Unknown:               ${explicitData.unknown.count.toLocaleString()} (${explicitData.unknown.percentage}%)`);
  console.log('');
  console.log(`✓ Total with scores:   ${explicitData.totalWithExplicitScore.toLocaleString()}`);
  console.log(`✓ With reasoning:      ${explicitData.withReasoning.toLocaleString()}\n`);

  // Cost Savings
  const savings = calculateCostSavings(explicitData);
  console.log('💰 PARALLEL AI COST SAVINGS');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Songs with existing scores:  ${savings.songsWithExistingScores.toLocaleString()}`);
  console.log(`Cost per song:               $${savings.costPerSong}`);
  console.log(`Estimated savings:           ${savings.formatted}`);
  console.log(`  (Avoid re-running Parallel AI on existing data)\n`);

  // User Corrections
  const corrections = analyzeUserCorrections(records);
  console.log('✏️  USER CORRECTIONS (High-Value Data)');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Total corrected:       ${corrections.total.toLocaleString()}`);
  console.log(`Energy feedback:       ${corrections.energyFeedback.toLocaleString()}`);
  console.log(`Accessibility:         ${corrections.accessibility.count.toLocaleString()}`);

  if (Object.keys(corrections.accessibility.values).length > 0) {
    console.log('\nAccessibility values:');
    Object.entries(corrections.accessibility.values)
      .sort((a, b) => b[1] - a[1])
      .forEach(([value, count]) => {
        console.log(`  ${value.padEnd(20)} ${count.toLocaleString()}`);
      });
  }
  console.log('');

  // Energy Distribution
  const energy = analyzeEnergyDistribution(records);
  console.log('⚡ ENERGY DISTRIBUTION');
  console.log('─────────────────────────────────────────────────────────');
  Object.entries(energy.distribution)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([label, count]) => {
      const percentage = ((count / records.length) * 100).toFixed(1);
      console.log(`${label.padEnd(15)} ${count.toLocaleString().padStart(6)} (${percentage}%)`);
    });
  console.log(`\nAverage Score:         ${energy.averageScore} / 10`);
  console.log(`Songs with score:      ${energy.totalWithScore.toLocaleString()}\n`);

  // Duplicates
  const duplicates = findPotentialDuplicates(records);
  console.log('🔍 POTENTIAL DUPLICATES');
  console.log('─────────────────────────────────────────────────────────');
  console.log(`Found ${duplicates.length.toLocaleString()} potential duplicates`);

  if (duplicates.length > 0 && duplicates.length <= 10) {
    console.log('\nSample duplicates:');
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`  "${dup.artist} - ${dup.title}"`);
      console.log(`    Rows: ${dup.firstIndex + 2}, ${dup.duplicateIndex + 2}`);
      console.log(`    ISRCs: ${dup.isrc1} | ${dup.isrc2}\n`);
    });
  } else if (duplicates.length > 10) {
    console.log('\nTop 5 duplicates (showing first 5 of many):');
    duplicates.slice(0, 5).forEach(dup => {
      console.log(`  "${dup.artist} - ${dup.title}" (rows ${dup.firstIndex + 2}, ${dup.duplicateIndex + 2})`);
    });
    console.log(`  ... and ${duplicates.length - 5} more\n`);
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('SUMMARY & RECOMMENDATIONS');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('✓ HIGH-VALUE DATA:');
  console.log(`  • ${explicitData.totalWithExplicitScore.toLocaleString()} songs with explicit scores (${savings.formatted} value)`);
  console.log(`  • ${corrections.total.toLocaleString()} user-corrected records (authoritative)`);
  console.log(`  • ${explicitData.withReasoning.toLocaleString()} songs with reasoning/instances\n`);

  console.log('⚠️  INTEGRATION NEEDS:');
  console.log(`  • ${isrcData.withoutISRC.toLocaleString()} songs need fuzzy matching (no ISRC)`);
  if (duplicates.length > 0) {
    console.log(`  • ${duplicates.length} potential duplicates to review`);
  }
  if (explicitData.unknown.count > 0) {
    console.log(`  • ${explicitData.unknown.count.toLocaleString()} songs missing explicit scores`);
  }

  console.log('\n💡 NEXT STEPS:');
  console.log('  1. Use merge-data-sources.cjs to combine with enriched data');
  console.log('  2. Preserve user corrections (highest priority)');
  console.log('  3. Reuse existing explicit scores to save costs');
  console.log('  4. Run fuzzy matching for songs without ISRCs');
  console.log('  5. Review duplicates for data quality\n');

  // Export JSON report
  const report = {
    timestamp: new Date().toISOString(),
    totalSongs: records.length,
    isrc: isrcData,
    explicit: explicitData,
    costSavings: savings,
    userCorrections: corrections,
    energy: energy,
    duplicates: {
      count: duplicates.length,
      samples: duplicates.slice(0, 10)
    }
  };

  const reportPath = 'outputs/data-quality-report.json';
  fs.mkdirSync('outputs', { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log(`📄 Detailed report saved to: ${reportPath}\n`);
  console.log('═══════════════════════════════════════════════════════════\n');
}

// Run dashboard
if (require.main === module) {
  try {
    generateDashboard();
  } catch (error) {
    console.error('Error generating dashboard:', error.message);
    process.exit(1);
  }
}

module.exports = { generateDashboard };
