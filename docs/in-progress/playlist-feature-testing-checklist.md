# Playlist Feature Testing Checklist

**Version:** 1.0
**Date Created:** 2025-11-23
**Feature:** Playlist filtering, association, and export functionality

## Overview

This document provides a comprehensive testing checklist for the playlist feature implementation. Each test includes the test objective, expected behavior, verification steps, and a checkbox to track completion.

---

## Critical Tests

### 1. Export with Playlist Filter

**Objective:** Verify that CSV export respects the selected playlist filter

**Test Steps:**
1. Select a specific playlist from the dropdown (e.g., "Summer Vibes")
2. Apply any additional filters (optional)
3. Click "Export CSV" button
4. Open the exported CSV file

**Expected Behavior:**
- Only songs associated with the selected playlist are exported
- All songs in the export have matching `playlistName` value
- Export count matches the filtered view count
- Other filter criteria (if applied) are also respected

**Verification:**
- [ ] CSV contains only songs from selected playlist
- [ ] `playlistName` column values match filter selection
- [ ] Row count matches UI pagination total
- [ ] No songs from other playlists are included

**Status:** [YES] PASSED [ ] FAILED [ ] NOT TESTED

---

### 2. Playlist Sorting in Dropdown

**Objective:** Verify playlist dropdown shows playlists in reverse chronological order (newest first)

**Test Steps:**
1. Upload multiple playlists at different times
2. Open the playlist filter dropdown
3. Observe the order of playlists

**Expected Behavior:**
- Most recently uploaded playlist appears first
- Oldest playlist appears last
- "All Playlists" option appears at the top
- Order is consistent with upload timestamps

**Verification:**
- [ ] "All Playlists" is first option
- [ ] Newest playlist is second option
- [ ] Playlists are in reverse chronological order
- [ ] Order matches database `createdAt` timestamps

**Status:** [YES] PASSED [ ] FAILED [ ] NOT TESTED

---

### 3. Multiple Playlist Association

**Objective:** Verify songs can appear in multiple playlists correctly

**Test Steps:**
1. Upload Playlist A containing Song X
2. Upload Playlist B also containing Song X
3. Filter by Playlist A, verify Song X appears
4. Filter by Playlist B, verify Song X appears
5. Export each playlist separately

**Expected Behavior:**
- Song X appears when filtering by Playlist A
- Song X appears when filtering by Playlist B
- Exports for each playlist include Song X
- Song data remains consistent across playlists

**Verification:**
- [ ] Song appears in both playlist filters
- [ ] Song exports correctly with Playlist A
- [ ] Song exports correctly with Playlist B
- [ ] Song metadata is identical in both contexts
- [ ] Database has correct associations (check `Song.playlists` array)

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 4. Playlist Metadata Accuracy

**Objective:** Verify playlist metadata (name, song count, upload date) is accurate

**Test Steps:**
1. Upload a playlist CSV with known song count
2. Check database for playlist record
3. Verify UI displays correct information
4. Check playlist dropdown shows correct name

**Expected Behavior:**
- Playlist name matches original CSV filename (normalized)
- Song count matches number of rows in CSV
- Upload timestamp is accurate
- All metadata persists correctly

**Verification:**
- [ ] Playlist name is correct and normalized
- [ ] Song count is accurate
- [ ] `createdAt` timestamp is set correctly
- [ ] Metadata visible in dropdown/UI matches database

**Status:** [YES] PASSED [ ] FAILED [ ] NOT TESTED

---

### 5. Filter Combination Testing

**Objective:** Verify playlist filter works correctly with other filters

**Test Steps:**
1. Select a playlist filter
2. Apply Energy filter (e.g., "High")
3. Apply Subgenre filter (e.g., "Pop/Top 40")
4. Apply Review Status filter (e.g., "Approved")
5. Verify results match all criteria

**Expected Behavior:**
- Songs must match ALL selected filters (AND logic)
- Changing any filter updates results immediately
- Pagination updates correctly
- Export respects all combined filters

**Verification:**
- [ ] Playlist + Energy filter combination works
- [ ] Playlist + Subgenre filter combination works
- [ ] Playlist + Review Status filter combination works
- [ ] All three filters combined work correctly
- [ ] Pagination reflects correct total count
- [ ] Export includes only songs matching all filters

