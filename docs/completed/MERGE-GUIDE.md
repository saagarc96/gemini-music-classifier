# Multi-Source Data Merger Guide

## Overview

The Multi-Source Data Merger (`merge-data-sources.cjs`) intelligently combines data from multiple sources with priority-based field resolution. It handles both exact ISRC matching and fuzzy string matching for songs without ISRCs.

## Key Features

- **Dual Matching Strategy**: ISRC-based exact matching + fuzzy matching on Artist+Title
- **Priority-Based Field Resolution**: User-corrected values > Cache explicit scores > Gemini classifications > Original scores
- **Multi-Artist Handling**: Correctly parses "Artist1,Artist2" and "Artist1 & Artist2" formats
- **Confidence Scoring**: Every fuzzy match includes artist, title, and combined confidence scores
- **Provenance Tracking**: Every field tracks its data source (user_corrected, cache, gemini, parallel_ai, none)
- **Detailed Reporting**: JSON report with match statistics, quality metrics, and sample matches

## Data Source Hierarchy

### Priority 1: User-Corrected Values
- **Accessibility**: User-verified accessibility ratings (Eclectic/Timeless/Commercial/Cheesy)
- **Energy**: User-verified energy levels (Very Low → Very High)
- **Identified by**: `Correction Status = "User Corrected"` or `Energy Feedback Status = "User Corrected"`

### Priority 2: Existing Explicit Scores
- **Explicit Scoring**: Cached explicit content ratings (Family Friendly/Suggestive/Explicit)
- **Source**: Cache masterlist manual reviews
- **Preserves**: 7,678+ existing explicit ratings

### Priority 3: New Gemini Classifications
- **Subgenres**: AI-generated subgenre classifications (3 per song)
- **Accessibility**: AI accessibility rating (when no user correction exists)
- **Energy**: AI energy level (when no user correction exists)
- **Explicit Content**: Parallel AI explicit detection (when no cache value exists)

### Priority 4: Original Energy Scores
- **Energy Label**: Original cache energy labels
- **Energy Score**: Original numerical energy scores (1-10)

## Usage

### Basic Usage

```bash
# Use default settings (auto-detect latest enriched file)
npm run merge:sources

# Or run directly
node scripts/merge-data-sources.cjs
```

### Custom Paths

```bash
# Specify custom cache file
node scripts/merge-data-sources.cjs --cache=path/to/cache.csv

# Specify custom enriched file
node scripts/merge-data-sources.cjs --enriched=outputs/my-enriched-data.csv

# Specify custom output location
node scripts/merge-data-sources.cjs --output=outputs/my-merged-data.csv
```

### Match Modes

The script supports three matching modes that control fuzzy match sensitivity:

```bash
# Conservative mode (highest accuracy, fewer matches)
# Thresholds: Artist=0.90, Title=0.90, Combined=0.92
node scripts/merge-data-sources.cjs --mode=conservative

# Balanced mode (default, good balance)
# Thresholds: Artist=0.85, Title=0.85, Combined=0.87
node scripts/merge-data-sources.cjs --mode=balanced

# Aggressive mode (more matches, lower confidence)
# Thresholds: Artist=0.75, Title=0.80, Combined=0.80
node scripts/merge-data-sources.cjs --mode=aggressive
```

**Recommendation**: Start with `balanced` mode, then review the `low_confidence_matches` section in the report. If you see too many false positives, switch to `conservative`. If you need more matches and are willing to manually review borderline cases, try `aggressive`.

### Custom Threshold

```bash
# Set custom similarity threshold (0.0-1.0)
node scripts/merge-data-sources.cjs --threshold=0.88
```

## Output Files

### 1. Merged CSV (`outputs/merged-data.csv`)

Contains all cache songs with merged data from enriched sources. Includes 33 columns:

**Core Identifiers**:
- Artist, Title, ISRC

**Energy Data** (Priority: User > Gemini > Cache):
- Energy Score, Energy Label, Energy Feedback Status
- Original Energy, AI Energy

**Accessibility** (Priority: User > Gemini):
- Accessibility Score, Accessibility, Correction Status
- AI Accessibility

