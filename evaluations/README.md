# BrainTrust Evaluation Setup for Gemini Music Classification

This directory contains the evaluation infrastructure for testing the Gemini-based music classification system with BrainTrust.

## Overview

The evaluation system:
- Reads songs from CSV test data
- Calls Google Gemini API with music classification prompt
- Logs all traces to BrainTrust for analysis and manual annotation
- Includes web search capability for enhanced context

## Files

- `gemini-client.js` - Gemini API wrapper with BrainTrust tracing
- `gemini-classification.eval.js` - Main evaluation script
- `README.md` - This file

## Setup

Already completed! Environment variables are set in `.env`:

```bash
BRAINTRUST_API_KEY=sk-Zp5FbMimLlYF0SpENZAo47arscQqFreCoEb1CqlX61At8QBL
BRAINTRUST_PROJECT_NAME=music-classification-eval
BRAINTRUST_PROJECT_ID=a6071ea4-893c-4ea8-8ac1-d71958f7aa85
GEMINI_API_KEY=AIzaSyB51CIS0uU6NB--N1tNNOP_GRBm8nc4QGs
TEST_SONG_LIMIT=10
```

## Running Evaluations

### Run with default 10 songs:
```bash
npx braintrust eval evaluations/gemini-classification.eval.js
```

### Run with custom song limit:
```bash
TEST_SONG_LIMIT=100 npx braintrust eval evaluations/gemini-classification.eval.js
```

### Run with custom rate limiting (to avoid API overload):
```bash
RATE_LIMIT_DELAY=2000 TEST_SONG_LIMIT=100 npx braintrust eval evaluations/gemini-classification.eval.js
```

### Run locally without sending to BrainTrust:
```bash
npx braintrust eval evaluations/gemini-classification.eval.js --no-send-logs
```

## Rate Limiting

To prevent Gemini API overload errors (503), the script includes rate limiting:
- **Default delay**: 1000ms (1 second) between requests
- **Configurable**: Set `RATE_LIMIT_DELAY` environment variable
- **Recommended for large batches**: 1500-2000ms for 100+ songs

## Test Data

Currently using: `test-data/test-data-10-13/Raina Unlabelled Sample Dataset.csv`
- 760 songs total
- Limited to 10 songs for initial testing (configurable via TEST_SONG_LIMIT)

## BrainTrust Dashboard

View results at: https://www.braintrust.dev/app/Raina%20Music/p/Music%20Classification%20-%20Gemini

## Output Format

Each song classification includes:
- **Energy**: Very Low | Low | Medium | High | Very High
- **Accessibility**: Eclectic | Timeless | Commercial | Cheesy
- **Subgenres**: 1-3 subgenres from Raina's catalog
- **Reasoning**: 2-3 sentence explanation
- **Context Used**: Sources that informed the decision

## Tool Call Tracking

The system now tracks Google Search tool usage during classification:

**Metadata Logged to BrainTrust:**
- `tool_calls_used`: Boolean indicating if any tools were invoked
- `tool_call_count`: Number of tool calls made
- `search_queries`: Array of search queries executed
- `tool_calls`: Full tool call objects with names and arguments

**Implementation Details:**

The system uses the full response API (not streaming) to access tool call metadata from `response.candidates`:

```javascript
// Extract tool call information from response candidates
const toolCalls = [];
if (response.candidates && response.candidates.length > 0) {
  const candidate = response.candidates[0];
  if (candidate.content && candidate.content.parts) {
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        toolCalls.push({
          name: part.functionCall.name,
          args: part.functionCall.args || {}
        });
      }
    }
  }
}

// Extract search queries
const searchQueries = toolCalls
  .filter(tc => tc.name === 'googleSearch' || tc.name === 'google_search')
  .map(tc => tc.args.query || tc.args.q || '')
  .filter(q => q.length > 0);
```

This allows you to correlate search usage with classification accuracy in the BrainTrust dashboard.

## Next Steps

1. Review classifications in BrainTrust UI with tool call metadata
2. Add manual annotations for accuracy assessment
3. Create custom scorers once baseline is established
4. Compare performance against current OpenAI-based system
5. Scale up testing to larger sample sizes (500+ songs)

## Model Configuration

- **Model**: gemini-2.0-flash-exp
- **Tools**: Google Search enabled for context gathering
- **System Prompt**: Complete Raina classification instructions (from docs/gemini-prompt/10-13-25-prompt.ts)
- **Thinking Budget**: 0 (disabled for speed)

## Tracing

All API calls are traced with:
- Input (artist, title)
- Output (full classification text)
- Latency (ms)
- Model metadata
- Error information (if any)

Traces appear in BrainTrust under the "classify_song_gemini" span name.
