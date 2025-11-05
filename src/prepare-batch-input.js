// Phase 1: Prepare Batch Input (JSONL generation and file upload)

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { GoogleGenAI } = require('@google/genai');
const config = require('./config.json');

/**
 * Reads CSV and converts to JSONL format for batch API
 */
async function prepareBatchInput() {
  console.log('📄 Phase 1: Preparing Batch Input\n');

  // Read CSV
  console.log(`Reading CSV from: ${config.inputCsv}`);
  const csvContent = fs.readFileSync(config.inputCsv, 'utf-8');
  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true
  });

  console.log(`✓ Loaded ${records.length} total songs`);

  // Apply test mode limit if enabled
  const songsToProcess = config.testMode
    ? records.slice(0, config.testSongLimit)
    : records;

  console.log(`${config.testMode ? '🧪 TEST MODE:' : '🚀 PRODUCTION:'} Processing ${songsToProcess.length} songs\n`);

  // Load system instruction with subgenres injected
  const { loadClassificationPrompt } = require('./utils/subgenre-loader.cjs');
  const systemInstruction = loadClassificationPrompt();
  console.log(`✓ Loaded classification prompt (${systemInstruction.length} chars)\n`);

  // Generate JSONL
  const jsonlLines = [];
  const metadataMap = {}; // Store original row data for later

  songsToProcess.forEach((row, index) => {
    const artist = row.artist || '';
    const title = row.title || '';
    const key = `song-${index}`;

    // Store metadata for later joining
    metadataMap[key] = {
      ...row,
      originalIndex: index
    };

    // Create batch request - include system instruction in EACH request
    // (batch config systemInstruction is not reliably applied by Gemini Batch API)
    const batchRequest = {
      key: key,
      request: {
        systemInstruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: `${artist} - ${title}` }]
          }
        ]
      }
    };

    jsonlLines.push(JSON.stringify(batchRequest));
  });

  // Write JSONL file
  const jsonlPath = path.join(config.outputDir, 'batch-input.jsonl');
  fs.writeFileSync(jsonlPath, jsonlLines.join('\n'), 'utf-8');
  console.log(`✓ Created JSONL file: ${jsonlPath}`);
  console.log(`  └─ ${jsonlLines.length} requests ready\n`);

  // Write metadata map for later
  const metadataPath = path.join(config.outputDir, 'batch-metadata.json');
  fs.writeFileSync(metadataPath, JSON.stringify(metadataMap, null, 2), 'utf-8');
  console.log(`✓ Saved metadata mapping: ${metadataPath}\n`);

  // Upload file to Google File API
  console.log('📤 Uploading JSONL to Google File API...');
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  const uploadResult = await ai.files.upload({
    file: jsonlPath,
    config: {
      mimeType: 'application/json'
    }
  });

  console.log(`✓ File uploaded successfully!`);
  console.log(`  └─ URI: ${uploadResult.uri}`);
  console.log(`  └─ Name: ${uploadResult.name}`);
  console.log(`  └─ Size: ${uploadResult.sizeBytes} bytes\n`);

  // Save upload info
  const uploadInfo = {
    fileUri: uploadResult.uri,
    fileName: uploadResult.name,
    uploadedAt: new Date().toISOString(),
    songCount: songsToProcess.length,
    testMode: config.testMode
  };

  const uploadInfoPath = path.join(config.outputDir, 'upload-info.json');
  fs.writeFileSync(uploadInfoPath, JSON.stringify(uploadInfo, null, 2), 'utf-8');

  console.log('✅ Phase 1 Complete!\n');
  console.log('Next step: Run submit-batch-job.js to submit the batch\n');

  return uploadInfo;
}

// Run if called directly
if (require.main === module) {
  prepareBatchInput()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      process.exit(1);
    });
}

module.exports = { prepareBatchInput };
