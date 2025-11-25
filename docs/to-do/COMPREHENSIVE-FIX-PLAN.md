# Comprehensive Fix Plan: Music Classification System

*Created: November 24, 2024*

This document outlines all identified issues and the implementation plan to fix them, organized by priority and category.

---

## Phase 1: Cleanup - Remove Old Batch Pipeline

**Goal:** Remove broken/unused code to reduce maintenance burden.

### Files to Delete:
```
src/orchestrator.js
src/prepare-batch-input.js
src/submit-batch-job.js
src/monitor-batch-job.js
src/process-batch-results.js
src/export-to-csv.js
src/playlist-batch-runner.js
```

### Files to Update:
1. **`package.json`** - Remove scripts:
   - `process:all`
   - `process:playlist`
   - `monitor`

2. **`CLAUDE.md`** - Remove/update:
   - "Batch Processing (Legacy)" section
   - References to 5-phase pipeline
   - `npm run process:all` and `npm run monitor` commands

---

## Phase 2: Security Fixes

### 2.1 JWT Secret Fallback (CRITICAL)
**File:** `api/lib/auth.ts:9`

**Current:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
```

**Fix:**
```typescript
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
```

### 2.2 Increase bcrypt Rounds
**File:** `api/lib/auth.ts:29`

**Current:** `bcryptjs.hash(password, 10)`
**Fix:** `bcryptjs.hash(password, 12)` (industry standard)

### 2.3 Add Input Validation with Zod
**Files:** All API endpoints

**Install:** `npm install zod`

**Example for `api/songs/[isrc].ts`:**
```typescript
import { z } from 'zod';

const UpdateSongSchema = z.object({
  ai_energy: z.enum(['Very Low', 'Low', 'Medium', 'High', 'Very High']).optional(),
  ai_accessibility: z.enum(['Timeless', 'Mainstream', 'Current', 'Cutting Edge', 'Eclectic']).optional(),
  ai_explicit: z.enum(['Family Friendly', 'Some Explicit', 'Explicit']).optional(),
  ai_subgenre_1: z.string().optional(),
  ai_subgenre_2: z.string().optional(),
  ai_subgenre_3: z.string().optional(),
  reviewed: z.boolean().optional(),
});

// In handler:
const result = UpdateSongSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ error: 'Invalid input', details: result.error.issues });
}
```

### 2.4 Add CSRF Protection
**Files:** `api/lib/auth.ts`, all state-changing endpoints

**Approach:** Double-submit cookie pattern
1. Generate CSRF token on login, store in cookie + return in response
2. Client sends token in `X-CSRF-Token` header
3. Server validates header matches cookie

### 2.5 Reduce JWT Expiration
**File:** `api/lib/auth.ts:10`

**Current:** `'7d'`
**Fix:** `'24h'` with refresh token mechanism (or `'7d'` if refresh tokens too complex)

### 2.6 Sanitize Error Messages
**Files:** All API endpoints

**Current:**
```typescript
return res.status(500).json({ error: 'Failed', message: error.message });
```

**Fix:**
```typescript
console.error('Internal error:', error); // Log full error server-side
return res.status(500).json({ error: 'Internal server error' }); // Generic to client
```

---

## Phase 3: API Performance Fixes

### 3.1 Fix N+1 Query in Duplicate Detection (CRITICAL)
**Files:** `api/songs/check-duplicates.ts:70`, `api/songs/upload.ts:415`

**Current:** Loads ALL songs into memory for comparison

**Fix Option A - Database Query:**
```typescript
// Use database ILIKE for fuzzy matching
const potentialDuplicates = await prisma.song.findMany({
  where: {
    OR: [
      { artist: { contains: artist, mode: 'insensitive' } },
      { title: { contains: title, mode: 'insensitive' } },
      { isrc: isrc || undefined },
    ],
  },
  take: 100, // Limit results
});

// Then run fuzzy matching only on potential matches
```

**Fix Option B - Pagination:**
```typescript
// Process in batches of 1000
let skip = 0;
const batchSize = 1000;
let duplicateFound = false;