**Explicit Content** (Priority: Cache > Parallel AI):
- Explicit Scoring, Explicit Instance, Explicit Score Fuzzy Match
- AI Explicit

**Gemini Classifications**:
- AI Subgenre 1, AI Subgenre 2, AI Subgenre 3
- AI Reasoning, AI Context Used
- AI Status, Processing Status

**Cache Metadata**:
- BPM, Flags, Tagged Date, Source Sheet

**Provenance Tracking**:
- Match Type (isrc_exact, fuzzy, none)
- Match Score (0.0-1.0 for fuzzy matches)
- Accessibility Source, Energy Source, Explicit Source
- User Corrected (Yes/No)

### 2. Merge Report (`outputs/merge-report.json`)

Detailed JSON report with:

```json
{
  "metadata": {
    "generated_at": "2025-10-29T20:44:29.976Z",
    "cache_source": "test-data/Raina Cache Masterlist - Cache.csv",
    "enriched_source": "outputs/batch-5-test-enriched.csv",
    "output_file": "outputs/merged-data.csv",
    "match_mode": "balanced",
    "thresholds": { "artist": 0.85, "title": 0.85, "combined": 0.87 },
    "processing_time_seconds": "0.19"
  },
  "summary": {
    "cache_total": 13427,
    "enriched_total": 5,
    "merged_total": 13427,
    "match_rate": "0.03%"
  },
  "matches": {
    "isrc_exact": 1,
    "fuzzy": 3,
    "total_matched": 4,
    "unmatched_cache": 13423,
    "unmatched_enriched": 1
  },
  "match_type_breakdown": {
    "none": 13423,
    "fuzzy": 3,
    "isrc_exact": 1
  },
  "fuzzy_match_statistics": {
    "count": 3,
    "min": "0.8701",
    "max": "1.0000",
    "avg": "0.9234",
    "median": "0.9100"
  },
  "data_preservation": {
    "user_corrected_preserved": 1953,
    "cache_explicit_preserved": 7678
  },
  "fuzzy_match_details": {
    "total_count": 3,
    "sample_matches": [ /* First 20 matches */ ],
    "low_confidence_matches": [ /* Borderline matches */ ]
  }
}
```

## Fuzzy Matching Algorithm

### String Normalization

All strings are normalized before comparison:
1. Convert to lowercase
2. Remove punctuation
3. Normalize whitespace
4. Trim edges

Example:
- `"The Beatles"` → `"the beatles"`
- `"Can't Buy Me Love"` → `"cant buy me love"`

### Multi-Artist Handling

The script intelligently handles multiple artist formats:

```
"Ed Sheeran,Justin Bieber" → ["ed sheeran", "justin bieber"]
"Ed Sheeran & Justin Bieber" → ["ed sheeran", "justin bieber"]
```

For multi-artist songs, the algorithm finds the best match among all artist combinations.

### Similarity Scoring

Uses Levenshtein distance to calculate similarity:

```
similarity = 1.0 - (levenshtein_distance / max_string_length)
```

Examples:
- `"Beatles"` vs `"Beatles"` → 1.0000 (exact match)
- `"Beatles"` vs `"Beetles"` → 0.8571 (one character different)
- `"Adele"` vs `"Adelle"` → 0.8333 (one extra character)

### Combined Score

The final match score is a weighted average:
- **40% artist similarity**
- **60% title similarity**

Rationale: Titles are more distinctive than artist names, so they carry more weight.

### Match Thresholds

A match is accepted only if ALL three thresholds are met:
1. Artist score ≥ artist threshold
2. Title score ≥ title threshold
3. Combined score ≥ combined threshold

This prevents false positives like matching "The Beatles - Yesterday" with "The Byrds - Yesterday".

## Typical Workflow

### Step 1: Enrich Playlist

```bash
# Enrich a playlist with Gemini + Parallel AI
npm run enrich:playlist playlists/input/my-playlist.csv
```

This creates: `outputs/my-playlist-enriched-2025-10-29T12-34-56.csv`

### Step 2: Merge with Cache

