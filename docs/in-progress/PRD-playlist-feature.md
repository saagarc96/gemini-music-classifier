# PRD: Playlist Tracking & Management Feature

## Overview

**Feature Name:** Playlist Tracking & Management
**Target Release:** Q1 2025
**Owner:** Product Team
**Status:** Planning

## Problem Statement

Currently, when uploading CSV files to the music classification platform:
- Songs already in the database are skipped and not associated with the new upload batch
- Curators cannot see complete playlists they've uploaded (missing duplicate songs)
- No historical view of which songs were uploaded together in a playlist
- The `uploadBatchId` field gets overwritten when a song appears in multiple uploads
- Cannot track upload history or see "what was in the original CSV"

**Impact:** Curators lose context about playlist composition and cannot review or export the exact song list they uploaded.

## Goals

### Primary Goals
1. **Complete Playlist Preservation** - Track every song in an uploaded CSV, including duplicates
2. **Upload History** - Maintain chronological history of all playlist uploads
3. **Curator Visibility** - Show curators exactly what they uploaded and when
4. **Multi-Playlist Support** - Allow songs to belong to multiple playlists simultaneously

### Success Metrics
- 100% of songs in uploaded CSVs are associated with created playlists
- Curators can export exact replica of original upload (minus enrichments)
- Playlist view shows clear distinction between new vs existing songs
- Zero data loss during uploads (all songs tracked)

## User Stories

### As a Curator
- **US-1:** I want to see a list of all playlists I've uploaded, so I can track my work history
- **US-2:** I want to view all songs in a specific playlist, including duplicates, so I can review the complete context
- **US-3:** I want to know which songs were newly added vs already existed when I uploaded a playlist
- **US-4:** I want to export a specific playlist as CSV to share with clients
- **US-5:** I want to filter the main song table by playlist to focus my review work
- **US-6:** I want to see upload metadata (date, batch ID) for each playlist

### As an Admin
- **US-7:** I want to see who uploaded each playlist for accountability
- **US-8:** I want to delete old test playlists without removing the songs themselves
- **US-9:** I want to track upload volume and review progress per playlist

## Technical Architecture

### Database Schema

#### New Table: `Playlist`
```prisma
model Playlist {
  id              String   @id @default(cuid())
  name            String   @db.VarChar(255)          // "tcrg_main"
  uploadBatchId   String   @db.VarChar(50)           // UUID for this session
  uploadedBy      String?  @map("uploaded_by_id")    // FK to User
  uploader        User?    @relation(fields: [uploadedBy], references: [id])
  uploadedAt      DateTime @default(now()) @map("uploaded_at")
  sourceFile      String?  @map("source_file")       // "tcrg_main.csv"
  totalSongs      Int      @default(0) @map("total_songs")
  newSongs        Int      @default(0) @map("new_songs")
  duplicateSongs  Int      @default(0) @map("duplicate_songs")

  songs           PlaylistSong[]

  @@index([uploadBatchId])
  @@index([uploadedBy])
  @@map("playlists")
}
```

#### New Table: `PlaylistSong` (Junction)
```prisma
model PlaylistSong {
  id         String   @id @default(cuid())
  playlistId String   @map("playlist_id")
  songIsrc   String   @map("song_isrc")
  addedAt    DateTime @default(now()) @map("added_at")
  wasNew     Boolean  @default(false) @map("was_new")  // True if created in this upload

  playlist   Playlist @relation(fields: [playlistId], references: [id], onDelete: Cascade)
  song       Song     @relation(fields: [songIsrc], references: [isrc], onDelete: Cascade)

  @@unique([playlistId, songIsrc])
  @@index([playlistId])
  @@index([songIsrc])
  @@map("playlist_songs")
}
```

#### Updated: `Song` Model
```prisma
model Song {
  // ... existing fields ...
  playlists  PlaylistSong[]  // NEW: Many-to-many relation

  // KEEP: Existing batch fields for backward compatibility
  uploadBatchId   String?
  uploadBatchName String?
}
```

