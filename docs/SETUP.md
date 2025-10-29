# Music Classification Review Interface - Setup Instructions

**Date**: 2025-10-27
**Status**: Ready for deployment
**Estimated Setup Time**: 30-45 minutes

---

## Overview

This project now includes a complete web-based review interface for curators to review AI-generated music classifications. The interface connects to a Vercel Postgres database and provides filtering, pagination, and inline editing capabilities.

### What's Been Built

✅ **Backend** (Vercel Serverless Functions):
- GET `/api/songs` - Fetch songs with pagination and filtering
- PATCH `/api/songs/:isrc` - Save curator edits

✅ **Frontend** (React + TypeScript + shadcn/ui):
- FilterPanel - Filter by subgenre, status, energy, accessibility, review status
- SongTable - Paginated table with 50 songs per page
- ReviewModal - Edit energy, accessibility, 3 subgenres + curator notes
- AudioPlayer - Stream songs from S3

✅ **Database**:
- Schema script (`scripts/create-schema.js`)
- Seed script (`scripts/seed.js`)
- 243 hard-coded subgenres from classification prompt

---

## Prerequisites

Before starting, ensure you have:

- [ ] Node.js 18+ installed
- [ ] A Vercel account
- [ ] Access to the batch CSV output: `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv`

---

## Step 1: Create Vercel Postgres Database

### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project (or create one: "gemini-music-classifier")
3. Navigate to **Storage** tab
4. Click **Create Database** → **Postgres**
5. Choose a database name (e.g., "music-classifications")
6. Select region (choose closest to your users)
7. Click **Create**

### Option B: Via Vercel CLI

```bash
vercel link  # Link to your project
vercel storage create postgres music-classifications
```

### Get Connection Details

After creating the database:

1. Go to your database in the Vercel dashboard
2. Click **Settings** → **Environment Variables**
3. You'll see these variables (auto-added to your project):
   ```
   POSTGRES_URL
   POSTGRES_PRISMA_URL
   POSTGRES_URL_NON_POOLING
   ```

4. Pull them locally:
   ```bash
   vercel env pull .env.local
   ```

---

## Step 2: Install Dependencies

### Root Dependencies (Backend Scripts)

```bash
npm install
```

This installs:
- `@vercel/postgres` - Database client
- `csv-parse` - CSV parsing for seed script
- Existing Gemini/batch processing dependencies

### Client Dependencies (Frontend)

```bash
cd client
npm install
```

This installs:
- React 18 + TypeScript
- Vite (build tool)
- shadcn/ui components
- Tailwind CSS
- Sonner (toast notifications)
- All dependencies from Figma Make prototype

---

## Step 3: Create Database Schema

Run the schema creation script:

```bash
npm run create-schema
```

**Expected Output**:
```
🔨 Creating database schema...

✅ Table "songs" created
✅ Index on isrc created
✅ Index on ai_subgenre_1 created
✅ Index on ai_subgenre_2 created
✅ Index on ai_subgenre_3 created
✅ Index on ai_status created
✅ Index on reviewed created

🎉 Schema created successfully!

Next step: Run `npm run seed` to import your batch CSV
```

### Troubleshooting

**Error**: `Cannot find module '@vercel/postgres'`
- Solution: Run `npm install` in root directory

**Error**: `POSTGRES_URL environment variable not found`
- Solution: Run `vercel env pull .env.local` to get database credentials

---

## Step 4: Seed Database with Batch CSV

Import your batch classification CSV into the database:

```bash
npm run seed
```

**Expected Output**:
```
🌱 Starting seed process...

📂 Reading CSV from: archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv

📊 Found 50 songs in CSV

   Processed 10/50 songs...
   Processed 20/50 songs...
   Processed 30/50 songs...
   Processed 40/50 songs...
   Processed 50/50 songs...

============================================================
🎉 Seed completed!

   ✅ Inserted: 50 songs
   🔄 Updated:  0 songs
============================================================

Next step: Start the development server with `npm run dev`
```

### What This Does

- Reads the batch CSV file
- Converts "NULL" strings to actual null values
- Upserts songs by ISRC (inserts new, updates existing)
- Generates temp ISRCs if missing
- Sets `reviewed = false` for all songs

### Troubleshooting

**Error**: `CSV file not found`
- Check path: `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv`
- Update `CSV_PATH` in `scripts/seed.js` if using different file

**Error**: Parsing errors
- Check CSV has correct headers (title, artist, isrc, etc.)
- Ensure CSV is UTF-8 encoded

---

## Step 5: Start Development Server

### Start Frontend

```bash
cd client
npm run dev
```

