# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Music classification system using Google Gemini API + Parallel AI for explicit content detection, with a React review interface. Classifies songs by Energy, Accessibility, and Subgenres (171 options across 10 categories). Built for Raina Music (B2B music streaming for hospitality/retail).

**Components:**
1. **Batch Processing Pipeline** - Classifies songs using Gemini AI
2. **Review Interface** - React + TypeScript web app for curator review
3. **Database Layer** - Prisma ORM with Vercel Postgres

## Key Commands

### CSV Enrichment (Recommended)

```bash
# Enrich a single playlist CSV
npm run enrich:playlist playlists/input/my-playlist.csv

# Options:
npm run enrich:playlist playlist.csv --force              # Force reprocess all
npm run enrich:playlist playlist.csv --concurrency=10     # 10 songs at a time
npm run enrich:playlist playlist.csv --skip-existing      # Skip songs in DB
npm run enrich:playlist playlist.csv --gemini-only        # Skip explicit check
npm run enrich:playlist playlist.csv --explicit-only      # Only explicit check
```

Runs Gemini classification + Parallel AI explicit check, saves to database, exports CSV. ~5-10 min for 200 songs.

### Curator CSV Import

```bash
# Merge curator CSV with ISRCs and enrich missing fields
node scripts/merge-and-enrich-curator-csvs.cjs curator.csv \
  --isrc-source=isrc_output/playlist_formatted.csv

# Import to database with audio links
node scripts/import-curator-to-db.cjs enriched-output.csv \
  --audio-source=isrc_output/_updated.csv --dry-run
```

Matches by Artist + Title (fuzzy), enriches missing fields, imports with `reviewed=true`.

### Spotify CSV Import

```bash
npm run enrich:spotify "test-data/test-spotify-csv/my-playlist.csv"
```

Parses Spotify export, fetches preview URLs/artwork, normalizes BPM (50-170), runs AI enrichment. Sets `reviewed=false`.

**Spotify API Setup:** Add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` to `.env` from https://developer.spotify.com/dashboard

### Pre-Tagged Curator Import (Expedited)

```bash
# Import curator-tagged CSV (skips AI, marks as reviewed)
npm run import:pretagged "path/to/curator-tagged.csv"

# Options:
npm run import:pretagged playlist.csv --playlist-name="HRT Spa"  # Custom name
npm run import:pretagged playlist.csv --dry-run                  # Preview only
```

For curators who already know the correct tags. Fetches Spotify preview URLs/artwork but skips AI classification. Sets `reviewed=true` immediately.

**CSV Format** (10 columns):
```csv
Song,Artist,BPM,Spotify Track Id,ISRC,Curator_Energy,Curator_Accessibility,Curator_Explicit,Curator_Subgenre,Uploaded By
Flute Canyon,Native American Instrumentals,62,2m3l9ErXFZa4fheFFasysZ,US1234567890,Low,Eclectic,Family Friendly,Native American Spa,Kristine
```

- **Curator_Energy**: Low, Medium, High
- **Curator_Accessibility**: Eclectic, Timeless, Commercial, Cheesy
- **Curator_Explicit**: Family Friendly, Suggestive, Explicit
- **Curator_Subgenre**: Semicolon-separated (e.g., "Native American Spa;Ambient")

Template: `docs/templates/expedited-curator-upload-template.csv`

### Batch Processing (Legacy)

```bash
npm run process:all      # Full pipeline (12-24 hour batch)
npm run process:playlist # Single playlist
npm run monitor          # Poll batch status
npm run merge            # Merge results
npm run check-quota      # Check API quota
```

### Review Interface

```bash
# Terminal 1: Backend API
vercel dev --listen 3001

# Terminal 2: Frontend (after backend starts)
cd client && npm run dev

# Database
npm run create-schema    # Run migrations
npm run seed             # Import sample songs
npm run build:client     # Production build
```

Backend: `http://localhost:3001` | Frontend: `http://localhost:3000` (proxies `/api/*` to 3001)

### Managing Subgenres

Edit `data/subgenres.json` (single source of truth), then:

```bash
npm run validate:subgenres    # Validate
npm run generate:constants    # Regenerate frontend constants
git add data/subgenres.json client/src/data/constants.ts
```

### Prisma (Database)

```bash
npm run prisma:generate   # Generate client
npm run prisma:migrate    # Create migration (dev)
npm run create-schema     # Apply migrations (prod)
```

### Development

```bash
npm install && cd client && npm install && cd ..

# Test mode: Edit config/default.json
# "testMode": true, "testSongLimit": 50
```

## Architecture

### Review Interface Stack

**Frontend**: React 18 + TypeScript + Vite
- Location: `client/src/`
- Components: FilterPanel, SongTable, ReviewModal, AudioPlayer
- UI: shadcn/ui (dark zinc theme), Tailwind CSS, Sonner toasts

**Styling Note - Tailwind Opacity Classes:**
Tailwind opacity modifiers (e.g., `bg-red-500/20`) don't compile correctly in this project. Use inline styles with hex colors instead:

```tsx
// DON'T - Tailwind opacity classes don't work
className="bg-red-500/20 text-red-500"

// DO - Use inline styles with hex colors
style={{ backgroundColor: '#7f1d1d', color: '#ef4444' }}
```

