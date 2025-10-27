# Progressive Batch Testing Strategy

This directory contains CSV files split from the original 19,935-song dataset for progressive batch testing.

## Batch Files Overview

All batches are **non-overlapping** - each song appears in only one file.

### Phase 1: Initial Validation (100 songs)
- **File**: `batch-100-songs.csv`
- **Rows**: 1-100
- **Cost**: ~$2-4
- **Purpose**: Verify stability at medium scale
- **Success Criteria**: ≥95% success rate

### Phase 2: Sustained Processing (500 songs)
- **File**: `batch-500-songs.csv`
- **Rows**: 101-600
- **Cost**: ~$10-20
- **Purpose**: Test sustained processing over longer duration
- **Success Criteria**: ≥95% success rate

### Phase 3: Near-Production Volume (2000 songs)
- **File**: `batch-2000-songs.csv`
- **Rows**: 601-2600
- **Cost**: ~$40-80
- **Purpose**: Validate near-production volume
- **Success Criteria**: ≥95% success rate

### Phase 4-12: Production Batches (2000 songs each)
- **Files**: `batch-4-2000-songs.csv` through `batch-12-2000-songs.csv`
- **Total**: 9 batches
  - Batches 4-11: 2000 songs each
  - Batch 12: 1335 songs (final batch)
- **Cost**: ~$40-80 per batch, ~$360-720 total
- **Purpose**: Full production processing

## Total Coverage

| Batch | File | Songs | Rows | Cost Estimate |
|-------|------|-------|------|---------------|
| 1 | batch-100-songs.csv | 100 | 1-100 | $2-4 |
| 2 | batch-500-songs.csv | 500 | 101-600 | $10-20 |
| 3 | batch-2000-songs.csv | 2000 | 601-2600 | $40-80 |
| 4 | batch-4-2000-songs.csv | 2000 | 2601-4600 | $40-80 |
| 5 | batch-5-2000-songs.csv | 2000 | 4601-6600 | $40-80 |
| 6 | batch-6-2000-songs.csv | 2000 | 6601-8600 | $40-80 |
| 7 | batch-7-2000-songs.csv | 2000 | 8601-10600 | $40-80 |
| 8 | batch-8-2000-songs.csv | 2000 | 10601-12600 | $40-80 |
| 9 | batch-9-2000-songs.csv | 2000 | 12601-14600 | $40-80 |
| 10 | batch-10-2000-songs.csv | 2000 | 14601-16600 | $40-80 |
| 11 | batch-11-2000-songs.csv | 2000 | 16601-18600 | $40-80 |
| 12 | batch-12-2000-songs.csv | 1335 | 18601-19935 | $27-54 |
| **Total** | | **19935** | | **$399-798** |

## Usage Workflow

### 1. Start with batch-100-songs.csv
```bash
# Update config.json
"inputCsv": "test-data/batch-100-songs.csv"

# Run batch
npm run batch:all
```

### 2. Check results
- Success rate ≥95%? → Proceed to next batch
- Success rate <95%? → Investigate failures, fix issues, retry

### 3. Update config for next batch
```bash
# For batch 2
"inputCsv": "test-data/batch-500-songs.csv"

# For batch 3
"inputCsv": "test-data/batch-2000-songs.csv"

# For batches 4-12
"inputCsv": "test-data/batch-4-2000-songs.csv"
# ... etc
```

### 4. Track progress
Keep a log of completed batches:
```
✓ Batch 1 (100): 98% success - 2025-10-27
✓ Batch 2 (500): 97% success - 2025-10-27
✓ Batch 3 (2000): 96% success - 2025-10-28
□ Batch 4 (2000): pending
```

## Risk Mitigation

1. **Progressive scaling**: Each batch builds confidence before investing more
2. **Early detection**: Catch issues at low cost (100 songs = $2-4)
3. **Non-overlapping**: No duplicate processing if you need to restart
4. **Manageable chunks**: 2000-song batches complete in 12-24 hours
5. **Cost control**: Only ~$132 invested before full production commitment

## Expected Timeline

- **Batch 1 (100)**: ~1-2 hours
- **Batch 2 (500)**: ~2-4 hours
- **Batch 3 (2000)**: ~12-24 hours
- **Batches 4-12**: ~12-24 hours each (can run in parallel if desired)

## Merging Results

After all batches complete, merge CSV outputs:
```bash
# Combine all batch outputs
cat outputs/batch-1-output.csv > final-results.csv
tail -n +2 outputs/batch-2-output.csv >> final-results.csv
tail -n +2 outputs/batch-3-output.csv >> final-results.csv
# ... etc for all batches
```

This preserves the header from batch 1 and appends data from all other batches.
