# Upload Workflow Implementation Plan

**Status**: In Progress - 75% Complete (Phases 1-3 Done, CHECKPOINT 3 Paused)
**Last Updated**: 2025-11-10
**Branch**: `feature/upload-workflow-with-duplicates`

## Progress Summary
- ✅ Phase 1: Database Schema & Utilities (COMPLETE)
- ✅ Phase 2: CLI Script Enhancement (COMPLETE)
- ✅ Phase 3: Backend API Endpoints (COMPLETE)
- ⏸️ CHECKPOINT 3: Backend API Testing (PAUSED - check-duplicates tested ✅, upload endpoint pending)
- ⏳ Phase 4: Frontend Components (NEXT)
- ⏳ Phase 5: E2E Testing & Polish (PENDING)

## Overview
Build hybrid upload workflow supporting both CLI and web-based uploads with intelligent duplicate detection.

## Refined Scope (From Planning Discussion)

### Two Upload Methods
1. **CLI Script**: For bulk processing (unlimited size, multiple CSVs) - technical users
2. **Web UI**: For on-demand uploads (max 250 songs) - non-technical team members

### Key Parameters (FINALIZED)
- **Web Upload Limit**: 250 songs max (~5-6 min processing time)
- **CLI Upload Limit**: None (handles any size)
- **Processing**: Synchronous with progress bar (no Redis/BullMQ)
- **Duplicate Threshold**: 70% similarity triggers warning (adjusted from 85% for better detection)
- **Error Policy**: Partial success - save successful songs, report failures
- **Duplicate Resolution**: Interactive CLI prompts, Web UI modal
- **Smart Pattern Detection**: Strips "(Radio Edit)", "(Remix)", "The" prefix, etc.

## Implementation Plan with Testing Checkpoints (2-3 Days)

### Phase 1: Database Schema & Utilities (2-3 hours) ✅ COMPLETE

**Completed Work:**
1. ✅ Added 3 new fields to Song model:
   - `isDuplicate` (boolean, default false)
   - `originalIsrc` (string, nullable) - points to canonical version
   - `uploadBatchId` (string, nullable) - tracks upload batches
2. ✅ Created `src/utils/fuzzy-matcher.cjs` (350 lines):
   - Levenshtein distance algorithm
   - Smart pattern detection (strips "The", "(Radio Edit)", "(Remix)", etc.)
   - Two-tier matching (smart + basic fallback)
   - 70% default threshold
3. ✅ Ran migration: `npx prisma db push`
4. ✅ Added 3 indexes for efficient queries

**🛑 CHECKPOINT 1: Schema & Fuzzy Matching** ✅ PASSED
- ✅ Tested similarity calculations - all tests passing
- ✅ Migration applied successfully
- ✅ Fuzzy matching works correctly:
  - "The Beatles" vs "Beatles (Remastered)": 89.47%
  - "One More Time" vs "One More Time (Radio Edit)": 100%
  - Different songs: 53.85% (correctly NOT flagged)

---

### Phase 2: Enhance CLI Script (3-4 hours) ✅ COMPLETE

**Completed Work:**
4. ✅ Extended `scripts/enrich-playlist.cjs` with duplicate detection:
   - ISRC exact match + 70% fuzzy match detection
   - Interactive prompts with 5 options:
     - [S]kip - Don't import
     - [U]pdate - Merge into existing song
     - [N]ew - Save as duplicate version
     - [A]lways new - Skip all remaining checks
     - [Q]uit - Stop processing
   - Added `--force-duplicates` and `--dry-run` flags
   - Upload batch tracking with UUID
   - Side-by-side comparison with similarity %
5. ✅ Installed `uuid` package for batch ID generation
6. ✅ Integrated with fuzzy-matcher utility

**🛑 CHECKPOINT 2: CLI Duplicate Detection** ✅ PASSED
- ✅ Dry run mode works: `npm run enrich:playlist test-duplicates.csv --dry-run`
- ✅ Interactive prompts tested - detected ISRC exact match (100%)
- ✅ [S]kip option worked correctly
- ✅ uploadBatchId assigned to all songs in batch
- ✅ Remaining songs enriched successfully
- **Note**: Fuzzy matching threshold may need tuning for edge cases (64-70% similarity range)

---

### Phase 3: Backend API Endpoints (4-5 hours) ✅ COMPLETE

**Completed Work:**
6. ✅ Created `api/songs/check-duplicates.ts` (130 lines):
   - POST endpoint for duplicate detection
   - Checks ISRC exact match first (returns immediately if found)
   - Fuzzy matching with 70% threshold
   - Returns exactMatch, fuzzyMatches array, and matchType
   - Sorts fuzzy matches by similarity (highest first)