while (!duplicateFound) {
  const batch = await prisma.song.findMany({ skip, take: batchSize });
  if (batch.length === 0) break;

  for (const song of batch) {
    if (areSongsDuplicate(...)) {
      duplicateFound = true;
      break;
    }
  }
  skip += batchSize;
}
```

### 3.2 Fix Filter Inconsistency
**Files:** `api/songs/export.ts:128-135` vs `api/songs/index.ts:67-75`

**Issue:** Export uses case-sensitive match, list uses case-insensitive

**Fix in `export.ts`:**
```typescript
where.OR = [
  { aiSubgenre1: { equals: subgenre, mode: 'insensitive' } },
  { aiSubgenre2: { equals: subgenre, mode: 'insensitive' } },
  { aiSubgenre3: { equals: subgenre, mode: 'insensitive' } },
];
```

### 3.3 Add Missing Database Indexes
**File:** `prisma/schema.prisma`

**Add:**
```prisma
model Song {
  // ... existing fields ...

  @@index([artist, title])           // For fuzzy matching queries
  @@index([reviewed, createdAt])     // For common filter pattern
  @@index([playlistName])            // For playlist filtering
}
```

**Run:** `npm run prisma:migrate` after schema change

### 3.4 Implement `requireAdmin` Checks
**Files:** Sensitive endpoints (if any admin-only operations exist)

Currently `requireAdmin()` is defined but never used. Either:
- A) Use it on appropriate endpoints
- B) Remove it if not needed

---

## Phase 4: React Interface UX Fixes

### 4.1 CSV Parsing Bug (HIGH)
**File:** `client/src/components/UploadModal.tsx:104-107`

**Current:**
```typescript
const fields = line.split(','); // Breaks on "Artist, Name" or quoted fields
```

**Fix:**
```typescript
import Papa from 'papaparse';

// In the parsing logic:
const parsed = Papa.parse(csvContent, {
  header: true,
  skipEmptyLines: true,
});
const rows = parsed.data;
```

**Install:** `cd client && npm install papaparse @types/papaparse`

### 4.2 Search Debouncing (HIGH)
**File:** `client/src/pages/SongsPage.tsx:78`

**Current:** Every keystroke triggers API call

**Fix:**
```typescript
import { useMemo } from 'react';
import debounce from 'lodash.debounce';

// Create debounced search handler
const debouncedSearch = useMemo(
  () => debounce((value: string) => {
    setSearchQuery(value);
  }, 300),
  []
);

// In search input:
onChange={(e) => debouncedSearch(e.target.value)}
```

**Install:** `cd client && npm install lodash.debounce @types/lodash.debounce`

### 4.3 Export Preview Spam (HIGH)
**File:** `client/src/components/ExportModal.tsx:45-49`

**Current:**
```typescript
useEffect(() => {
  if (isOpen) loadPreview(); // Runs on every checkbox change
}, [isOpen, playlistName, includeAccessibility, includeExplicit, selectedIsrcs]);
```

**Fix:**
```typescript
const debouncedLoadPreview = useMemo(
  () => debounce(() => loadPreview(), 500),
  [loadPreview]
);

useEffect(() => {
  if (isOpen) debouncedLoadPreview();
  return () => debouncedLoadPreview.cancel();
}, [isOpen, playlistName, includeAccessibility, includeExplicit, selectedIsrcs]);
```

### 4.4 Request Cancellation (MEDIUM)
**File:** `client/src/lib/api.ts`

**Current:** No AbortController

**Fix - Create wrapper:**
```typescript
export function createAbortableFetch() {
  const controller = new AbortController();

  const fetchWithAbort = async (url: string, options?: RequestInit) => {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  };

  return {
    fetch: fetchWithAbort,
    abort: () => controller.abort(),
  };
}

