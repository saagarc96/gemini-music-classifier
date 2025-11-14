# Fix Reprocess Errors Script - Implementation Plan

## Context

The `scripts/reprocess-errors.cjs` script was created to reprocess songs that failed during batch enrichment (aiStatus='ERROR'). However, the script has 5 critical bugs that prevent it from running correctly.

**Problem:** 78 songs failed during medium-priority-batch-4 due to high concurrency (10) causing Gemini to return markdown-formatted responses instead of pure JSON.

**Goal:** Fix the reprocess script to correctly query ERROR songs and retry classification with concurrency=5.

---

## Identified Bugs

### Bug 1: Incorrect Gemini Classifier Import (Line 10)
**Current:**
```javascript
const { classifySongWithGemini } = require('../src/classifiers/gemini-classifier.cjs');
```

**Problem:** Function `classifySongWithGemini` does not exist in the export

**Fix:** Change to correct export name
```javascript
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');
```

**Location:** scripts/reprocess-errors.cjs:10

---

### Bug 2: Incorrect Explicit Classifier Import (Line 11)
**Current:**
```javascript
const { classifyExplicit } = require('../src/classifiers/explicit-classifier.cjs');
```

**Problem:** Function `classifyExplicit` does not exist in the export

**Fix:** Change to correct export name
```javascript
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier.cjs');
```

**Location:** scripts/reprocess-errors.cjs:11

---

### Bug 3: Incorrect Gemini Function Call Signature (Lines 66-70)
**Current:**
```javascript
const geminiResult = await classifySongWithGemini({
  artist: song.artist,
  title: song.title,
  bpm: song.bpm
});
```

**Problem:**
1. Function name is wrong (should be `classifySong`)
2. Function signature is wrong - expects positional arguments, not object

**Correct Function Signature:**
```javascript
async function classifySong(artist, title, metadata = {})
```

**Fix:** Use correct function name and signature
```javascript
const geminiResult = await classifySong(song.artist, song.title, {
  bpm: song.bpm
});
```

**Location:** scripts/reprocess-errors.cjs:66-70

---

### Bug 4: Incorrect Explicit Result Field Mapping (Line 90)
**Current:**
```javascript
aiExplicit: explicitResult.explicit,
```

**Problem:** The explicit classifier returns `classification` field, not `explicit`

**Correct Result Structure:**
```javascript
{
  classification: 'Family Friendly' | 'Suggestive' | 'Explicit',
  status: 'SUCCESS' | 'ERROR'
}
```

**Fix:** Use correct field name
```javascript
aiExplicit: explicitResult.classification,
```

**Location:** scripts/reprocess-errors.cjs:90

---

### Bug 5: Incorrect Gemini Context Field Mapping (Line 92)
**Current:**
```javascript
aiContextUsed: geminiResult.context_used,
```

**Problem:** The Gemini classifier returns `context` field, not `context_used`

**Correct Result Structure:**
```javascript
{
  status: 'SUCCESS' | 'ERROR' | 'REQUIRES_HUMAN_REVIEW' | 'INVALID_INPUT',
  energy: string,
  accessibility: string,
  subgenre1: string,
  subgenre2: string,
  subgenre3: string,
  reasoning: string,
  context: string,  // <-- correct field name
  error_message: string
}
```

**Fix:** Use correct field name
```javascript
aiContextUsed: geminiResult.context,
```

**Location:** scripts/reprocess-errors.cjs:92

---

## Implementation Checklist

- [ ] **Fix Bug 1:** Update Gemini classifier import (line 10)
- [ ] **Fix Bug 2:** Update Explicit classifier import (line 11)
- [ ] **Fix Bug 3:** Update Gemini function call signature (lines 66-70)
- [ ] **Fix Bug 4:** Update explicit result field mapping (line 90)
- [ ] **Fix Bug 5:** Update Gemini context field mapping (line 92)
- [ ] **Test:** Run the script against medium-priority-batch-4 errors
- [ ] **Verify:** Check that all 78 error songs are successfully reprocessed
- [ ] **Document:** Update script comments with correct usage

---

## Testing Plan

After fixing all bugs:

1. **Test the script:**
   ```bash
   node scripts/reprocess-errors.cjs --batch-name=medium-priority-batch-4 --concurrency=5
   ```

2. **Expected output:**
   ```
   Found 78 songs with ERROR status

   Processing batch 1/16 (5 songs)...
     Reprocessing: Artist - Title
     ✓ Fixed: Artist - Title
   ...

   Summary:
   Total errors found: 78
   Successfully fixed: 78
   Still have errors: 0
   ```

3. **Verify in database:**
   - All 78 songs should have `aiStatus: 'SUCCESS'`
   - Should have valid energy, accessibility, and subgenre values
   - Should have reasoning and context fields populated

---

## Reference: Working Pattern from enrich-playlist.cjs

The `scripts/enrich-playlist.cjs` file (lines 247-276) shows the correct pattern:

```javascript
// Correct import
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');

// Correct function call
geminiResult = await classifySong(song.artist, song.title, {
  bpm: song.bpm,
  energy: song.energy
});

// Correct result mapping
aiEnergy: geminiResult?.energy || null,
aiAccessibility: geminiResult?.accessibility || null,
aiSubgenre1: geminiResult?.subgenre1 || null,
aiSubgenre2: geminiResult?.subgenre2 || null,
aiSubgenre3: geminiResult?.subgenre3 || null,
aiReasoning: geminiResult?.reasoning || null,
aiContextUsed: geminiResult?.context || null,  // <-- 'context', not 'context_used'
```

---

## Success Criteria

- [ ] Script runs without import errors
- [ ] Script correctly queries songs with ERROR status
- [ ] Script successfully calls Gemini and Parallel AI APIs
- [ ] Script correctly maps API results to database fields
- [ ] Script successfully updates database with new classifications
- [ ] All 78 error songs from batch 4 are reprocessed successfully
- [ ] Script can be reused for future error batches

---

## Next Steps After Fixing

1. Monitor Batch 4 completion (currently running with concurrency=10)
2. Run reprocess script on any additional errors
3. Continue with Batch 5 using concurrency=5 (not 10)
4. Complete remaining medium-priority batches (5-10)
5. Process low-priority playlists (104 playlists, 4,754 songs)
