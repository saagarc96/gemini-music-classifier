---
skill: curator-csv-import
description: Import curator-reviewed playlist CSVs into the database with ISRC matching, AI enrichment, and audio/artwork linking
globs:
  - test-data/curator-enrichments/to-do/**/*.csv
  - playlists/input/isrc_output/**/*.csv
  - scripts/merge-and-enrich-curator-csvs.cjs
  - scripts/import-curator-to-db.cjs
---

# Curator CSV Import Skill

You are an expert at importing curator-reviewed playlist CSVs into the Raina music classification database. Your role is to guide the user through the 2-step import process, handle edge cases, and ensure data integrity.

## Your Capabilities

1. **ISRC Matching** - Match curator songs to existing ISRC databases by artist + title
2. **AI Enrichment** - Fill missing ACCESSIBILITY and EXPLICIT fields via Gemini and Parallel AI
3. **Audio Linking** - Connect songs to S3 audio files and artwork
4. **Directory Discovery** - Find the correct ISRC source directories for playlists
5. **Batch Processing** - Process multiple playlists sequentially
6. **Error Handling** - Troubleshoot common issues and provide solutions

## When to Use This Skill

Invoke this skill when the user:
- Mentions "curator CSV" or "import curator data"
- Wants to process files in `test-data/curator-enrichments/to-do/`
- Needs to match songs with ISRCs
- Asks about importing playlists with missing metadata

## Standard Workflow

### Step 1: Merge and Enrich

Find the ISRC source file and enrich missing fields.

```bash
node scripts/merge-and-enrich-curator-csvs.cjs \
  "test-data/curator-enrichments/to-do/PLAYLIST_NAME.csv" \
  --isrc-source="playlists/input/isrc_output/playlist_dir/playlist_formatted_high_confidence.csv" \
  --concurrency=5
```

**Your responsibilities:**
- List available curator CSVs in `test-data/curator-enrichments/to-do/`
- Search for matching ISRC directory using `ls` and `grep`
- Try both `_high_confidence.csv` and `_formatted.csv`
- Verify file exists before running command
- Explain what enrichment is happening (ACCESSIBILITY, EXPLICIT, or neither)

### Step 2: Import to Database

Import enriched CSV with audio/artwork links.

```bash
node scripts/import-curator-to-db.cjs \
  "outputs/merged/PLAYLIST_NAME-enriched-TIMESTAMP.csv" \
  --audio-source="playlists/input/isrc_output/playlist_dir/playlist_updated.csv"
```

**Your responsibilities:**
- Use the enriched CSV from Step 1 output
- Always include `--audio-source` for complete data
- Report import statistics (created, updated, skipped)
- Explain why songs were skipped (missing ISRC)

## Directory Discovery Strategy

Many curator playlist names don't match ISRC directory names. Use this strategy:

1. **Extract keywords** from curator CSV name (e.g., "Benny's Afternoon" → "benny", "afternoon")
2. **Search directories** using `ls playlists/input/isrc_output/ | grep -i "keyword"`
3. **Try common patterns:**
   - Lowercase with underscores: `benny's_afternoon`
   - Acronyms: `DTF` for "Din Tai Fung"
   - Singular vs plural: `Meditative Soundscape` vs `Meditative Soundscapes`
   - Alternative names: "Early" might be `early_lunch`
4. **Verify files** in found directory: check for `_high_confidence.csv` or `_formatted.csv`

## Common Directory Mappings

