# Upload Batch Filter Feature - Implementation Plan

**Status**: ✅ IMPLEMENTATION COMPLETE - Ready for Testing
**Last Updated**: 2025-11-13
**Branch**: `feature/upload-batch-filter`

## Goal
Allow curators to filter songs by upload batch using the original CSV filename (e.g., "Anderson's 2026"), making reviewing and exporting specific uploads streamlined.

## Overview
- Store original CSV filename with each batch
- Add backend endpoint to list all batches
- Add frontend dropdown filter to select batches
- Integrate with existing filters and export functionality

---

## Progress Summary
- ✅ Phase 1: Database Schema Update (COMPLETE)
- ✅ Phase 2: Backend Batch Name Capture (COMPLETE - Web API + CLI)
- ✅ Phase 3: Backend APIs (COMPLETE)
- ✅ Phase 4: Frontend UI (COMPLETE)
- ✅ Phase 5: Testing (COMPLETE - verified working in browser)

---

## Phase 1: Database Schema Update ✅ COMPLETE

### 1.1 Add `uploadBatchName` Field to Schema ✅
**File**: `prisma/schema.prisma`

**Changes Made**:
```prisma
model Song {
  // ... existing fields
  uploadBatchId   String?  @map("upload_batch_id") @db.VarChar(50)
  uploadBatchName String?  @map("upload_batch_name") @db.VarChar(255)  // NEW

  // Add index for efficient filtering
  @@index([uploadBatchId], map: "idx_upload_batch_id")
  @@index([uploadBatchName], map: "idx_upload_batch_name")  // NEW
}
```

### 1.2 Run Migration ✅
**Command**: `npx prisma db push`
**Status**: Successfully applied - database now has `upload_batch_name` column

---

## Phase 2: Backend - Capture Batch Names

### 2.1 Update Web Upload API ✅ COMPLETE
**File**: `api/songs/upload.ts`

**Changes Made**:

1. **Updated `parseFormData` function** (line 315-347):
   - Return type now includes `batchName: string`
   - Extracts filename from `file.originalFilename`
   - Strips `.csv` extension
   - Returns "Unknown Upload" as fallback

```typescript
async function parseFormData(req: VercelRequest): Promise<{
  file: formidable.File | null;
  songs: ParsedSong[];
  batchName: string;  // NEW
}> {
  // ... parsing logic

  // Extract batch name from filename (remove .csv extension)
  const batchName = (file.originalFilename || 'Unknown Upload')
    .replace(/\.csv$/i, '')
    .trim();

  resolve({ file, songs, batchName });
}
```

2. **Updated handler to capture batchName** (line 173):
```typescript
const { file, songs, batchName } = await parseFormData(req);
```

3. **Updated `enrichAndSaveSong` function signature** (line 458):
```typescript
async function enrichAndSaveSong(song: ParsedSong, uploadBatchId: string, uploadBatchName: string)
```

4. **Added uploadBatchName to enriched song object** (line 493):
```typescript
const enrichedSong = {
  // ... existing fields
  uploadBatchId,
  uploadBatchName,  // NEW
  reviewed: false
};
```

5. **Updated enrichAndSaveSong call** (line 259):
```typescript
const enrichedSong = await enrichAndSaveSong(song, uploadBatchId, batchName);
```

### 2.2 Update CLI Script ✅ COMPLETE
**File**: `scripts/enrich-playlist.cjs`

**Changes Made**:

**Line 73**: Added batch name extraction after uploadBatchId generation
```javascript
// Extract batch name from CSV filename (remove .csv extension)
const batchName = path.basename(csvPath, '.csv');
```

**Line 280**: Added uploadBatchName to enriched song object
```javascript
// Upload tracking
uploadBatchId: uploadBatchId,
uploadBatchName: batchName  // NEW
```

**Status**: CLI script now captures and stores batch names from CSV filenames

---

## Phase 3: Backend - Batch Listing API ✅ COMPLETE

### 3.1 Create Batches Endpoint ✅ COMPLETE
**File**: `api/songs/batches.ts` (NEW)

**Endpoint**: GET /api/songs/batches

**Response Format**:
```json
{
  "batches": [
    {
      "uploadBatchId": "uuid",
      "uploadBatchName": "Anderson's 2026",
      "uploadDate": "2025-11-12T10:30:00Z",
      "totalSongs": 45,
      "reviewedSongs": 12,
      "unreviewedSongs": 33
    }
  ]
}
```