Common hex colors:
- Red: `#7f1d1d` (bg), `#ef4444` (text)
- Zinc: `#18181b` (bg), `#27272a` (border)

**Backend**: Vercel Serverless Functions + Prisma ORM
- Location: `api/songs/`
- Endpoints: `GET /api/songs`, `PATCH /api/songs/:isrc`, `GET /api/songs/export`

**Key Features**: Pagination, multi-criteria filtering, S3 audio streaming, CSV export with selection

### Batch Processing Pipeline

5-phase pipeline orchestrated by `src/orchestrator.js`:

1. **Prepare** (`src/prepare-batch-input.js`) - Generate JSONL, upload to Google File API
2. **Submit** (`src/submit-batch-job.js`) - Submit to Gemini Batch API
3. **Monitor** (`src/monitor-batch-job.js`) - Poll status every 5 min
4. **Process** (`src/process-batch-results.js`) - Parse responses, merge with metadata
5. **Export** (`src/export-to-csv.js`) - Output timestamped CSV

### Critical Implementation Details

**System Instruction Embedding**
- 17KB prompt MUST be in each JSONL request, not batch config
- Batch-level `systemInstruction` is unreliable
- See `src/prepare-batch-input.js:56-68`

**Response Parsing**
- Strip markdown wrappers (````json` and ```)
- See `src/process-batch-results.js:12-63`

**Metadata Preservation**
- Original CSV in `batch-metadata.json` with keys matching JSONL
- Critical for rejoining AI results with metadata (ISRC, BPM, artwork)

**Status Tracking**
- Values: SUCCESS, ERROR, REQUIRES HUMAN REVIEW, INVALID INPUT
- Enables filtering for manual review

## Configuration

Edit `config/default.json`:

```json
{
  "inputCsv": "playlists/input/isrc_output",
  "outputDir": "outputs",
  "pollIntervalMs": 300000,
  "model": "gemini-flash-latest",
  "promptPath": "prompts/classification-prompt.md",
  "testMode": false,
  "testSongLimit": 50
}
```

## Environment Variables

Required in `.env` or `.env.local`:

```bash
# Required
GEMINI_API_KEY=your_key              # From https://aistudio.google.com/apikey
PARALLEL_AI_API_KEY=your_key         # For explicit content detection

# Database (auto-populated by vercel env pull)
POSTGRES_URL_NON_POOLING=postgres://...  # Direct connection
POSTGRES_PRISMA_URL=postgres://...       # Pooled (production)

# Optional
BRAINTRUST_API_KEY=your_key          # Observability
SPOTIFY_CLIENT_ID=your_id            # For Spotify imports
SPOTIFY_CLIENT_SECRET=your_secret
```

Setup: `vercel env pull .env.local` to get database credentials.

## CSV Export

**API**: `GET /api/songs/export`

Query params: `subgenre`, `status`, `reviewStatus`, `energy`, `accessibility`, `explicit`, `playlistName`, `includeAccessibility`, `includeExplicit`, `preview`, `isrcs`

**Transformations**: Energy capitalized, Accessibility uppercase, Explicit mapped (Family Friendly→FAMILY), BPM defaults to 100

## Common Issues

### Batch Processing

**Quota Exceeded**: Wait 2-4 hours. Check https://aistudio.google.com/usage

**Batch Failed**: Check logs. Common: malformed JSONL, invalid system instruction, timeout

**Missing Results**: May take 24 hours. Use `npm run monitor`

### Review Interface

**Prisma Connection Error (P6008)**:
- Change `prisma/schema.prisma:10` from `POSTGRES_PRISMA_URL` to `POSTGRES_URL_NON_POOLING`
- Run `npx prisma generate` and restart servers

**API Returns HTML Instead of JSON**:
- Ensure backend on port 3001: `vercel dev --listen 3001`
- Verify proxy in `client/vite.config.ts:59-64`

**Songs Not Loading**:
1. Backend running? `curl http://localhost:3001/api/songs`
2. Database seeded? `npm run seed`
3. Check browser console
4. Verify `.env.local` credentials

**Empty Dropdown Values**:
- Case mismatch between DB and constants
- All values use Title Case ("Eclectic", "High", "Family Friendly")
- Update `client/src/data/constants.ts` and run DB migration

## Utilities

- `scripts/merge-results.js` - Combine CSVs from `outputs/by-playlist/`
- `scripts/check-quota.js` - Display API quota
- `scripts/verify-import.cjs` - Check import stats
- `scripts/check-song-data.cjs` - Inspect song values

## Database

Uses Prisma with `POSTGRES_URL_NON_POOLING` for local dev. Schema in `prisma/schema.prisma`.

To modify: Edit schema → `npm run prisma:migrate` → Prisma Client regenerates automatically.

See `docs/other/session-recaps/PRISMA-MIGRATION.md` for full migration details.

## Cross-References

- **README.md** - Project overview, file structure, rate limits
- **docs/completed/SETUP.md** - Full deployment guide
- **docs/other/session-recaps/PRISMA-MIGRATION.md** - Database migration details
- **QUICK-REFERENCE.md** - Data merge commands
