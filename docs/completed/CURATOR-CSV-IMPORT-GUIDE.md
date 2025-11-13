# Curator CSV Import Guide

This guide documents the complete workflow for importing curator-reviewed CSV files into the database, including ISRC matching, metadata enrichment, and audio/artwork linking.

## Overview

The curator CSV import workflow allows you to:
1. Import curator-reviewed playlists with custom classifications
2. Match songs to existing ISRC databases for missing metadata
3. Enrich missing fields (ACCESSIBILITY, EXPLICIT) via AI APIs
4. Link audio files and artwork from S3
5. Mark all imported songs as curator-reviewed

## Prerequisites

- Node.js environment with all dependencies installed
- Access to the following scripts:
  - `scripts/merge-and-enrich-curator-csvs.cjs`
  - `scripts/import-curator-to-db.cjs`
- Environment variables configured in `.env`:
  - `GEMINI_API_KEY` - For ACCESSIBILITY classification
  - `PARALLEL_AI_API_KEY` - For EXPLICIT content detection
  - `POSTGRES_URL_NON_POOLING` - Database connection

## File Structure Requirements

### Input Files

**Curator CSV Location:**
```
test-data/curator-enrichments/to-do/
├── Playlist Name - DATA EXPORT FOR NEW SYSTEM.csv
└── ... (other curator CSVs)
```

**ISRC Source Files Location:**
```
playlists/input/isrc_output/
├── playlist_name/
│   ├── playlist_name_formatted_high_confidence.csv  (preferred)
│   ├── playlist_name_formatted.csv  (fallback)
│   └── playlist_name_updated.csv  (for audio/artwork)
```

### Expected CSV Columns

**Curator CSV:**
- Artist
- Song
- ENERGY (Low, Medium, High, Very High, etc.)
- BPM
- Subgenre 1, Subgenre 2, Subgenre 3
- ACCESSIBILITY (may be missing - will be enriched)
- EXPLICIT (may be missing - will be enriched)
- ISRC (may be missing - will be matched)

**ISRC Source CSV (_high_confidence or _formatted):**
- Artist
- Name
- Energy
- BPM
- Subgenre
- ISRC

**Audio Source CSV (_updated):**
- title
- artist
- isrc
- artwork (S3 URL)
- source_file (S3 URL)

## Workflow Steps

### Step 1: Merge and Enrich

This step matches curator songs to ISRC database and enriches missing fields.

```bash
node scripts/merge-and-enrich-curator-csvs.cjs \
  "test-data/curator-enrichments/to-do/Playlist Name - DATA EXPORT FOR NEW SYSTEM.csv" \
  --isrc-source="playlists/input/isrc_output/playlist_name/playlist_name_formatted_high_confidence.csv" \
  --concurrency=5
```

**What it does:**
1. Loads curator CSV
2. Fuzzy matches songs to ISRC source by Artist + Title
3. Merges ISRCs from source file
4. Identifies missing fields:
   - ACCESSIBILITY (if empty)
   - EXPLICIT (if empty)
5. Calls AI APIs to enrich missing fields:
   - Gemini API for ACCESSIBILITY classification
   - Parallel AI for EXPLICIT content detection
6. Exports enriched CSV to `outputs/merged/`

**Output:**
```
outputs/merged/Playlist Name - DATA EXPORT FOR NEW SYSTEM-enriched-YYYY-MM-DDTHH-MM-SS.csv
```

### Step 2: Import to Database

This step imports the enriched CSV to the database with audio/artwork links.

```bash
node scripts/import-curator-to-db.cjs \
  "outputs/merged/Playlist Name - DATA EXPORT FOR NEW SYSTEM-enriched-YYYY-MM-DDTHH-MM-SS.csv" \
  --audio-source="playlists/input/isrc_output/playlist_name/playlist_name_updated.csv"
```

**What it does:**
1. Loads audio source for artwork and S3 URLs
2. Loads enriched curator CSV
3. For each song with an ISRC:
   - Creates or updates database record
   - Links artwork and audio file
   - Sets `reviewed=true`, `reviewedBy="curator"`
   - Normalizes values to Title Case
4. Skips songs without ISRCs

**Output:**
```
Summary:
  Created: 248
  Updated: 1
  Skipped: 0
  Total processed: 249
```

## Real-World Example

### Example: Bar Moxy Evening Playlist

