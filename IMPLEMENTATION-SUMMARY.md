# Music Classification Review Interface - Implementation Summary

**Status**: Ready to build
**Estimated Time**: 6-8 hours
**Full PRD**: See `PRD-review-interface.md`

---

## Quick Overview

### What We're Building
A web interface for curators to review and correct AI-generated music classifications from your Gemini batch processing pipeline.

### Tech Stack (Final Decisions)
- **Frontend**: React 18 + TypeScript + Vite + shadcn/ui (using your Figma Make prototype)
- **Backend**: Vercel Serverless Functions
- **Database**: Vercel Postgres (PostgreSQL from day 1, no migration)
- **Deployment**: Vercel

### Key Features
✅ Filter songs by subgenre, status, energy, accessibility, review status
✅ Paginated table (50 songs/page)
✅ Review modal with audio player
✅ Edit energy, accessibility, 3 subgenres
✅ Save & Next workflow
✅ Dark theme (zinc-950/900/800)

### Data Model (Simplified)
- **Single set of fields**: Curator edits directly overwrite `ai_*` fields
- **No separate approved fields** in prototype (can add later for analytics)
- Track review status with `reviewed` boolean + timestamps

---

## What You Need to Do

### 1. Choose Project Structure

**Option A: Build in current repo** (`gemini-music-classifier/`)
```
gemini-music-classifier/
├── client/          # React frontend (Figma Make prototype)
├── api/             # Vercel Functions
├── scripts/         # DB schema + seed script
├── src/             # Existing batch processing code
└── prompts/         # Classification prompt (already here)
```

**Option B: Create new repo** (`music-review-interface/`)
```
music-review-interface/
├── src/             # React frontend
├── api/             # Vercel Functions
├── scripts/         # DB schema + seed script
└── README.md
```

**👉 Which do you prefer? A or B?**

---

### 2. Confirm Vercel Setup

**Option 1**: You create the Postgres database
- Go to Vercel → Storage → Create Postgres DB
- Provide connection URL to Claude
- Claude builds everything else

**Option 2**: Claude creates everything
- Needs Vercel API access (if you have it set up)
- Or you can manually run the SQL schema Claude provides

**👉 Which option works better for you?**

---

### 3. File Locations (Already Confirmed ✅)
- Figma prototype: `/Users/saagar/Music/New Downloads/Music Classification Review Interface`
- Test CSV: `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv`
- Classification prompt: `prompts/classification-prompt.md`

---

## What Claude Will Build

### Backend (2-3 hours)
1. Database schema (songs table with all fields)
2. CSV seed script (import your batch output)
3. GET /api/songs (with pagination + filtering)
4. PATCH /api/songs/:isrc (save curator edits)

### Frontend (3-4 hours)
5. Copy Figma Make prototype
6. Extract 243 subgenres from prompt → hard-code in constants
7. Build API client to replace mock data
8. Add pagination to SongTable
9. Test with real data

### Deployment (30 min)
10. Deploy to Vercel
11. Verify everything works

---

## When You're Ready

Just say:
1. **"Option A"** or **"Option B"** (project structure)
2. **"Go"** or **"Let's start"**

Claude will immediately begin:
- Creating database schema
- Building seed script
- Setting up API endpoints
- Integrating Figma Make prototype
- Adding pagination
- Testing with your CSV

**No additional input needed after that** - Claude will build everything end-to-end.

---

## Questions?

If anything is unclear about the PRD or implementation plan, ask now before we start building!
