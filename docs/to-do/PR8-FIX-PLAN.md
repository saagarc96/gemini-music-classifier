# PR #8 Fix Plan: Multi-Select Filters & CSV Upload Improvements

**Created:** 2025-11-28
**PR:** #8 (feature/csv-upload-improvements)
**Status:** Needs fixes before merge

---

## Priority 1: Critical Security Issues

### 1.1 Add Authentication to Upload Endpoint

**File:** `api/songs/upload.ts`
**Line:** ~170

**Current:**
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // No auth check - SECURITY VULNERABILITY
```

**Fix:**
```typescript
import { requireAuth } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return; // requireAuth already sent 401 response
  }
```

**Effort:** 5 minutes

---

### 1.2 Add Authentication to Upload-Status Endpoint

**File:** `api/songs/upload-status.ts`
**Line:** ~26

**Current:**
```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  // No auth check
```

**Fix:**
```typescript
import { requireAuth } from '../../lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await requireAuth(req, res);
  if (!user) {
    return;
  }
```

**Effort:** 5 minutes

---

## Priority 2: Important Issues

### 2.1 Fix Progress Polling Race Condition

**File:** `client/src/components/UploadModal.tsx`
**Lines:** 151-170

**Problem:** `progress.total` in effect dependencies causes interval recreation mid-poll.

**Current:**
```typescript
useEffect(() => {
  if (uploadState !== 'uploading' || !batchId) return;

  const interval = setInterval(async () => {
    // ...
    setProgress({
      current: status.processed,
      total: status.total || progress.total  // Changes progress.total
    });
  }, 1000);

  return () => clearInterval(interval);
}, [uploadState, batchId, progress.total]);  // progress.total causes re-runs
```

**Fix:**
```typescript
useEffect(() => {
  if (uploadState !== 'uploading' || !batchId) return;

  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/songs/upload-status?batchId=${batchId}`);
      if (response.ok) {
        const status = await response.json();
        setProgress(prev => ({
          current: status.processed,
          total: status.total || prev.total
        }));
      }
    } catch (error) {
      console.error('Progress poll error:', error);
    }
  }, 1000);

  return () => clearInterval(interval);
}, [uploadState, batchId]);  // Remove progress.total
```

**Effort:** 10 minutes

---

### 2.2 Add File Size Limit to Upload

**File:** `api/songs/upload.ts`
**Line:** ~99

**Current:**
```typescript
const form = formidable({ multiples: false });
```

**Fix:**
```typescript
const form = formidable({
  multiples: false,
  maxFileSize: 5 * 1024 * 1024  // 5MB limit
});
```

Also add error handling for file too large:
```typescript
form.parse(req, async (err, fields, files) => {
  if (err) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    return res.status(400).json({ error: `Failed to parse upload: ${err.message}` });
  }
  // ... rest
});
```

**Effort:** 10 minutes

---

### 2.3 Validate batchId Format

**File:** `api/songs/upload-status.ts`
**Lines:** 31-35

**Current:**
```typescript
const { batchId } = req.query;

if (!batchId || typeof batchId !== 'string') {
  return res.status(400).json({ error: 'batchId is required' });
}
// Proceeds directly to DB query
```

**Fix:**
```typescript
const { batchId } = req.query;

if (!batchId || typeof batchId !== 'string') {
  return res.status(400).json({ error: 'batchId is required' });
}

// Validate UUID format
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
if (!uuidRegex.test(batchId)) {
  return res.status(400).json({ error: 'Invalid batchId format' });
}
```

**Effort:** 5 minutes

---

### 2.4 Wrap Playlist Association in Try-Catch

**File:** `api/songs/upload.ts`
**Lines:** 246-252

**Current:**
```typescript
// Create playlist association for skipped song
await prisma.playlistSong.create({
  data: {
    playlistId: playlist.id,
    songIsrc: song.isrc,
    wasNew: false
  }
});
```

**Fix:**
```typescript
// Create playlist association for skipped song
try {
  await prisma.playlistSong.create({
    data: {
      playlistId: playlist.id,
      songIsrc: song.isrc,
      wasNew: false
    }
  });
} catch (error: any) {
  // Ignore duplicate key errors (already associated)
  if (error.code !== 'P2002') {
    console.error(`Failed to create playlist association for ${song.isrc}:`, error.message);
  }
}
```

**Effort:** 5 minutes

---

### 2.5 Add Warning for Poll Failures

**File:** `client/src/components/UploadModal.tsx`
**Lines:** 164-166

**Current:**
```typescript
} catch (error) {
  console.error('Progress poll error:', error);
}
```

**Fix:** Add state to track failures and show warning:

```typescript
const [pollFailures, setPollFailures] = useState(0);

// In the useEffect polling interval:
} catch (error) {
  console.error('Progress poll error:', error);
  setPollFailures(prev => {
    const newCount = prev + 1;
    if (newCount === 3) {
      toast.warning('Unable to track progress. Upload may still be processing.');
    }
    return newCount;
  });
}

// Reset on successful poll:
if (response.ok) {
  setPollFailures(0);
  // ... rest
}

// Reset in handleUploadAnother and handleClose:
setPollFailures(0);
```

**Effort:** 15 minutes

---

## Priority 3: Spotify Error Visibility

### 3.1 Track and Report Spotify Failures

**File:** `api/songs/upload.ts`
**Lines:** 60-95

**Current:** Spotify errors logged but swallowed.

**Fix:** Return Spotify failures in response for user visibility.

```typescript
interface SpotifyResult {
  trackData: Map<string, any>;
  failures: Array<{ trackId: string; error: string }>;
}

async function fetchSpotifyTrackData(trackIds: string[]): Promise<SpotifyResult> {
  const trackData = new Map<string, any>();
  const failures: Array<{ trackId: string; error: string }> = [];

  // ... existing logic but track failures:
  if (!response.ok) {
    console.error(`Spotify API error: ${response.statusText}`);
    batch.forEach(id => failures.push({ trackId: id, error: response.statusText }));
    continue;
  }

  // Return both data and failures
  return { trackData, failures };
}
```

Update response to include:
```typescript
return res.status(200).json({
  // ... existing fields
  spotifyWarnings: spotifyResult.failures.length > 0
    ? `${spotifyResult.failures.length} songs missing preview/artwork`
    : undefined
});
```

**Effort:** 30 minutes

---

## Priority 4: Quality Improvements

### 4.1 Reset Document Title on Modal Close

**File:** `client/src/components/UploadModal.tsx`
**Line:** 296 (handleClose function)

**Fix:** Add title reset:
```typescript
const handleClose = () => {
  document.title = 'Music Classifier';  // Add this line
  setSelectedFile(null);
  // ... rest
};
```

**Effort:** 2 minutes

---

### 4.2 Add Cleanup to FilterPanel Effects

**File:** `client/src/components/FilterPanel.tsx`
**Lines:** 76-103

**Fix:** Add AbortController pattern:
```typescript
useEffect(() => {
  let cancelled = false;

  async function fetchBatches() {
    try {
      const batches = await getUploadBatches();
      if (!cancelled) {
        // ... set state
      }
    } catch (error) {
      if (!cancelled) {
        console.error('Failed to load upload batches:', error);
      }
    }
  }

  fetchBatches();
  return () => { cancelled = true; };
}, []);
```

**Effort:** 10 minutes

---

### 4.3 Track Invalid CSV Rows

**File:** `api/songs/upload.ts`
**Lines:** 398-410

**Fix:** Track and return skipped rows:
```typescript
const songs: CsvSong[] = [];
const invalidRows: Array<{ row: number; reason: string }> = [];
let rowNumber = 1;

.on('data', (row) => {
  rowNumber++;
  const artist = row['Artist'] || row['artist'] || '';
  const title = row['Title'] || row['Song'] || row['title'] || row['song'] || '';

  if (!artist || !title) {
    invalidRows.push({
      row: rowNumber,
      reason: !artist ? 'Missing artist' : 'Missing title'
    });
    return;
  }

  songs.push({ ... });
})

// Include in response:
return res.status(200).json({
  // ... existing fields
  invalidRows: invalidRows.length > 0 ? invalidRows : undefined
});
```

**Effort:** 15 minutes

---

### 4.4 Improve API Error Response Handling

**File:** `client/src/lib/api.ts`
**Lines:** 127-129

**Current:**
```typescript
const error = await response.json().catch(() => ({ error: 'Failed to fetch songs' }));
```

**Fix:**
```typescript
let errorMessage = `Request failed with status ${response.status}`;
try {
  const error = await response.json();
  errorMessage = error.error || error.message || errorMessage;
} catch {
  // Non-JSON response (502, HTML error pages, etc.)
  const text = await response.text().catch(() => '');
  if (text) {
    console.error('Non-JSON error response:', text.substring(0, 500));
  }
}
throw new Error(errorMessage);
```

**Effort:** 10 minutes

---

## Priority 5: Type Improvements (Optional)

### 5.1 Convert UploadState to Discriminated Union

**File:** `client/src/components/UploadModal.tsx`

**Current:**
```typescript
type UploadState = 'idle' | 'uploading' | 'complete';
const [uploadState, setUploadState] = useState<UploadState>('idle');
const [result, setResult] = useState<UploadResult | null>(null);
```

**Consider:** Bundling state with associated data:
```typescript
type UploadState =
  | { status: 'idle' }
  | { status: 'uploading'; batchId: string }
  | { status: 'complete'; result: UploadResult }
  | { status: 'error'; error: string };
```

**Effort:** 45 minutes (significant refactor)
**Recommendation:** Defer to future PR

---

### 5.2 Add Generic Types to MultiSelect

**File:** `client/src/components/ui/multi-select.tsx`

**Consider:**
```typescript
export interface MultiSelectOption<T extends string = string> {
  value: T;
  label: string;
}

interface MultiSelectProps<T extends string = string> {
  options: MultiSelectOption<T>[];
  selected: T[];
  onChange: (values: T[]) => void;
  // ...
}
```

**Effort:** 30 minutes
**Recommendation:** Defer to future PR

---

## Implementation Checklist

### Must Fix (Before Merge)
- [ ] 1.1 Add auth to upload endpoint
- [ ] 1.2 Add auth to upload-status endpoint

### Should Fix (Before Merge)
- [ ] 2.1 Fix progress polling race condition
- [ ] 2.2 Add file size limit
- [ ] 2.3 Validate batchId format
- [ ] 2.4 Wrap playlist association in try-catch
- [ ] 2.5 Add warning for poll failures

### Nice to Have (Can Merge Without)
- [ ] 3.1 Track Spotify failures in response
- [ ] 4.1 Reset document title on modal close
- [ ] 4.2 Add cleanup to FilterPanel effects
- [ ] 4.3 Track invalid CSV rows
- [ ] 4.4 Improve API error response handling

### Future PR
- [ ] 5.1 Convert UploadState to discriminated union
- [ ] 5.2 Add generic types to MultiSelect

---

## Estimated Total Effort

| Priority | Items | Time |
|----------|-------|------|
| Critical (P1) | 2 | 10 min |
| Important (P2) | 5 | 45 min |
| Spotify (P3) | 1 | 30 min |
| Quality (P4) | 4 | 37 min |
| **Total** | **12** | **~2 hours** |

Type improvements (P5) deferred to future work.
