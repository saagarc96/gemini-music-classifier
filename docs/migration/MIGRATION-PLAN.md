# Migration Plan: Gemini Batch Processing → Standalone Project

## 🎯 Goal
Extract the working Gemini batch processing system into a clean, standalone project with proper Git workflow, separate from the legacy Google Apps Script music-energy-tagger.

---

## 📊 Current State Analysis

### What Works (Keep This):
- ✅ Batch processing pipeline (6 phases: prepare → submit → monitor → download → process → export)
- ✅ System instruction per-request architecture (17KB prompt in each JSONL)
- ✅ BrainTrust integration for logging
- ✅ CSV parsing with proper quoting/escaping
- ✅ Response parsing (handles markdown-wrapped JSON)
- ✅ Python download script for reliable file retrieval
- ✅ 95%+ success rate validation

### What's Wrong (Fix This):
- ❌ Living in legacy `music-energy-tagger` repo (Google Apps Script project)
- ❌ Mixed concerns: Batch processing + GAS energy tagger
- ❌ No Git workflow for batch processing code
- ❌ Monolithic approach (processing 19K songs at once)
- ❌ Hard to track playlist-by-playlist progress
- ❌ Config hardcoded to single CSV file

---

## 🏗️ New Project Structure

### Project Name: `gemini-music-classifier`

```
gemini-music-classifier/
├── README.md                          # Complete documentation
├── .env                               # API keys (gitignored)
├── .gitignore                        # Standard Node.js + outputs/
├── package.json                       # Dependencies
├──
├── config/
│   ├── default.json                  # Default configuration
│   └── playlists.json                # Playlist processing queue
│
├── src/
│   ├── prepare.js                    # Phase 1: Prepare JSONL input
│   ├── submit.js                     # Phase 2: Submit batch job
│   ├── monitor.js                    # Phase 3: Monitor completion
│   ├── download.py                   # Phase 4: Download results
│   ├── process.js                    # Phase 5: Process & parse JSON
│   ├── export.js                     # Phase 6: Export to CSV
│   ├── orchestrator.js               # Main pipeline coordinator
│   └── playlist-batch-runner.js      # NEW: Iterate through playlists
│
├── prompts/
│   └── classification-prompt.md      # System instruction (single source)
│
├── playlists/
│   ├── input/                        # Symlink to isrc_output directory
│   └── processed/                    # Track which playlists are done
│       └── completed.json            # List of completed playlists
│
├── outputs/
│   ├── by-playlist/                  # Organized by playlist name
│   │   ├── tcrg_main/
│   │   │   ├── batch-input.jsonl
│   │   │   ├── batch-output.jsonl
│   │   │   ├── processed-results.json
│   │   │   └── classified-songs.csv
│   │   └── central/
│   │       └── ...
│   └── merged/                       # Final merged outputs
│       └── all-playlists-classified.csv
│
├── logs/
│   ├── batch-runs.log               # All batch submissions
│   └── errors.log                   # Failed batches
│
└── scripts/
    ├── merge-all-playlists.js       # Combine all playlist CSVs
    ├── check-quota.js               # Check API quota status
    └── retry-failed.js              # Retry failed playlists
```

---

## 🔄 Migration Steps

### Phase 1: Create New Project ✨
**Time: 30 minutes**

1. **Create new directory** outside music-energy-tagger:
   ```bash
   cd ~/Desktop/Raina_Projects
   mkdir gemini-music-classifier
   cd gemini-music-classifier
   git init
   ```

2. **Copy working files** from `music-energy-tagger/batch-processing/`:
   ```bash
   # Core processing files
   cp ../music-energy-tagger/batch-processing/*.js src/
   cp ../music-energy-tagger/batch-processing/*.py src/

   # Configuration
   cp ../music-energy-tagger/batch-processing/config.json config/default.json

   # Prompt
   cp ../music-energy-tagger/docs/gemini-prompt/classification-prompt.md prompts/

   # Environment
   cp ../music-energy-tagger/.env .env
   ```

3. **Setup package.json**:
   ```json
   {
     "name": "gemini-music-classifier",
     "version": "1.0.0",
     "description": "Batch music classification using Google Gemini API",
     "main": "src/orchestrator.js",
     "scripts": {
       "prepare": "node src/prepare.js",
       "submit": "node src/submit.js",
       "monitor": "node src/monitor.js",
       "download": "python3 src/download.py",
       "process": "node src/process.js",
       "export": "node src/export.js",
       "pipeline": "node src/orchestrator.js",
       "playlist-batch": "node src/playlist-batch-runner.js",
       "merge-all": "node scripts/merge-all-playlists.js",
       "check-quota": "node scripts/check-quota.js"
     },
     "dependencies": {
       "@google/genai": "^0.21.0",
       "braintrust": "^0.0.166",
       "csv-parse": "^5.6.0",
       "csv-writer": "^1.6.0",
       "dotenv": "^16.4.7"
     }
   }
   ```

