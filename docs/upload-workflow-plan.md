# Upload Workflow Implementation Plan

**Status**: Planned for post-launch (after auth + deployment)
**Last Updated**: 2025-11-09

## Overview
Transform the current review interface into a full production platform supporting 3 core workflows.

## What's Already Built (No Work Needed)
- ✅ **Workflow 1 (Previous Migrations)**: Fully functional - S3 URLs already in database, audio playback works
- ✅ **Workflow 3 (Review/Export)**: Complete - filtering, editing, export all working
- ✅ **Workflow 4 (Database Viewing)**: Complete - current functionality

## Components to Build

### 1. Upload New Music Workflow (Workflow 2)
**Priority: HIGH** - This is the main gap

#### Backend Components:
- **Duplicate Detection API** (`api/songs/check-duplicates.ts`)
  - GET endpoint: checks ISRC exact match + fuzzy artist/title match
  - Returns: `{ exactMatch: Song | null, fuzzyMatches: Song[] }`
  - Reuses existing `normalizeForMatching()` logic from import scripts

- **Upload Processing API** (`api/songs/upload.ts`)
  - POST endpoint: accepts CSV file upload
  - Validates CSV structure (required: artist, title; optional: ISRC, BPM, Spotify Track ID)
  - For each row:
    1. Check for ISRC exact match → block with error
    2. Check for fuzzy artist+title match → flag for curator review
    3. If no match → enrich via Gemini + Parallel AI
    4. Insert to database with `reviewed=false`
  - Returns: summary stats + list of duplicates + newly added songs
  - Processing time: ~5-10 min for 200 songs (async with progress updates)

#### Frontend Components:
- **UploadModal Component** (`client/src/components/UploadModal.tsx`)
  - File picker for CSV upload
  - CSV validation preview (shows first 5 rows)
  - Progress bar during enrichment
  - Results summary with 3 tabs:
    - ✅ Successfully Added (X songs)
    - ⚠️ Potential Duplicates (needs review)
    - ❌ Blocked (exact ISRC matches)

- **DuplicateReviewModal Component** (`client/src/components/DuplicateReviewModal.tsx`)
  - Side-by-side comparison of new vs existing song
  - Actions: "Merge & Update Existing", "Save as New Version", "Skip"
  - Shows all fields: energy, accessibility, subgenres, BPM, etc.

- **Upload Button** (add to FilterPanel)
  - Opens UploadModal
  - Badge shows upload status when processing

### 2. Database Schema Updates
- Add `isDuplicate` boolean field (for tracking duplicate versions)
- Add `originalIsrc` string field (points to "canonical" version if duplicate)
- Add `uploadBatchId` string field (track which batch a song came from)
- Migration: `npx prisma migrate dev --name add_duplicate_tracking`

### 3. Enhanced Export for Raina Platform Integration
- Add export preset: "Raina Platform Format"
- Ensures all required fields are present
- Filters: only export `reviewed=true` songs
- Add "Mark as Exported" option (sets `exportedAt` timestamp)

## Implementation Timeline (3-4 Days)

### Day 1: Duplicate Detection Foundation
1. Add schema fields (isDuplicate, originalIsrc, uploadBatchId)
2. Build duplicate detection API endpoint
3. Write unit tests for fuzzy matching
4. Extract `normalizeForMatching()` to shared utility

### Day 2: Upload Processing Backend
1. Build upload API endpoint with CSV parsing
2. Integrate enrichment (Gemini + Parallel AI)
3. Add progress tracking (store in Redis or temp DB table)
4. Handle errors gracefully (partial success scenarios)

### Day 3: Upload UI Components
1. Build UploadModal with file picker + validation
2. Build DuplicateReviewModal with merge logic
3. Add upload button to FilterPanel
4. Wire up progress updates (polling or WebSocket)

### Day 4: Testing & Polish
1. End-to-end testing with real CSV exports
2. Performance testing (200 song batch)
3. Error handling edge cases
4. UI polish (loading states, error messages)
5. Documentation updates

## Technical Decisions

**CSV Processing**: Server-side (Node.js + PapaParse)
**Progress Tracking**: Simple polling (GET /api/songs/upload/:batchId/status)
**Enrichment**: Reuse existing `scripts/enrich-playlist.cjs` logic as library
**Audio**: CSV-only uploads (Spotify preview URLs extracted if Track ID present)
**Duplicate Threshold**: 90% fuzzy match = flag as potential duplicate

## User Requirements (From Discussion)

### Workflow 1: Work on Previous Migrations
- **Status**: ✅ Already working
- S3 URLs already in database via CSV imports
- Audio playback functional in review interface

### Workflow 2: Upload New Music
- **Format**: CSV only (like Spotify exports)
- **Volume**: Medium batches (50-200 songs)
- **Duplicate Handling**:
  - ISRC exact match → block with warning
  - Fuzzy artist+title match → allow merge or save as new version
- **Processing**: Full enrichment (Gemini + Parallel AI)

### Workflow 3: Review & Export
- **Status**: ✅ Already working
- Review AI classifications
- Edit/annotate
- Export for Raina platform

### Workflow 4: Database Viewing
- **Status**: ✅ Already working
- Filter, search, export subsets

## Production Readiness Checklist
- [ ] All API endpoints have error handling
- [ ] Database migrations tested on staging
- [ ] CSV validation prevents corrupt data
- [ ] Upload limits enforced (max 500 songs per batch)
- [ ] Progress tracking works for concurrent uploads
- [ ] Duplicate detection is accurate (test with known duplicates)
- [ ] Export format matches Raina platform requirements
- [ ] User documentation/tooltips added to upload workflow

## Files to Create/Modify

### New Files (~6 files):
- `api/songs/check-duplicates.ts`
- `api/songs/upload.ts`
- `client/src/components/UploadModal.tsx`
- `client/src/components/DuplicateReviewModal.tsx`
- `src/utils/fuzzy-matcher.cjs` (shared utility)
- `prisma/migrations/XXX_add_duplicate_tracking/migration.sql`

### Modified Files (~4 files):
- `client/src/components/FilterPanel.tsx` (add upload button)
- `prisma/schema.prisma` (add 3 fields)
- `client/src/lib/api.ts` (add upload API calls)
- `api/lib/csv-exporter.ts` (add Raina export preset)

## Risk Mitigation
- **Performance**: Batch enrichment may take 10+ min → add progress bar + allow background tab
- **Duplicates**: Fuzzy matching may have false positives → require curator confirmation
- **Data Loss**: Upload failures mid-process → store in temp table, allow resume
- **S3 Audio**: No upload needed (Workflow 1 already works, Workflow 2 uses Spotify URLs)

## Out of Scope (Post-Launch)
- Bulk audio file upload to S3 (Workflow 1 already functional with existing URLs)
- WebSocket real-time progress (polling sufficient for medium batches)
- Undo/redo for edits
- Advanced duplicate detection (acoustic fingerprinting)

## Dependencies
**Must be completed first:**
- [ ] Authentication system (user roles: admin, curator, viewer)
- [ ] Production deployment (Vercel)
- [ ] Environment configuration (production .env)
- [ ] Database migrations on production

**Nice to have:**
- [ ] Monitoring/logging (Sentry, LogRocket)
- [ ] Rate limiting on upload endpoints
- [ ] Backup/restore procedures
