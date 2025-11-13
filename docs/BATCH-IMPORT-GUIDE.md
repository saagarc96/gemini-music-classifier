# Batch Import Guide

## Overview

This guide explains how to use the batch enrichment system to import ~20,000 songs from the `isrc_output` directory into the music classification database.

## What's Been Built

### 1. Priority List Analysis
- **File**: `docs/playlist-import-priority.md`
- **Contents**: 188 playlists ranked by new song count
- **Stats**:
  - High priority: 27 playlists (200+ new songs each)
  - Medium priority: 57 playlists (100-199 new songs)
  - Low priority: 104 playlists (<100 new songs)
- **Note**: Contains 22 duplicate playlists (same ISRC sets, different folder names)

### 2. Batch Enrichment Script
- **File**: `scripts/batch-enrich-playlists.cjs`
- **Features**:
  - Processes playlists in priority order
  - Auto-detects duplicates (ISRC + fuzzy matching)
  - Preserves S3 artwork and audio URLs
  - Resume capability (--start-at option)
  - Progress tracking and error handling
  - Estimated time per playlist: 5-10 minutes

### 3. Deduplication Utility
- **File**: `scripts/deduplicate-priority-list.cjs`
- **Purpose**: Identifies duplicate playlists by comparing ISRC sets
- **Findings**: 22 duplicate groups detected (e.g., "mcfadden's_late_night" vs "McFadden's Late Night")

## Usage

### Quick Start: Process High Priority Playlists

```bash
# Process all high-priority playlists (19 unique playlists, ~3,500 songs)
npm run enrich:batch -- --priority=high --skip-duplicates
```

**Options:**
- `--priority=high|medium|low|all` - Filter by priority level
- `--skip-duplicates` - Auto-skip duplicate songs without prompting
- `--concurrency=N` - Process N songs at a time (default: 5)
- `--start-at=N` - Resume from playlist #N
- `--dry-run` - Preview playlists without processing

### Estimated Time

**With defaults (concurrency=5):**
- High priority: ~10-20 hours (3,500 songs)
- Medium priority: ~20-30 hours (8,000 songs)
- Low priority: ~10-15 hours (4,700 songs)
- **Total**: ~40-60 hours for all 20,000 songs

**To speed up (concurrency=10):**
```bash
npm run enrich:batch -- --priority=high --concurrency=10 --skip-duplicates
```
- Cuts time in half but uses more API quota

### Resume After Interruption

If the script is interrupted, resume from where you left off:

```bash
# Example: Resume from playlist #15
npm run enrich:batch -- --priority=high --start-at=14 --skip-duplicates
```

### Process Specific Priority Levels

```bash
# High priority only
npm run enrich:batch -- --priority=high --skip-duplicates

# Medium priority only
npm run enrich:batch -- --priority=medium --skip-duplicates

# All playlists
npm run enrich:batch -- --priority=all --skip-duplicates
```

### Dry Run (Preview)

```bash
# See what will be processed without actually running
npm run enrich:batch -- --priority=high --dry-run
```

## What Gets Imported

For each song, the system:

1. **Loads from CSV**: ISRC, Artist, Title, BPM, Energy, Subgenre, Artwork URL, Audio URL
2. **Enriches via APIs**:
   - Gemini AI: Energy, Accessibility, 3 Subgenres, Reasoning
   - Parallel AI: Explicit content classification
3. **Saves to database**: All fields above + timestamps + review status (unreviewed)
4. **Exports enriched CSV**: Saved to `outputs/` directory

## Duplicate Handling

The script uses fuzzy matching (70% similarity threshold) to detect duplicates:

### Detection Methods:
1. **Exact ISRC match** - 100% duplicate
2. **Artist + Title fuzzy match** - 70%+ similarity

### Resolution Options (when --skip-duplicates is NOT used):
- **[S]kip** - Don't import, keep existing song
- **[U]pdate** - Merge new data into existing song
- **[N]ew** - Save as separate duplicate version
- **[A]lways new** - Auto-import all remaining songs as new
- **[Q]uit** - Stop processing

### Recommended Approach:
Use `--skip-duplicates` for batch processing to auto-skip without prompting.

## Monitoring Progress

### During Processing:
- Live output shows each song as it's processed
- Progress summary every 5 playlists
- Estimated time remaining

### Check Database Stats:
```bash
# After completion, check total songs imported
psql $POSTGRES_URL_NON_POOLING -c "SELECT COUNT(*) FROM songs;"

# Check by review status
psql $POSTGRES_URL_NON_POOLING -c "SELECT reviewed, COUNT(*) FROM songs GROUP BY reviewed;"
```

## Files Without ISRCs (Skipped)

These 9 playlists are missing ISRCs and will be automatically skipped:
1. Hawaiian Christmas (58 songs)
2. GHK Waterfall Soundscape (3 songs)
3. Soul Revival (Mixes) (7 songs)
4. Funk Favorites (Mixes) (1 song)
5. Motown Brunch (Mixes) (5 songs)
6. Party Classics (1 song)
7. Updated Waterfall (1 song)
8. Funk & Soul Classics (Mixes) (9 songs)
9. Nubeluz Mixes (14 songs)

## Known Duplicates

22 duplicate groups exist in the priority list (same playlist, different folder names):
- mcfadden's_late_night ↔ McFadden's Late Night
- commercial_dance ↔ Commercial Dance
- ghk_treatment_rooms ↔ GHK Treatment Rooms
- ghk_pool ↔ GHK Pool
- ghk_salon ↔ GHK Salon
- And 17 more...

**Recommendation**: Process one version of each (e.g., prefer snake_case versions).

## After Import

### Review in Web Interface

```bash
# Start backend (Terminal 1)
vercel dev --listen 3001

# Start frontend (Terminal 2)
cd client && npm run dev
```

Navigate to http://localhost:3000 to review and edit classifications.

### Export Results

Use the web interface's "Export CSV" feature or API endpoint:
```bash
curl "http://localhost:3001/api/songs/export?reviewStatus=unreviewed" -o unreviewed-songs.csv
```

## Troubleshooting

### Script Fails Mid-Playlist
- Use `--start-at=N` to resume from next playlist
- Check error logs for specific song failures

### API Rate Limits
- Reduce `--concurrency` to lower API usage
- Space out processing across multiple days

### Duplicate Prompts
- Use `--skip-duplicates` to bypass prompts
- Or select [A]lways new mode when prompted

### Memory Issues
- Process in smaller batches (high → medium → low)
- Restart between priority levels

## Commands Reference

```bash
# Preview high priority
npm run enrich:batch -- --priority=high --dry-run

# Process high priority with auto-skip duplicates
npm run enrich:batch -- --priority=high --skip-duplicates

# Process high priority with faster concurrency
npm run enrich:batch -- --priority=high --concurrency=10 --skip-duplicates

# Resume from playlist 15
npm run enrich:batch -- --priority=high --start-at=14 --skip-duplicates

# Process all playlists
npm run enrich:batch -- --priority=all --skip-duplicates

# Check for duplicate playlists
node scripts/deduplicate-priority-list.cjs
```

## Next Steps

After importing all songs:
1. Review in web interface (http://localhost:3000)
2. Filter by `Unreviewed` status
3. Curate and approve classifications
4. Export final reviewed dataset
5. Deploy to production
