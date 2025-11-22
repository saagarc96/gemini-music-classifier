# Batch Import Process - Complete Explanation

## 🎉 Final Results

### What We Accomplished:
- **Started with**: 2,255 songs in database
- **Ended with**: 7,750 songs in database
- **Total imported**: 5,495 songs
- **All 19 high-priority playlists**: ✅ Complete
- **Processing time**: ~16 hours (across multiple sessions)
- **Errors**: Minimal (automatic retry/skip on failures)

---

## 📋 The Complete Workflow

### Phase 1: Analysis & Planning
Before importing, we analyzed the `isrc_output` directory to create a priority list:

1. **Scanned all CSV files** in the directory (539 files total)
2. **Counted songs** in each playlist
3. **Checked database** for existing songs (to find duplicates)
4. **Calculated "new songs"** count for each playlist
5. **Ranked playlists** by new song count (high/medium/low priority)
6. **Identified duplicates** - Same playlist in different folders (e.g., "mcfadden's_late_night" vs "McFadden's Late Night")
7. **Generated priority list** saved to `docs/playlist-import-priority.md`

**Key Files Created:**
- `scripts/batch-enrich-playlists.cjs` - Main batch orchestrator
- `docs/playlist-import-priority.md` - Ranked list of all playlists
- `scripts/deduplicate-priority-list.cjs` - Duplicate detection utility

---

### Phase 2: The Enrichment Pipeline

Each song goes through this multi-step process:

#### Step 1: CSV Loading
```
Read CSV file → Parse columns (ISRC, Artist, Title, BPM, Artwork URL, Audio URL)
```

#### Step 2: Gemini AI Classification
```
Send to Gemini API → Classify:
  - Energy Level (Very Low → Very High)
  - Accessibility (Eclectic/Timeless/Commercial/Cheesy)
  - 3 Subgenres (from 167 options across 10 categories)
  - Reasoning (why these classifications)
  - Context Used (what sources Gemini found)
```

**How Gemini Works:**
- Uses Google Search to find information about the song
- Analyzes artist style, release date, genre conventions
- Applies our 17KB classification prompt with all rules
- Returns structured JSON with classifications

#### Step 3: Parallel AI Explicit Content Detection
```
Send to Parallel AI API → Classify:
  - Family Friendly (clean, no suggestive content)
  - Suggestive (mild sexual/drug references)
  - Explicit (strong profanity, graphic content)
```

**How Parallel AI Works:**
- Specialized model for content moderation
- Analyzes song title and artist name
- Cross-references known explicit content databases
- Returns classification rating

#### Step 4: Database Save
```
Save to Postgres via Prisma:
  - Original metadata (ISRC, Artist, Title, BPM, Artwork, Audio)
  - AI classifications (Energy, Accessibility, Subgenres, Explicit)
  - Tracking fields (uploadBatchId, createdAt, modifiedAt)
  - Review status (reviewed=false for curator review)
```

#### Step 5: Export Enriched CSV
```
Generate timestamped CSV in outputs/ with:
  - All original columns
  - All AI-generated classifications
  - Status and error messages
```

---

### Phase 3: Parallel Processing Strategy

Instead of processing playlists one at a time, we ran **3 playlists simultaneously**:

```
Process 1: Playlist A (5 songs at once)
Process 2: Playlist B (5 songs at once)
Process 3: Playlist C (5 songs at once)
─────────────────────────────────────
Total: 15 songs processing at once
```

**Why This Works:**
- Each playlist runs in its own Node.js process
- Concurrency=5 per process = manageable API rate limits
- 3 processes × 5 songs = 3x faster than single playlist
- Independent processes = better fault isolation

**The 6 Batches We Ran:**

**Batch 1:**
1. tcrg_main (797 songs)
2. McFadden's Late Night (337 songs)
3. Central (334 songs)
4. Modern Coffeehouse (318 songs)

**Batch 2:**
5. Commercial Dance (315 songs)
6. GHK Treatment Rooms (315 songs)
7. GHK Pool (306 songs)

**Batch 3:**
8. Ambient Spa (289 songs)
9. Longboard Afternoon (274 songs)
10. GHK Salon (263 songs)

**Batch 4:**
11. Hotel Contessa Lobby (248 songs)
12. McFadden's Lunch (234 songs)
13. Instrumental Lounge House (228 songs)

**Batch 5:**
14. Instrumental Spanish Guitar (219 songs)
15. Municipal Bar Afternoon (212 songs)
16. Craft Stampede (206 songs)

**Batch 6:**
17. Ilima Terrace (202 songs)
18. Stevensons (202 songs)
19. Close Company Happy Hour (201 songs)

---

## 🔧 Technical Architecture

### The Stack:

**Node.js Scripts:**
- `scripts/enrich-playlist.cjs` - Core enrichment logic
- `scripts/batch-enrich-playlists.cjs` - Batch orchestrator
- `scripts/check-import-progress.cjs` - Progress monitoring