#### Updated: `User` Model
```prisma
model User {
  // ... existing fields ...
  playlists  Playlist[]  // NEW: One-to-many relation
}
```

### API Endpoints

#### GET `/api/playlists`
**Purpose:** List all playlists
**Query Params:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `uploadedBy` (string, optional) - Filter by user email

**Response:**
```json
{
  "playlists": [
    {
      "id": "clx123abc",
      "name": "tcrg_main",
      "uploadBatchId": "550e8400-e29b-41d4-a716",
      "uploadedAt": "2025-11-20T14:30:00Z",
      "uploader": { "name": "John Doe", "email": "john@example.com" },
      "sourceFile": "tcrg_main.csv",
      "totalSongs": 797,
      "newSongs": 234,
      "duplicateSongs": 563,
      "reviewProgress": {
        "reviewed": 450,
        "pending": 347
      }
    }
  ],
  "pagination": { "total": 42, "page": 1, "pages": 1 }
}
```

#### GET `/api/playlists/[id]`
**Purpose:** Get playlist details with songs
**Query Params:**
- `page`, `limit` - For song pagination
- `status`, `reviewStatus` - Filter songs within playlist

**Response:**
```json
{
  "playlist": {
    "id": "clx123abc",
    "name": "tcrg_main",
    "uploadedAt": "2025-11-20T14:30:00Z",
    "uploader": { "name": "John Doe" },
    "totalSongs": 797,
    "newSongs": 234,
    "duplicateSongs": 563
  },
  "songs": [
    {
      "isrc": "USUM71234567",
      "title": "Song Title",
      "artist": "Artist Name",
      "wasNew": true,
      "addedAt": "2025-11-20T14:30:15Z"
    }
  ],
  "pagination": { }
}
```

#### GET `/api/playlists/[id]/export`
**Purpose:** Export playlist songs as CSV
**Query Params:** Same as song export (includeAccessibility, etc.)
**Response:** CSV file download

#### DELETE `/api/playlists/[id]`
**Purpose:** Delete playlist (admin only)
**Behavior:**
- Removes `Playlist` record
- Cascade deletes `PlaylistSong` associations
- Does NOT delete `Song` records
- Returns 403 if not admin

#### GET `/api/songs` (Updated)
**New Query Param:** `playlistId` (string, optional)
**Behavior:** When provided, only returns songs associated with that playlist

### Script Modifications

#### All Upload Scripts Updated
**Files:**
- `scripts/enrich-playlist.cjs`
- `scripts/enrich-spotify-playlist.cjs`
- `scripts/import-curator-to-db.cjs`

**New Behavior:**
```javascript
// 1. Create playlist at start
const playlist = await prisma.playlist.create({
  data: {
    name: batchName,
    uploadBatchId: uploadBatchId,
    uploadedBy: options.uploadedBy, // From --uploaded-by flag
    sourceFile: path.basename(csvPath),
    totalSongs: 0,
    newSongs: 0,
    duplicateSongs: 0
  }
});

// 2. For each song in CSV
for (const song of songs) {
  const existingSong = await findDuplicate(song);
  const wasNew = !existingSong;

  // Create/update song as usual
  const savedSong = await prisma.song.upsert({ ... });

  // NEW: Create playlist association
  await prisma.playlistSong.create({
    data: {
      playlistId: playlist.id,
      songIsrc: savedSong.isrc,
      wasNew: wasNew
    }
  });

  // Track stats
  if (wasNew) newCount++;
  else duplicateCount++;
}

// 3. Update playlist stats at end
await prisma.playlist.update({
  where: { id: playlist.id },
  data: {
    totalSongs: songs.length,
    newSongs: newCount,
    duplicateSongs: duplicateCount
  }
});
```

**New CLI Flag:**
```bash
npm run enrich:playlist my-playlist.csv --uploaded-by=john@example.com
```