**Expected Output**:
```
  VITE v6.3.5  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### Configure API Proxy (if needed)

If API calls fail in development, add this to `client/vite.config.ts`:

```typescript
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000', // Your Vercel dev server
        changeOrigin: true,
      },
    },
  },
});
```

---

## Step 6: Test Locally

Open [http://localhost:5173](http://localhost:5173) and verify:

### 1. **Songs Load**
- You should see songs from your batch CSV
- FilterPanel shows "Showing X songs"

### 2. **Filtering Works**
- Select a subgenre from dropdown
- Table should filter to matching songs
- Song count updates

### 3. **Review Modal Opens**
- Click any song row
- Modal appears with song details
- Audio player loads (if `source_file` URL is valid)

### 4. **Editing & Saving Works**
- Change energy level
- Change accessibility
- Modify subgenres
- Add curator notes
- Click "Save" or "Save & Next"
- Toast notification appears: "Classification saved successfully"

### 5. **Pagination Works** (if >50 songs)
- Page controls appear at bottom
- Click "Next" to go to page 2
- URL should update (page=2)

---

## Step 7: Deploy to Vercel

### Prepare for Deployment

1. **Commit all changes**:
   ```bash
   git add .
   git commit -m "feat: add music classification review interface"
   ```

2. **Push to GitHub**:
   ```bash
   git push origin main
   ```

### Deploy via Vercel Dashboard

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repository
3. **Framework Preset**: Vite (auto-detected)
4. **Root Directory**: Leave as `.` (monorepo setup)
5. **Build Command**: `cd client && npm run build`
6. **Output Directory**: `client/dist`
7. **Install Command**: `npm install && cd client && npm install`

8. Click **Deploy**

### Deploy via Vercel CLI

```bash
vercel
```

Follow prompts:
- Set up and deploy? **Y**
- Which scope? (Select your account)
- Link to existing project? **Y** (or create new)
- What's your project's name? **gemini-music-classifier**
- In which directory is your code located? **./client**

### Verify Deployment

1. Visit your deployed URL (e.g., `gemini-music-classifier.vercel.app`)
2. Test filtering, editing, saving
3. Check Vercel logs for any API errors

---

## Step 8: Verify Database Connection

### Check Songs Were Imported

Run this SQL query in Vercel's SQL editor:

```sql
SELECT COUNT(*) as total_songs,
       SUM(CASE WHEN reviewed THEN 1 ELSE 0 END) as reviewed_count,
       SUM(CASE WHEN NOT reviewed THEN 1 ELSE 0 END) as unreviewed_count
FROM songs;
```

**Expected Result**:
```
total_songs | reviewed_count | unreviewed_count
------------|----------------|------------------
50          | 0              | 50
```

### Test API Endpoints Directly

```bash
# Get songs (should return 50)
curl https://your-app.vercel.app/api/songs?limit=10

# Get single song
curl https://your-app.vercel.app/api/songs/GBAYE2300262
```

---

## Project Structure

```
gemini-music-classifier/
├── api/                          # Vercel Serverless Functions
│   └── songs/
│       ├── index.ts              # GET /api/songs (list + filter)
│       └── [isrc].ts             # PATCH /api/songs/:isrc (update)
│
├── client/                       # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── FilterPanel.tsx  # 5 filter types
│   │   │   ├── SongTable.tsx    # Paginated table
│   │   │   ├── ReviewModal.tsx  # Edit modal
│   │   │   ├── AudioPlayer.tsx  # S3 streaming
│   │   │   └── ui/              # shadcn/ui components
│   │   ├── lib/
│   │   │   └── api.ts           # API client
│   │   ├── data/
│   │   │   └── constants.ts     # 243 subgenres
│   │   ├── App.tsx              # Main app
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── scripts/
│   ├── create-schema.js         # DB schema setup
│   └── seed.js                  # Import CSV
│
├── src/                         # Existing batch processing
│   ├── orchestrator.js
│   └── ...
│
├── package.json                 # Root dependencies
├── .env.local                   # Database credentials
├── SETUP.md                     # This file
├── PRD-review-interface.md      # Full requirements doc
└── IMPLEMENTATION-SUMMARY.md    # Quick reference

