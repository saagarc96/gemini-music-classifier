# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a music classification system that uses Google Gemini's Batch API to analyze songs from playlists, plus a web-based review interface for human curation. It classifies songs by:
- Energy Level (Very Low → Very High)
- Accessibility (Eclectic / Timeless / Commercial / Cheesy)
- Subgenres (from a curated list of 243 subgenres)

The system is built for Raina Music, a B2B music streaming company serving hospitality and retail clients. It processes ~20,000 songs across 120 playlists at 50% cost discount via batch processing.

**Components:**
1. **Batch Processing Pipeline** - Classifies songs using Gemini AI (existing)
2. **Review Interface** - React + TypeScript web app for curators to review/edit AI classifications (NEW)
3. **Database Layer** - Prisma ORM with Vercel Postgres for persistent storage (NEW)

## Key Commands

### Batch Processing Workflows

```bash
# Process all playlists end-to-end (12-24 hour batch processing)
npm run process:all

# Process a single playlist
npm run process:playlist

# Monitor an active batch job
npm run monitor

# Merge multiple playlist results
npm run merge

# Check API quota usage
npm run check-quota
```

### Review Interface (Web App)

```bash
# Start React dev server (runs on http://localhost:5173)
npm run dev:client

# Build client for production
npm run build:client

# Database setup
npm run create-schema    # Run Prisma migrations
npm run seed             # Import 50 songs from CSV
```

### Prisma (Database)

```bash
# Generate Prisma Client (auto-runs on npm install)
npm run prisma:generate

# Create new migration (dev only)
npm run prisma:migrate

# Apply migrations (production)
npm run create-schema
```

### Development

```bash
# Install all dependencies (root + client + Prisma)
npm install
cd client && npm install && cd ..

# Test mode: Process only first 50 songs
# Edit config/default.json: "testMode": true, "testSongLimit": 50
```

## Architecture

### Review Interface Stack (NEW)

**Frontend**: React 18 + TypeScript + Vite
- Location: `client/src/`
- Components: FilterPanel, SongTable, ReviewModal, AudioPlayer
- UI Library: shadcn/ui (dark zinc theme)
- State Management: React hooks (useState, useEffect)
- Notifications: Sonner toast library
- Styling: Tailwind CSS

**Backend**: Vercel Serverless Functions + Prisma ORM
- Location: `api/songs/`
- Database: Vercel Postgres (PostgreSQL)
- ORM: Prisma Client (type-safe queries)
- Endpoints:
  - `GET /api/songs` - Paginated list with filters
  - `PATCH /api/songs/:isrc` - Update classifications

**Database Schema** (`prisma/schema.prisma`):
- `Song` model with 20+ fields (ISRC, metadata, AI classifications, review tracking)
- Indexes on ISRC, subgenres, status, reviewed
- Auto-generated TypeScript types via Prisma
- Migrations tracked in `prisma/migrations/`

**Key Features**:
- Pagination (50 songs/page, configurable to 200)
- Multi-criteria filtering (subgenre, status, energy, accessibility, review status)
- Audio streaming from S3
- Inline editing with validation
- Curator notes
- Automatic timestamp tracking

### Batch Processing Pipeline

The batch classification system follows a 5-phase pipeline orchestrated by `src/orchestrator.js`:

1. **Prepare Batch Input** (`src/prepare-batch-input.js`)
   - Reads CSV playlists from `playlists/input/` (symlinked to `isrc_output/`)
   - Embeds 17KB system instruction (from `prompts/classification-prompt.md`) into EACH request
   - Generates JSONL file with batch requests
   - Uploads JSONL to Google File API
   - Creates `batch-metadata.json` to preserve original CSV data

2. **Submit Batch Job** (`src/submit-batch-job.js`)
   - Submits JSONL to Gemini Batch API with Google Search tools enabled
   - Uses `gemini-flash-latest` model
   - Wraps submission in BrainTrust tracing for observability
   - Saves job status to `batch-job-status.json`

3. **Monitor Job** (`src/monitor-batch-job.js`)
   - Polls job status every 5 minutes (configurable via `pollIntervalMs`)
   - Handles both inline responses (small batches) and file-based outputs
   - Updates job status with progress metrics
   - Downloads completed results to `batch-output.jsonl`

