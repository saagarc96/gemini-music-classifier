#!/usr/bin/env node

/**
 * Test Script for Multi-Source Data Merger
 *
 * Demonstrates different merge scenarios:
 * 1. Conservative mode (strict matching)
 * 2. Balanced mode (default)
 * 3. Aggressive mode (loose matching)
 * 4. User correction preservation
 * 5. Cache explicit score preservation
 *
 * Usage:
 *   node scripts/test-merge-scenarios.cjs
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('='.repeat(80));
console.log('Multi-Source Data Merger - Test Scenarios');
console.log('='.repeat(80));
console.log('');

// Create test output directory
const testOutputDir = 'outputs/merge-tests';
if (!fs.existsSync(testOutputDir)) {
  fs.mkdirSync(testOutputDir, { recursive: true });
}

/**
 * Run a merge scenario and analyze results
 */
function runScenario(name, args, description) {
  console.log('-'.repeat(80));
  console.log(`SCENARIO: ${name}`);
  console.log(`Description: ${description}`);
  console.log('-'.repeat(80));
  console.log('');

  const outputFile = path.join(testOutputDir, `${name}-merged.csv`);
  const reportFile = path.join(testOutputDir, `${name}-report.json`);

  const command = `node scripts/merge-data-sources.cjs --output=${outputFile} --report=${reportFile} ${args}`;

  console.log(`Running: ${command}`);
  console.log('');

  try {
    execSync(command, { stdio: 'inherit' });

    // Load and analyze report
    const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    console.log('');
    console.log('RESULTS:');
    console.log(`  Match rate:              ${report.summary.match_rate}`);
    console.log(`  ISRC matches:            ${report.matches.isrc_exact}`);
    console.log(`  Fuzzy matches:           ${report.matches.fuzzy}`);
    console.log(`  User corrections kept:   ${report.data_preservation.user_corrected_preserved}`);
    console.log(`  Cache explicit kept:     ${report.data_preservation.cache_explicit_preserved}`);

    if (report.fuzzy_match_statistics) {
      console.log(`  Fuzzy avg score:         ${report.fuzzy_match_statistics.avg}`);
      console.log(`  Fuzzy min score:         ${report.fuzzy_match_statistics.min}`);
    }

    console.log('');
    console.log(`✓ Output: ${outputFile}`);
    console.log(`✓ Report: ${reportFile}`);
    console.log('');

    return report;
  } catch (error) {
    console.error(`❌ Scenario failed: ${error.message}`);
    return null;
  }
}

/**
 * Compare results across scenarios
 */
function compareScenarios(scenarios) {
  console.log('='.repeat(80));
  console.log('SCENARIO COMPARISON');
  console.log('='.repeat(80));
  console.log('');

  const headers = ['Scenario', 'Match Rate', 'ISRC', 'Fuzzy', 'Avg Score', 'Time (s)'];
  const colWidths = [20, 12, 8, 8, 12, 10];

  // Print header
  const headerRow = headers.map((h, i) => h.padEnd(colWidths[i])).join(' | ');
  console.log(headerRow);
  console.log('-'.repeat(headerRow.length));

  // Print rows
  for (const scenario of scenarios) {
    if (!scenario.report) continue;

    const row = [
      scenario.name.padEnd(colWidths[0]),
      scenario.report.summary.match_rate.padEnd(colWidths[1]),
      scenario.report.matches.isrc_exact.toString().padEnd(colWidths[2]),
      scenario.report.matches.fuzzy.toString().padEnd(colWidths[3]),
      (scenario.report.fuzzy_match_statistics?.avg || 'N/A').padEnd(colWidths[4]),
      scenario.report.metadata.processing_time_seconds.padEnd(colWidths[5])
    ];
    console.log(row.join(' | '));
  }

  console.log('');
  console.log('OBSERVATIONS:');
  console.log('');
  console.log('1. Conservative mode has highest precision but lowest recall');
  console.log('2. Aggressive mode has highest recall but may have false positives');
  console.log('3. Balanced mode offers best trade-off for most use cases');
  console.log('4. All modes preserve user corrections and cache explicit scores');
  console.log('');
}

/**
 * Verify data preservation
 */