```

---

## Environment Variables

### Required (Auto-configured by Vercel)

```bash
POSTGRES_URL=postgres://...
POSTGRES_PRISMA_URL=postgres://...
POSTGRES_URL_NON_POOLING=postgres://...
```

### Existing (For Batch Processing)

```bash
GEMINI_API_KEY=your_gemini_api_key
BRAINTRUST_API_KEY=your_braintrust_key
BRAINTRUST_PROJECT_NAME=Music Classification - Gemini
```

---

## Common Issues & Solutions

### Issue 1: "Cannot connect to database"

**Symptoms**: API calls return 500 errors, logs show connection errors

**Solution**:
1. Verify environment variables exist: `vercel env ls`
2. Pull latest env vars: `vercel env pull .env.local`
3. Restart dev server

### Issue 2: "Songs not loading"

**Symptoms**: Empty table, no songs displayed

**Solution**:
1. Check seed script ran successfully: `npm run seed`
2. Query database directly in Vercel dashboard: `SELECT COUNT(*) FROM songs;`
3. Check browser console for API errors

### Issue 3: "Audio won't play"

**Symptoms**: Audio player shows error, can't stream

**Solution**:
- S3 URLs may be invalid or expired
- Check `source_file` column in database: some may be NULL
- Verify S3 bucket has CORS enabled
- This is expected for some songs (not all have `source_file`)

### Issue 4: "Pagination not working"

**Symptoms**: Can't navigate pages, all songs shown at once

**Solution**:
- Check API returns pagination data: `curl /api/songs?page=1&limit=50`
- Verify `totalPages > 1` in response
- Check browser console for errors

### Issue 5: "Save doesn't work"

**Symptoms**: Changes don't persist, toast says "Failed to save"

**Solution**:
1. Check PATCH endpoint works:
   ```bash
   curl -X PATCH https://your-app.vercel.app/api/songs/GBAYE2300262 \
     -H "Content-Type: application/json" \
     -d '{"ai_energy":"High","ai_accessibility":"Commercial","ai_subgenre_1":"Nu-Disco"}'
   ```
2. Check browser console for validation errors
3. Ensure all required fields are provided (energy, accessibility, subgenre_1)

---

## Next Steps

### 1. Import More Batch CSVs

To import additional batch outputs:

```bash
# Update CSV_PATH in scripts/seed.js to point to new file
# Then run:
npm run seed
```

The script will:
- Insert new songs (new ISRCs)
- Update existing songs (duplicate ISRCs)
- Preserve `reviewed = true` for songs already reviewed

### 2. Add Authentication (Phase 2)

When ready to add auth:

1. Install Clerk or WorkOS
2. Update `api/songs/[isrc].ts` to set `reviewed_by` from auth session
3. Add login page to `client/src`
4. See PRD section "Phase 3: Authentication"

### 3. Monitor Usage

- **Vercel Dashboard**: Check function invocations, errors
- **Database**: Monitor storage usage (free tier = 256MB)
- **Frontend**: Add analytics (PostHog, Plausible, etc.)

### 4. Backup Database

Regular backups:

```bash
# Export all songs to CSV
vercel postgres -- psql -c "COPY songs TO STDOUT WITH CSV HEADER" > backup-$(date +%Y%m%d).csv
```

---

## Useful Commands

### Backend (Root Directory)

```bash
npm run create-schema   # Create database tables
npm run seed            # Import batch CSV
npm run process:all     # Run batch processing (existing)
npm run monitor         # Monitor batch job (existing)
```

### Frontend (client/ Directory)

```bash
npm run dev             # Start dev server (port 5173)
npm run build           # Build for production
npm run preview         # Preview production build
```

### Database Queries

```bash
# Total songs
vercel postgres -- psql -c "SELECT COUNT(*) FROM songs;"

# Reviewed vs unreviewed
vercel postgres -- psql -c "SELECT reviewed, COUNT(*) FROM songs GROUP BY reviewed;"

# Songs by subgenre
vercel postgres -- psql -c "SELECT ai_subgenre_1, COUNT(*) FROM songs GROUP BY ai_subgenre_1 ORDER BY count DESC LIMIT 10;"
```

---

## Support & Documentation

- **Full PRD**: See `PRD-review-interface.md` for complete requirements
- **Quick Reference**: See `IMPLEMENTATION-SUMMARY.md`
- **GitHub Issues**: Report bugs at (your repo)
- **Vercel Docs**: [vercel.com/docs](https://vercel.com/docs)

---

## Success Checklist

Before considering setup complete, verify:

- [ ] Vercel Postgres database created
- [ ] Schema script ran successfully
- [ ] Batch CSV imported (50 songs)
- [ ] Frontend loads at localhost:5173
- [ ] Songs appear in table
- [ ] Filtering works (try selecting a subgenre)
- [ ] Review modal opens when clicking song
- [ ] Can edit energy/accessibility/subgenres
- [ ] Save button works (toast appears)
- [ ] Changes persist (refresh page, see updated value)
- [ ] Deployed to Vercel successfully
- [ ] Production site works (test editing + saving)

---

**Setup Complete!** 🎉

Your music classification review interface is now ready. Curators can log in and start reviewing AI-generated classifications.

For questions or issues, refer to the "Common Issues & Solutions" section above or check the PRD for detailed specifications.