**Status:** [] PASSED [ ] FAILED [ ] NOT TESTED

---

### 6. Pagination with Playlist Filter

**Objective:** Verify pagination works correctly when playlist filter is active

**Test Steps:**
1. Select a playlist with more than 50 songs
2. Observe pagination controls
3. Navigate to page 2
4. Verify song count and data consistency
5. Change page size and verify

**Expected Behavior:**
- Pagination shows correct total count
- Page navigation works smoothly
- Songs on each page belong to selected playlist
- Page size changes update display correctly

**Verification:**
- [ ] Total count matches filtered song count
- [ ] Page navigation works (next/previous)
- [ ] All pages show correct playlist songs
- [ ] Page size changes (50/100/200) work correctly
- [ ] URL state persists pagination settings

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 7. "All Playlists" Default Behavior

**Objective:** Verify "All Playlists" option shows all songs regardless of playlist

**Test Steps:**
1. Upload multiple playlists
2. Select specific playlist
3. Switch back to "All Playlists"
4. Verify all songs are shown

**Expected Behavior:**
- "All Playlists" is the default selection
- Switching to "All Playlists" removes playlist filter
- All songs in database are visible (subject to other filters)
- Export includes all songs when "All Playlists" is selected

**Verification:**
- [ ] "All Playlists" is default on page load
- [ ] Shows all songs when selected
- [ ] Other filters still work with "All Playlists"
- [ ] Export includes all songs (subject to other filters)
- [ ] Song count matches total in database

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 8. Empty Playlist Scenario

**Objective:** Verify behavior when a playlist has no songs

**Test Steps:**
1. Create a scenario where a playlist exists but has no songs (edge case)
2. Select that playlist from dropdown
3. Observe UI behavior

**Expected Behavior:**
- UI shows "No songs found" message
- No error is thrown
- Pagination shows 0 results
- Export button is disabled or creates empty CSV

**Verification:**
- [ ] UI gracefully handles empty playlist
- [ ] No console errors appear
- [ ] Appropriate "no results" message shown
- [ ] Export behavior is appropriate

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 9. Search + Playlist Filter

**Objective:** Verify search functionality works with playlist filter

**Test Steps:**
1. Select a specific playlist
2. Use search box to search for artist/title
3. Verify results match both criteria
4. Clear search and verify playlist filter remains

**Expected Behavior:**
- Search only returns results within selected playlist
- Search + playlist filter work together (AND logic)
- Clearing search keeps playlist filter active
- Export respects both search and playlist filter

**Verification:**
- [ ] Search results limited to selected playlist
- [ ] Search across artist and title works
- [ ] Playlist filter persists after search
- [ ] Export includes search + playlist results
- [ ] "Clear search" keeps playlist filter active

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 10. Reviewed Songs in Playlist

**Objective:** Verify reviewed/approved songs in playlists display and export correctly

**Test Steps:**
1. Upload playlist with some reviewed songs
2. Filter by playlist + "Approved" review status
3. Verify only approved songs from that playlist appear
4. Export and verify CSV contains correct songs

**Expected Behavior:**
- Approved songs in playlist are visible
- Review status filter works with playlist filter
- Exported CSV reflects both filters
- Review metadata preserved in export

**Verification:**
- [ ] Approved songs in playlist are visible
- [ ] Review status + playlist filter combination works
- [ ] Export includes only approved songs from playlist
- [ ] Review metadata (reviewedBy, reviewedAt) present in export

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

## Edge Cases

### 11. Special Characters in Playlist Names

**Objective:** Verify system handles special characters in playlist names

**Test Steps:**
1. Upload CSV with filename containing special characters:
   - Spaces: "My Playlist.csv"
   - Hyphens/underscores: "test-playlist_v2.csv"
   - Numbers: "2024-summer-hits.csv"
   - Parentheses: "Chill (Acoustic).csv"
   - Ampersands: "Rock & Roll.csv"
2. Check playlist name in dropdown
3. Filter by that playlist
4. Export and verify CSV

**Expected Behavior:**
- Special characters are preserved or normalized consistently
- Playlist is selectable in dropdown
- Filtering works correctly
- Export filename reflects playlist name appropriately

