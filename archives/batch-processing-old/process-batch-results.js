// Phase 4: Process Batch Results with BrainTrust Tracing

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { initLogger } = require('braintrust');
const config = require('./config.json');

/**
 * Parses a single classification response (handles both raw JSON and markdown-wrapped JSON)
 */
function parseClassificationResponse(responseText) {
  try {
    // Strip markdown code block wrapper if present
    let jsonText = responseText.trim();

    // Check if wrapped in ```json ... ```
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (jsonText.startsWith('```')) {
      // Also handle plain ``` wrapper
      jsonText = jsonText.replace(/^```\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    // Parse JSON response
    const data = JSON.parse(jsonText);

    // Validate required fields
    if (!data.reasoning || !data.context_used || !data.energy || !data.accessibility || !data.subgenres) {
      return {
        status: 'ERROR',
        error: 'Missing required fields in response',
        reasoning: '',
        context_used: '',
        energy: '',
        accessibility: '',
        subgenres: []
      };
    }

    // Return successfully parsed result
    return {
      status: 'SUCCESS',
      reasoning: data.reasoning,
      context_used: data.context_used,
      energy: String(data.energy),
      accessibility: data.accessibility,
      subgenres: Array.isArray(data.subgenres) ? data.subgenres : []
    };

  } catch (error) {
    // JSON parsing failed
    return {
      status: 'ERROR',
      error: `Failed to parse JSON response: ${error.message}`,
      reasoning: '',
      context_used: '',
      energy: '',
      accessibility: '',
      subgenres: []
    };
  }
}

/**
 * Processes batch results with BrainTrust tracing
 */
async function processBatchResults() {
  console.log('🔄 Phase 4: Processing Batch Results\n');

  // Load job status
  const statusPath = path.join(config.outputDir, 'batch-job-status.json');
  if (!fs.existsSync(statusPath)) {
    throw new Error('Job status not found. Run monitor-batch-job.js first.');
  }

  const jobStatus = JSON.parse(fs.readFileSync(statusPath, 'utf-8'));

  if (!jobStatus.outputPath) {
    throw new Error('Output file not available. Wait for job to complete.');
  }

  console.log(`📂 Reading results from: ${jobStatus.outputPath}`);

  // Load JSONL output
  const jsonlContent = fs.readFileSync(jobStatus.outputPath, 'utf-8');
  const lines = jsonlContent.trim().split('\n');
  console.log(`✓ Found ${lines.length} result lines\n`);

  // Load metadata for joining
  const metadataPath = path.join(config.outputDir, 'batch-metadata.json');
  const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

  console.log('🔍 Parsing classification responses...\n');

  const processedResults = [];
  let successCount = 0;
  let errorCount = 0;
  let humanReviewCount = 0;
  let invalidInputCount = 0;

  // Initialize BrainTrust logger for this batch
  const projectName = process.env.BRAINTRUST_PROJECT_NAME || 'Music Classification - Gemini';
  const experimentName = `batch-processing-${Date.now()}`;

  console.log(`🔍 BrainTrust Project: ${projectName}`);
  console.log(`📊 Experiment: ${experimentName}\n`);

  const logger = initLogger({
    project: projectName,
    experiment: experimentName,
    projectId: process.env.BRAINTRUST_PROJECT_ID
  });

  // Process each result and log to BrainTrust
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    try {
      const result = JSON.parse(line);
      const key = result.key || `song-${i}`;
      const originalData = metadata[key];

      if (!originalData) {
        console.warn(`⚠️  No metadata found for key: ${key}`);
        continue;
      }

      // Extract response text
      let responseText = '';
      if (result.response && result.response.candidates && result.response.candidates[0]) {
        const candidate = result.response.candidates[0];
        if (candidate.content && candidate.content.parts) {
          responseText = candidate.content.parts
            .map(p => p.text || '')
            .join('')
            .trim();
        }
      }

      // Parse classification
      const parsed = parseClassificationResponse(responseText);

      // Log to BrainTrust
      logger.log({
        input: {
          artist: originalData.artist,
          title: originalData.title
        },
        output: parsed,
        metadata: {
          status: parsed.status,
          has_energy: !!parsed.energy,
          has_accessibility: !!parsed.accessibility,
          subgenre_count: parsed.subgenres.length,
          batch_index: i
        }
      });

      // Merge with original data
      const processedRow = {
        ...originalData,
        ai_status: parsed.status,
        ai_error_message: parsed.error || '',
        ai_reasoning: parsed.reasoning,
        ai_context_used: parsed.context_used,
        ai_energy: parsed.energy,
        ai_accessibility: parsed.accessibility,
        ai_subgenre_1: parsed.subgenres[0] || '',
        ai_subgenre_2: parsed.subgenres[1] || '',
        ai_subgenre_3: parsed.subgenres[2] || ''
      };

      processedResults.push(processedRow);

      // Update counts
      if (parsed.status === 'SUCCESS') successCount++;
      else if (parsed.status === 'ERROR') errorCount++;
      else if (parsed.status === 'HUMAN_REVIEW') humanReviewCount++;
      else if (parsed.status === 'INVALID_INPUT') invalidInputCount++;

      // Progress update
      if ((i + 1) % 100 === 0) {
        console.log(`  ✓ Processed ${i + 1}/${lines.length} results...`);
      }

    } catch (error) {
      logger.log({
        input: { error: 'Parse error' },
        error: error.message,
        metadata: {
          line_number: i,
          error_type: error.constructor.name
        }
      });

      console.error(`❌ Error processing line ${i}:`, error.message);
      errorCount++;
    }
  }

  console.log(`\n✅ Processing complete!\n`);
  console.log('📊 Results Summary:');
  console.log(`  ✓ Success: ${successCount}`);
  console.log(`  👤 Human Review: ${humanReviewCount}`);
  console.log(`  ⚠️  Invalid Input: ${invalidInputCount}`);
  console.log(`  ❌ Errors: ${errorCount}`);
  console.log(`  📈 Success Rate: ${((successCount / lines.length) * 100).toFixed(1)}%\n`);

  // Save processed results
  const processedPath = path.join(config.outputDir, 'processed-results.json');
  fs.writeFileSync(processedPath, JSON.stringify(processedResults, null, 2), 'utf-8');
  console.log(`✓ Saved processed results: ${processedPath}\n`);

  // Flush BrainTrust traces before exiting
  console.log('📤 Flushing BrainTrust traces...');
  await new Promise(resolve => setTimeout(resolve, 2000)); // Give BrainTrust time to send traces
  console.log('✓ BrainTrust traces sent\n');

  console.log('Next step: Run export-to-csv.js to create final CSV\n');

  return {
    results: processedResults,
    stats: {
      total: lines.length,
      success: successCount,
      humanReview: humanReviewCount,
      invalidInput: invalidInputCount,
      errors: errorCount
    }
  };
}

// Run if called directly
if (require.main === module) {
  processBatchResults()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ Error:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}

module.exports = { processBatchResults };