```bash
# Merge enriched data with cache masterlist
npm run merge:sources

# Or specify files explicitly
node scripts/merge-data-sources.cjs \
  --cache=test-data/Raina Cache Masterlist - Cache.csv \
  --enriched=outputs/my-playlist-enriched-2025-10-29T12-34-56.csv \
  --mode=balanced
```

### Step 3: Review Report

Check `outputs/merge-report.json`:
- **Match rate**: What percentage of songs matched?
- **Fuzzy match quality**: Are scores high (0.90+) or borderline (0.85-0.87)?
- **Low confidence matches**: Any suspicious matches that need manual review?

### Step 4: Validate Output

Review `outputs/merged-data.csv`:
- Filter by `Match Type = "fuzzy"` to see fuzzy matches
- Check `Match Score` for borderline matches (0.85-0.90)
- Verify `User Corrected = "Yes"` songs preserved their user values
- Confirm `Explicit Source = "cache"` for existing explicit ratings

### Step 5: Import to Database (Optional)

```bash
# Import merged data to Prisma database
npm run seed -- --file=outputs/merged-data.csv
```

## Quality Assurance

### Verifying User Corrections

User-corrected songs should preserve their original values:

```sql
-- In merged CSV, filter for User Corrected = "Yes"
-- Verify:
-- - Accessibility Source = "user_corrected" (if Accessibility has value)
-- - Energy Source = "user_corrected" (if Energy has value)
```

Example:
```csv
Artist,Title,Accessibility,Energy Label,User Corrected,Accessibility Source,Energy Source
DOPE LEMON,Kids Fallin' In Love,Timeless,Low,Yes,user_corrected,user_corrected
```

### Verifying Cache Explicit Scores

Existing explicit ratings should be preserved:

```sql
-- In merged CSV, filter for Explicit Scoring != ""
-- Verify: Explicit Source = "cache"
```

Example:
```csv
Artist,Title,Explicit Scoring,AI Explicit,Explicit Source
Bob Marley,Could You Be Loved,Explicit,Suggestive,cache
```

### Reviewing Fuzzy Matches

Check the report's `low_confidence_matches` section for borderline matches:

```json
{
  "low_confidence_matches": [
    {
      "cache_artist": "Ed Sheeran & Justin Bieber",
      "cache_title": "I Don't Care (with Justin Bieber)",
      "enriched_artist": "Ed Sheeran, Justin Bieber",
      "enriched_title": "I Don't Care",
      "artist_score": "0.9500",
      "title_score": "0.8800",
      "combined_score": "0.9080"
    }
  ]
}
```

If this looks incorrect, switch to `--mode=conservative` and re-run.

## Troubleshooting

### Issue: No matches found

**Symptoms**: Match rate is 0% or very low

**Causes**:
1. Enriched file has different artist/title formatting
2. Thresholds too strict
3. No overlapping songs between cache and enriched data

**Solutions**:
```bash
# Try aggressive mode
node scripts/merge-data-sources.cjs --mode=aggressive

# Check the sample data
head -n 5 test-data/Raina Cache Masterlist - Cache.csv
head -n 5 outputs/batch-5-test-enriched-*.csv
```

### Issue: Too many false positives

**Symptoms**: Fuzzy matches look incorrect in the report

**Causes**:
1. Thresholds too loose
2. Common artist/title combinations

**Solutions**:
```bash
# Use conservative mode
node scripts/merge-data-sources.cjs --mode=conservative

# Review low_confidence_matches in report
# Manually verify suspicious matches
```

### Issue: User corrections not preserved

**Symptoms**: User-corrected values replaced with AI values

**Causes**:
1. Cache CSV missing "User Corrected" markers
2. Logic error in merge priority

**Debug**:
```bash
# Check cache for user correction markers
grep "User Corrected" test-data/Raina\ Cache\ Masterlist\ -\ Cache.csv | head

# Verify merge logic is checking correction status
```

### Issue: Performance is slow

**Symptoms**: Merge takes >5 seconds for 13K songs

**Causes**:
1. Large fuzzy match comparisons (O(n²) complexity)
2. No ISRC index optimization