**Verification:**
- [ ] Spaces handled correctly
- [ ] Hyphens and underscores preserved
- [ ] Numbers don't cause issues
- [ ] Parentheses work correctly
- [ ] Ampersands and other special chars handled
- [ ] No database errors with special characters

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 12. Very Long Playlist Names

**Objective:** Verify UI and database handle very long playlist names

**Test Steps:**
1. Upload CSV with very long filename (100+ characters)
2. Check dropdown display
3. Check database storage
4. Verify filtering and export

**Expected Behavior:**
- Long names are truncated in UI with ellipsis
- Full name stored in database
- Tooltip shows full name on hover
- Export uses full playlist name

**Verification:**
- [ ] Long names display correctly in dropdown (truncated)
- [ ] Hover shows full name
- [ ] Database stores complete name
- [ ] Filtering works with long names
- [ ] Export CSV has correct playlist name
- [ ] No UI layout breaks

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 13. Concurrent Uploads

**Objective:** Verify system handles multiple playlists uploaded simultaneously

**Test Steps:**
1. Open two browser tabs
2. Upload different playlists simultaneously
3. Check both complete successfully
4. Verify both appear in dropdown
5. Filter by each and verify data

**Expected Behavior:**
- Both uploads complete without errors
- Database maintains data integrity
- Both playlists appear in dropdown
- Song associations are correct for each playlist
- No race conditions or data corruption

**Verification:**
- [ ] Both uploads complete successfully
- [ ] Both playlists in dropdown
- [ ] Song counts are correct for each
- [ ] No duplicate songs incorrectly created
- [ ] Database constraints maintained
- [ ] No console errors

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 14. Re-uploading Same Playlist

**Objective:** Verify behavior when same playlist is uploaded multiple times

**Test Steps:**
1. Upload "Playlist A"
2. Note song count and associations
3. Re-upload identical "Playlist A" CSV
4. Check if duplicate playlist created or existing updated
5. Verify song associations

**Expected Behavior:**
- System either updates existing playlist or creates new version
- Behavior is consistent and documented
- Song associations are correct
- No orphaned data or broken references

**Verification:**
- [ ] Re-upload behavior is predictable
- [ ] Dropdown shows correct playlist(s)
- [ ] Song associations updated correctly
- [ ] No duplicate songs created
- [ ] Database remains consistent
- [ ] User understands expected behavior

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

## Performance Tests

### 15. Large Playlist Handling

**Objective:** Verify system performs well with playlists containing 1000+ songs

**Test Steps:**
1. Upload a large playlist (1000+ songs)
2. Measure upload time
3. Filter by large playlist
4. Measure page load time
5. Navigate pagination
6. Export CSV and measure time

**Expected Behavior:**
- Upload completes within reasonable time (< 2 minutes)
- Filtering loads within 2 seconds
- Pagination responsive (< 500ms per page)
- Export completes within reasonable time based on size
- No browser freezing or timeouts

**Verification:**
- [ ] Upload time acceptable (< 2 min for 1000 songs)
- [ ] Filter application < 2 seconds
- [ ] Pagination smooth and responsive
- [ ] Export completes successfully
- [ ] No memory leaks or performance degradation
- [ ] Database queries optimized (check logs)

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 16. Many Playlists

**Objective:** Verify system handles 50+ playlists in dropdown

**Test Steps:**
1. Upload 50+ playlists (can use test script)
2. Check dropdown performance
3. Verify all playlists are selectable
4. Test search/filtering with many playlists
5. Check database query performance

**Expected Behavior:**
- Dropdown renders quickly (< 1 second)
- All playlists are accessible
- Dropdown is scrollable and usable
- Filtering and export work correctly
- No performance degradation

**Verification:**
- [ ] Dropdown loads all playlists quickly
- [ ] Dropdown is scrollable and responsive
- [ ] All playlists selectable
- [ ] Search/filtering still performant
- [ ] Database queries remain fast
- [ ] No UI rendering issues

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

## Data Integrity Tests

### 17. Database Consistency

**Objective:** Verify database maintains referential integrity for playlists

