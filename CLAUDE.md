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

### CSV Enrichment Workflow (NEW - Recommended)

The new enrichment workflow uses **standard Gemini API + Parallel AI** for real-time processing with database storage:

```bash
# Enrich a single playlist CSV
npm run enrich:playlist playlists/input/my-playlist.csv

# Options:
npm run enrich:playlist playlist.csv --force              # Force reprocess all songs
npm run enrich:playlist playlist.csv --concurrency=10     # Process 10 songs at a time
npm run enrich:playlist playlist.csv --skip-existing      # Skip songs already in DB
npm run enrich:playlist playlist.csv --gemini-only        # Only run Gemini (skip explicit)
npm run enrich:playlist playlist.csv --explicit-only      # Only run explicit check
```

**What it does:**
1. Reads CSV playlist file
2. For each song:
   - Runs Gemini classification (energy, accessibility, 3 subgenres, reasoning)
   - Runs Parallel AI explicit content check (Explicit/Suggestive/Family Friendly)
3. Saves results directly to database (Postgres via Prisma)
4. Exports enriched CSV to `outputs/` directory
5. Shows progress and summary statistics

**Estimated time:** ~5-10 minutes for 200 songs (with default concurrency=5)

**Advantages over batch API:**
- Real-time progress tracking
- Resume capability if interrupted
- Easier debugging
- Direct database storage
- Parallel AI explicit content detection
- No 12-24 hour wait

### Curator CSV Enrichment Workflow (NEW)

For importing curator-reviewed CSVs with missing ISRCs or metadata:

```bash
# Step 1: Merge curator CSV with ISRCs and enrich missing fields
node scripts/merge-and-enrich-curator-csvs.cjs curator.csv \
  --isrc-source=isrc_output/playlist_formatted.csv

# Step 2: Import enriched CSV to database with audio links
node scripts/import-curator-to-db.cjs enriched-output.csv \
  --audio-source=isrc_output/_updated.csv

# Optional: Dry run to preview import
node scripts/import-curator-to-db.cjs enriched.csv \
  --audio-source=_updated.csv --dry-run
```

**What it does:**
1. Matches curator songs to ISRC database by Artist + Title (fuzzy matching)
2. Enriches missing ACCESSIBILITY/EXPLICIT via Gemini + Parallel AI APIs
3. Preserves all existing curator data (energy, subgenres, BPM)
4. Imports to database with audio links, artwork, and reviewed=true status
5. Normalizes accessibility values to Title Case for UI consistency

**Utilities:**
- `scripts/verify-import.cjs` - Check import stats and sample data
- `scripts/check-song-data.cjs` - Inspect specific song values

### Batch Processing Workflows (Legacy)

These scripts use the old Gemini Batch API approach (slower, no explicit content):

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
# Start both servers for local development
# Terminal 1: Backend API server
vercel dev --listen 3001

# Terminal 2: React dev server (wait for backend to start first)
cd client && npm run dev

# Or use the npm scripts:
npm run dev:client       # Just frontend (needs backend already running)

# Build client for production
npm run build:client

# Database setup
npm run create-schema    # Run Prisma migrations
npm run seed             # Import 50 songs from CSV
```

**Local Development Setup:**
1. Backend runs on `http://localhost:3001` (Vercel dev server with API endpoints)
2. Frontend runs on `http://localhost:3000` (Vite dev server with HMR)
3. Vite proxies `/api/*` requests to port 3001 (see `client/vite.config.ts:59-64`)
4. Always start backend FIRST, then frontend

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
  - `GET /api/songs/export` - Export to CSV with filtering (✅ NEW)

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
- CSV export with configurable columns (✅ NEW)
- Song selection for selective export (✅ NEW)

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
# Google Gemini (for main classification)
GEMINI_API_KEY=your_gemini_api_key          # From Google AI Studio (required)
GEMINI_MODEL=gemini-2.0-flash-exp           # Model to use (optional, defaults to this)

# Parallel AI (for explicit content detection)
PARALLEL_AI_API_KEY=your_parallel_ai_key    # From Parallel AI (required for enrichment)
PARALLEL_AI_ENDPOINT=https://api.parallel.ai/v1/tasks/runs  # API endpoint (optional)

