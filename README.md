# Gemini Music Classifier

Playlist-by-playlist music classification system using Google Gemini Batch API.

## Overview

This project processes music playlists from the `isrc_output` directory, classifying each song with:
- **Energy Level**: Very Low (1-2) → Very High (9-10)
- **Accessibility**: Eclectic / Timeless / Commercial / Cheesy
- **Explicit Content**: Family-friendly / Suggestive / Explicit
- **Musical Characteristics**: Genre, time period, cultural context

## Features

- **Batch Processing**: 50% cost discount with 12-24 hour turnaround
- **Playlist-by-Playlist**: Process 5-6 playlists per day to manage quota limits
- **Progress Tracking**: Automatic tracking of completed playlists
- **BrainTrust Integration**: All processing logged for quality assessment
- **Rate Limit Management**: Built-in delays between submissions

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set API Key

Create a `.env` file:
```bash
GOOGLE_AI_STUDIO_API_KEY=your_api_key_here
```

### 3. Process a Playlist

```bash
# List available playlists
node src/playlist-batch-runner.js

# Process a specific playlist
node src/playlist-batch-runner.js "Afterwork Jazz - Downtime"
```

### 4. Monitor Progress

The system automatically tracks completed playlists in `playlists/processed/completed.json`.

## Project Structure

```
gemini-music-classifier/
├── src/
│   ├── playlist-batch-runner.js    # Main entry point
│   ├── prepare-batch-data.js       # JSONL preparation
│   ├── submit-batch-job.js         # Batch submission
│   ├── monitor-batch-job.js        # Job monitoring
│   ├── process-batch-results.js    # Result parsing
│   └── export-csv.js               # CSV export
├── config/
│   └── default.json                # Configuration
├── prompts/
│   └── classification-prompt.md    # System instruction
├── playlists/
│   ├── input/                      # Symlink to isrc_output
│   └── processed/                  # Progress tracking
├── outputs/
│   ├── by-playlist/                # Individual results
│   └── merged/                     # Combined results
└── scripts/
    ├── merge-results.js            # Merge all CSVs
    └── check-quota.js              # Quota monitoring
```

## Workflow

### Daily Processing (5-6 playlists)

1. **Morning**: Submit 2-3 playlists with 2-4 hour spacing
2. **Afternoon**: Submit 2-3 more playlists
3. **Next Day**: Check results, merge data, repeat

### Batch Processing Flow

```
Select Playlist
    ↓
Prepare JSONL (with 17KB system instruction per song)
    ↓
Submit to Gemini Batch API
    ↓
Monitor Progress (12-24 hours)
    ↓
Download Results
    ↓
Parse & Export CSV
    ↓
Update Progress Tracking
```

## Configuration

Edit `config/default.json`:

```json
{
  "model": "gemini-flash-latest",
  "promptPath": "prompts/classification-prompt.md",
  "pollIntervalMs": 300000,
  "outputDir": "outputs"
}
```

## Rate Limits

- **Enqueued Tokens**: 10M tokens/model (shared across all batches)
- **Concurrent Batches**: 100 max
- **File Uploads**: 10K files/day
- **Processing Time**: 12-24 hours typical

**Best Practice**: Space submissions 2-4 hours apart, process 5-6 playlists/day.

## Merging Results

After processing multiple playlists:

```bash
npm run merge
```

This combines all `outputs/by-playlist/*.csv` into `outputs/merged/all-classifications.csv`.

## Troubleshooting

### Quota Exceeded

Wait 2-4 hours between submissions. Check usage at:
https://aistudio.google.com/u/1/usage

### Batch Failed

Check logs in `logs/` directory. Common issues:
- Malformed JSONL
- Invalid system instruction
- Network timeout

### Missing Results

Batch API may take up to 24 hours. Use monitoring script:

```bash
npm run monitor
```

## Success Metrics

- **Cost**: ~$0.05 per 1000 songs (50% batch discount)
- **Success Rate**: 95-98% expected
- **Throughput**: ~120 playlists at 5-6/day = 20-24 days
- **Total Dataset**: ~19,935 songs across all playlists

## Migration Notes

This project was migrated from `music-energy-tagger/batch-processing` to support:
- Playlist-centric processing workflow
- Better quota management
- Standalone deployment
- Clean Git history

Original system validated with:
- ✅ 100 songs: 97% success rate
- ✅ 500 songs: 95.6% success rate

See `MIGRATION-PLAN.md` for complete migration details.