## UI Design

### 1. Playlists Page (`/playlists`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Playlists                                     [+ Upload] │
├─────────────────────────────────────────────────────────────┤
│ Filter: [All Users ▼] [All Dates ▼]                        │
├──────┬────────────┬──────────┬───────┬─────┬──────┬────────┤
│ Name │ Uploaded   │ By       │ Total │ New │ Dupe │ Action │
├──────┼────────────┼──────────┼───────┼─────┼──────┼────────┤
│ tcrg │ 11/20 2pm  │ John Doe │  797  │ 234 │ 563  │ [View] │
│ main │            │          │       │     │      │ [Del]  │
├──────┼────────────┼──────────┼───────┼─────┼──────┼────────┤
│ ...  │            │          │       │     │      │        │
└──────┴────────────┴──────────┴───────┴─────┴──────┴────────┘
                                           Page 1 of 3  [< >]
```

**Features:**
- Click row → navigate to playlist detail
- Delete button (admin only, confirmation dialog)
- Filter by uploader and date range
- Pagination (50 per page)

### 2. Playlist Detail Page (`/playlists/:id`)

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ ← Back to Playlists                                         │
├─────────────────────────────────────────────────────────────┤
│ 📋 tcrg_main                                                │
│ Uploaded: Nov 20, 2025 2:30 PM by John Doe                 │
│ Batch ID: 550e8400-e29b-41d4-a716                          │
│ Source: tcrg_main.csv                                       │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌─────────┐          │
│ │ Total   │ │ New     │ │ Existing │ │ Reviewed│          │
│ │   797   │ │   234   │ │    563   │ │   450   │          │
│ └─────────┘ └─────────┘ └──────────┘ └─────────┘          │
├─────────────────────────────────────────────────────────────┤
│ [Export Playlist CSV] [Filter: All ▼]                      │
├────────┬─────────────┬────────┬────────┬──────────┬────────┤
│ Status │ Artist      │ Title  │ Energy │ Subgenre │ Review │
├────────┼─────────────┼────────┼────────┼──────────┼────────┤
│ 🆕 New │ The Beatles │ Let... │ Med    │ Classic  │ ✅     │
├────────┼─────────────┼────────┼────────┼──────────┼────────┤
│ 📋 Dup │ Queen       │ Bohe...│ High   │ Rock     │ ⏳     │
├────────┼─────────────┼────────┼────────┼──────────┼────────┤
│ ...    │             │        │        │          │        │
└────────┴─────────────┴────────┴────────┴──────────┴────────┘
```

**Features:**
- Stats cards showing totals
- Song table with "Status" column (New vs Existing)
- All existing song table features (play, review, filters)
- Export button creates CSV of only this playlist's songs
- Breadcrumb navigation

### 3. Updated Filter Panel (Main Song Table)

**New Filter:**
```
┌─────────────────────────────────────┐
│ Filters                             │
├─────────────────────────────────────┤
│ Playlist:     [All Playlists ▼]    │  ← NEW
│ Subgenre:     [All ▼]              │
│ Energy:       [All ▼]              │
│ Status:       [All ▼]              │
│ ...                                 │
└─────────────────────────────────────┘
```

**When playlist selected:**
- Badge appears: "🎵 Filtered by: tcrg_main [×]"
- Song table shows only songs in that playlist
- URL updates: `/songs?playlistId=clx123abc`

## User Flows

### Flow 1: Upload New Playlist
1. User runs: `npm run enrich:playlist new-songs.csv --uploaded-by=john@example.com`
2. Script creates `Playlist` record
3. Script processes each song (AI classification)
4. Script creates `PlaylistSong` associations (all songs, including duplicates)
5. Script updates playlist stats
6. User navigates to `/playlists` → sees new playlist in list
7. User clicks playlist → sees all 797 songs with 234 marked "New", 563 marked "Existing"