| Curator CSV Pattern | ISRC Directory | Notes |
|---------------------|----------------|-------|
| Bar Moxy * | `bar_moxy_*` | Lowercase, underscores |
| Benny's * | `benny's_*` | Preserve apostrophe |
| Cabana Sass - Early | `cabana_sass_early_lunch` | "Early" → "early_lunch" |
| Din Tai Fung * | `dtf_*` or `DTF (*)` | Try both formats |
| Meditative Soundscapes | `Meditative Soundscape` | Singular, Title Case |

## Handling Edge Cases

### No High Confidence File

If only `_formatted.csv` exists (no `_high_confidence.csv`):
- Use `_formatted.csv` as ISRC source
- Explain to user that matching confidence may be lower

### Songs Without ISRCs

If enrichment shows "Matched X/Y songs":
- Calculate match rate: (X/Y * 100)
- If < 90%, warn user and suggest verifying ISRC source
- Explain that unmatched songs will be skipped during import

### All Fields Complete

If enrichment shows "Skipped (complete): X":
- Explain no API calls needed (saves cost)
- This is expected for fully-prepared curator CSVs

### File Not Found Errors

If ISRC source file doesn't exist:
1. List directory: `ls "playlists/input/isrc_output/directory/"`
2. Show available files to user
3. Suggest correct filename

## Required Checks Before Processing

Before running Step 1, verify:
- [ ] Curator CSV exists in `test-data/curator-enrichments/to-do/`
- [ ] ISRC source directory exists in `playlists/input/isrc_output/`
- [ ] ISRC source file exists (either `_high_confidence.csv` or `_formatted.csv`)

Before running Step 2, verify:
- [ ] Enriched CSV exists in `outputs/merged/`
- [ ] Audio source `_updated.csv` exists
- [ ] Environment variables are set (`GEMINI_API_KEY`, `PARALLEL_AI_API_KEY`, `POSTGRES_URL_NON_POOLING`)

## Batch Processing Multiple Playlists

When user requests processing multiple playlists:

1. **List all curator CSVs**:
   ```bash
   ls test-data/curator-enrichments/to-do/
   ```

2. **Process one at a time** (don't parallelize - allows error handling)

3. **Track progress**:
   - Use TodoWrite tool to track which playlists are complete
   - Report cumulative statistics after each import

4. **Provide summary** after all imports:
   ```
   Total Playlists: X
   Total Songs: Y
   Created: Z
   Updated: W
   Skipped: V
   ```

## Data Normalization

Explain these transformations to users:

- **Energy**: "MEDIUM" → "Medium", "VERY HIGH" → "Very High"
- **Accessibility**: "TIMELESS" → "Timeless" (Title Case)
- **Explicit**: "FAMILY" → "Family Friendly", "SUGGESTIVE" → "Suggestive"
- **Review Status**: All imported songs marked `reviewed=true`, `reviewedBy="curator"`

## Error Messages and Solutions

### "ENOENT: no such file or directory"
- **Cause**: Wrong path to ISRC source
- **Solution**: Verify with `ls` command, check for typos

### "POSTGRES connection failed"
- **Cause**: Missing database credentials
- **Solution**: Run `vercel env pull .env.local`

### "Matched 0/X songs with ISRCs"
- **Cause**: Wrong ISRC source file (different playlist)
- **Solution**: Verify curator CSV name matches ISRC directory

### API rate limits
- **Cause**: Too many concurrent requests
- **Solution**: Reduce `--concurrency=3` or add delays

## Best Practices to Recommend

1. **Verify before running** - Always check file paths exist
2. **One playlist at a time** - Easier to debug than batch
3. **Include audio source** - Never skip `--audio-source` flag
4. **Archive processed CSVs** - Suggest moving from `to-do/` to `completed/`
5. **Monitor API usage** - Remind about Gemini/Parallel AI quotas
6. **Use dry-run** - Suggest `--dry-run` for first-time imports

## Communication Style

- **Be proactive** - Search for ISRC directories without being asked
- **Explain results** - Interpret match rates, enrichment counts, import stats
- **Anticipate issues** - Check for common problems before running commands
- **Track progress** - Use TodoWrite for multi-playlist imports
- **Provide context** - Explain why songs are skipped or need enrichment

## Example Interaction

**User:** "Can you import the curator CSV for Benny's Morning?"

**Your response:**
1. Check if file exists: `ls "test-data/curator-enrichments/to-do/" | grep -i "benny.*morning"`
2. Search for ISRC directory: `ls playlists/input/isrc_output/ | grep -i "benny.*morning"`
3. Verify high confidence file exists
4. Run Step 1 (merge and enrich)
5. Interpret results: "Matched 230/231 songs (99.6%), all fields complete"
6. Run Step 2 (import to database)
7. Report: "Created 223 songs, updated 7, skipped 1 (missing ISRC)"

## Script Locations

- **merge-and-enrich-curator-csvs.cjs** - Step 1: ISRC matching + AI enrichment
- **import-curator-to-db.cjs** - Step 2: Database import with audio/artwork
- **verify-import.cjs** - Check import results
- **check-song-data.cjs** - Inspect specific songs

## Related Documentation

For more details, refer to:
- `docs/completed/CURATOR-CSV-IMPORT-GUIDE.md` - Full workflow documentation
- `CLAUDE.md` - Project overview and setup
- `PRISMA-MIGRATION.md` - Database schema details

## Success Criteria

A successful import should:
- Match rate > 95% (unless known issues with ISRC source)
- No API errors (check BrainTrust logs if errors occur)
- All imported songs have `reviewed=true`
- Audio links and artwork present for matched songs
- Clear explanation of any skipped songs

---

**Remember:** Always verify file paths before running commands, and explain import statistics in plain language to the user.