// Update fetchSongs:
export async function fetchSongs(params: SongQueryParams, signal?: AbortSignal) {
  const response = await fetch(url, {
    credentials: 'include',
    signal,
  });
  // ...
}
```

**Usage in SongsPage.tsx:**
```typescript
useEffect(() => {
  const controller = new AbortController();

  fetchSongs(params, controller.signal)
    .then(setSongs)
    .catch(err => {
      if (err.name !== 'AbortError') setError(err);
    });

  return () => controller.abort();
}, [/* deps */]);
```

### 4.5 Loading States (MEDIUM)
**Files:** `SongsPage.tsx`, `SongTable.tsx`

**Add skeleton component:**
```typescript
// client/src/components/SongTableSkeleton.tsx
export function SongTableSkeleton({ rows = 10 }: { rows?: number }) {
  return (
    <div className="animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 bg-zinc-800 rounded mb-2" />
      ))}
    </div>
  );
}
```

**Use in SongsPage:**
```typescript
{isLoading ? <SongTableSkeleton rows={limit} /> : <SongTable songs={songs} ... />}
```

### 4.6 FilterPanel Caching (LOW)
**File:** `client/src/components/FilterPanel.tsx:67-93`

**Current:** Re-fetches batches/playlists on every modal open

**Fix:** Cache in parent component or use React Query

---

## Phase 5: Database Schema Cleanup

### 5.1 Remove Redundant Reviewer Field
**File:** `prisma/schema.prisma`

**Current:** Both `reviewedBy` (string) and `reviewedById` (UUID)

**Decision needed:** Keep one, migrate data, remove other

**If keeping reviewedById:**
1. Migrate: `UPDATE songs SET reviewedById = (SELECT id FROM users WHERE name = reviewedBy) WHERE reviewedBy IS NOT NULL`
2. Remove `reviewedBy` field from schema
3. Update all code references

### 5.2 Add NOT NULL Constraints (Consider)
**File:** `prisma/schema.prisma`

**Fields to consider making required:**
- `title` - Required for display and matching
- `artist` - Required for display and matching

**Migration approach:**
1. Backfill empty values: `UPDATE songs SET title = 'Unknown' WHERE title IS NULL`
2. Add constraint

### 5.3 Clean Up Unused Fields
**File:** `prisma/schema.prisma`

**Review these:**
- `wasNew` on PlaylistSong - never set to true
- `isDuplicate` on Song - never set to true
- `originalIsrc` on Song - never populated

**Action:** Either implement usage or remove to reduce confusion

---

## Phase 6: Code Quality Improvements

### 6.1 Consolidate Duplicate Detection Logic
**Current:** Same fuzzy matching in 3+ files

**Fix:** Already have `src/utils/fuzzy-matcher.cjs` - ensure all code uses it:
- `api/songs/check-duplicates.ts` - import from utils
- `api/songs/upload.ts` - import from utils
- `scripts/enrich-playlist.cjs` - already imports

### 6.2 Single Source of Truth for Enums
**Current:** Enums defined in multiple places

**Fix:**
1. `data/subgenres.json` is source of truth
2. Generate `client/src/data/constants.ts` from it (already have script)
3. Generate `api/lib/validation.ts` from it (new script needed)

**Create:** `scripts/generate-api-validation.cjs`
```javascript
// Reads data/subgenres.json and generates Zod schemas for API
```

### 6.3 Extract Hardcoded Playlist Names
**Current:** 20+ names hardcoded in 2 scripts

**Fix:**
1. Create `data/playlists.json`:
```json
{
  "knownPlaylists": [
    "Bazaar Meat (Late)",
    "Benny's Evening",
    ...
  ]
}
```
2. Update scripts to import from this file

---

## Implementation Order

### Sprint 1: Critical Security & Bugs
1. [ ] Remove old batch pipeline (Phase 1)
2. [ ] Fix JWT secret requirement (2.1)
3. [ ] Fix N+1 query (3.1)
4. [ ] Fix CSV parsing bug (4.1)

### Sprint 2: Security Hardening
5. [ ] Add Zod validation to API endpoints (2.3)
6. [ ] Sanitize error messages (2.6)
7. [ ] Increase bcrypt rounds (2.2)
8. [ ] Fix filter inconsistency (3.2)

### Sprint 3: UX Improvements
9. [ ] Add search debouncing (4.2)
10. [ ] Fix export preview spam (4.3)
11. [ ] Add request cancellation (4.4)
12. [ ] Add loading skeletons (4.5)

### Sprint 4: Database & Code Quality
13. [ ] Add missing indexes (3.3)
14. [ ] Consolidate duplicate logic (6.1)
15. [ ] Single source for enums (6.2)
16. [ ] Extract hardcoded playlists (6.3)

### Future/Optional
17. [ ] Add CSRF protection (2.4)
18. [ ] Reduce JWT expiration + refresh tokens (2.5)
19. [ ] Schema cleanup - remove unused fields (5.3)
20. [ ] Remove redundant reviewer field (5.1)

---

## Files Summary

**To Delete:**
- `src/orchestrator.js`
- `src/prepare-batch-input.js`
- `src/submit-batch-job.js`
- `src/monitor-batch-job.js`
- `src/process-batch-results.js`
- `src/export-to-csv.js`
- `src/playlist-batch-runner.js`

**To Modify (High Priority):**
- `api/lib/auth.ts` - JWT validation, bcrypt
- `api/songs/check-duplicates.ts` - N+1 fix
- `api/songs/upload.ts` - N+1 fix
- `api/songs/export.ts` - Filter consistency
- `client/src/components/UploadModal.tsx` - CSV parsing
- `client/src/pages/SongsPage.tsx` - Debouncing
- `client/src/components/ExportModal.tsx` - Preview debouncing
- `client/src/lib/api.ts` - AbortController
- `package.json` - Remove scripts, add dependencies
- `CLAUDE.md` - Update documentation

**To Modify (Medium Priority):**
- `prisma/schema.prisma` - Indexes
- All API endpoints - Zod validation, error sanitization
- `scripts/*.cjs` - Import shared utilities

**To Create:**
- `client/src/components/SongTableSkeleton.tsx`
- `data/playlists.json`
- `scripts/generate-api-validation.cjs` (optional)