7. ✅ Created `api/songs/upload.ts` (339 lines):
   - POST endpoint for CSV upload processing
   - Multipart form data parsing with formidable
   - Enforces 250 song limit for web uploads
   - CSV parsing with support for multiple column name variations
   - Duplicate detection: exact ISRC blocks, fuzzy matches flagged for review
   - Enrichment: Gemini + Parallel AI classifiers
   - Returns detailed results: successful, duplicates, blocked, errors
   - Generates temporary ISRCs if missing (TEMP-XXXXXXXX format)
   - Upload batch tracking with UUID
8. ✅ Installed `formidable` and `csv-parser` packages

**🛑 CHECKPOINT 3: Backend API Testing** ⏳ IN PROGRESS (PAUSED)

**Completed Testing:**
- ✅ check-duplicates endpoint fully tested:
  - Exact ISRC match: Returns exactMatch object with matchType='exact'
  - Fuzzy match: Returns fuzzyMatches array sorted by similarity (92% for "Yussef Dayes" variants)
  - No match: Returns empty arrays with matchType='none'
  - All three scenarios working correctly

**Remaining Testing:**
- ⏸️ upload endpoint testing paused:
  - Created test-upload-10-songs.csv with 10 French house classics
  - Started upload test but paused before completion
  - Need to verify: Enrichment works, database inserts, error handling
  - Expected: ~2-3 min processing time for 10 songs

**Test Commands:**
```bash
# Test duplicate detection (PASSED ✅)
curl -X POST http://localhost:3001/api/songs/check-duplicates \
  -H "Content-Type: application/json" \
  -d '{"artist": "Daft Punk", "title": "One More Time"}'

# Test upload with small CSV (PAUSED ⏸️)
curl -X POST http://localhost:3001/api/songs/upload \
  -F "file=@test-upload-10-songs.csv"
```

---

### Phase 4: Frontend Components (6-8 hours)
9. Create `client/src/components/UploadModal.tsx`:
   - File picker with drag & drop
   - CSV validation + preview (first 5 rows)
   - 250 song limit validation
   - Progress bar during processing
   - Results summary with 3 tabs (✅ Success, ⚠️ Duplicates, ❌ Blocked)

**🛑 CHECKPOINT 4A: Upload Modal UI (No Backend Connection)**
- Test: Click "Upload CSV" button, select a CSV file
- Verify: File picker works (drag & drop + click)
- Verify: CSV preview shows first 5 rows correctly
- Verify: 250 song limit validation shows error for larger files
- Verify: Column validation catches missing Artist/Title
- Expected: Smooth UI, clear validation messages, no backend calls yet

---

10. Wire up UploadModal to backend API + add progress tracking

**🛑 CHECKPOINT 4B: Full Upload Flow**
- Test: Upload 50-song CSV (mix of new + 5 duplicates)
- Verify: Progress updates every 2 seconds
- Verify: Results tabs populate correctly (Success/Duplicates/Blocked)
- Verify: Processing completes without timeout
- Expected: ~1 min processing time, all songs categorized correctly

---

11. Create `client/src/components/DuplicateReviewModal.tsx`:
    - Side-by-side comparison of new vs existing song
    - Action buttons: "Merge & Update", "Save as New", "Skip"
    - Navigate between duplicates (prev/next)

**🛑 CHECKPOINT 5: Duplicate Resolution UI**
- Test: Click on a duplicate from results tab
- Verify: Side-by-side comparison shows all fields clearly
- Verify: Differences are highlighted (color coding)
- Verify: "Merge & Update" overwrites existing song
- Verify: "Save as New" creates duplicate with `isDuplicate=true`
- Verify: "Skip" removes song from import
- Verify: Prev/Next buttons navigate between duplicates
- Expected: Clear visual comparison, one-click resolution

---

12. Add "Upload CSV" button to `FilterPanel.tsx`

---

### Phase 5: End-to-End Testing & Polish (2-3 hours)

**🛑 CHECKPOINT 6: Full Production Test**
- Test: 3 scenarios:
  1. 100% new songs (no duplicates) - 100 songs
  2. Mixed batch (80 new, 20 duplicates) - 100 songs
  3. Max size upload (250 songs with ~30 duplicates)
- Verify: All songs enriched correctly (spot check 10 random songs)
- Verify: Duplicate resolution works at scale
- Verify: Error handling (malformed CSV, missing columns)
- Verify: UI remains responsive during long uploads
- Expected: <6 min for 250 songs, accurate duplicate detection

---

13. CLI stress test with large batch
14. Update documentation (CLAUDE.md + README)

**🛑 CHECKPOINT 7: CLI Large Batch Test**
- Test: Run CLI with 500+ song CSV
- Verify: No memory issues, processes all songs
- Verify: Interactive prompts don't get overwhelming
- Verify: Database handles large inserts correctly
- Expected: Smooth processing, no crashes

---

## Testing Checkpoints Summary

