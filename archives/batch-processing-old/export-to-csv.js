// Phase 5: Export to CSV with Expanded Columns

const fs = require('fs');
const path = require('path');
const { createObjectCsvWriter } = require('csv-writer');
const config = require('./config.json');

/**
 * Exports processed results to CSV with expanded columns
 */
async function exportToCSV() {
  console.log('📊 Phase 5: Exporting to CSV\n');

  // Load processed results
  const processedPath = path.join(config.outputDir, 'processed-results.json');
  if (!fs.existsSync(processedPath)) {
    throw new Error('Processed results not found. Run process-batch-results.js first.');
  }

  const results = JSON.parse(fs.readFileSync(processedPath, 'utf-8'));
  console.log(`✓ Loaded ${results.length} processed results\n`);

  // Create output filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outputPath = path.join(config.outputDir, `batch-output-${timestamp}.csv`);

  console.log('📝 Creating CSV with expanded columns...');

  // Define CSV writer with all columns
  const csvWriter = createObjectCsvWriter({
    path: outputPath,
    header: [
      // Original columns
      { id: 'title', title: 'title' },
      { id: 'artist', title: 'artist' },
      { id: 'energy', title: 'energy' },
      { id: 'isrc', title: 'isrc' },
      { id: 'bpm', title: 'bpm' },
      { id: 'subgenre', title: 'subgenre' },
      { id: 'artwork', title: 'artwork' },
      { id: 'source_file', title: 'source_file' },

      // New AI-generated columns (expanded format)
      { id: 'ai_status', title: 'ai_status' },
      { id: 'ai_error_message', title: 'ai_error_message' },
      { id: 'ai_reasoning', title: 'ai_reasoning' },
      { id: 'ai_context_used', title: 'ai_context_used' },
      { id: 'ai_energy', title: 'ai_energy' },
      { id: 'ai_accessibility', title: 'ai_accessibility' },
      { id: 'ai_subgenre_1', title: 'ai_subgenre_1' },
      { id: 'ai_subgenre_2', title: 'ai_subgenre_2' },
      { id: 'ai_subgenre_3', title: 'ai_subgenre_3' }
    ]
  });

  // Write CSV
  await csvWriter.writeRecords(results);

  console.log(`✅ CSV export complete!\n`);
  console.log(`📁 Output file: ${outputPath}`);
  console.log(`📊 Total rows: ${results.length}`);
  console.log(`📋 Total columns: 16 (8 original + 8 AI fields)\n`);

  // Display column summary
  console.log('📋 Column Summary:');
  console.log('   Original Columns (8):');
  console.log('     - title, artist, energy, isrc, bpm, subgenre, artwork, source_file');
  console.log('   AI Generated Columns (8):');
  console.log('     - ai_status, ai_error_message, ai_reasoning, ai_context_used');
  console.log('     - ai_energy, ai_accessibility');
  console.log('     - ai_subgenre_1, ai_subgenre_2, ai_subgenre_3\n');

  // Statistics
  const stats = {
    total: results.length,
    success: results.filter(r => r.ai_status === 'SUCCESS').length,
    humanReview: results.filter(r => r.ai_status === 'HUMAN_REVIEW').length,
    invalidInput: results.filter(r => r.ai_status === 'INVALID_INPUT').length,
    errors: results.filter(r => r.ai_status === 'ERROR').length
  };

  console.log('📊 Final Statistics:');
  console.log(`   ✓ Success: ${stats.success} (${(stats.success / stats.total * 100).toFixed(1)}%)`);
  console.log(`   👤 Human Review: ${stats.humanReview} (${(stats.humanReview / stats.total * 100).toFixed(1)}%)`);
  console.log(`   ⚠️  Invalid Input: ${stats.invalidInput} (${(stats.invalidInput / stats.total * 100).toFixed(1)}%)`);
  console.log(`   ❌ Errors: ${stats.errors} (${(stats.errors / stats.total * 100).toFixed(1)}%)\n`);

  console.log('✅ All phases complete! CSV is ready for database import.\n');

  return {
    outputPath,
    stats
  };
}

// Run if called directly
if (require.main === module) {
  exportToCSV()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { exportToCSV };