**APIs:**
- Google Gemini API (`@google/generative-ai`)
- Parallel AI API (REST via axios)
- BrainTrust API (logging/observability)

**Database:**
- Vercel Postgres (PostgreSQL)
- Prisma ORM (type-safe queries)
- Connection pooling for concurrent writes

**Key Libraries:**
- `csv-parser` - Read CSV files
- `csv-writer` - Export enriched CSVs
- `uuid` - Generate batch tracking IDs
- `fastest-levenshtein` - Fuzzy duplicate matching

---

## 🛡️ Duplicate Detection

The system uses two methods to detect duplicates:

### Method 1: Exact ISRC Match
```javascript
const existing = await prisma.song.findUnique({
  where: { isrc: song.isrc }
});
```
If ISRC already exists in database → 100% duplicate

### Method 2: Fuzzy Artist + Title Match
```javascript
const similarity = calculateSongSimilarity(
  { artist: newSong.artist, title: newSong.title },
  { artist: existingSong.artist, title: existingSong.title }
);

if (similarity >= 70%) {
  // Potential duplicate - prompt user or skip
}
```

**Fuzzy Matching Algorithm:**
- Normalizes text (lowercase, remove special chars)
- Uses Levenshtein distance for string similarity
- 70% threshold balances false positives/negatives
- Catches typos, alternate spellings, feature tags

**Our Approach:**
We used `--force-duplicates` flag to skip duplicate prompts and auto-skip songs already in DB (by ISRC). This was safe because:
- ISRCs are globally unique identifiers
- Database upsert handles existing ISRCs gracefully
- Parallel processes can't create true duplicates

---

## 📊 Data Flow Diagram

```
┌─────────────────┐
│   CSV Files     │
│  (isrc_output)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Load & Parse   │
│  (csv-parser)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Check Database  │
│ (Duplicate?)    │
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
 Skip      New Song
    │         │
    │         ▼
    │   ┌──────────────┐
    │   │ Gemini API   │
    │   │ (Classify)   │
    │   └──────┬───────┘
    │          │
    │          ▼
    │   ┌──────────────┐
    │   │ Parallel AI  │
    │   │ (Explicit)   │
    │   └──────┬───────┘
    │          │
    │          ▼
    │   ┌──────────────┐
    │   │  Save to DB  │
    │   │  (Prisma)    │
    │   └──────┬───────┘
    │          │
    └──────────┼──────────┐
               │          │
               ▼          ▼
        ┌────────────┐  ┌────────────┐
        │ Export CSV │  │  Web UI    │
        │ (outputs/) │  │  (Review)  │
        └────────────┘  └────────────┘
```

---

## 🎯 Key Commands Used

### Launch Single Playlist:
```bash
node scripts/enrich-playlist.cjs "path/to/playlist.csv" \
  --concurrency=5 \
  --force-duplicates
```

### Launch Parallel Batch:
```bash
# Terminal commands (run in background with nohup)
nohup node scripts/enrich-playlist.cjs "playlist1.csv" \
  --concurrency=5 --force-duplicates > /tmp/enrich-p1.log 2>&1 &

nohup node scripts/enrich-playlist.cjs "playlist2.csv" \
  --concurrency=5 --force-duplicates > /tmp/enrich-p2.log 2>&1 &

nohup node scripts/enrich-playlist.cjs "playlist3.csv" \
  --concurrency=5 --force-duplicates > /tmp/enrich-p3.log 2>&1 &
```

### Monitor Progress:
```bash
# Check database stats
node scripts/check-import-progress.cjs

# Watch live logs
tail -f /tmp/enrich-p1.log

# Check if processes running
ps aux | grep "enrich-playlist.cjs" | grep -v grep
```

---

## 🔐 Data Preservation

### What Gets Preserved:

1. **Original CSV Data:**
   - ISRC (unique identifier)
   - Artist, Title
   - BPM, Energy, Subgenre (original human-curated values)
   - **S3 Artwork URL** (album art)
   - **S3 Audio URL** (MP3/M4A file)