# BrainTrust (observability - optional)
BRAINTRUST_API_KEY=your_braintrust_key      # For logging and quality tracking
BRAINTRUST_PROJECT_NAME=Music Classification - Gemini

# Database (auto-populated by Vercel)
POSTGRES_PRISMA_URL=postgres://...          # Pooled connection (for API endpoints)
POSTGRES_URL_NON_POOLING=postgres://...     # Direct connection (for migrations + enrichment)
POSTGRES_URL=postgres://...                 # Default connection
```

**Setup**:
1. Copy `.env.example` to `.env`
2. Run `vercel env pull .env.local` to pull database credentials from Vercel
3. Add your Gemini API key from https://aistudio.google.com/apikey
4. Add your Parallel AI API key from Parallel AI dashboard
5. (Optional) Add BrainTrust key for observability

## File Structure

```
# Review Interface (NEW)
api/
├── lib/
│   └── csv-exporter.ts        # CSV generation utility (NEW)
└── songs/
    ├── index.ts               # GET /api/songs (list with filters)
    ├── [isrc].ts              # PATCH /api/songs/:isrc (update)
    └── export.ts              # GET /api/songs/export (CSV download) (NEW)

client/                        # React frontend
├── src/
│   ├── components/
│   │   ├── FilterPanel.tsx   # 243 subgenres, 5 filter types, Export button (NEW)
│   │   ├── SongTable.tsx     # Paginated table, checkboxes for selection (NEW)
│   │   ├── ExportModal.tsx   # CSV export UI with preview (NEW)
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

## CSV Export Feature (NEW)

The review interface includes a powerful CSV export capability for data migration and analysis:

### Export API Endpoint

**GET /api/songs/export** - Export songs to CSV format with optional filtering

**Query Parameters:**
- `subgenre` - Filter by subgenre (searches aiSubgenre1/2/3)
- `status` - Filter by aiStatus (SUCCESS, ERROR, etc.)
- `reviewStatus` - Filter by review status (all, reviewed, unreviewed)
- `energy` - Filter by aiEnergy level
- `accessibility` - Filter by aiAccessibility
- `explicit` - Filter by aiExplicit content
- `playlistName` - Optional playlist name prepended to subgenres (for legacy format)
- `includeAccessibility` - Include ACCESSIBILITY column (default: true)
- `includeExplicit` - Include EXPLICIT column (default: true)
- `preview` - Return first 5 rows as JSON (default: false)
- `isrcs` - Comma-separated list of specific ISRCs to export

**Response:**
- CSV file download with UTF-8 BOM encoding for Excel compatibility
- Or JSON preview when preview=true

### Export Modal UI Features

The ExportModal component (`client/src/components/ExportModal.tsx`) provides:

1. **Song Selection** - Checkbox interface to select/deselect individual songs or entire page
2. **Filter-Based Export** - Export all songs matching current filter criteria
3. **Selection-Based Export** - Export only selected songs when checkboxes are checked
4. **Dynamic Preview** - Real-time CSV preview showing first 5 rows with proper parsing
5. **Configurable Columns** - Toggle ACCESSIBILITY and EXPLICIT columns on/off
6. **Playlist Naming** - Optional playlist name prepended to subgenres for legacy format migration

### Export Data Transformation

The CSV exporter (`api/lib/csv-exporter.ts`) performs these transformations:

- **Energy Capitalization** - "medium" → "Medium", "very high" → "Very High"
- **Accessibility Uppercase** - "Timeless" → "TIMELESS"
- **Explicit Mapping** - "Family Friendly" → "FAMILY", "Suggestive" → "SUGGESTIVE", "Explicit" → "EXPLICIT"
- **Subgenre Formatting** - Semicolon-separated with optional playlist name prefix
- **BPM Defaults** - Default to 100 when BPM is missing
- **CSV Escaping** - Proper handling of quotes, commas, newlines

### Export Workflow

1. User clicks "Export CSV" button in FilterPanel
2. ExportModal opens with current filters
3. User can:
   - Enter optional playlist name
   - Toggle column visibility
   - Select specific songs (overrides filters)
   - Preview first 5 rows