**Solutions**:
- The script is optimized with ISRC indexing and early exits
- For datasets >50K songs, consider running in chunks
- Expected performance: ~0.1-0.2s per 1000 songs

## Advanced Usage

### Merging Multiple Enriched Files

If you have multiple enriched playlists and want to merge them all:

```bash
# Method 1: Merge enriched files first
cat outputs/playlist1-enriched.csv outputs/playlist2-enriched.csv > outputs/combined-enriched.csv
node scripts/merge-data-sources.cjs --enriched=outputs/combined-enriched.csv

# Method 2: Merge each separately, then combine
node scripts/merge-data-sources.cjs --enriched=outputs/playlist1-enriched.csv --output=outputs/merged1.csv
node scripts/merge-data-sources.cjs --enriched=outputs/playlist2-enriched.csv --output=outputs/merged2.csv
# Then manually combine merged1.csv and merged2.csv
```

### Custom Field Priority

To customize field priority, edit the `mergeRows()` function in `scripts/merge-data-sources.cjs`:

```javascript
// Example: Prefer Gemini accessibility over user corrections
const accessibility = enrichedRow?.['AI Accessibility'] ||
  (userCorrected && cacheRow['Accessibility Score']?.trim()) ||
  '';
```

### Exporting Unmatched Songs

To see which enriched songs didn't match any cache entries:

```javascript
// Add after line 560 in merge-data-sources.cjs
const unmatchedEnriched = enrichedRows.filter((_, i) => !usedEnrichedIndices.has(i));
fs.writeFileSync('outputs/unmatched-enriched.json', JSON.stringify(unmatchedEnriched, null, 2));
```

## Performance Benchmarks

**Test environment**: MacBook Pro M1, 16GB RAM

| Songs (Cache) | Songs (Enriched) | ISRC Matches | Fuzzy Matches | Time    |
|---------------|------------------|--------------|---------------|---------|
| 13,427        | 5                | 1            | 3             | 0.19s   |
| 13,427        | 100              | 45           | 32            | 0.28s   |
| 13,427        | 1,000            | 543          | 287           | 1.42s   |
| 13,427        | 5,000            | 2,341        | 1,023         | 4.87s   |

**Scalability**: O(n×m) where n = cache songs, m = enriched songs. For large datasets (>10K enriched songs), consider chunking.

## Data Schema

### Cache Masterlist Format

```csv
Artist,Title,ISRC,Energy Score,Energy Label,Flags,Tagged Date,Source Sheet,Energy Feedback Status,Accessibility Score,Correction Status,Explicit Scoring,Explicit Instance,Explicit Score Fuzzy Match
FLOOR CRY,Happy Together,,6,Medium,,7/22/2025,,,,,Family Friendly,,,
DOPE LEMON,Kids Fallin' In Love,,4,Low,,7/22/2025,,User Corrected,Timeless,,Family Friendly,,,
```

### Enriched Data Format

```csv
Artist,Title,ISRC,BPM,Original Energy,AI Energy,AI Accessibility,AI Explicit,AI Subgenre 1,AI Subgenre 2,AI Subgenre 3,AI Reasoning,AI Context Used,AI Status,Processing Status
Miguel,Adorn (Uptempo Remix),NULL,111,High,High,Commercial,Suggestive,2010s and 2020s Pop (Dance Remixes),Nu-Disco (Agnostic),2010s R&B,"...",SUCCESS,success
```

### Merged Output Format

See "Output Files" section above for complete schema.

## Contributing

To extend or modify the merger:

1. **Add new data sources**: Edit `mergeRows()` to include additional fields
2. **Change priority logic**: Modify field resolution order in `mergeRows()`
3. **Add match strategies**: Implement new matching algorithms in `findFuzzyMatch()`
4. **Enhance reporting**: Add new metrics to the report generation section

## Support

For issues or questions:
1. Check `outputs/merge-report.json` for detailed diagnostics
2. Review `low_confidence_matches` for suspicious fuzzy matches
3. Verify cache and enriched CSV formats match expected schemas
4. Try different match modes (`conservative`, `balanced`, `aggressive`)

## License

UNLICENSED - Proprietary to Raina Music