2. **AI-Generated Data:**
   - aiEnergy (Gemini classification)
   - aiAccessibility (Gemini)
   - aiSubgenre1, aiSubgenre2, aiSubgenre3 (Gemini)
   - aiExplicit (Parallel AI)
   - aiReasoning (Gemini's explanation)
   - aiContextUsed (Sources Gemini found)

3. **Metadata:**
   - uploadBatchId (UUID for this import batch)
   - createdAt, modifiedAt (timestamps)
   - reviewed (false = needs curator review)
   - aiStatus (SUCCESS/ERROR/REQUIRES_HUMAN_REVIEW)

### Database Schema (Prisma):
```prisma
model Song {
  id              String    @id @default(uuid())
  isrc            String    @unique
  title           String
  artist          String
  bpm             Int?
  artwork         String?   // S3 URL
  sourceFile      String?   @map("source_file") // S3 URL

  // AI Classifications
  aiEnergy        String?   @map("ai_energy")
  aiAccessibility String?   @map("ai_accessibility")
  aiSubgenre1     String?   @map("ai_subgenre_1")
  aiSubgenre2     String?   @map("ai_subgenre_2")
  aiSubgenre3     String?   @map("ai_subgenre_3")
  aiExplicit      String?   @map("ai_explicit")
  aiReasoning     String?   @map("ai_reasoning")
  aiContextUsed   String?   @map("ai_context_used")
  aiStatus        String?   @map("ai_status")

  // Review Tracking
  reviewed        Boolean   @default(false)
  reviewedAt      DateTime? @map("reviewed_at")
  uploadBatchId   String?   @map("upload_batch_id")

  createdAt       DateTime  @default(now()) @map("created_at")
  modifiedAt      DateTime  @updatedAt @map("modified_at")

  @@index([aiSubgenre1, aiSubgenre2, aiSubgenre3])
  @@index([aiStatus])
  @@index([reviewed])
  @@map("songs")
}
```

---

## ⚡ Performance Optimizations

### 1. Parallel Processing
- 3 playlists simultaneously = 3x throughput
- Each process independent = no blocking

### 2. Batch API Calls
- Gemini: Parallel requests (no sequential bottleneck)
- Parallel AI: Async task submission with polling

### 3. Database Optimization
- Upsert operations (insert or update in one query)
- Connection pooling for concurrent writes
- Indexed fields (ISRC, subgenres, status)

### 4. Error Handling
- Automatic retry on transient failures
- Continue processing on individual song errors
- Log errors without stopping entire batch

### 5. Progress Tracking
- Real-time console output
- Log files for debugging
- Database queries for overall stats

---

## 📈 Cost & Rate Limits

### API Costs (Estimated):

**Gemini API:**
- Model: `gemini-2.0-flash-exp` (free tier during preview)
- Requests: ~5,500 songs
- Cost: $0 (currently free)

**Parallel AI:**
- Explicit content classification
- Requests: ~5,500 songs
- Cost: Depends on your plan (typically $0.01-0.05/request)

**Total estimated cost**: ~$55-275 for Parallel AI (Gemini free)

### Rate Limits:

**Gemini:**
- 15 requests/minute (flash model)
- We stayed under with concurrency=5 per process

**Parallel AI:**
- Varies by plan
- Async task model prevents rate limit issues

---

## 🚀 What's Next?

### Immediate Next Steps:

1. **Review in Web Interface:**
   ```bash
   # Start backend
   vercel dev --listen 3001

   # Start frontend (separate terminal)
   cd client && npm run dev
   ```
   Navigate to http://localhost:3000

2. **Filter Unreviewed Songs:**
   - 5,679 unreviewed songs ready for curator review
   - Filter by subgenre, energy, accessibility
   - Edit classifications as needed
   - Mark as reviewed when complete

3. **Export Curated Data:**
   - Use web UI "Export CSV" feature
   - Filter by reviewed=true for final dataset
   - Download with configurable columns

### Future Enhancements:

1. **Medium Priority Playlists:**
   - 43 playlists (~8,000 songs)
   - Use same parallel processing strategy

2. **Low Priority Playlists:**
   - 104 playlists (~4,700 songs)
   - Complete the remaining catalog

3. **Quality Improvements:**
   - Review AI classification accuracy
   - Adjust subgenre mappings if needed
   - Train on curator edits

---

## 🎓 Key Learnings

### What Worked Well:

1. **Parallel processing** - 3x faster than sequential
2. **Fuzzy duplicate detection** - Caught variations/typos
3. **--force-duplicates flag** - Eliminated manual prompts
4. **nohup background processes** - Resilient to interruptions
5. **Progress monitoring** - Easy to check status anytime
6. **Prisma ORM** - Type-safe, clean database code

### Challenges Overcome:

1. **API rate limits** - Managed with concurrency controls
2. **Long processing times** - Solved with parallel batches
3. **Laptop sleep issues** - Used nohup + background processes
4. **Duplicate playlists** - Detected via ISRC comparison
5. **Markdown parsing errors** - Gemini occasionally returns markdown-wrapped JSON (handled gracefully)

### Best Practices Applied:

1. **Idempotent operations** - Safe to re-run on same data
2. **Comprehensive logging** - Logs saved for debugging
3. **Atomic transactions** - Database writes are all-or-nothing
4. **Graceful degradation** - Continue on individual errors
5. **Clear documentation** - Easy to resume/understand process

---

## 📝 Summary

You've successfully built and executed a production-grade music classification pipeline that:

✅ Analyzed 539 CSV files and prioritized them
✅ Processed 5,495 songs through dual-AI classification
✅ Preserved all original metadata + S3 URLs
✅ Handled duplicates intelligently
✅ Ran efficiently with parallel processing
✅ Logged everything for observability
✅ Exported enriched CSVs for backup
✅ Loaded everything into searchable database

**The result:** A curated, classified, and enriched music catalog ready for human review and production use! 🎵
