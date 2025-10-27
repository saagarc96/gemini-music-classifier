// Orchestrator: End-to-End Batch Processing Automation

const { prepareBatchInput } = require('./prepare-batch-input');
const { submitBatchJob } = require('./submit-batch-job');
const { monitorBatchJob } = require('./monitor-batch-job');
const { processBatchResults } = require('./process-batch-results');
const { exportToCSV } = require('./export-to-csv');

/**
 * Runs the complete batch processing pipeline
 */
async function runBatchPipeline() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('🚀 Music Classification Batch Processing Pipeline');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const startTime = Date.now();

  try {
    // Phase 1: Prepare Input
    console.log('━━━ PHASE 1/5: Prepare Batch Input ━━━\n');
    await prepareBatchInput();
    console.log('');

    // Phase 2: Submit Job
    console.log('━━━ PHASE 2/5: Submit Batch Job ━━━\n');
    await submitBatchJob();
    console.log('');

    // Phase 3: Monitor (this will take the longest)
    console.log('━━━ PHASE 3/5: Monitor Batch Job ━━━\n');
    console.log('⏰ This phase may take 12-24 hours. The script will poll every 5 minutes.\n');
    console.log('💡 Tip: You can safely close this window and restart monitoring later');
    console.log('   by running: node batch-processing/monitor-batch-job.js\n');

    await monitorBatchJob();
    console.log('');

    // Phase 4: Process Results
    console.log('━━━ PHASE 4/5: Process Batch Results ━━━\n');
    await processBatchResults();
    console.log('');

    // Phase 5: Export to CSV
    console.log('━━━ PHASE 5/5: Export to CSV ━━━\n');
    const exportResult = await exportToCSV();
    console.log('');

    // Final Summary
    const totalTime = Date.now() - startTime;
    const hours = Math.floor(totalTime / (1000 * 60 * 60));
    const minutes = Math.floor((totalTime % (1000 * 60 * 60)) / (1000 * 60));

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('✅ BATCH PROCESSING COMPLETE!');
    console.log('═══════════════════════════════════════════════════════════════\n');

    console.log('⏱️  Total Pipeline Time:', `${hours}h ${minutes}m`);
    console.log('📁 Output File:', exportResult.outputPath);
    console.log('📊 Total Songs:', exportResult.stats.total);
    console.log('✅ Success Rate:', `${(exportResult.stats.success / exportResult.stats.total * 100).toFixed(1)}%\n`);

    console.log('🎉 Your CSV is ready for database import!\n');

    process.exit(0);

  } catch (error) {
    console.error('\n═══════════════════════════════════════════════════════════════');
    console.error('❌ PIPELINE ERROR');
    console.error('═══════════════════════════════════════════════════════════════\n');
    console.error('Error:', error.message);
    console.error('\nStack trace:', error.stack);
    console.error('\n💡 Tip: You can resume from where you left off by running the');
    console.error('   individual phase scripts (e.g., monitor-batch-job.js)\n');
    process.exit(1);
  }
}

// Run the pipeline
if (require.main === module) {
  runBatchPipeline();
}

module.exports = { runBatchPipeline };
