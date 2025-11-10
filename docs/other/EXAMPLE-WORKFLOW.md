# Complete Workflow Example

This document demonstrates a complete end-to-end workflow using the music classification system.

## Scenario

You have a new playlist CSV with 200 songs. You want to:
1. Classify them with Gemini AI and Parallel AI
2. Merge with the existing 13,428-song cache masterlist
3. Preserve user corrections and cache explicit scores
4. Review the results in the web interface

## Step-by-Step Workflow

### Step 1: Enrich the Playlist (5-10 minutes)

```bash
# Place your playlist CSV in playlists/input/
cp ~/Downloads/new-playlist.csv playlists/input/

# Run enrichment with Gemini + Parallel AI
npm run enrich:playlist playlists/input/new-playlist.csv

# Expected output:
# [1/5] Loading CSV...
#   ✓ Loaded 200 songs
# [2/5] Processing songs (5 at a time)...
#   Progress: 40 / 200 (20.0%)
#   Progress: 80 / 200 (40.0%)
#   ...
# [3/5] Saving to database...
#   ✓ Saved 200 songs
# [4/5] Exporting enriched CSV...
#   ✓ Exported: outputs/new-playlist-enriched-2025-10-29T14-30-45.csv
```

**Result**: Enriched CSV with AI classifications saved to `outputs/`

### Step 2: Merge with Cache Masterlist (< 1 second)

```bash
# Merge enriched data with cache (auto-detects latest enriched file)
npm run merge:sources

# Or specify explicitly:
npm run merge:sources -- --enriched=outputs/new-playlist-enriched-2025-10-29T14-30-45.csv

# Expected output:
# ================================================================================
# Multi-Source Data Merger
# ================================================================================
# Cache source:    test-data/Raina Cache Masterlist - Cache.csv
# Enriched source: outputs/new-playlist-enriched-2025-10-29T14-30-45.csv
# Match mode:      balanced
# ================================================================================
#
# [1/5] Loading cache masterlist...
#   ✓ Loaded 13,427 songs from cache
#
# [2/5] Loading enriched data...
#   ✓ Loaded 200 songs from enriched data
#
# [3/5] Building ISRC index...
#   ✓ Indexed 185 songs by ISRC
#
# [4/5] Merging data sources...
#   Progress: 13,427 / 13,427 (100.0%)
#
# [5/5] Exporting merged data...
#   ✓ Exported 13,427 merged rows to outputs/merged-data.csv
#
# ================================================================================
# MERGE SUMMARY
# ================================================================================
# Total cache songs:           13,427
# Total enriched songs:        200
# Total merged rows:           13,427
#
# MATCHES:
#   ISRC exact matches:        185 (1.38%)
#   Fuzzy matches:             12 (0.09%)
#   Total matched:             197 (1.47%)
#   Unmatched cache:           13,230 (98.53%)
#   Unmatched enriched:        3
#
# FUZZY MATCH QUALITY:
#   Min score:                 0.8701
#   Max score:                 1.0000
#   Average score:             0.9423
#   Median score:              0.9500
#
# DATA PRESERVATION:
#   User corrections preserved: 1,953
#   Cache explicit preserved:   7,678
#
# Processing time:             0.45s
# ================================================================================
```

**Result**: Unified dataset in `outputs/merged-data.csv` with provenance tracking

### Step 3: Review Merge Quality

```bash
# View detailed report
cat outputs/merge-report.json | jq '.'

# Check match statistics
cat outputs/merge-report.json | jq '.summary'
# Output:
# {
#   "cache_total": 13427,
#   "enriched_total": 200,
#   "merged_total": 13427,
#   "match_rate": "1.47%"
# }

# Review fuzzy match quality
cat outputs/merge-report.json | jq '.fuzzy_match_statistics'
# Output:
# {
#   "count": 12,
#   "min": "0.8701",
#   "max": "1.0000",
#   "avg": "0.9423",
#   "median": "0.9500"
# }

# Check low-confidence matches (might need manual review)
cat outputs/merge-report.json | jq '.fuzzy_match_details.low_confidence_matches'
# Output:
# [
#   {
#     "cache_artist": "Ed Sheeran & Justin Bieber",
#     "cache_title": "I Don't Care (with Justin Bieber)",
#     "enriched_artist": "Ed Sheeran, Justin Bieber",
#     "enriched_title": "I Don't Care",
#     "artist_score": "0.9500",
#     "title_score": "0.8800",
#     "combined_score": "0.9080"
#   }
# ]
```

**Action**: If low-confidence matches look suspicious, re-run with `--mode=conservative`

### Step 4: Verify Data Preservation

```bash
# Check a few merged rows
head -n 10 outputs/merged-data.csv | column -t -s,

# Verify user corrections preserved
grep "User Corrected,Yes" outputs/merged-data.csv | wc -l
# Should output: 1953

# Verify cache explicit scores preserved
grep -E "Family Friendly|Suggestive|Explicit" outputs/merged-data.csv | wc -l
# Should output: ~13427 (all songs have some explicit value)

# Check provenance for a specific song
grep "DOPE LEMON" outputs/merged-data.csv | cut -d, -f1,2,11,12,30,31,32
# Output: Artist,Title,Accessibility,Correction Status,Accessibility Source,Energy Source,Explicit Source
# DOPE LEMON,Kids Fallin' In Love,Timeless,User Corrected,user_corrected,user_corrected,cache
```

**Result**: All user corrections and cache data preserved

### Step 5: Import to Database (Optional)

