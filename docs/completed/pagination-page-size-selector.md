# Pagination Page Size Selector - Implementation Plan

**Status**: Ready to Implement
**Created**: 2025-11-13
**Estimated Time**: ~10 minutes
**Complexity**: Low

## Goal
Allow users to choose how many songs to display per page (25, 50, or 100 items), replacing the current hardcoded 50-item limit.

## Current State
- **File**: `client/src/pages/SongsPage.tsx`
- **Line 42**: `const limit = 50;` (hardcoded constant)
- **Backend Support**: API already supports variable page sizes (min: 1, max: 200, default: 50)
- **Pagination UI**: Inline in SongsPage (lines 264-300), not a separate component

## Implementation Details

### 1. Add Import Statements
**File**: `client/src/pages/SongsPage.tsx`
**Location**: Top of file (around line 9-10)

**Add to existing imports**:
```typescript
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
```

**Context**: These are shadcn/ui components already used in FilterPanel.tsx

---

### 2. Convert Limit from Constant to State
**File**: `client/src/pages/SongsPage.tsx`
**Location**: Line 42

**Current Code**:
```typescript
const limit = 50;
```

**New Code**:
```typescript
const [limit, setLimit] = useState(50); // Default to 50 to maintain current behavior
```

**Why**: Need state to make limit reactive and trigger re-fetching when changed

---

### 3. Update useEffect Dependencies
**File**: `client/src/pages/SongsPage.tsx`
**Location**: Line 47

**Current Code**:
```typescript
}, [selectedSubgenre, selectedStatus, selectedReviewStatus, selectedEnergy, selectedAccessibility, selectedExplicit, selectedBatchId, searchQuery, currentPage, sortBy, sortOrder]);
```

**New Code**:
```typescript
}, [selectedSubgenre, selectedStatus, selectedReviewStatus, selectedEnergy, selectedAccessibility, selectedExplicit, selectedBatchId, searchQuery, currentPage, sortBy, sortOrder, limit]);
```

**Why**: When limit changes, need to re-fetch songs with new page size

---

### 4. Add Limit Change Handler
**File**: `client/src/pages/SongsPage.tsx`
**Location**: After `fetchSongs` function (around line 77)

**Add New Function**:
```typescript
const handleLimitChange = (newLimit: string) => {
  setLimit(parseInt(newLimit));
  setCurrentPage(1); // Reset to page 1 to avoid showing invalid page (e.g., page 5 of 2)
};
```

**Why**:
- Parse string to number (Select returns strings)
- Reset pagination to avoid edge case where user is on page 10 with 50 items, switches to 100 items, and now there are only 5 pages

---

### 5. Add Per-Page Selector UI
**File**: `client/src/pages/SongsPage.tsx`
**Location**: Lines 264-300 (inside pagination section)

**Current Pagination Structure**:
```typescript
{totalPages > 1 && (
  <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
    <div className="text-sm text-zinc-500">
      Page {currentPage} of {totalPages} • {totalSongs} total songs
    </div>
    <div className="flex gap-2">
      {/* Pagination buttons */}
    </div>
  </div>
)}
```

**New Pagination Structure** (replace entire section):
```typescript
{totalPages > 1 && (
  <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
    <div className="text-sm text-zinc-500">
      Page {currentPage} of {totalPages} • {totalSongs} total songs
    </div>

    <div className="flex items-center gap-4">
      {/* NEW: Per-page selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-zinc-400">Show:</span>
        <Select value={limit.toString()} onValueChange={handleLimitChange}>
          <SelectTrigger className="w-[130px] bg-zinc-950 border-zinc-700 text-zinc-100 h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-zinc-900 border-zinc-800">
            <SelectItem value="25" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
              25 per page
            </SelectItem>
            <SelectItem value="50" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
              50 per page
            </SelectItem>
            <SelectItem value="100" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
              100 per page
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Existing: Pagination buttons */}
      <div className="flex gap-2">
        <Button
          onClick={() => setCurrentPage(1)}
          disabled={currentPage === 1}
          variant="outline"
          size="sm"
          className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
        >
          First
        </Button>
        <Button
          onClick={() => setCurrentPage(currentPage - 1)}
          disabled={currentPage === 1}
          variant="outline"
          size="sm"
          className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
        >
          Previous
        </Button>
        <Button
          onClick={() => setCurrentPage(currentPage + 1)}
          disabled={currentPage === totalPages}
          variant="outline"
          size="sm"
          className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
        >
          Next
        </Button>
        <Button
          onClick={() => setCurrentPage(totalPages)}
          disabled={currentPage === totalPages}
          variant="outline"
          size="sm"
          className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
        >
          Last
        </Button>
      </div>
    </div>
  </div>
)}
```