4. **Create .gitignore**:
   ```
   node_modules/
   .env
   outputs/
   *.log
   .DS_Store
   playlists/processed/
   ```

5. **Initialize Git**:
   ```bash
   npm install
   git add .
   git commit -m "Initial commit: Gemini batch classifier"
   ```

---

### Phase 2: Refactor for Playlist Processing 🎵
**Time: 1-2 hours**

1. **Create `src/playlist-batch-runner.js`**:
   - Discover all `*_high_confidence.csv` files
   - Read `playlists/processed/completed.json` to skip done playlists
   - Process playlists sequentially (5-6 per day)
   - Track progress after each completion
   - Save outputs to `outputs/by-playlist/{playlist_name}/`

2. **Update configuration** (`config/default.json`):
   ```json
   {
     "playlistsDir": "playlists/input",
     "outputDir": "outputs/by-playlist",
     "processedTrackingFile": "playlists/processed/completed.json",
     "batchesPerDay": 6,
     "model": "gemini-flash-latest",
     "promptPath": "prompts/classification-prompt.md",
     "pollIntervalMs": 30000,
     "waitBetweenBatches": 14400000
   }
   ```

3. **Create symlink** to existing playlists:
   ```bash
   ln -s ~/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output playlists/input
   ```

4. **Update all scripts** to use new paths:
   - Replace hardcoded paths with config-based paths
   - Add playlist name parameter to all functions
   - Create output subdirectories per playlist

---

### Phase 3: Add Progress Tracking 📊
**Time: 30 minutes**

1. **Create `playlists/processed/completed.json`**:
   ```json
   {
     "completed": [],
     "failed": [],
     "lastRun": null,
     "totalSongs": 0,
     "successRate": 0
   }
   ```

2. **Update after each playlist**:
   - Add playlist name to `completed` array
   - Increment `totalSongs`
   - Calculate cumulative `successRate`
   - Save timestamp

3. **Create status dashboard**:
   ```bash
   npm run status
   # Shows: X/120 playlists done, Y total songs, Z% success rate
   ```

---

### Phase 4: Add Quota Management 🚦
**Time: 30 minutes**

1. **Create `scripts/check-quota.js`**:
   - Fetch quota status from Google API
   - Display current usage
   - Calculate safe batch count
   - Warn if approaching limits

2. **Add quota checks** to `playlist-batch-runner.js`:
   - Check quota before each batch
   - Wait if quota low
   - Auto-resume when quota refreshes

3. **Add delay between batches**:
   - Default: 4 hours between submissions
   - Configurable via `waitBetweenBatches`

---

### Phase 5: Add Merge & Export Tools 🔗
**Time: 30 minutes**

1. **Create `scripts/merge-all-playlists.js`**:
   - Read all `outputs/by-playlist/*/classified-songs.csv`
   - Combine into single CSV
   - Deduplicate songs (keep first occurrence)
   - Save to `outputs/merged/all-playlists-classified.csv`

2. **Add playlist metadata** to merged CSV:
   - Add `source_playlist` column
   - Track which playlist(s) each song came from

3. **Generate summary report**:
   - Total songs classified
   - Per-playlist success rates
   - Total cost estimate
   - Processing timeline

---

### Phase 6: Testing & Validation ✅
**Time: 1 hour**

1. **Test with 3 small playlists**:
   - Pick 3 playlists < 100 songs each
   - Run complete pipeline
   - Verify outputs in correct directories
   - Check tracking file updates

2. **Test merge script**:
   - Combine the 3 test playlists
   - Verify no duplicates
   - Check CSV format

3. **Test resume functionality**:
   - Kill process mid-playlist
   - Restart - should skip completed playlists

4. **Git workflow**:
   ```bash
   git add .
   git commit -m "Add playlist batch processing"
   git push origin main
   ```

---

## 📋 Migration Checklist

### Pre-Migration (Done ✅)
- [x] Validate batch processing works (95%+ success)
- [x] Document working configuration
- [x] Identify all dependencies

### Migration Tasks
- [ ] Create new project directory
- [ ] Copy working files
- [ ] Setup package.json & dependencies
- [ ] Initialize Git repo
- [ ] Refactor for playlist processing
- [ ] Add progress tracking
- [ ] Add quota management
- [ ] Create merge scripts
- [ ] Test with 3 small playlists
- [ ] Document new workflow