```bash
# Import merged data to Postgres
npm run seed -- --file=outputs/merged-data.csv

# Expected output:
# [Seed] Importing from outputs/merged-data.csv...
#   ✓ Loaded 13,427 songs
#   ✓ Imported 13,427 songs to database
```

### Step 6: Review in Web Interface

```bash
# Terminal 1: Start backend
vercel dev --listen 3001

# Terminal 2: Start frontend
cd client && npm run dev

# Open browser to http://localhost:3000
```

**In the UI**:
1. Filter by subgenre "Nu-Disco" to see new classifications
2. Sort by "Created At" descending to see newest songs first
3. Click a song to review AI classifications
4. Edit if needed and save
5. Add curator notes for borderline cases

### Step 7: Export Final Dataset (Optional)

```bash
# Export from database to CSV
# (This would be a new script - currently manual)

# Or use merged CSV directly
cp outputs/merged-data.csv final-dataset-2025-10-29.csv
```

## Advanced Scenarios

### Scenario A: Merge with Conservative Matching

If you want higher precision and fewer false positives:

```bash
npm run merge:sources -- --mode=conservative

# Higher thresholds: Artist=0.90, Title=0.90, Combined=0.92
# Result: Fewer matches but higher confidence
```

### Scenario B: Merge with Aggressive Matching

If you want maximum coverage and are willing to manually review:

```bash
npm run merge:sources -- --mode=aggressive

# Lower thresholds: Artist=0.75, Title=0.80, Combined=0.80
# Result: More matches but lower confidence
```

### Scenario C: Multiple Playlists

```bash
# Enrich multiple playlists
npm run enrich:playlist playlists/input/playlist1.csv
npm run enrich:playlist playlists/input/playlist2.csv
npm run enrich:playlist playlists/input/playlist3.csv

# Combine enriched outputs
cat outputs/playlist1-enriched-*.csv > temp-header.csv
tail -n +2 outputs/playlist2-enriched-*.csv >> temp-header.csv
tail -n +2 outputs/playlist3-enriched-*.csv >> temp-header.csv
mv temp-header.csv outputs/combined-enriched.csv

# Merge all at once
npm run merge:sources -- --enriched=outputs/combined-enriched.csv
```

### Scenario D: Custom Output Location

```bash
npm run merge:sources \
  --cache=test-data/Raina Cache Masterlist - Cache.csv \
  --enriched=outputs/my-enriched.csv \
  --output=outputs/production-merged.csv \
  --report=outputs/production-report.json \
  --mode=balanced
```

## Troubleshooting Example

### Issue: Low Match Rate

```bash
# Problem: Only 5% of enriched songs matched

# Step 1: Check the report
cat outputs/merge-report.json | jq '.summary.match_rate'
# Output: "5.00%"

# Step 2: Inspect sample data
head -n 5 test-data/Raina\ Cache\ Masterlist\ -\ Cache.csv
head -n 5 outputs/my-enriched.csv

# Step 3: Notice artist format differences
# Cache: "Ed Sheeran & Justin Bieber"
# Enriched: "Ed Sheeran, Justin Bieber"

# Step 4: Try aggressive mode (handles variations better)
npm run merge:sources -- --mode=aggressive

# Step 5: Check improved match rate
cat outputs/merge-report.json | jq '.summary.match_rate'
# Output: "12.00%" (improved!)
```

### Issue: User Corrections Lost

```bash
# Problem: User corrections not preserved

# Step 1: Verify user correction markers in cache
grep "User Corrected" test-data/Raina\ Cache\ Masterlist\ -\ Cache.csv | head -n 3

# Step 2: Check merge logic
grep "User Corrected,Yes" outputs/merged-data.csv | head -n 3

# Step 3: Verify accessibility/energy sources
grep "user_corrected" outputs/merged-data.csv | wc -l
# Should match number of user corrections

# If mismatch, check cache CSV has correct headers
head -n 1 test-data/Raina\ Cache\ Masterlist\ -\ Cache.csv
```

## Expected Results Summary

After completing this workflow, you should have:

1. **Enriched CSV** (`outputs/new-playlist-enriched-*.csv`)
   - 200 songs with AI classifications
   - Subgenres, energy, accessibility, explicit ratings
   - AI reasoning and context used

2. **Merged CSV** (`outputs/merged-data.csv`)
   - 13,427 songs (full cache)
   - 197 songs with new AI classifications merged in
   - All user corrections preserved (1,953 songs)
   - All cache explicit scores preserved (7,678 songs)
   - Provenance tracking for every field

3. **Merge Report** (`outputs/merge-report.json`)
   - Match rate: ~1.47%
   - Fuzzy match quality: ~0.94 average
   - Low-confidence matches for review
   - Processing time: < 1 second

4. **Database** (if imported)
   - 13,427 songs in Postgres
   - Available via API endpoints
   - Reviewable in web interface

## Performance Expectations

| Step | Dataset | Expected Time |
|------|---------|---------------|
| Enrich 200 songs | Real-time API | 5-10 minutes |
| Merge 13K + 200 | Fuzzy matching | < 1 second |
| Import to DB | Postgres | 2-5 seconds |
| Start review UI | Dev servers | 10-15 seconds |

## Next Steps

- **Quality Review**: Manually review low-confidence matches
- **Curation**: Use web interface to edit borderline classifications
- **Export**: Generate final dataset for production
- **Repeat**: Process next playlist batch

## Resources

- **Quick Start**: `docs/MERGE-QUICKSTART.md`
- **Full Guide**: `docs/MERGE-GUIDE.md`
- **Implementation**: `docs/DATA-MERGER-SUMMARY.md`
- **Project Guide**: `CLAUDE.md`
- **Main README**: `README.md`
