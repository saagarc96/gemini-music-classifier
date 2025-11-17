# Gemini Classification Cleanup Plan

**Date**: October 27, 2025
**Goal**: Remove ALL Gemini classification work from music-energy-tagger
**Reason**: Fully migrated to standalone `gemini-music-classifier` project

## 🎯 Strategy

**DO NOT merge** feature branch to main. Instead:
1. Identify all Gemini-related files in feature branch
2. Move any missing files to gemini-music-classifier
3. Delete all Gemini work from feature branch
4. Keep feature branch clean for Apps Script development only

## 📋 Files to Remove from music-energy-tagger

### 1. Batch Processing System ✅ (Already migrated)
```bash
batch-processing/
├── config.json
├── download-batch-output.py
├── export-to-csv.js
├── monitor-batch-job.js
├── orchestrator.js
├── prepare-batch-input.js
├── process-batch-results.js
├── README.md
└── submit-batch-job.js
```

### 2. BrainTrust Evaluation System (Move then delete)
```bash
evaluations/
├── gemini-client.js
├── gemini-classification.eval.js
├── gemini-classification-quick-test.eval.js
└── README.md
```
**Action**: Copy to gemini-music-classifier first

### 3. Test Batch Data
```bash
test-data/
├── batch-100-songs.csv
├── batch-500-songs.csv
├── batch-2000-songs.csv
├── batch-4-2000-songs.csv
├── batch-5-2000-songs.csv
├── batch-5-test.csv
├── batch-6-2000-songs.csv
├── batch-7-2000-songs.csv
├── batch-8-2000-songs.csv
├── batch-9-2000-songs.csv
├── batch-10-2000-songs.csv
├── batch-11-2000-songs.csv
└── batch-12-2000-songs.csv
```

### 4. Gemini Classification Prompt
```bash
docs/gemini-prompt/
└── classification-prompt.md
```
**Status**: ✅ Already in gemini-music-classifier

### 5. Batch Processing Outputs
```bash
outputs/
├── batch-output.jsonl
├── classified-songs.csv
└── [other batch-related outputs]
```

### 6. Migration Documentation (Move to archives)
```bash
MIGRATION-PLAN.md
SESSION-RECAP-2025-10-27.md
```

### 7. Documentation (Gemini-related only)
```bash
docs/in-progress/
└── braintrust-gemini-integration.md
```

## 🔄 Files to Move to gemini-music-classifier

### BrainTrust Evaluations (Not yet in new project)
```bash
# FROM: music-energy-tagger/evaluations/
# TO: gemini-music-classifier/evaluations/

evaluations/
├── gemini-client.js
├── gemini-classification.eval.js
├── gemini-classification-quick-test.eval.js
└── README.md
```

### BrainTrust Documentation
```bash
# FROM: music-energy-tagger/docs/in-progress/
# TO: gemini-music-classifier/docs/

docs/in-progress/braintrust-gemini-integration.md
```

### Migration Documentation
```bash
# FROM: music-energy-tagger/
# TO: gemini-music-classifier/docs/

MIGRATION-PLAN.md (already there)
SESSION-RECAP-2025-10-27.md
```

## ✅ Execution Plan

### Step 1: Copy Missing Files to gemini-music-classifier
```bash
# Navigate to new project
cd ~/Desktop/Raina_Projects/gemini-music-classifier

# Copy evaluations directory
cp -r ~/Desktop/Raina_Projects/music-energy-tagger/evaluations ./

# Copy BrainTrust docs
mkdir -p docs
cp ~/Desktop/Raina_Projects/music-energy-tagger/docs/in-progress/braintrust-gemini-integration.md docs/

# Copy session recap
cp ~/Desktop/Raina_Projects/music-energy-tagger/SESSION-RECAP-2025-10-27.md docs/

# Commit in gemini-music-classifier
git add .
git commit -m "feat: add BrainTrust evaluation system and documentation"
```

### Step 2: Remove Gemini Files from music-energy-tagger
```bash
# Navigate to music-energy-tagger
cd ~/Desktop/Raina_Projects/music-energy-tagger

# Remove batch processing
rm -rf batch-processing/

# Remove evaluations (after copying to new project)
rm -rf evaluations/

# Remove test batch data
rm test-data/batch-*.csv

# Remove Gemini prompt (already in new project)
rm -rf docs/gemini-prompt/

# Remove BrainTrust docs
rm docs/in-progress/braintrust-gemini-integration.md

# Remove batch outputs
rm outputs/batch-*.jsonl outputs/classified-songs.csv 2>/dev/null || true

# Move migration docs to archives
mkdir -p archives/completed-migrations/
mv MIGRATION-PLAN.md archives/completed-migrations/
mv SESSION-RECAP-2025-10-27.md archives/completed-migrations/

# Commit removals
git add .
git commit -m "chore: remove all Gemini classification work (migrated to gemini-music-classifier)"
```

### Step 3: Update CLAUDE.md
Remove all references to:
- Batch processing
- Gemini evaluation
- BrainTrust integration

Keep only:
- Google Apps Script energy tagging
- OpenAI integration
- Cache system
- Feedback collection

### Step 4: Verify Clean State
```bash
# Check for any remaining Gemini references
grep -r "gemini" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "batch-processing" . --exclude-dir=node_modules --exclude-dir=.git
grep -r "braintrust" . --exclude-dir=node_modules --exclude-dir=.git
```

## 📦 What Stays in music-energy-tagger

This project should ONLY contain:
- ✅ Google Apps Script source files (src/)
- ✅ OpenAI energy tagging system
- ✅ Cache management
- ✅ Feedback collection
- ✅ Apps Script deployment (clasp)
- ✅ Template wrapper for library usage

## 🚫 What Does NOT Belong Here Anymore

- ❌ Gemini Batch API code
- ❌ BrainTrust evaluations
- ❌ Node.js batch processing scripts
- ❌ Large test CSV batches
- ❌ Batch processing outputs

## 🎯 Final State

### music-energy-tagger (Google Apps Script ONLY)
```
music-energy-tagger/
├── src/                  # Apps Script source
├── appsscript.json       # Apps Script config
├── template-wrapper.js   # Library wrapper
├── .clasp.json          # Clasp deployment
├── archives/            # Historical files
├── docs/                # Apps Script docs only
└── test-data/           # Small test datasets for Apps Script
```

### gemini-music-classifier (Node.js Batch System)
```
gemini-music-classifier/
├── src/                 # Batch processing scripts
├── evaluations/         # BrainTrust eval system
├── playlists/          # Symlink to isrc_output
├── outputs/            # Batch processing results
├── docs/               # Complete documentation
└── scripts/            # Utility scripts
```

## ⚠️ Important Notes

1. **No Merge**: Do NOT merge feature/ai-prompting-context-exploration into main
2. **Clean Separation**: Each project has a single, clear purpose
3. **Git History**: All files remain in Git history if needed
4. **Dependencies**: Update package.json to remove Gemini-related packages

## 🔄 Next Steps

1. Execute Step 1 (copy to gemini-music-classifier)
2. Execute Step 2 (remove from music-energy-tagger)
3. Update CLAUDE.md to reflect clean Apps Script focus
4. Test Apps Script deployment still works
5. Archive or delete feature branch after cleanup
6. Keep main branch clean for Apps Script only

Ready to execute when you are!