### Post-Migration
- [ ] Update SESSION-RECAP.md with new project location
- [ ] Archive old batch-processing directory
- [ ] Create GitHub repo (optional)
- [ ] Run first production batch

---

## 🚀 New Workflow (After Migration)

### Daily Batch Processing:
```bash
# Morning: Check quota
npm run check-quota

# If quota available: Process 5-6 playlists
npm run playlist-batch --count 6

# Evening: Check progress
npm run status

# Output shows:
# ✅ Processed 6 playlists today
# 📊 45/120 playlists complete
# 🎵 6,800 songs classified
# 💰 Estimated cost: $136
# ⏰ Next batch ready in: 2 hours
```

### Weekly: Merge & Review
```bash
# Combine all completed playlists
npm run merge-all

# Output: outputs/merged/all-playlists-classified.csv
# Contains all songs from completed playlists
```

---

## 💡 Benefits of New Structure

### vs. Current Approach:
| Current | New |
|---------|-----|
| Single 19K-song batch | 120+ playlist batches |
| Hits quota limits | Stays under quotas |
| All-or-nothing | Incremental progress |
| Hard to resume | Auto-resume |
| Monolithic outputs | Organized by playlist |
| Mixed with GAS code | Clean separation |
| No Git history | Proper version control |
| No progress tracking | Real-time status |

---

## 📅 Timeline Estimate

- **Setup (Phase 1)**: 30 min
- **Refactoring (Phase 2-3)**: 2 hours
- **Tools (Phase 4-5)**: 1 hour
- **Testing (Phase 6)**: 1 hour
- **Total**: ~4-5 hours of development

Then: **20-25 days** of automated processing (5-6 playlists/day)

---

## 🎯 Success Criteria

1. ✅ Clean Git repo with proper structure
2. ✅ Process playlists sequentially without quota issues
3. ✅ Track progress automatically
4. ✅ Maintain 95%+ success rate
5. ✅ Outputs organized by playlist
6. ✅ Easy to resume after interruption
7. ✅ Final merged CSV with all songs
8. ✅ Cost stays under $500 total

---

## 📝 Notes

- **Keep music-energy-tagger unchanged**: It still serves Google Apps Script use case
- **Reference old code**: Keep batch-processing directory for reference
- **Parallel development**: Can still use GAS tagger for manual corrections
- **Future integration**: Eventually import batch results into GAS cache

---

## ⚡ EXECUTION PLAN (After Compaction)

### User Confirmed Settings:
- **Scope**: Full migration (all 6 phases)
- **Location**: `~/Desktop/Raina_Projects/gemini-music-classifier`
- **Git**: Initialize repository with initial commit
- **Playlists**: Create symlink to existing `isrc_output` directory (DO NOT copy files)

### Quick Execution Steps:

#### Step 1: Create Project Structure (5 min)
```bash
cd ~/Desktop/Raina_Projects
mkdir -p gemini-music-classifier/{src,config,prompts,playlists/{input,processed},outputs/{by-playlist,merged},logs,scripts}
cd gemini-music-classifier
git init
```

#### Step 2: Copy Core Files (5 min)
```bash
# Copy JavaScript files
cp ../music-energy-tagger/batch-processing/*.js src/

# Copy Python script
cp ../music-energy-tagger/batch-processing/download-batch-output.py src/

# Copy configuration
cp ../music-energy-tagger/batch-processing/config.json config/default.json

# Copy prompt
cp ../music-energy-tagger/docs/gemini-prompt/classification-prompt.md prompts/

# Copy environment
cp ../music-energy-tagger/.env .env
```

#### Step 3: Create Symlink (1 min)
```bash
ln -s ~/Desktop/Raina_Projects/day-to-day-work/csv-link-downloader/isrc_output playlists/input
```

#### Step 4: Create package.json & Install (10 min)
Create package.json with all scripts, then `npm install`

#### Step 5: Create New Scripts (60 min)
- `src/playlist-batch-runner.js` - Main playlist processor
- `scripts/merge-all-playlists.js` - Merge all CSVs
- `scripts/check-quota.js` - Quota checker
- `playlists/processed/completed.json` - Progress tracker

#### Step 6: Update Existing Scripts (30 min)
Modify all scripts to:
- Use config-based paths
- Accept playlist name parameter
- Create per-playlist output directories

#### Step 7: Test & Commit (20 min)
- Test with 1 small playlist
- Verify outputs
- Git commit

**Total Time**: ~2 hours for full migration

---

*Migration plan created: October 27, 2025*
*Execution plan added: October 27, 2025*
*Ready to execute after compaction*
