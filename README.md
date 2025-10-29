# Gemini Music Classifier

Playlist-by-playlist music classification system using Google Gemini Batch API.

## Overview

This project processes music playlists from the `isrc_output` directory, classifying each song with:
- **Energy Level**: Very Low (1-2) → Very High (9-10)
- **Accessibility**: Eclectic / Timeless / Commercial / Cheesy
- **Explicit Content**: Family-friendly / Suggestive / Explicit
- **Musical Characteristics**: Genre, time period, cultural context

## Features

- **Real-Time Enrichment**: Fast CSV enrichment with Gemini + Parallel AI (~5-10 min for 200 songs)
- **Multi-Source Merging**: Intelligent fuzzy matching with priority-based field resolution
- **Batch Processing**: 50% cost discount with 12-24 hour turnaround
- **Review Interface**: React + TypeScript web app for human curation
- **Progress Tracking**: Automatic tracking of completed playlists
- **BrainTrust Integration**: All processing logged for quality assessment
- **Database Layer**: Prisma ORM with Postgres for persistent storage

## Quick Start

### 1. Install Dependencies

```bash
npm install
vercel env pull .env.local  # Pull database credentials
```

### 2. Set API Keys

Edit `.env`:
```bash
GEMINI_API_KEY=your_gemini_key
PARALLEL_AI_API_KEY=your_parallel_ai_key
BRAINTRUST_API_KEY=your_braintrust_key  # Optional
```

### 3. Enrich a Playlist (Recommended)

```bash
# Fast real-time processing
npm run enrich:playlist playlists/input/my-playlist.csv
```

### 4. Merge with Cache Data

```bash
# Merge enriched data with existing 13,428-song cache
npm run merge:sources

# View results
cat outputs/merge-report.json | jq '.summary'
```

### 5. Review Interface (Optional)

```bash
# Terminal 1: Backend
vercel dev --listen 3001

# Terminal 2: Frontend
cd client && npm run dev

# Access at http://localhost:3000
```

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

## Workflows

### CSV Enrichment + Merging (Recommended)

```bash
# Step 1: Enrich playlist
npm run enrich:playlist playlists/input/my-playlist.csv

# Step 2: Merge with 13K cache masterlist
npm run merge:sources

# Step 3: Review quality
cat outputs/merge-report.json | jq '.fuzzy_match_statistics'

# Step 4: Check output
head -n 10 outputs/merged-data.csv
```

**Match Modes**:
- `--mode=conservative`: High precision (90%+ similarity)
- `--mode=balanced`: Default (85%+ similarity)
- `--mode=aggressive`: High recall (75-80%+ similarity)

See `docs/MERGE-GUIDE.md` for complete documentation.

### Legacy Batch Processing

After processing multiple playlists via batch API:

```bash
npm run merge  # Combines outputs/by-playlist/*.csv
```

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