4. **Process Results** (`src/process-batch-results.js`)
   - Parses JSONL responses
   - Handles markdown-wrapped JSON (````json ... ````)
   - Validates required fields (reasoning, context_used, energy, accessibility, subgenres)
   - Logs all classifications to BrainTrust
   - Merges AI results with original CSV metadata
   - Saves to `processed-results.json`

5. **Export to CSV** (`src/export-to-csv.js`)
   - Converts processed results to CSV format
   - Expands subgenres into 3 separate columns (ai_subgenre_1, ai_subgenre_2, ai_subgenre_3)
   - Adds 8 new AI-generated columns to original 8 CSV columns
   - Outputs timestamped CSV files

### Critical Implementation Details

**System Instruction Embedding**
- The 17KB classification prompt MUST be included in each JSONL request, not in the batch config
- Batch-level `systemInstruction` is unreliable and may be ignored by Gemini API
- See `src/prepare-batch-input.js:56-68` for correct implementation

**Response Parsing**
- Responses may be wrapped in markdown code blocks (````json`)
- Parser must strip both ````json` and plain ``` wrappers
- See `src/process-batch-results.js:12-63` for parsing logic

**Metadata Preservation**
- Original CSV data is stored in `batch-metadata.json` with keys matching JSONL requests
- This allows rejoining AI results with original metadata (ISRC, BPM, artwork, etc.)
- Critical for maintaining data lineage through the pipeline

**Status Tracking**
- AI classifications return status: SUCCESS, ERROR, REQUIRES HUMAN REVIEW, INVALID INPUT
- Status is preserved through the pipeline and exported to final CSV
- Enables filtering for manual review

## Configuration

Edit `config/default.json`:

```json
{
  "inputCsv": "playlists/input/isrc_output",     // Input playlist directory
  "outputDir": "outputs",                         // Output directory
  "pollIntervalMs": 300000,                       // Monitor polling interval (5 min)
  "model": "gemini-flash-latest",                 // Gemini model
  "promptPath": "prompts/classification-prompt.md", // System instruction
  "testMode": false,                              // Enable test mode
  "testSongLimit": 50                             // Songs to process in test mode
}
```

## Environment Variables

Required in `.env` (or `.env.local` for local development):

```bash
# Batch Processing
GEMINI_API_KEY=your_gemini_api_key          # From Google AI Studio
BRAINTRUST_API_KEY=your_braintrust_key      # For observability (optional)
BRAINTRUST_PROJECT_NAME=Music Classification - Gemini

# Review Interface + Database (auto-populated by Vercel)
POSTGRES_PRISMA_URL=postgres://...          # Pooled connection (for API endpoints)
POSTGRES_URL_NON_POOLING=postgres://...     # Direct connection (for migrations)
```

**Setup**: Run `vercel env pull .env.local` to pull database credentials from Vercel.

## File Structure

```
# Review Interface (NEW)
api/
└── songs/
    ├── index.ts               # GET /api/songs (list with filters)
    └── [isrc].ts              # PATCH /api/songs/:isrc (update)

client/                        # React frontend
├── src/
│   ├── components/
│   │   ├── FilterPanel.tsx   # 243 subgenres, 5 filter types
│   │   ├── SongTable.tsx     # Paginated table
│   │   ├── ReviewModal.tsx   # Edit interface
│   │   ├── AudioPlayer.tsx   # S3 streaming
│   │   └── ui/               # shadcn/ui library (50+ components)
│   ├── lib/
│   │   └── api.ts            # API client (getSongs, updateSong)
│   ├── data/
│   │   └── constants.ts      # Subgenres, energy, accessibility enums
│   ├── App.tsx               # Main app with pagination/filtering
│   └── main.tsx              # React entry point
├── package.json
├── vite.config.ts
└── dist/                      # Production build output

prisma/
├── schema.prisma              # Song model definition
└── migrations/
    └── 0_init/
        └── migration.sql      # Initial schema

scripts/
├── create-schema.js           # Run Prisma migrations
└── seed.js                    # Import CSV to database

# Batch Processing (existing)
outputs/
├── batch-input.jsonl          # Generated JSONL for batch API
├── batch-metadata.json        # Original CSV data with keys
├── upload-info.json           # File upload details
├── batch-job-status.json      # Job status and progress
├── batch-output.jsonl         # Raw API responses
├── processed-results.json     # Parsed and merged results
└── batch-output-TIMESTAMP.csv # Final CSV export

playlists/
├── input/                     # Symlink to isrc_output directory
└── processed/
    └── completed.json         # Progress tracking

prompts/
└── classification-prompt.md   # 17KB system instruction

# Documentation
SETUP.md                       # Setup instructions (8 steps)
BUILD-COMPLETE.md              # Build summary & testing
PRD-review-interface.md        # Product requirements
PRISMA-MIGRATION.md            # Migration guide
```

## Rate Limits & Best Practices

Google Gemini Batch API has these limits:
- **Enqueued Tokens**: 10M tokens/model (shared across all batches)
- **Concurrent Batches**: 100 max
- **File Uploads**: 10K files/day
- **Processing Time**: 12-24 hours typical

**Best Practices:**
- Space playlist submissions 2-4 hours apart
- Process 5-6 playlists per day
- Monitor quota at https://aistudio.google.com/usage
- Use test mode (`testSongLimit: 50`) for validation

## Classification Prompt

The system instruction (`prompts/classification-prompt.md`) is extensive and includes:
- Energy level definitions (Very Low → Very High)
- Accessibility categories (Eclectic → Cheesy)
- 200+ available subgenres organized by category
- Decade-specific rules (release date matters)
- Instrumental vs vocal detection logic
- Error handling for invalid inputs
- Output format specification (JSON)

**Key Rules:**
- Only use subgenres from the provided list
- Match decade labels to release dates, not stylistic influences
- "EDM Classics" = 2010s+ only (not 90s/2000s electronic music)
- Check vocals before selecting instrumental subgenres
- Return INVALID INPUT if missing artist or title
- Return REQUIRES HUMAN REVIEW if insufficient web context

## BrainTrust Integration

All batch processing is logged to BrainTrust for quality assessment:
- Job submissions logged with metadata (song count, test mode, model)
- Individual classifications logged with input/output/status
- Experiment names: `batch-processing-{timestamp}`
- Project: "Music Classification - Gemini" (configurable)

This enables success rate tracking, error analysis, and classification quality review.

## Common Issues

**Quota Exceeded**: Wait 2-4 hours between submissions. Check usage dashboard.

**Batch Failed**: Check logs directory. Common causes:
- Malformed JSONL (syntax errors)
- Invalid system instruction format
- Network timeout during upload

**Missing Results**: Batch API may take up to 24 hours. Use `npm run monitor` to poll status.

**Download Errors**: SDK download for file-based batch outputs has known limitations. The monitor script attempts download and logs file ID for manual retrieval if needed.

## Utilities

`scripts/merge-results.js`: Combines all `outputs/by-playlist/*.csv` into `outputs/merged/all-classifications.csv`

`scripts/check-quota.js`: Displays current API quota usage and remaining capacity

## Prisma Database Layer (NEW)

### Type-Safe Queries

All database operations use Prisma Client for type safety:

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// Query with type-safe filters
const songs = await prisma.song.findMany({
  where: {
    aiStatus: 'SUCCESS',
    reviewed: false,
    OR: [
      { aiSubgenre1: 'Nu-Disco' },
      { aiSubgenre2: 'Nu-Disco' },
      { aiSubgenre3: 'Nu-Disco' },
    ],
  },
  orderBy: { createdAt: 'desc' },
  take: 50,
  skip: 0,
});

// Update with validation
const updated = await prisma.song.update({
  where: { isrc: 'USRC12345678' },
  data: {
    aiEnergy: 'High',
    aiAccessibility: 'Commercial',
    reviewed: true,
    reviewedAt: new Date(),
  },
});
```

### Schema Changes

To add/modify fields:

1. Update `prisma/schema.prisma`
2. Run `npm run prisma:migrate` (creates migration)
3. Migration auto-applies on next deploy
4. Prisma Client regenerates with new types

### Database Connection

- API endpoints use `POSTGRES_PRISMA_URL` (pooled, handles concurrency)
- Migrations use `POSTGRES_URL_NON_POOLING` (direct, required for schema changes)
- Prisma manages connection lifecycle (no manual pooling needed)
- Each serverless function gets isolated Prisma Client instance

### Benefits Over Raw SQL

- **Type Safety**: Autocomplete for all fields, compiler catches typos
- **Cleaner Syntax**: No SQL string building or manual WHERE clause construction
- **Auto-Generated Types**: Song interface auto-synced with database schema
- **Migration Versioning**: Schema changes tracked in `prisma/migrations/`
- **Better Errors**: Descriptive error codes (e.g., P2025 = record not found)

See `PRISMA-MIGRATION.md` for complete migration details from `@vercel/postgres`.