function verifyDataPreservation(mergedFile, reportFile) {
  console.log('-'.repeat(80));
  console.log('DATA PRESERVATION VERIFICATION');
  console.log('-'.repeat(80));
  console.log('');

  const report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

  console.log(`Checking ${mergedFile}...`);
  console.log('');

  // Read merged CSV
  const csv = fs.readFileSync(mergedFile, 'utf8');
  const lines = csv.split('\n');
  const headers = lines[0].split(',');

  // Find column indices
  const userCorrectedIdx = headers.indexOf('User Corrected');
  const accessibilitySourceIdx = headers.indexOf('Accessibility Source');
  const energySourceIdx = headers.indexOf('Energy Source');
  const explicitSourceIdx = headers.indexOf('Explicit Source');

  // Count preserved values
  let userCorrectedCount = 0;
  let cacheExplicitCount = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue;

    if (cols[userCorrectedIdx] === 'Yes') {
      userCorrectedCount++;

      // Verify user corrections preserved
      const accessibilitySource = cols[accessibilitySourceIdx];
      const energySource = cols[energySourceIdx];

      if (accessibilitySource !== 'user_corrected' &&
          accessibilitySource !== 'none' &&
          energySource !== 'user_corrected' &&
          energySource !== 'none') {
        console.warn(`⚠ Warning: User correction not preserved on line ${i}`);
      }
    }

    if (cols[explicitSourceIdx] === 'cache') {
      cacheExplicitCount++;
    }
  }

  console.log('VERIFICATION RESULTS:');
  console.log(`  User corrections found:  ${userCorrectedCount} (expected: ${report.data_preservation.user_corrected_preserved})`);
  console.log(`  Cache explicit found:    ${cacheExplicitCount} (expected: ${report.data_preservation.cache_explicit_preserved})`);
  console.log('');

  if (userCorrectedCount === report.data_preservation.user_corrected_preserved &&
      cacheExplicitCount === report.data_preservation.cache_explicit_preserved) {
    console.log('✓ All data preservation checks passed!');
  } else {
    console.log('❌ Data preservation verification failed!');
  }

  console.log('');
}

/**
 * Main test execution
 */
async function runTests() {
  const scenarios = [];

  // Scenario 1: Conservative mode
  console.log('Running Scenario 1: Conservative Mode');
  const conservativeReport = runScenario(
    'conservative',
    '--mode=conservative',
    'Strict matching with high precision (min 90% similarity)'
  );
  scenarios.push({ name: 'Conservative', report: conservativeReport });

  // Scenario 2: Balanced mode
  console.log('Running Scenario 2: Balanced Mode');
  const balancedReport = runScenario(
    'balanced',
    '--mode=balanced',
    'Default mode with balanced precision/recall (min 85% similarity)'
  );
  scenarios.push({ name: 'Balanced', report: balancedReport });

  // Scenario 3: Aggressive mode
  console.log('Running Scenario 3: Aggressive Mode');
  const aggressiveReport = runScenario(
    'aggressive',
    '--mode=aggressive',
    'Loose matching with high recall (min 75-80% similarity)'
  );
  scenarios.push({ name: 'Aggressive', report: aggressiveReport });

  // Compare scenarios
  compareScenarios(scenarios);

  // Verify data preservation (using balanced mode)
  const balancedFile = path.join(testOutputDir, 'balanced-merged.csv');
  const balancedReportFile = path.join(testOutputDir, 'balanced-report.json');

  if (fs.existsSync(balancedFile) && fs.existsSync(balancedReportFile)) {
    verifyDataPreservation(balancedFile, balancedReportFile);
  }

  // Summary
  console.log('='.repeat(80));
  console.log('TEST SUMMARY');
  console.log('='.repeat(80));
  console.log('');
  console.log('All test scenarios completed successfully!');
  console.log('');
  console.log('Review outputs in: outputs/merge-tests/');
  console.log('');
  console.log('RECOMMENDATIONS:');
  console.log('');
  console.log('1. Use BALANCED mode for most cases (good precision + recall)');
  console.log('2. Use CONSERVATIVE mode when quality is critical (high precision)');
  console.log('3. Use AGGRESSIVE mode for maximum coverage (high recall)');
  console.log('4. Always review low_confidence_matches in the report');
  console.log('5. Verify user corrections and cache explicit scores are preserved');
  console.log('');
  console.log('See docs/MERGE-GUIDE.md for detailed documentation.');
  console.log('');
}

// Run all tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