**Key Details**:
- `value={limit.toString()}`: Select expects string values
- `onValueChange={handleLimitChange}`: Calls our handler which parses to int and resets page
- `w-[130px]`: Fixed width for selector (fits "100 per page" comfortably)
- `h-9`: Height matches pagination buttons for visual alignment
- Dark zinc theme matches existing FilterPanel styling
- Three options: 25, 50, 100 (50 is default)

---

## Visual Result

### Before:
```
┌─────────────────────────────────────────────────────────────┐
│ Page 1 of 10 • 500 total songs    [First] [Prev] [Next] [Last] │
└─────────────────────────────────────────────────────────────┘
```

### After:
```
┌──────────────────────────────────────────────────────────────────────┐
│ Page 1 of 10 • 500 total   Show: [50 per page ▼]   [First] [Prev] [Next] [Last] │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Behavior

### User Flow:
1. User opens songs page → sees 50 songs by default
2. User selects "100 per page" from dropdown
3. Page automatically resets to 1
4. API fetches 100 songs for page 1
5. Pagination updates (e.g., "Page 1 of 5" instead of "Page 1 of 10")

### Edge Cases Handled:
- ✅ User on page 10 with 50/page switches to 100/page → resets to page 1 (avoids invalid page)
- ✅ User changes limit while filtering → maintains filters, just changes page size
- ✅ Backend enforces max 200, so 100 is safe
- ✅ Selection persists during session (but not across page reloads - could add localStorage later)

---

## Testing Checklist

### Manual Testing:
- [ ] Default loads 50 items per page
- [ ] Selecting "25 per page" shows 25 items
- [ ] Selecting "100 per page" shows 100 items
- [ ] Changing limit resets to page 1
- [ ] Pagination controls update correctly (totalPages recalculates)
- [ ] Works with filters applied (subgenre, energy, etc.)
- [ ] Works with search query
- [ ] Works with batch filter
- [ ] Dropdown styling matches FilterPanel (dark zinc theme)
- [ ] Dropdown is properly aligned with pagination buttons

### Edge Cases:
- [ ] User on last page (e.g., page 10) switches to larger limit → goes to page 1
- [ ] Total songs < selected limit (e.g., 40 songs with 100/page) → shows all on page 1
- [ ] Switching rapidly between limits → no race conditions

---

## Files Modified

### Primary:
- `client/src/pages/SongsPage.tsx` (~40 lines changed)
  - Add imports (6 lines)
  - Change limit to state (1 line)
  - Update useEffect deps (1 line)
  - Add handler (4 lines)
  - Update pagination UI (~30 lines)

### No Changes Needed:
- ✅ `client/src/lib/api.ts` - already supports variable limit
- ✅ `api/songs/index.ts` - already supports variable limit (max 200)
- ✅ UI components - Select already exists in shadcn/ui

---

## Backend Compatibility

From `api/songs/index.ts` (line 46):
```typescript
const limit = Math.min(200, Math.max(1, parseInt(req.query.limit as string) || 50));
```

- ✅ Min: 1 (we're using 25)
- ✅ Max: 200 (we're using 100)
- ✅ Default: 50 (matches our default)

**Conclusion**: Fully compatible, no backend changes needed

---

## Future Enhancements (Not in Scope)

- Persist selection in localStorage (currently resets on page reload)
- Add "All" option (requires backend changes - 200 max)
- Add custom input for arbitrary page sizes
- Show "Showing X-Y of Z songs" text instead of just "X total songs"
- Keyboard shortcuts for changing page size

---

## Implementation Order

1. Add imports
2. Convert limit to state
3. Update useEffect dependencies
4. Add handleLimitChange function
5. Update pagination UI
6. Test manually
7. Commit changes

**Total Time**: ~10 minutes
