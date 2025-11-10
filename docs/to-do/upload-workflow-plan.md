# Upload Workflow Implementation Plan

**Status**: In Progress (Started 2025-11-10)
**Last Updated**: 2025-11-10
**Branch**: `feature/upload-workflow-with-duplicates`

## Overview
Build hybrid upload workflow supporting both CLI and web-based uploads with intelligent duplicate detection.

## Refined Scope (From Planning Discussion)

### Two Upload Methods
1. **CLI Script**: For bulk processing (unlimited size, multiple CSVs) - technical users
2. **Web UI**: For on-demand uploads (max 250 songs) - non-technical team members

### Key Parameters
- **Web Upload Limit**: 250 songs max (~5-6 min processing time)
- **CLI Upload Limit**: None (handles any size)
- **Processing**: Synchronous with progress bar (no Redis/BullMQ)
- **Duplicate Threshold**: 85% similarity triggers warning
- **Error Policy**: Partial success - save successful songs, report failures
- **Duplicate Resolution**: Interactive CLI prompts, Web UI modal

## Implementation Plan with Testing Checkpoints (2-3 Days)

### Phase 1: Database Schema & Utilities (2-3 hours)
1. Add duplicate tracking fields to Song model (`isDuplicate`, `originalIsrc`, `uploadBatchId`)
2. Create `src/utils/fuzzy-matcher.cjs` with shared duplicate detection logic
3. Run migration: `npx prisma migrate dev --name add_duplicate_tracking`

**🛑 CHECKPOINT 1: Schema & Fuzzy Matching**
- Test: Run `node -e "const {calculateSimilarity} = require('./src/utils/fuzzy-matcher.cjs'); console.log(calculateSimilarity('Daft Punk', 'Daft  Punk'))"`
- Verify: Migration applied successfully to database
- Verify: Fuzzy matching returns sensible similarity scores (85%+ for near matches)
- Expected: ~90-100% for slight variations, ~70% for partial matches

---

### Phase 2: Enhance CLI Script (3-4 hours)
4. Extend `scripts/enrich-playlist.cjs` with duplicate detection:
   - Check for ISRC exact match + 85% fuzzy match before enriching
   - Interactive prompts: [S]kip, [U]pdate existing, [N]ew version, [A]lways new
   - Add `--force-duplicates` and `--dry-run` flags
5. Test with known duplicate scenarios

**🛑 CHECKPOINT 2: CLI Duplicate Detection**
- Test: Run `npm run enrich:playlist test-duplicates.csv --dry-run`
- Verify: Script correctly identifies duplicates at 85%+ threshold
- Verify: Interactive prompts appear and work correctly
- Verify: `--force-duplicates` flag bypasses duplicate checks
- Expected: Clear side-by-side comparison, intuitive prompts

---

### Phase 3: Backend API Endpoints (4-5 hours)
6. Create `api/songs/check-duplicates.ts` - POST endpoint for duplicate detection
7. Create `api/songs/upload.ts` - POST endpoint for CSV upload:
   - Parse CSV (validate required columns, enforce 250 song limit)
   - Check each song for duplicates (85% threshold)
   - Enrich new songs (reuse existing classifiers)
   - Return summary: successful, duplicates, blocked, errors
8. Add progress tracking (polling endpoint)

**🛑 CHECKPOINT 3: Backend API Testing**
- Test: Use Postman/curl to test endpoints:
  ```bash
  # Test duplicate detection
  curl -X POST http://localhost:3001/api/songs/check-duplicates \
    -H "Content-Type: application/json" \
    -d '{"artist": "Daft Punk", "title": "One More Time"}'

  # Test upload with small CSV (10 songs)
  curl -X POST http://localhost:3001/api/songs/upload \
    -F "file=@test-10-songs.csv"
  ```
- Verify: Endpoints return correct structure (summary, results tabs)
- Verify: Enrichment works (Gemini + Parallel AI calls succeed)
- Verify: Database inserts happen correctly
- Expected: ~1 min processing time for 10 songs, clear error messages

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
2. Fuzzy match artist + title (85% threshold) → FLAG for review
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
- Consistent duplicate detection logic (85% threshold)

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
- [ ] All API endpoints have error handling
- [ ] Database migrations tested on local
- [ ] CSV validation prevents corrupt data
- [ ] Upload limit enforced (250 songs web, unlimited CLI)
- [ ] Duplicate detection accurate (85% threshold tested)
- [ ] CLI handles large batches (500+ songs tested)
- [ ] Web UI responsive during processing
- [ ] User documentation/tooltips added

## Benefits
- ✅ Non-technical team can upload up to 250 songs via web
- ✅ Technical users can process unlimited size CSVs via CLI
- ✅ Consistent 85% duplicate detection across both workflows
- ✅ 7 clear testing checkpoints for quality assurance
- ✅ Reuses 80% of existing enrichment code
- ✅ No Redis/background jobs needed (keeps it simple)
- ✅ 5-6 min max wait time for web uploads
