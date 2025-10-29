# Quick Reference - Data Integration System

## Quick Commands

### Analyze Your Data
```bash
npm run analyze:quality
```
Shows: ISRCs, explicit scores, user corrections, duplicates, cost savings

### Merge Data Sources  
```bash
# Auto-detect latest enriched file
npm run merge:sources

# Specify files and mode
npm run merge:sources -- --enriched=outputs/my-file.csv --mode=balanced
```

### Match Modes
| Mode | Threshold | Use Case |
|------|-----------|----------|
| `conservative` | 90%+ | High precision, production data |
| `balanced` | 85%+ | Default, good trade-off |
| `aggressive` | 75-80%+ | Maximum coverage, review needed |

## Key Metrics (From Your Cache)

- **Total Songs**: 13,427
- **Existing Explicit Scores**: 7,678 ($76.78 value)
- **User Corrections**: 1,953 (authoritative)
- **Need Fuzzy Matching**: 5,843 (43.52%)

## Output Files

- `outputs/merged-data.csv` - Unified dataset
- `outputs/merge-report.json` - Detailed statistics
- `outputs/data-quality-report.json` - Quality metrics

## Documentation

- **5-minute start**: `docs/MERGE-QUICKSTART.md`
- **Complete guide**: `docs/MERGE-GUIDE.md`
- **Examples**: `EXAMPLE-WORKFLOW.md`

## Workflow

1. Analyze quality: `npm run analyze:quality`
2. Enrich playlist: `npm run enrich:playlist playlist.csv`
3. Merge sources: `npm run merge:sources`
4. Review report: `cat outputs/merge-report.json`

## Troubleshooting

- **Gemini errors?** Check CLAUDE.md → "Troubleshooting & Solutions"
- **Low matches?** Try `--mode=aggressive`
- **Data conflicts?** Review `merge-report.json` → `low_confidence_matches`

