# Gemini Batch Processing - Working Configuration

This document describes the **exact working process** for batch music classification using Google's Gemini Batch API.

## ✅ Verified Working Configuration (October 27, 2025)

**Status**: 100% success rate on test batches
**Last Tested**: 10 songs, all classified correctly with categorical energy values

## Critical Discovery: System Instruction Placement

### ❌ What DOESN'T Work
Including `systemInstruction` in the batch config causes it to **override** per-request instructions:
```javascript
// In submit-batch-job.js - THIS OVERRIDES PER-REQUEST INSTRUCTIONS ❌
const batch = await ai.batches.create({
  config: {
    systemInstruction: [{ text: systemInstruction }],  // DON'T DO THIS
  }
});
```

### ✅ What DOES Work
Including `systemInstruction` in **each individual JSONL request**:
```javascript
// In prepare-batch-input.js - THIS WORKS ✅
{
  key: 'song-0',
  request: {
    systemInstruction: {
      parts: [{ text: systemInstruction }]  // Include per-request
    },
    contents: [{ role: 'user', parts: [{ text: 'Artist - Title' }] }]
  }
}
```

**Why**: When both are present, batch config overrides per-request, causing conversational responses instead of structured JSON.

## Working Process Flow

### Phase 1: Prepare Batch Input
```bash
npm run batch:prepare
```

**What happens**:
- Loads CSV (19,935 songs or test subset)
- Loads classification prompt from `docs/gemini-prompt/classification-prompt.md` (17,406 chars)
- Creates JSONL with system instruction **in each request** (~1.8KB per song)
- Uploads to Google File API

**Outputs**: `batch-input.jsonl`, `upload-info.json`, `batch-metadata.json`

### Phase 2: Submit Batch Job
```bash
npm run batch:submit
```

**What happens**:
- Submits to Gemini API **without systemInstruction in batch config** (critical!)
- Enables Google Search tool
- Temperature: 0.3
- BrainTrust tracing wrapper

**Output**: `batch-job-status.json` with job ID

### Phase 3: Monitor Completion
```bash
npm run batch:monitor
```

**What happens**:
- Polls every 30 seconds
- Waits for `JOB_STATE_SUCCEEDED`
- Test batches: ~1 minute
- Full batches: 12-24 hours

**Note**: SDK download may fail - use manual Python download if needed

### Phase 4: Download Results (Manual if needed)
```bash
python3 batch-processing/download-batch-output.py [batch-job-id]
```

**Why manual**: Node.js SDK file download is unreliable
**Output**: `batch-output.jsonl`

### Phase 5: Process Results
```bash
npm run batch:process
```

**What happens**:
- Parses JSONL (handles ```json``` markdown wrappers)
- Validates fields
- BrainTrust logging
**Output**: `processed-results.json`

### Phase 6: Export to CSV
```bash
npm run batch:export
```

**What happens**:
- Converts to 16-column CSV
- Ready for database import

**Output**: `batch-output-[timestamp].csv`

## Quick Start (Automated)
```bash
npm run batch:all  # Runs all 6 phases
```

## Output Schema

### Input Columns (8)
title, artist, energy, isrc, bpm, subgenre, artwork, source_file

### AI Generated Columns (8)
- `ai_status`: SUCCESS | ERROR | HUMAN_REVIEW | INVALID_INPUT
- `ai_error_message`: Error details if status is ERROR
- `ai_reasoning`: 2-3 sentence explanation
- `ai_context_used`: Sources consulted (Google Search, knowledge)
- `ai_energy`: Very Low | Low | Medium | High | Very High
- `ai_accessibility`: Eclectic | Timeless | Commercial | Cheesy
- `ai_subgenre_1`, `ai_subgenre_2`, `ai_subgenre_3`: Up to 3 subgenres

## Example Output
```json
{
  "reasoning": "Uptempo Remix of 2012 Neo-Soul/R&B track converts original to High energy dance version",
  "context_used": "Original track popularity (2012) and Uptempo Remix function",
  "energy": "High",
  "accessibility": "Commercial",
  "subgenres": ["2010s and 2020s Pop (Dance Remixes)", "2010s R&B", "Modern Dance"]
}
```

## Configuration

Edit `batch-processing/config.json`:
```json
{
  "inputCsv": "/path/to/songs.csv",
  "testMode": true,      // false for production
  "testSongLimit": 50,   // How many songs in test mode
  "pollIntervalMs": 30000  // Poll every 30 seconds
}
```

## Troubleshooting

### Problem: All results show ERROR
**Cause**: systemInstruction in batch config overriding per-request
**Solution**: Verify `submit-batch-job.js` has NO systemInstruction in batch config

### Problem: Energy values are numbers (1-10)
**Cause**: System instruction not being applied
**Solution**: Verify systemInstruction in each JSONL request, not batch config

### Problem: File download returns "undefined"
**Cause**: Node.js SDK limitation
**Solution**: `python3 batch-processing/download-batch-output.py [batch-id]`

### Problem: BrainTrust traces not appearing
**Cause**: Project name mismatch
**Solution**: Verify `.env` has `BRAINTRUST_PROJECT_NAME="Music Classification - Gemini"`

## Files Modified for Working Solution

1. **prepare-batch-input.js**: Include systemInstruction in each request (not batch config)
2. **submit-batch-job.js**: Remove systemInstruction from batch config
3. **process-batch-results.js**: Handle markdown-wrapped JSON (```json ... ```)
4. **download-batch-output.py**: Fix relative path (`../outputs/`)
5. **classification-prompt.md**: JSON output format with categorical energy

## Cost & Performance

- **Discount**: 50% off standard API pricing
- **Turnaround**: 12-24 hours (tests: 1-2 minutes)
- **Test Results**: 100% success rate, 10/10 correctly classified
- **File Size**: ~1.8KB per song (includes 17KB prompt)
