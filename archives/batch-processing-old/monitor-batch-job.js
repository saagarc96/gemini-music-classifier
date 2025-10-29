// Phase 3: Monitor Batch Job Status

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const config = require('./config.json');

/**
 * Formats duration in human-readable format
 */
function formatDuration(ms) {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

/**
 * Monitors batch job until completion
 */
async function monitorBatchJob() {
  console.log('👀 Phase 3: Monitoring Batch Job\n');

  // Load job status from Phase 2
  const statusPath = path.join(config.outputDir, 'batch-job-status.json');
  if (!fs.existsSync(statusPath)) {
    throw new Error('Job status not found. Run submit-batch-job.js first.');
  }

  const jobStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));
  console.log(`🆔 Monitoring job: ${jobStatus.jobName}`);
  console.log(`📊 Total songs: ${jobStatus.songCount}`);
  console.log(`⏰ Started: ${new Date(jobStatus.submittedAt).toLocaleString()}\n`);

  // Initialize client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  let pollCount = 0;
  const startTime = Date.now();

  while (true) {
    pollCount++;
    const elapsed = Date.now() - startTime;

    // Get current job status
    const batch = await ai.batches.get({ name: jobStatus.jobName });

    // Update status file
    jobStatus.state = batch.state;
    jobStatus.lastChecked = new Date().toISOString();
    jobStatus.pollCount = pollCount;
    jobStatus.elapsedMs = elapsed;

    if (batch.requestCounts) {
      jobStatus.requestCounts = batch.requestCounts;
    }

    fs.writeFileSync(statusPath, JSON.stringify(jobStatus, null, 2), 'utf-8');

    // Display progress
    console.log(`\n[${new Date().toLocaleTimeString()}] Poll #${pollCount} (Elapsed: ${formatDuration(elapsed)})`);
    console.log(`State: ${batch.state}`);

    if (batch.requestCounts) {
      const { total, succeeded, failed, pending } = batch.requestCounts;
      const progress = total > 0 ? ((succeeded || 0) / total * 100).toFixed(1) : 0;
      console.log(`Progress: ${succeeded || 0}/${total} (${progress}%)`);
      if (failed > 0) console.log(`⚠️  Failed: ${failed}`);
      if (pending > 0) console.log(`⏳ Pending: ${pending}`);
    }

    // Check for completion
    if (batch.state === 'JOB_STATE_SUCCEEDED') {
      console.log('\n✅ Batch job completed successfully!\n');

      // Check if responses are inlined (for small batches)
      if (batch.dest && batch.dest.inlinedResponses) {
        console.log('📥 Results are inlined (not in a file)\n');
        const outputPath = path.join(config.outputDir, 'batch-output.jsonl');
        const content = batch.dest.inlinedResponses
          .map(r => JSON.stringify(r))
          .join('\n');
        fs.writeFileSync(outputPath, content, 'utf-8');

        console.log(`✓ Results saved: ${outputPath}`);
        console.log(`  └─ Size: ${content.length} bytes\n`);

        jobStatus.outputPath = outputPath;
        jobStatus.completedAt = new Date().toISOString();
        fs.writeFileSync(statusPath, JSON.stringify(jobStatus, null, 2), 'utf-8');
      }
      // Download output file for file-based batches
      else if (batch.dest?.fileName) {
        const outputFileId = batch.dest.fileName;
        console.log('📥 Downloading results from file...');
        console.log(`  └─ Output file ID: ${outputFileId}\n`);

        const outputPath = path.join(config.outputDir, 'batch-output.jsonl');

        // Try SDK download method
        try {
          const fileContentBuffer = await ai.files.download({ file: outputFileId });
          if (fileContentBuffer) {
            const content = Buffer.isBuffer(fileContentBuffer)
              ? fileContentBuffer.toString('utf-8')
              : String(fileContentBuffer);
            fs.writeFileSync(outputPath, content, 'utf-8');
            console.log(`✓ Results saved: ${outputPath}`);
            console.log(`  └─ Size: ${content.length} bytes\n`);
          } else {
            throw new Error('Download returned undefined');
          }
        } catch (downloadError) {
          console.log(`⚠️  SDK download failed: ${downloadError.message}`);
          console.log('Note: This is a known limitation. File-based batch outputs may');
          console.log('require accessing through alternative methods or using inline mode.\n');

          // Save the file ID for manual retrieval
          jobStatus.outputFileId = outputFileId;
          jobStatus.outputSkipped = true;
          jobStatus.downloadError = downloadError.message;
        }

        jobStatus.outputPath = outputPath;
        jobStatus.completedAt = new Date().toISOString();
        fs.writeFileSync(statusPath, JSON.stringify(jobStatus, null, 2), 'utf-8');
      } else {
        console.log('⚠️  No output found in batch response');
        console.log('Batch dest:', JSON.stringify(batch.dest, null, 2));
      }

      console.log(`📊 Final Stats:`);
      console.log(`  └─ Total time: ${formatDuration(elapsed)}`);
      console.log(`  └─ Total polls: ${pollCount}`);
      console.log(`  └─ Success rate: ${((batch.requestCounts?.succeeded || 0) / (batch.requestCounts?.total || 1) * 100).toFixed(1)}%\n`);

      console.log('Next step: Run process-batch-results.js to parse results\n');
      return jobStatus;
    }

    if (batch.state === 'JOB_STATE_FAILED') {
      console.log('\n❌ Batch job failed!');
      console.log(`Error: ${batch.error?.message || 'Unknown error'}\n`);
      throw new Error('Batch job failed');
    }

    if (batch.state === 'JOB_STATE_CANCELLED') {
      console.log('\n⚠️  Batch job was cancelled\n');
      throw new Error('Batch job cancelled');
    }

    // Wait before next poll
    const waitMinutes = config.pollIntervalMs / 60000;
    console.log(`⏳ Waiting ${waitMinutes} minutes before next check...`);
    await new Promise(resolve => setTimeout(resolve, config.pollIntervalMs));
  }
}

// Run if called directly
if (require.main === module) {
  monitorBatchJob()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { monitorBatchJob };