**Implementation**:
```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { PrismaClient } from '@prisma/client';
import { requireAuth } from '../lib/auth.js';

const prisma = new PrismaClient();

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) return;

  try {
    // Get all unique batches with aggregated data
    const batches = await prisma.song.groupBy({
      by: ['uploadBatchId', 'uploadBatchName'],
      where: {
        uploadBatchId: { not: null }
      },
      _count: {
        id: true
      },
      _min: {
        createdAt: true
      }
    });

    // For each batch, get reviewed counts
    const batchesWithCounts = await Promise.all(
      batches.map(async (batch) => {
        const reviewedCount = await prisma.song.count({
          where: {
            uploadBatchId: batch.uploadBatchId,
            reviewed: true
          }
        });

        return {
          uploadBatchId: batch.uploadBatchId,
          uploadBatchName: batch.uploadBatchName || 'Unknown Upload',
          uploadDate: batch._min.createdAt,
          totalSongs: batch._count.id,
          reviewedSongs: reviewedCount,
          unreviewedSongs: batch._count.id - reviewedCount
        };
      })
    );

    // Sort by most recent first
    batchesWithCounts.sort((a, b) =>
      new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime()
    );

    return res.status(200).json({ batches: batchesWithCounts });

  } catch (error: any) {
    console.error('Error fetching batches:', error);
    return res.status(500).json({
      error: 'Failed to fetch batches',
      message: error.message
    });
  } finally {
    await prisma.$disconnect();
  }
}
```

### 3.2 Update Songs API for Batch Filtering ✅ COMPLETE
**File**: `api/songs/index.ts`

**Changes Made**:

**Line 55**: Added uploadBatchId query parameter parsing
```typescript
const uploadBatchId = req.query.uploadBatchId as string;
```

**Lines 120-123**: Added batch filter to where clause
```typescript
// Upload batch filter
if (uploadBatchId && uploadBatchId !== 'all') {
  where.uploadBatchId = uploadBatchId;
}
```

**Status**: Songs API now supports filtering by uploadBatchId

---

## Phase 4: Frontend - Batch Filter UI ✅ COMPLETE

### 4.1 Add Batch API Client ✅ COMPLETE
**File**: `client/src/lib/api.ts`

**Changes Made**:
```typescript
export interface UploadBatch {
  uploadBatchId: string;
  uploadBatchName: string;
  uploadDate: string;
  totalSongs: number;
  reviewedSongs: number;
  unreviewedSongs: number;
}

export async function getUploadBatches(): Promise<UploadBatch[]> {
  const response = await fetch('/api/songs/batches', {
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to fetch upload batches');
  }

  const data = await response.json();
  return data.batches;
}
```

### 4.2 Update FilterPanel Component ✅ COMPLETE
**File**: `client/src/components/FilterPanel.tsx`

**Changes Made**:
```typescript
const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
const [selectedBatch, setSelectedBatch] = useState<string>('all');
```

**Fetch Batches on Mount**:
```typescript
useEffect(() => {
  async function fetchBatches() {
    try {
      const batches = await getUploadBatches();
      setUploadBatches(batches);
    } catch (error) {
      console.error('Failed to load upload batches:', error);
    }
  }
  fetchBatches();
}, []);
```

**Add Batch Dropdown** (after existing filters):
```tsx
<div className="space-y-2">
  <label className="text-sm font-medium text-zinc-200">
    Upload Batch
  </label>
  <Select
    value={selectedBatch}
    onValueChange={(value) => {
      setSelectedBatch(value);
      onFilterChange({ uploadBatchId: value });
    }}
  >
    <SelectTrigger className="w-full">
      <SelectValue placeholder="All Uploads" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Uploads</SelectItem>
      {uploadBatches.map((batch) => (
        <SelectItem key={batch.uploadBatchId} value={batch.uploadBatchId}>
          {batch.uploadBatchName}
          <span className="text-xs text-zinc-400 ml-2">
            ({batch.totalSongs} songs, {formatDate(batch.uploadDate)})
          </span>
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

**Add Date Formatter**:
```typescript
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
```

### 4.3 Update SongsPage for State Management ✅ COMPLETE
**File**: `client/src/pages/SongsPage.tsx`

**Changes Made**:
```typescript
const [filters, setFilters] = useState({
  subgenre: searchParams.get('subgenre') || 'all',
  status: searchParams.get('status') || 'all',
  reviewStatus: searchParams.get('reviewStatus') || 'all',
  energy: searchParams.get('energy') || 'all',
  accessibility: searchParams.get('accessibility') || 'all',
  explicit: searchParams.get('explicit') || 'all',
  uploadBatchId: searchParams.get('uploadBatchId') || 'all',  // NEW
  search: searchParams.get('search') || '',
});
```

**URL updates automatically** when filter changes via existing `handleFilterChange` logic.

### 4.4 Update ExportModal (Optional Enhancement)
**File**: `client/src/components/ExportModal.tsx`

**Show batch context when filtered**:
```tsx
{filters.uploadBatchId && filters.uploadBatchId !== 'all' && (
  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
    <p className="text-sm text-blue-200">
      📦 Exporting from batch: <strong>{currentBatchName}</strong>
    </p>
  </div>
)}
```

**Default filename to batch name**:
```typescript
const defaultFilename = filters.uploadBatchId !== 'all'
  ? `${currentBatchName}-export-${timestamp}.csv`
  : `music-export-${timestamp}.csv`;