```bash
# Step 1: Merge and enrich
node scripts/merge-and-enrich-curator-csvs.cjs \
  "test-data/curator-enrichments/to-do/Bar Moxy Evening - DATA EXPORT FOR NEW SYSTEM.csv" \
  --isrc-source="playlists/input/isrc_output/bar_moxy_evening/bar_moxy_evening_formatted_high_confidence.csv" \
  --concurrency=5

# Output: Matched 84/86 songs with ISRCs

# Step 2: Import to database
node scripts/import-curator-to-db.cjs \
  "outputs/merged/Bar Moxy Evening - DATA EXPORT FOR NEW SYSTEM-enriched-2025-11-10T19-44-11.csv" \
  --audio-source="playlists/input/isrc_output/bar_moxy_evening/bar_moxy_evening_updated.csv"

# Output: Created 79, Updated 5, Skipped 2
```

## Batch Processing Multiple Playlists

To process multiple curator CSVs in sequence:

```bash
# 1. Bar Moxy Evening
node scripts/merge-and-enrich-curator-csvs.cjs \
  "test-data/curator-enrichments/to-do/Bar Moxy Evening - DATA EXPORT FOR NEW SYSTEM.csv" \
  --isrc-source="playlists/input/isrc_output/bar_moxy_evening/bar_moxy_evening_formatted_high_confidence.csv" \
  --concurrency=5

node scripts/import-curator-to-db.cjs \
  "outputs/merged/Bar Moxy Evening - DATA EXPORT FOR NEW SYSTEM-enriched-2025-11-10T19-44-11.csv" \
  --audio-source="playlists/input/isrc_output/bar_moxy_evening/bar_moxy_evening_updated.csv"

# 2. Benny's Afternoon
node scripts/merge-and-enrich-curator-csvs.cjs \
  "test-data/curator-enrichments/to-do/Benny's Afternoon - DATA EXPORT FOR NEW SYSTEM.csv" \
  --isrc-source="playlists/input/isrc_output/benny's_afternoon/benny's_afternoon_formatted_high_confidence.csv" \
  --concurrency=5

node scripts/import-curator-to-db.cjs \
  "outputs/merged/Benny's Afternoon - DATA EXPORT FOR NEW SYSTEM-enriched-2025-11-10T19-44-35.csv" \
  --audio-source="playlists/input/isrc_output/benny's_afternoon/benny's_afternoon_updated.csv"

# ... continue for remaining playlists
```

## Naming Pattern Mapping

Finding the correct ISRC source directory can be tricky. Here are common patterns:

| Curator CSV Name | ISRC Directory | Notes |
|------------------|----------------|-------|
| Bar Moxy Evening | `bar_moxy_evening/` | Lowercase, underscores |
| Benny's Afternoon | `benny's_afternoon/` | Lowercase, apostrophe preserved |
| Cabana Sass - Early | `cabana_sass_early_lunch/` | "Early" → "early_lunch" |
| Din Tai Fung - Indie Grooves | `dtf_indie_grooves/` or `DTF (Indie Grooves)/` | Check both formats |
| Meditative Soundscapes | `Meditative Soundscape/` | Singular, Title Case |

**Pro tip:** Use `ls playlists/input/isrc_output/ | grep -i "keyword"` to find directories.

## Handling Edge Cases

### Case 1: No High Confidence File

Some playlists only have `_formatted.csv` without `_high_confidence.csv`.

**Solution:** Use `_formatted.csv` instead:
```bash
--isrc-source="playlists/input/isrc_output/playlist_name/playlist_name_formatted.csv"
```

### Case 2: Songs Without ISRCs

Songs that cannot be matched to the ISRC source will be skipped during import.

**Behavior:**
- Enrichment script will show: "Matched X/Y songs with ISRCs"
- Import script will skip songs without ISRCs
- These songs require manual ISRC lookup

### Case 3: All Fields Complete

If all curator songs already have ACCESSIBILITY, EXPLICIT, and ISRCs:

**Behavior:**
- Enrichment script will show: "Skipped (complete): X"
- No API calls made (saves cost)
- Enriched CSV will be identical to input

### Case 4: Directory Name Mismatch

If the ISRC directory name doesn't match the curator CSV name:

**Solution:**
1. List directories: `ls playlists/input/isrc_output/`
2. Search for keywords: `ls playlists/input/isrc_output/ | grep -i "dtf"`
3. Use exact path found

## Data Transformations

The import process applies these transformations:

### Energy Normalization
- Curator: `"MEDIUM"` → Database: `"Medium"`
- Curator: `"VERY HIGH"` → Database: `"Very High"`

### Accessibility Normalization
- Curator: `"TIMELESS"` → Database: `"Timeless"`
- Curator: `"COMMERCIAL"` → Database: `"Commercial"`

### Explicit Content Normalization
- Curator: `"FAMILY"` → Database: `"Family Friendly"`
- Curator: `"SUGGESTIVE"` → Database: `"Suggestive"`
- Curator: `"EXPLICIT"` → Database: `"Explicit"`

### Subgenre Format
- Curator CSV: 3 separate columns (Subgenre 1, 2, 3)
- Database: 3 fields (aiSubgenre1, aiSubgenre2, aiSubgenre3)

## Script Options

### merge-and-enrich-curator-csvs.cjs Options

```bash
--isrc-source=<path>     # Path to ISRC source CSV (required)
--concurrency=<number>   # API concurrency (default: 5)
--force                  # Force reprocess all songs
--skip-existing          # Skip songs already in database
--gemini-only            # Only run Gemini enrichment
--explicit-only          # Only run explicit content detection
--dry-run                # Preview without making changes
```

### import-curator-to-db.cjs Options

```bash
--audio-source=<path>    # Path to _updated.csv with artwork/audio
--dry-run                # Preview import without database changes
```

## Success Metrics

From the November 10, 2025 import session:

| Metric | Value |
|--------|-------|
| Total Playlists Processed | 8 |
| Total Songs Processed | 1,392 |
| Successfully Imported | 1,367 (98.2%) |
| New Songs Created | 1,336 |
| Existing Songs Updated | 31 |
| Skipped (No ISRC) | 25 (1.8%) |
| ISRC Match Rate | ~96-100% per playlist |
| Enrichment Needed | 0% (all complete) |

## Troubleshooting

### Error: "ENOENT: no such file or directory"

**Cause:** Incorrect path to ISRC source file.

**Solution:**
1. Verify file exists: `ls "path/to/file.csv"`
2. Check for typos in directory name
3. Try `_formatted.csv` if `_high_confidence.csv` missing

### Error: "POSTGRES connection failed"

**Cause:** Missing or incorrect database credentials.

**Solution:**
1. Verify `.env` has `POSTGRES_URL_NON_POOLING`
2. Run `vercel env pull .env.local` to refresh credentials
3. Test connection: `node -e "require('@prisma/client')"`

### Warning: "Matched X/Y songs with ISRCs"

**Cause:** Some songs couldn't be fuzzy matched to ISRC source.

**Solution:**
- If match rate < 90%, verify ISRC source is correct playlist
- Check for typos in curator CSV artist/title
- Missing songs will be skipped during import

### API Rate Limit Errors

**Cause:** Too many concurrent API calls.

**Solution:**
- Reduce concurrency: `--concurrency=3`
- Add delays between playlists
- Check API quota usage

## Best Practices

1. **Process one playlist at a time** - Easier to debug and track progress
2. **Verify ISRC source first** - Use `ls` and `head -1` to confirm
3. **Check enrichment output** - Review "Complete" vs "Enriched" counts
4. **Include audio source** - Always use `--audio-source` for complete data
5. **Archive processed CSVs** - Move from `to-do/` to `completed/` after import
6. **Monitor API usage** - Track Gemini and Parallel AI quota
7. **Test with dry-run** - Use `--dry-run` to preview before committing

## Related Documentation

- `CLAUDE.md` - Main project documentation
- `PRD-review-interface.md` - Review interface requirements
- `PRISMA-MIGRATION.md` - Database schema details
- `SETUP.md` - Initial setup instructions

## Scripts Location

```
scripts/
├── merge-and-enrich-curator-csvs.cjs   # Step 1: Merge & enrich
├── import-curator-to-db.cjs            # Step 2: Import to DB
├── verify-import.cjs                   # Verify import results
└── check-song-data.cjs                 # Inspect specific songs
```

## Future Improvements

- [ ] Batch processing script to automate multiple playlists
- [ ] Automatic ISRC source detection based on curator CSV name
- [ ] Progress tracking across multiple import sessions
- [ ] Retry logic for failed API calls
- [ ] CSV validation before processing
- [ ] Import rollback mechanism

---

**Last Updated:** November 10, 2025
**Import Session:** Successfully imported 8 playlists (1,367 songs)