### Flow 2: Review Playlist Songs
1. User navigates to `/playlists`
2. User clicks "tcrg_main" playlist
3. Views playlist detail page with stats
4. Filters to "Pending Review" songs
5. Reviews songs using existing review modal
6. Exports completed reviews as CSV

### Flow 3: Filter Main Table by Playlist
1. User navigates to `/songs` (main song table)
2. Opens filter panel
3. Selects "tcrg_main" from Playlist dropdown
4. Song table updates to show only 797 songs from that playlist
5. User can review/edit as normal

## Migration Strategy

### Phase 1: Schema Migration (No Backfill)
```bash
npx prisma migrate dev --name add-playlists
```

**What happens:**
- Creates `playlists` and `playlist_songs` tables
- Adds `playlists` relation to `Song` and `User` models
- Existing songs remain unchanged (no playlist associations)
- Old `uploadBatchId` fields remain for backward compatibility

**Result:**
- Historical songs still accessible via batch filters
- New uploads create proper playlists
- No data loss or corruption risk

### Phase 2: Deploy Script Changes
- Update all 3 upload scripts
- Test with sample CSV uploads
- Verify playlist creation and song associations

### Phase 3: Deploy API + UI
- Deploy new API endpoints
- Deploy playlists page
- Deploy playlist filter to main song table
- Deploy playlist detail view

## Edge Cases & Error Handling

### Edge Case 1: Upload Fails Mid-Process
**Scenario:** Network error during song processing
**Handling:**
- Playlist record already created → remains in DB
- Some songs associated, some not
- Display warning: "Incomplete upload - X of Y songs processed"
- Allow user to delete and re-upload

### Edge Case 2: Duplicate Song in Same CSV
**Scenario:** CSV contains same ISRC twice
**Handling:**
- Second occurrence skipped (no duplicate `PlaylistSong` entry)
- Unique constraint on `[playlistId, songIsrc]` prevents duplicates
- Stats reflect unique song count

### Edge Case 3: Delete Playlist with Songs
**Scenario:** User deletes playlist containing songs
**Handling:**
- `Playlist` record deleted
- `PlaylistSong` associations cascade deleted
- `Song` records remain untouched
- Songs still accessible in main table

### Edge Case 4: No User Provided (CLI)
**Scenario:** Upload script run without `--uploaded-by` flag
**Handling:**
- `uploadedBy` set to `null`
- Playlist shows "Unknown Uploader" in UI
- Still fully functional

## Backward Compatibility

### Existing Features Preserved
✅ **Batch filtering** - Old `uploadBatchId` field still works
✅ **Song table** - All existing filters/views unchanged
✅ **Export** - Current export functionality unaffected
✅ **Review workflow** - No changes to review modal or process

### Coexistence Strategy
- Songs uploaded before feature → no playlist associations, filterable by batch
- Songs uploaded after feature → playlist associations + batch fields
- Both approaches work simultaneously

## Out of Scope (Future Enhancements)

❌ **Backfilling historical data** - Not included in v1
❌ **Playlist editing** - Cannot add/remove songs after creation
❌ **Playlist merging** - Cannot combine multiple playlists
❌ **Custom playlist creation** - Only via CSV upload
❌ **Playlist sharing** - No public/private playlist URLs
❌ **Playlist reordering** - Songs ordered by addedAt timestamp
❌ **Playlist tagging** - No custom tags or categories

## Success Criteria

### Must Have (Launch Blockers)
- [ ] All songs in uploaded CSV appear in created playlist
- [ ] Playlist detail page shows new vs existing songs
- [ ] Export playlist creates correct CSV
- [ ] Existing batch filters still work
- [ ] No performance degradation on song table

### Should Have (Post-Launch)
- [ ] Upload via CLI sets `uploadedBy` field
- [ ] Playlists page loads in < 2 seconds
- [ ] Delete playlist removes associations without affecting songs

### Nice to Have (Future)
- [ ] Backfill historical playlists
- [ ] Playlist analytics dashboard
- [ ] Bulk playlist operations