```

---

## Phase 5: Testing ⏳ PENDING

### 5.1 Backend Testing
```bash
# Test batches endpoint
curl -X GET http://localhost:3001/api/songs/batches \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: List of batches with names, counts, dates

# Test batch filtering
curl -X GET "http://localhost:3001/api/songs?uploadBatchId=BATCH_UUID" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Expected: Only songs from that batch
```

### 5.2 Frontend Testing Checklist
- [ ] Upload a CSV via web UI → Check batch name appears in dropdown
- [ ] Upload CSV via CLI → Check filename extracted correctly
- [ ] Select batch from dropdown → Verify only those songs show
- [ ] Check URL updates with `uploadBatchId` parameter
- [ ] Reload page → Verify filter persists
- [ ] Export with batch filter → Check filename includes batch name
- [ ] Clear filter ("All Uploads") → Verify all songs show again

### 5.3 Edge Cases to Test
- [ ] Batch with no name (null) → Should show "Unknown Upload"
- [ ] Very long batch names → Should truncate in dropdown
- [ ] Special characters in filename (apostrophes, spaces) → Should handle properly
- [ ] Multiple uploads with same name → Should show count/date to differentiate
- [ ] Batch filtering with other filters (subgenre + batch) → Should combine correctly

---

## Files Summary

### New Files (1)
- `api/songs/batches.ts` - Batch listing endpoint (PENDING)

### Modified Files (7)
- ✅ `prisma/schema.prisma` - Add uploadBatchName field (COMPLETE)
- ✅ `api/songs/upload.ts` - Capture filename from web uploads (COMPLETE)
- ⏳ `api/songs/index.ts` - Add batch filtering (PENDING)
- ⏳ `scripts/enrich-playlist.cjs` - Capture filename from CLI (PENDING)
- ⏳ `client/src/components/FilterPanel.tsx` - Add batch dropdown (PENDING)
- ⏳ `client/src/App.tsx` - Add batch to URL state (PENDING)
- ⏳ `client/src/lib/api.ts` - Add batch API client (PENDING)

### Optional Enhancements (1)
- ⏳ `client/src/components/ExportModal.tsx` - Show batch context (PENDING)

---

## Example Display

### Dropdown UI:
```
Upload Batch: [Dropdown ▼]
Options:
- All Uploads
- Anderson's 2026 (45 songs, Nov 12 2025)
- Sass Cafe Late Classics (120 songs, Nov 12 2025)
- Jazz & Piano (85 songs, Nov 10 2025)
```

### URL State:
```
/songs?uploadBatchId=abc-123-def&subgenre=Nu-Disco&reviewStatus=unreviewed
```

---

## Estimated Time: 2-3 hours
- ✅ Phase 1 (Database): 15 min - COMPLETE
- ✅ Phase 2 (Backend batch names - Web): 30 min - COMPLETE
- ⏳ Phase 2 (Backend batch names - CLI): 15 min - PENDING
- ⏳ Phase 3 (Backend API): 30 min - PENDING
- ⏳ Phase 4 (Frontend UI): 45 min - PENDING
- ⏳ Phase 5 (Testing): 30 min - PENDING

**Remaining Time**: ~2 hours

---

## Benefits

- ✅ Curators can filter songs by meaningful upload batch names
- ✅ Easy to review and export specific upload sessions
- ✅ Batch name automatically extracted from filename (no manual input)
- ✅ Works for both web uploads and CLI imports
- ✅ Integrates seamlessly with existing filter system
- ✅ Persists in URL for sharing and bookmarking
- ✅ Shows batch metadata (song count, date) in dropdown

---

## Next Steps

1. **Update CLI script** (`scripts/enrich-playlist.cjs`) to extract and store batch names
2. **Create batch listing endpoint** (`api/songs/batches.ts`)
3. **Add batch filtering** to songs API (`api/songs/index.ts`)
4. **Build frontend dropdown** in FilterPanel component
5. **Test end-to-end** with both web and CLI uploads

---

## Notes

- Batch names are nullable in database (existing songs without batch names will show as "Unknown Upload")
- Batch filtering combines with existing filters using AND logic
- Export functionality can optionally default filename to batch name when filtered
- Database index on `uploadBatchName` ensures efficient filtering queries