**Test Steps:**
1. Upload multiple playlists with overlapping songs
2. Query database directly:
   ```sql
   SELECT * FROM "Playlist";
   SELECT * FROM "Song" WHERE playlists @> '["PlaylistName"]';
   ```
3. Verify song-playlist associations are correct
4. Check for orphaned records

**Expected Behavior:**
- All playlist records have valid metadata
- Song-playlist associations are accurate (JSONB array)
- No orphaned songs or playlists
- Timestamps are accurate
- Foreign key constraints maintained (if applicable)

**Verification:**
- [ ] All playlists in database match uploads
- [ ] Song `playlists` array is accurate
- [ ] No orphaned records
- [ ] Timestamps correct
- [ ] Database constraints enforced
- [ ] No data corruption

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED

---

### 18. Playlist Deletion (if implemented)

**Objective:** Verify playlist deletion behavior (if feature exists)

**Test Steps:**
1. Upload a playlist
2. Delete the playlist (via UI or script)
3. Check songs that were only in that playlist
4. Check songs that were in multiple playlists
5. Verify dropdown updates

**Expected Behavior:**
- Playlist removed from dropdown
- Songs in multiple playlists: playlist removed from their `playlists` array
- Songs only in deleted playlist: either deleted or `playlists` array emptied
- Behavior is documented and consistent
- No broken references

**Verification:**
- [ ] Playlist removed from dropdown
- [ ] Songs in multiple playlists updated correctly
- [ ] Songs only in deleted playlist handled appropriately
- [ ] No broken database references
- [ ] UI updates immediately
- [ ] Export no longer shows deleted playlist

**Status:** [ ] PASSED [ ] FAILED [ ] NOT TESTED [ ] NOT APPLICABLE

---

## Testing Environment Setup

### Prerequisites

- [ ] Backend running on port 3001 (`vercel dev --listen 3001`)
- [ ] Frontend running on port 3000 (`cd client && npm run dev`)
- [ ] Database seeded with initial test data
- [ ] Test playlists prepared in `playlists/input/` directory
- [ ] Environment variables configured (`.env.local`)

### Test Data Recommendations

1. **Small playlist**: 10-20 songs for quick tests
2. **Medium playlist**: 100-200 songs for typical scenarios
3. **Large playlist**: 1000+ songs for performance testing
4. **Duplicate songs**: Multiple playlists with overlapping songs
5. **Special characters**: Playlists with various naming patterns

---

## Test Execution Log

| Test # | Test Name | Date Tested | Tester | Result | Notes |
|--------|-----------|-------------|--------|--------|-------|
| 1 | Export with Playlist Filter | | | | |
| 2 | Playlist Sorting in Dropdown | | | | |
| 3 | Multiple Playlist Association | | | | |
| 4 | Playlist Metadata Accuracy | | | | |
| 5 | Filter Combination Testing | | | | |
| 6 | Pagination with Playlist Filter | | | | |
| 7 | "All Playlists" Default Behavior | | | | |
| 8 | Empty Playlist Scenario | | | | |
| 9 | Search + Playlist Filter | | | | |
| 10 | Reviewed Songs in Playlist | | | | |
| 11 | Special Characters in Playlist Names | | | | |
| 12 | Very Long Playlist Names | | | | |
| 13 | Concurrent Uploads | | | | |
| 14 | Re-uploading Same Playlist | | | | |
| 15 | Large Playlist Handling | | | | |
| 16 | Many Playlists | | | | |
| 17 | Database Consistency | | | | |
| 18 | Playlist Deletion | | | | |

---

## Issues Discovered

| Issue # | Test # | Description | Severity | Status | Fix PR/Commit |
|---------|--------|-------------|----------|--------|---------------|
| | | | | | |

**Severity Levels:**
- **Critical**: Feature broken, blocks usage
- **High**: Significant impact, workaround exists
- **Medium**: Moderate impact, not blocking
- **Low**: Minor issue, cosmetic or edge case

---

## Sign-off

**QA Lead:** _____________________________ Date: __________

**Product Owner:** _______________________ Date: __________

**Developer:** ___________________________ Date: __________

---

## Notes

- Update this checklist as new test scenarios are identified
- Link related GitHub issues to the Issues Discovered section
- Archive completed checklists in `docs/completed/` after release
- Consider automating high-priority tests with integration tests
