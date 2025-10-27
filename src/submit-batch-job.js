// Phase 2: Submit Batch Job with BrainTrust Tracing

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { wrapTraced } = require('braintrust');
const config = require('./config.json');

/**
 * Submits batch job to Google Gemini API with BrainTrust logging
 * Note: System instruction is included in each JSONL request, not in batch config
 */
async function submitBatchJob() {
  console.log('🚀 Phase 2: Submitting Batch Job\n');

  // Load upload info from Phase 1
  const uploadInfoPath = path.join(config.outputDir, 'upload-info.json');
  if (!fs.existsSync(uploadInfoPath)) {
    throw new Error('Upload info not found. Run prepare-batch-input.js first.');
  }

  const uploadInfo = JSON.parse(fs.readFileSync(uploadInfoPath, 'utf-8'));
  console.log(`📂 Input file: ${uploadInfo.fileName}`);
  console.log(`📊 Songs to process: ${uploadInfo.songCount}`);
  console.log(`${uploadInfo.testMode ? '🧪 Mode: TEST' : '🚀 Mode: PRODUCTION'}\n`);

  // Initialize Google AI client
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  console.log(`✓ System instruction included in each JSONL request\n`);

  console.log('📤 Submitting batch job to Google Gemini API...');
  console.log(`  └─ Model: ${config.model}`);
  console.log(`  └─ Tools: Google Search enabled`);
  console.log(`  └─ Temperature: 0.3\n`);

  // Wrap batch submission with BrainTrust tracing
  const submitWithTracing = wrapTraced(
    async () => {
      const batch = await ai.batches.create({
        model: config.model,
        src: uploadInfo.fileName,
        config: {
          displayName: `batch-${uploadInfo.testMode ? 'test' : 'prod'}-${Date.now()}`,
          // NOTE: systemInstruction is included in each JSONL request, not here
          // Including it here would override the per-request instructions
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.3,
            candidateCount: 1
          }
        }
      });
      return batch;
    },
    {
      name: 'batch_job_submission',
      project: process.env.BRAINTRUST_PROJECT_NAME || 'Music Classification - Gemini',
      metadata: {
        songCount: uploadInfo.songCount,
        testMode: uploadInfo.testMode,
        model: config.model,
        fileUri: uploadInfo.fileUri
      }
    }
  );

  const batch = await submitWithTracing();

  console.log('✅ Batch job submitted successfully!\n');
  console.log(`🆔 Job Name: ${batch.name}`);
  console.log(`📊 State: ${batch.state}`);
  console.log(`⏰ Created: ${batch.createTime}`);
  console.log(`📝 Request count: ${batch.requestCounts?.total || 'N/A'}\n`);

  // Save job status
  const jobStatus = {
    jobName: batch.name,
    state: batch.state,
    model: batch.model,
    createTime: batch.createTime,
    songCount: uploadInfo.songCount,
    testMode: uploadInfo.testMode,
    inputFileUri: uploadInfo.fileUri,
    submittedAt: new Date().toISOString()
  };

  const statusPath = path.join(config.outputDir, 'batch-job-status.json');
  fs.writeFileSync(statusPath, JSON.stringify(jobStatus, null, 2), 'utf-8');
  console.log(`✓ Saved job status: ${statusPath}\n`);

  console.log('⏳ Estimated completion: 12-24 hours (typically faster)');
  console.log('💰 Cost: 50% discount vs standard API\n');
  console.log('Next step: Run monitor-batch-job.js to track progress\n');

  return jobStatus;
}

// Run if called directly
if (require.main === module) {
  submitBatchJob()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { submitBatchJob };