## Implementation Progress (V1 - Streamlined Scope)

### ✅ Completed (Session 2025-11-23)

**Phase 1: Database Schema**
- [x] **Database Schema** - Added Playlist and PlaylistSong tables with indexes
- [x] **Database Migration** - Ran `npx prisma db push` successfully
- [x] **Backup Script** - Created `scripts/backup-db.cjs` for JSON exports
- [x] **Database Backup** - 19MB backup at `backups/db_backup_2025-11-23T20-42-34.json`

**Phase 2: Script Updates**
- [x] **enrich-playlist.cjs** - Updated with full playlist tracking:
  - Creates Playlist record at start
  - Tracks wasNew flag for each song
  - Creates PlaylistSong associations
  - Updates playlist stats (totalSongs, newSongs, duplicateSongs)
  - Added `--uploaded-by-name` CLI flag
- [x] **enrich-spotify-playlist.cjs** - Added same playlist tracking logic
- [x] **import-curator-to-db.cjs** - Added same playlist tracking logic

**Phase 3: API Endpoints**
- [x] **GET /api/playlists** - Created endpoint to list all playlists

**Testing Results (2025-11-23)**
- ✅ Uploaded "DTF (Non-English Asian)" playlist (20 songs)
- ✅ Playlist record created successfully
- ✅ PlaylistSong associations working correctly
- ✅ wasNew flag accurately tracking new vs existing songs
- ✅ AI enrichment working for all songs
- ✅ Batch metadata preserved (uploadBatchId, uploadBatchName)
- ✅ All database relations functioning properly

### 🚧 In Progress
- [ ] **GET /api/songs** - Add playlistId filter parameter
- [ ] **Frontend API Client** - Add Playlist types and getPlaylists()
- [ ] **FilterPanel Component** - Add playlist dropdown (8th filter)
- [ ] **SongsPage** - Add playlist filter state and badge display

### 📋 Pending
- [ ] **End-to-End Testing** - Test full upload → filter → export flow
- [ ] **Fix uploadedByName parsing** - CLI flag not being set correctly

### 📝 Notes
- **Streamlined V1 Scope**: No separate playlist pages, just filter on main songs page
- **Backward Compatible**: Existing batch fields preserved, both systems work simultaneously
- **Free-text uploader**: uploadedByName is simple string field (no User FK)

## Original Rollout Plan (Full PRD - Deferred)

### Week 1: Development
- ~~Database migration~~ ✅ DONE
- ~~Script updates~~ 🚧 IN PROGRESS (1 of 3 complete)
- API endpoints 🔜 NEXT

### Week 2: Testing
- Manual testing with sample uploads
- Verify duplicate handling
- Test backward compatibility

### Week 3: UI Development
- ~~Build playlists page~~ ❌ DEFERRED (V1 uses filter only)
- Build playlist filter ✅ PLANNED
- ~~Build detail view~~ ❌ DEFERRED

### Week 4: Launch
- Deploy to production
- Monitor for errors
- Gather curator feedback

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Migration breaks existing queries | High | Test thoroughly on staging, keep batch fields |
| Performance issues with large playlists | Medium | Implement pagination, add database indexes |
| Users confused by two systems (batch vs playlist) | Medium | Add UI hints, documentation, training |
| Incomplete uploads create orphaned playlists | Low | Add cleanup job, allow manual deletion |

## Questions & Decisions

**Q: Should we auto-delete playlists with 0 songs?**
A: No - keep for audit trail. Add manual cleanup tool later.

**Q: Allow editing playlist name after creation?**
A: Not in v1. Can add in future if needed.

**Q: Show playlists to all users or just creator?**
A: Show all playlists to all users. Filter by uploader if needed.

**Q: Limit number of playlists?**
A: No hard limit. Monitor database size and add if needed.

---

**Document Version:** 1.0
**Last Updated:** 2025-11-21
**Next Review:** After implementation
