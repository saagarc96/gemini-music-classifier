# Data Merger Quick Start

## 5-Minute Quick Start

### 1. Basic Merge (Auto-detect)

```bash
npm run merge:sources
```

**What it does:**
- Auto-detects latest enriched CSV from `outputs/`
- Merges with cache masterlist (13,428 songs)
- Outputs `outputs/merged-data.csv` and `outputs/merge-report.json`

### 2. Check Results

```bash
# View summary
cat outputs/merge-report.json | grep -A 10 "summary"

# Count matches
grep "isrc_exact" outputs/merged-data.csv | wc -l
grep "fuzzy" outputs/merged-data.csv | wc -l
```

### 3. Review Quality

Open `outputs/merge-report.json` and check:
- `summary.match_rate` - percentage of songs matched
- `fuzzy_match_statistics.avg` - average confidence (0.90+ is good)
- `low_confidence_matches` - borderline matches to review

## Common Commands

```bash
# Specify files
npm run merge:sources -- --enriched=outputs/my-playlist.csv

# Use strict matching
npm run merge:sources -- --mode=conservative

# Use loose matching
npm run merge:sources -- --mode=aggressive

# Custom output location
npm run merge:sources -- --output=outputs/final-merged.csv
```

## Match Modes

| Mode | Best For | Artist | Title | Combined |
|------|----------|--------|-------|----------|
| **conservative** | High precision | 0.90 | 0.90 | 0.92 |
| **balanced** (default) | General use | 0.85 | 0.85 | 0.87 |
| **aggressive** | Maximum coverage | 0.75 | 0.80 | 0.80 |

## Data Priority Rules

1. **User corrections** (Accessibility, Energy) - HIGHEST PRIORITY
2. **Cache explicit scores** - from manual reviews
3. **Gemini classifications** - AI-generated
4. **Original scores** - from cache

## Output Files

### merged-data.csv (33 columns)

Core fields:
- `Artist`, `Title`, `ISRC`
- `Energy Label`, `Accessibility`, `Explicit Scoring`
- `AI Subgenre 1/2/3`, `AI Reasoning`
- `Match Type`, `Match Score` (provenance)

### merge-report.json

Key sections:
- `summary` - overall statistics
- `matches` - breakdown by type
- `fuzzy_match_statistics` - quality metrics
- `fuzzy_match_details.low_confidence_matches` - borderline cases to review

## Typical Workflow

```bash
# Step 1: Enrich a playlist
npm run enrich:playlist playlists/input/my-playlist.csv

# Step 2: Merge with cache
npm run merge:sources

# Step 3: Review report
cat outputs/merge-report.json | jq '.summary'

# Step 4: Check low confidence matches
cat outputs/merge-report.json | jq '.fuzzy_match_details.low_confidence_matches'

# Step 5: Verify output
head -n 20 outputs/merged-data.csv
```

## Troubleshooting

**No matches found?**
- Check artist/title formatting differences
- Try `--mode=aggressive`

**Too many false positives?**
- Switch to `--mode=conservative`
- Review `low_confidence_matches` in report

**User corrections lost?**
- Verify cache CSV has "User Corrected" markers
- Check `User Corrected` column in output

## Next Steps

Read the full guide: `docs/MERGE-GUIDE.md`

Test different scenarios: `node scripts/test-merge-scenarios.cjs`
