# Cleanup Analysis: Feature Branch vs Main

**Date**: October 27, 2025
**Branch Comparison**: `feature/ai-prompting-context-exploration` vs `main`

## Status Summary

The feature branch contains extensive experimental work related to Gemini evaluation system. Now that this work has been migrated to the standalone `gemini-music-classifier` project, we should evaluate what needs to be cleaned up.

## 📁 Directory Comparison

### Main Branch (Production)
```
music-energy-tagger/
├── src/              # 12 files - Core Google Apps Script
├── batch-processing/ # 9 files - Batch processing (NOW MIGRATED)
├── backup/           # Old backups
├── csv-combiner/     # Utility
├── docs/             # 23 files - Documentation
├── evals/            # Evaluation tools
├── research/         # Research files
├── test-data/        # Test datasets
└── outputs/          # Processing outputs
```

### Feature Branch (Experimental)
```
music-energy-tagger/
├── src/              # 18 files (+6 from main)
├── batch-processing/ # 9 files (SAME - to be removed)
├── archives/         # NEW - Historical files
├── evaluations/      # NEW - BrainTrust evaluation system
├── tests/            # NEW - Test infrastructure
├── docs/             # 7 files (-16 from main, reorganized)
├── test-data/        # 19 files (+2 from main)
├── outputs/          # 19 files (SAME)
└── [same as main]
```

## 🆕 New Directories in Feature Branch

### 1. `archives/` - Historical Files
```
archives/
├── completed-planning/  # Finalized planning docs
└── legacy-code/         # Old implementations
```
**Status**: Keep - useful for reference

### 2. `evaluations/` - BrainTrust Gemini Evaluation
```
evaluations/
├── gemini-client.js                           # Gemini API wrapper
├── gemini-classification.eval.js              # Main evaluation
├── gemini-classification-quick-test.eval.js   # Quick test eval
└── README.md                                  # Quick-start guide
```
**Status**: Keep - still valuable for quality assessment of Google Apps Script system

### 3. `tests/` - Test Infrastructure
```
tests/
├── integration/
├── unit/
└── fixtures/
```
**Status**: Review - check if used

### 4. `batch-processing/` (in both branches)
**Status**: ⚠️ **REMOVE** - Migrated to gemini-music-classifier

## 📄 New Files in Feature Branch

### src/ Directory Changes
Feature branch has **6 additional files**:
```
src/crud/                    # NEW CRUD operations
src/services/                # NEW Service layer
src/comprehensiveEvaluation.js   # NEW
src/explicitGroupAPI.js      # NEW
```

### Documentation Changes
Main has 23 files, Feature has 7 files in docs/ (reorganized):
```
docs/
├── gemini-prompt/          # Prompt development
├── in-progress/            # WIP documentation
└── roadmap/                # Planning documents
```

### Test Data Changes
Feature branch has **additional test CSVs**:
```
test-data/
├── batch-100-songs.csv     # NEW
├── batch-500-songs.csv     # NEW
├── batch-2000-songs.csv    # NEW
├── batch-4 through batch-12.csv  # NEW (10 files)
└── [existing files from main]
```

## 🧹 Recommended Cleanup Actions

### ✅ Safe to Remove (Already Migrated)
1. **batch-processing/** directory - All files migrated to gemini-music-classifier
2. **test-data/batch-*.csv** files - Test batches now in standalone project
3. **MIGRATION-PLAN.md** - Can move to gemini-music-classifier or archive
4. **SESSION-RECAP-2025-10-27.md** - Session documentation, can archive

### 📦 Keep (Still Valuable)
1. **evaluations/** - BrainTrust eval system for Apps Script quality assessment
2. **archives/** - Historical reference
3. **src/crud/** - If used by Apps Script system (check if still relevant)
4. **src/services/** - If used by Apps Script system
5. **docs/** - Reorganized documentation structure

### 🔍 Review & Decide
1. **tests/** - Check if tests are actually written and used
2. **src/comprehensiveEvaluation.js** - Check if used by Apps Script
3. **src/explicitGroupAPI.js** - Check if used by Apps Script
4. **outputs/** - Old processing outputs (may be safe to clean)

## 📊 Size Impact

### Current Sizes (Estimated)
- **batch-processing/**: ~50KB of code
- **test-data/batch-*.csv**: ~100MB of test data
- **outputs/**: Unknown size

### Post-Cleanup
Removing batch-processing and test batches would save ~100MB+ of repository space.

## 🎯 Recommended Cleanup Steps

### Option 1: Minimal Cleanup (Safest)
```bash
# Just remove the migrated batch processing
rm -rf batch-processing/
git add batch-processing/
git commit -m "chore: remove batch-processing (migrated to gemini-music-classifier)"
```

### Option 2: Moderate Cleanup
```bash
# Remove batch processing and test batches
rm -rf batch-processing/
rm test-data/batch-*.csv
mv MIGRATION-PLAN.md archives/completed-planning/
mv SESSION-RECAP-2025-10-27.md archives/completed-planning/

git add .
git commit -m "chore: cleanup after migration to gemini-music-classifier"
```

### Option 3: Thorough Cleanup
```bash
# Full cleanup including outputs
rm -rf batch-processing/
rm test-data/batch-*.csv
rm -rf outputs/batch-*.csv  # If they exist
mv MIGRATION-PLAN.md archives/completed-planning/
mv SESSION-RECAP-2025-10-27.md archives/completed-planning/

# Review and remove if unused
rm -rf tests/ # If no actual tests written

git add .
git commit -m "chore: comprehensive cleanup after gemini-music-classifier migration"
```

## ⚠️ Important Notes

1. **BrainTrust Evaluations**: Keep the `evaluations/` directory - it's still valuable for quality assessment even though batch processing moved
2. **CRUD/Services**: Check if these are used by the Apps Script system before removing
3. **Git History**: All removed files remain in Git history if you need to recover them
4. **Feature Branch**: This cleanup should happen on the feature branch, then merge to main

## 🔄 Next Steps After Cleanup

1. Complete cleanup on feature branch
2. Test Google Apps Script functionality still works
3. Merge feature branch to main
4. Push cleaned main branch
5. Delete old feature branches that have been merged

## Summary

**Primary Action**: Remove `batch-processing/` directory since it's been fully migrated to the standalone `gemini-music-classifier` project.

**Secondary Actions**: Clean up test batch CSVs and move migration docs to archives.

**Keep**: BrainTrust evaluation system (`evaluations/`) as it's still valuable for the Apps Script system quality assessment.