| Checkpoint | What to Test | Expected Time | Critical? |
|------------|--------------|---------------|-----------|
| 1. Schema & Fuzzy Matching | Similarity calculations | 15 min | ⚠️ YES - Foundation |
| 2. CLI Duplicate Detection | CLI workflow with test CSV | 30 min | ⚠️ YES - Primary workflow |
| 3. Backend API | Postman/curl endpoint tests | 30 min | ⚠️ YES - Before building UI |
| 4A. Upload Modal UI | Frontend without backend | 20 min | ✅ Nice to have |
| 4B. Full Upload Flow | 50 song test upload | 30 min | ⚠️ YES - Core functionality |
| 5. Duplicate Resolution | Review modal interactions | 30 min | ⚠️ YES - Critical UX |
| 6. Production Test | 3 real-world scenarios | 45 min | ⚠️ YES - Before launch |
| 7. CLI Large Batch | 500+ song stress test | 30 min | ⚠️ YES - Your use case |

**Total Testing Time: ~4 hours across 7 checkpoints**

## Files to Create/Modify

### New Files (7):
- `src/utils/fuzzy-matcher.cjs` - Shared duplicate detection
- `api/songs/check-duplicates.ts` - Duplicate detection endpoint
- `api/songs/upload.ts` - Upload processing endpoint
- `client/src/components/UploadModal.tsx` - Main upload UI
- `client/src/components/DuplicateReviewModal.tsx` - Duplicate resolution UI
- `client/src/lib/upload-api.ts` - Upload API client
- `prisma/migrations/XXX_add_duplicate_tracking/migration.sql`

### Modified Files (3):
- `prisma/schema.prisma` - Add duplicate tracking fields
- `scripts/enrich-playlist.cjs` - Add duplicate detection
- `client/src/components/FilterPanel.tsx` - Add upload button

## Technical Architecture

### CLI Workflow (for bulk processing):
```bash
# No size limits - handles any CSV
npm run enrich:playlist large-export-1000-songs.csv
# Interactive prompts for duplicates
# Processes everything directly to database
```

### Web Workflow (for team):
```
User uploads CSV (max 250 songs)
    ↓
Validation (columns, row count)
    ↓
Processing (~5-6 min with progress bar)
    ↓
Results: Success/Duplicates/Blocked tabs
    ↓
If duplicates → Review Modal → Resolve
```

## Key Implementation Details

**Duplicate Detection Logic**:
1. Check ISRC exact match in database → BLOCK (show error)
2. Fuzzy match artist + title (70% threshold) → FLAG for review
3. No match → Enrich and insert

**Progress Tracking** (Web):
- Long-running API endpoint (~5-6 min for 250 songs)
- Frontend polls every 2 seconds for progress updates
- Shows: "Processing 123/250: Daft Punk - One More Time"

**Error Handling**:
- Partial success: Save 240 songs, show 10 errors
- User can download error report or retry failed songs

**Reusable Code**:
- Both CLI and Web use same `fuzzy-matcher.cjs` utilities
- Both use same Gemini/Parallel AI classifiers
- Consistent duplicate detection logic (70% threshold)

## What's Already Built (No Work Needed)
- ✅ **Workflow 1 (Previous Migrations)**: Fully functional - S3 URLs already in database, audio playback works
- ✅ **Workflow 3 (Review/Export)**: Complete - filtering, editing, export all working
- ✅ **Workflow 4 (Database Viewing)**: Complete - current functionality
- ✅ **Authentication**: JWT auth with User roles (Admin/Curator)
- ✅ **Enrichment Pipeline**: Gemini + Parallel AI classifiers working
- ✅ **Database**: Postgres via Vercel with Prisma ORM

## Estimated Time
**Total: 17-23 hours (2-3 days) + 4 hours testing**
- Schema + utilities: 2-3 hours
- CLI enhancement: 3-4 hours
- Backend APIs: 4-5 hours
- Frontend components: 6-8 hours
- Testing + docs: 2-3 hours

## Production Readiness Checklist
- [x] All API endpoints have error handling
- [x] Database migrations tested on local
- [x] CSV validation prevents corrupt data
- [x] Upload limit enforced (250 songs web, unlimited CLI)
- [ ] Duplicate detection accurate (70% threshold tested in production)
- [ ] CLI handles large batches (500+ songs tested)
- [ ] Web UI responsive during processing
- [ ] User documentation/tooltips added

## Benefits
- ✅ Non-technical team can upload up to 250 songs via web
- ✅ Technical users can process unlimited size CSVs via CLI
- ✅ Consistent 70% duplicate detection across both workflows
- ✅ Smart pattern detection handles music industry variations
- ✅ 7 clear testing checkpoints for quality assurance
- ✅ Reuses 80% of existing enrichment code
- ✅ No Redis/background jobs needed (keeps it simple)
- ✅ 5-6 min max wait time for web uploads