4. Click "Download Selected" or "Download CSV" to export
5. Browser downloads timestamped CSV file (e.g., `music-export-2025-10-29.csv`)

### Integration Points

- **Selection State** - App.tsx maintains selectedIsrcs Set across pagination
- **Filter State** - Current filters passed to ExportModal for preview
- **API Client** - ExportModal constructs query parameters for /api/songs/export
- **CSV Parsing** - PapaParse library used for real-time preview parsing

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

### Batch Processing Issues

**Quota Exceeded**: Wait 2-4 hours between submissions. Check usage dashboard.

**Batch Failed**: Check logs directory. Common causes:
- Malformed JSONL (syntax errors)
- Invalid system instruction format
- Network timeout during upload

**Missing Results**: Batch API may take up to 24 hours. Use `npm run monitor` to poll status.

**Download Errors**: SDK download for file-based batch outputs has known limitations. The monitor script attempts download and logs file ID for manual retrieval if needed.

### Review Interface Issues

**Prisma Connection Error (P6008)**: If you see "Accelerate was not able to connect to your database":
- Prisma Accelerate requires special configuration for connection pooling
- For local development, use direct connection instead
- Fix: Change `prisma/schema.prisma:10` from `POSTGRES_PRISMA_URL` to `POSTGRES_URL_NON_POOLING`
- Run `npx prisma generate` to regenerate client
- Restart both servers

**API Returns HTML Instead of JSON**: If frontend shows "Unexpected token '<'":
- Backend server not running or running on wrong port
- Frontend trying to fetch from `http://localhost:3000/api/songs` but no API there
- Fix: Ensure Vercel dev is running on port 3001 (`vercel dev --listen 3001`)
- Vite proxy will route `/api/*` requests to 3001
- Verify proxy config in `client/vite.config.ts:59-64`

**Songs Not Loading**: Check these in order:
1. Is backend running on port 3001? (`curl http://localhost:3001/api/songs`)
2. Is database seeded? (`npm run seed` should show 50 successful inserts)
3. Check browser console for API errors
4. Verify `.env.local` has correct database credentials

**Empty Dropdown Values**: If dropdowns appear empty when editing songs:
- Cause: Case mismatch between database values and frontend constants
- Example: Database has "TIMELESS" (UPPERCASE) but constants have "Timeless" (Title Case)
- React Select requires exact string match between value and options
- Fix: Normalize all values to Title Case for consistency
  - Update constants in `client/src/data/constants.ts`
  - Run database migration to normalize existing values
  - Update import scripts to use Title Case (`scripts/import-curator-to-db.cjs`)
- Current standard: All dropdown values use Title Case ("Eclectic", "High", "Family Friendly")

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

**Local Development:**
- Uses `POSTGRES_URL_NON_POOLING` (direct connection to Vercel Postgres)
- Configured in `prisma/schema.prisma:10`
- Prisma Accelerate (pooled connection) requires additional setup and is disabled for local dev
- Run `npx prisma generate` after schema changes to regenerate Prisma Client

**Production (when deployed to Vercel):**
- Can use `POSTGRES_PRISMA_URL` (Prisma Accelerate with connection pooling)
- Switch `url` in `prisma/schema.prisma` from `POSTGRES_URL_NON_POOLING` to `POSTGRES_PRISMA_URL`
- Provides better performance and handles concurrent connections
- Migrations always use `POSTGRES_URL_NON_POOLING` (via `directUrl`)

**Environment Variables:**
- `POSTGRES_URL_NON_POOLING`: Direct connection (local dev + migrations)
- `POSTGRES_PRISMA_URL`: Pooled connection via Prisma Accelerate (production)
- Both automatically populated by `vercel env pull .env.local`

### Benefits Over Raw SQL

- **Type Safety**: Autocomplete for all fields, compiler catches typos
- **Cleaner Syntax**: No SQL string building or manual WHERE clause construction
- **Auto-Generated Types**: Song interface auto-synced with database schema
- **Migration Versioning**: Schema changes tracked in `prisma/migrations/`
- **Better Errors**: Descriptive error codes (e.g., P2025 = record not found)

See `PRISMA-MIGRATION.md` for complete migration details from `@vercel/postgres`.
