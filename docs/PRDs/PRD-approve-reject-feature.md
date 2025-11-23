# PRD: Approve/Reject Feature

**Created:** November 20, 2025
**Status:** Draft
**Owner:** Product Team
**Based on:** Danny & MB Check-In Call (Nov 20, 2025)

---

## Executive Summary

Add approve/reject workflow to the music classification review interface, enabling **admins** to explicitly approve or reject AI-classified songs during batch review. This addresses the current limitation where reviewers can't "trash" unwanted songs from imported playlists. Rejected songs are permanently excluded from exports and future imports.

---

## Current State Analysis

### What Already Exists

- ✅ Database has `reviewed` boolean, `reviewedBy`, `reviewedById`, `reviewedAt`, `curatorNotes`
- ✅ User authentication with ADMIN/CURATOR roles
- ✅ ReviewModal shows who's reviewing and previous reviewer
- ✅ FilterPanel has "Review Status" (All, Unreviewed Only, Reviewed Only)
- ✅ SongTable shows reviewed status with checkmark and reviewer name
- ✅ "Save & Next" button for rapid review workflow

### What's Missing

- ❌ **Can't explicitly reject/trash songs** - only approve (save) or skip (cancel)
- ❌ **No distinction** between "reviewed and approved" vs "reviewed and rejected"
- ❌ **Can't filter** by approved vs rejected songs
- ❌ **Export doesn't exclude** rejected songs

---

## Problem Statement

**From call (lines 162-164):**

> **Michaela:** "I was looking through some of the Christmas stuff, there was like one list from Spotify that I basically just like copied like the majority of songs over, but then there were some that I like actually didn't want. And I couldn't figure out how to like Trash those."

**Current Workflow Pain Points:**
1. Curator imports Spotify playlist with 100 songs
2. AI enriches all 100 songs
3. Curator reviews in interface
4. Some songs are good, some are bad
5. **Problem:** Can only save approved songs - no way to mark bad ones as rejected
6. **Workaround:** Must manually skip bad songs, then remember which ones to exclude from export

**Proposed Solution (lines 166-169):**

> **Saagar:** "I'm almost thinking we can just have like a column of like approved and rejected or like ready for review."
> **Michaela:** "Yeah if we can reject songs then I think reviewing it here would be totally fine."

---

## Goals

### Primary Goals
1. Enable **admins** to explicitly **approve or reject** songs during review
2. Prevent rejected songs from being exported to client playlists
3. Prevent rejected songs from being re-imported via CSV
4. Track **why songs were rejected** via curator notes
5. Filter songs by **approval status** (pending/approved/rejected)

### Secondary Goals
- Maintain fast review workflow with streamlined UI
- Preserve audit trail of who approved/rejected what and when
- Support changing decisions (re-review)

### Non-Goals (Future Phases)
- Keyboard shortcuts (will add based on user feedback)
- Team lead override functionality
- Bulk approve/reject operations
- Analytics dashboard on rejection rates
- Smart playlist review queues (separate feature)

---

## Feature Specification

### 1. Database Schema Changes

Add ONE new field to the `Song` model:

```prisma
model Song {
  // ... existing fields

  reviewDecision   String?   @default("PENDING") @map("review_decision") @db.VarChar(20)
  // Values: "PENDING" | "APPROVED" | "REJECTED"

  // Keep existing fields for backward compatibility:
  reviewed         Boolean   @default(false)
  reviewedBy       String?   @map("reviewed_by")
  reviewedById     String?   @map("reviewed_by_id")
  reviewedAt       DateTime? @map("reviewed_at")
  curatorNotes     String?   @map("curator_notes")

  @@index([reviewDecision], map: "idx_review_decision")
}
```

**Why keep `reviewed` boolean?**
- Backward compatibility with existing queries
- `reviewed=true` means "I looked at this"
- `reviewDecision` tracks the actual decision (approved/rejected)

**Migration Strategy:**
```sql
-- Add column with default
ALTER TABLE songs ADD COLUMN review_decision VARCHAR(20) DEFAULT 'PENDING';

-- Backfill existing data: All reviewed songs are marked as approved
UPDATE songs SET review_decision = 'APPROVED' WHERE reviewed = true;
UPDATE songs SET review_decision = 'PENDING' WHERE reviewed = false;

-- Add index
CREATE INDEX idx_review_decision ON songs(review_decision);
```

**Rationale for backfill:** Since there was no explicit reject option before, any song marked as `reviewed=true` was implicitly approved for use.

---

### 2. ReviewModal Changes

#### UI Layout Changes

**Move approve/reject to top near audio player** for faster workflow:

```
┌─────────────────────────────────────────────┐
│  [Song artwork]  Title - Artist             │
│  [Audio Player =================== 1:23]    │
│                                             │
│  Review Decision:                           │
│  [Approve & Next] [Reject]                  │
│                                             │
│  ─────────────────────────────────────────  │
│                                             │
│  Energy: [dropdown]                         │
│  Accessibility: [dropdown]                  │
│  Explicit: [dropdown]                       │
│  Subgenre 1: [dropdown]                     │
│  Subgenre 2: [dropdown]                     │
│  Subgenre 3: [dropdown]                     │
│  Curator Notes: [textarea]                  │
│                                             │
│  [Cancel] [Save Metadata]                   │
└─────────────────────────────────────────────┘
```

**This separates two workflows:**
1. **Review Decision** (top) - Quick approve/reject based on listening
2. **Metadata Editing** (bottom) - Detailed AI classification corrections

#### Button Behaviors

| Button | Action | Database Updates |
|--------|--------|------------------|
| **Approve & Next** | Mark approved, go to next song | `reviewDecision='APPROVED'`<br>`reviewed=true`<br>`reviewedBy=<user>`<br>`reviewedAt=<now>` |
| **Reject** | Mark rejected, go to next song | `reviewDecision='REJECTED'`<br>`reviewed=true`<br>`reviewedBy=<user>`<br>`reviewedAt=<now>` |
| **Save Metadata** | Save AI field changes only | Update AI fields only<br>(doesn't change review decision) |
| **Cancel** | Close modal, no changes | Nothing |

#### Rejection Flow

When admin clicks **Reject**:
1. Auto-expand curator notes section (currently collapsed)
2. Focus textarea with placeholder: "Why are you rejecting this song? (optional but recommended)"
3. On save, mark as rejected and go to next pending song

#### Keyboard Shortcuts

**Not included in MVP** - will be added in future iteration based on user feedback.

#### Visual Design Notes

**Button Styling** (using inline styles per CLAUDE.md guidelines):

```tsx
// Approve & Next button (primary action)
style={{ backgroundColor: '#16a34a', color: '#ffffff' }}

// Reject button (destructive action)
style={{ backgroundColor: '#7f1d1d', color: '#ef4444' }}

// Save Metadata button (secondary action)
style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}

// Cancel button
style={{ backgroundColor: '#27272a', color: '#a1a1aa', borderColor: '#3f3f46' }}
```

**Permission-Based UI:**
- If user role is CURATOR: Hide approve/reject buttons, show read-only badge "Admin review required"
- If user role is ADMIN: Show full approve/reject interface

---

### 3. FilterPanel Updates

#### Current Review Status Filter
```tsx
<Select value={selectedReviewStatus} onValueChange={onReviewStatusChange}>
  <SelectItem value="all">All</SelectItem>
  <SelectItem value="unreviewed">Unreviewed Only</SelectItem>
  <SelectItem value="reviewed">Reviewed Only</SelectItem>
</Select>
```

#### New Review Status Filter
```tsx
<Select value={selectedReviewStatus} onValueChange={onReviewStatusChange}>
  <SelectItem value="all">All</SelectItem>
  <SelectItem value="pending">Pending Review</SelectItem>
  <SelectItem value="approved">Approved</SelectItem>
  <SelectItem value="rejected">Rejected</SelectItem>
</Select>
```

#### Default Filter Behavior
- **On app load:** Default to `reviewDecision='pending'` (show songs needing review)
- **After approving all pending:** Auto-switch to "All" view
- **Export button:** Show count of approved songs in button text

---

### 4. SongTable Visual Updates

#### Update "Reviewed By" Column

**Current:**
```tsx
{song.reviewed && song.reviewed_by ? (
  <Check className="w-4 h-4 text-emerald-400" />
  <span>{song.reviewed_by}</span>
) : (
  <span>—</span>
)}
```

**New:**
```tsx
{song.review_decision === 'APPROVED' && (
  <div className="flex items-start gap-2">
    <Check className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
    <div className="text-sm">
      <div className="text-zinc-300">{song.reviewed_by}</div>
      <div className="text-zinc-500 text-xs">{formatDate(song.reviewed_at)}</div>
    </div>
  </div>
)}

{song.review_decision === 'REJECTED' && (
  <div className="flex items-start gap-2">
    <X className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
    <div className="text-sm">
      <div className="text-zinc-400">{song.reviewed_by}</div>
      <div className="text-zinc-500 text-xs">{formatDate(song.reviewed_at)}</div>
      {song.curator_notes && (
        <div className="text-xs text-zinc-600 italic truncate max-w-[150px]"
             title={song.curator_notes}>
          "{song.curator_notes}"
        </div>
      )}
    </div>
  </div>
)}

{song.review_decision === 'PENDING' && (
  <span className="text-zinc-600">Pending...</span>
)}
```

**Visual Indicators:**
- ✅ Green checkmark = Approved
- ❌ Red X = Rejected (with rejection note preview on hover)
- ⏱️ Gray "Pending..." = Needs review

---

### 5. Export Behavior

#### API Changes (`GET /api/songs/export`)

**Default Query Params:**
```
?reviewDecision=APPROVED  // Only export approved by default
```

**Allow Override:**
```
?reviewDecision=APPROVED,PENDING  // Multiple statuses (comma-separated)
?reviewDecision=all              // Export everything (for analysis)
```

#### UI Updates

**Export Button:**
```tsx
<Button
  onClick={onExport}
  disabled={approvedCount === 0}
  className="bg-blue-600 hover:bg-blue-700 text-white"
>
  <FileDown className="w-4 h-4 mr-2" />
  Export CSV ({approvedCount} approved)
</Button>
```

**Export Confirmation (if rejected songs exist):**
```
┌────────────────────────────────────────────┐
│  Export Songs                              │
│                                            │
│  ✓ 247 approved songs                      │
│  ⏱ 12 pending review                       │
│  ✗ 8 rejected songs                        │
│                                            │
│  Export approved songs only?               │
│  [Cancel] [Export Approved Only]           │
│                                            │
│  Advanced: Include pending/rejected songs  │
└────────────────────────────────────────────┘
```

---

### 6. Constants Update

**File:** `client/src/data/constants.ts`

```typescript
export const REVIEW_DECISIONS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];
```

---

## Implementation Plan

### Phase 1: Core Approve/Reject (1 week)

**Day 1-2: Database & Backend**
1. Create Prisma migration for `review_decision` column
2. Run migration with backfill script
3. Update `api/songs/` endpoints:
   - `PATCH /songs/:isrc` - accept `review_decision` field
   - `GET /songs` - filter by `review_decision`
   - `GET /songs/export` - default to `APPROVED` only
4. Update CSV import logic:
   - Check incoming ISRCs against rejected songs
   - Exclude rejected songs from import
   - Show warning during import preview

**Day 3-4: Frontend Core**
1. Update `constants.ts` with `REVIEW_DECISIONS`
2. Update `lib/api.ts` - add `review_decision` to Song type
3. Update `ReviewModal.tsx`:
   - Move approve/reject buttons to top near audio player
   - Separate "Review Decision" section from "Metadata Editing"
   - Add "Save Metadata" button for AI field updates
   - Auto-expand notes on Reject
   - Add permission check (Admin only for approve/reject)
4. Update `FilterPanel.tsx`:
   - Change review status dropdown options
   - Set default to "Pending Review"

**Day 5: Frontend Polish**
1. Update `SongTable.tsx`:
   - Show approval/rejection badges
   - Display rejection notes on hover
2. Update export button to show approved count
3. Add export confirmation if rejected songs exist

**Testing:**
- ✅ Approve flow works for Admin users
- ✅ Reject flow (notes expand, saves properly)
- ✅ Save Metadata works independently of review decision
- ✅ Curator users cannot see approve/reject buttons
- ✅ Admin users see full interface
- ✅ Filtering by pending/approved/rejected
- ✅ Export only exports approved songs
- ✅ Re-review (changing decision) works
- ✅ Rejected songs excluded from CSV re-import
- ✅ Pagination persists filter state

---

## Edge Cases & Solutions

### 1. Changing Decision After Review

**Scenario:** Admin approves song, then realizes it should be rejected

**Solution:**
- Allow re-opening modal and changing decision
- Last decision wins (no conflict resolution needed for MVP)
- Show subtle warning:
  ```
  ⚠️ This song was previously approved on Nov 20
  ```

### 2. CSV Re-Import with Rejected Songs

**Scenario:** Re-importing CSV that contains previously rejected songs

**Solution:**
- **Rejected songs are automatically excluded from import**
- During import preview, show:
  ```
  ⚠️ 7 songs were previously rejected and will be skipped:
    • Song A (rejected by Admin on Nov 18: "Too cheesy")
    • Song B (rejected by Admin on Nov 19: "Wrong vibe")
    ...

  [View Full List] [Continue Import]
  ```
- This prevents rejected songs from re-entering the workflow

### 3. CSV Re-Import with Approved Songs

**Scenario:** Re-importing CSV with songs that were already approved

**Solution:**
During import review step, show conflict summary:
```
ℹ️ 38 songs were already approved and reviewed:
  • Keep existing metadata (recommended)
  • Update metadata from new CSV
  • Skip these songs entirely
```

### 4. Rejected Song Accidentally Exported

**Scenario:** User manually overrides to export rejected songs

**Solution:**
- Require explicit confirmation
- Add warning badge in export CSV filename: `export_2025-11-20_includes-rejected.csv`
- Log export events for audit trail

### 5. No Curator Notes on Rejection

**Scenario:** Curator rejects without adding notes

**Solution:**
- Allow it (notes are optional)
- Encourage with placeholder: "Why are you rejecting this song?"
- Track rejection rate without notes as metric

### 6. Concurrent Review

**Scenario:** Two curators review same song simultaneously

**Solution:**
- Last write wins (acceptable for MVP)
- Show warning on save: "This song was just reviewed by Michaela. Your changes will override."
- Future: Add optimistic locking with version numbers

---

## API Specification

### PATCH /api/songs/:isrc

**Request Body:**
```typescript
interface UpdateSongRequest {
  // Existing fields
  ai_energy?: string;
  ai_accessibility?: string;
  ai_explicit?: string;
  ai_subgenre_1?: string;
  ai_subgenre_2?: string | null;
  ai_subgenre_3?: string | null;
  curator_notes?: string | null;

  // New fields
  review_decision?: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewed?: boolean;
  reviewed_at?: string; // ISO 8601 datetime
}
```

**Response:**
```typescript
{
  "id": 123,
  "isrc": "USRC12345678",
  "review_decision": "APPROVED",
  "reviewed": true,
  "reviewed_by": "Danny K.",
  "reviewed_at": "2025-11-20T15:30:00Z",
  // ... other fields
}
```

### GET /api/songs

**Query Parameters:**
```
?reviewDecision=PENDING          // Filter by single status
?reviewDecision=APPROVED,PENDING // Filter by multiple (comma-separated)
?reviewDecision=all              // No filter (show all)
```

### GET /api/songs/export

**Query Parameters:**
```
?reviewDecision=APPROVED  // Default: only approved
?includeReviewData=true   // Include review_decision, reviewed_by, curator_notes columns
```

**CSV Output (with includeReviewData=true):**
```csv
ISRC,Title,Artist,Energy,Accessibility,Subgenre1,ReviewDecision,ReviewedBy,ReviewNotes
USRC123,Song A,Artist,High,Eclectic,2020s Pop,APPROVED,Danny K.,
USRC456,Song B,Artist,Low,Cheesy,Christmas Pop,REJECTED,Michaela,Too cheesy for our brand
```

---

## Success Metrics

### Quantitative
- **Adoption:** 100% of curators using approve/reject within 1 week
- **Efficiency:** 50% reduction in time spent on batch review
- **Rejection Rate:** Stabilizes between 5-15% (indicates AI quality)
- **Zero Incidents:** No rejected songs accidentally exported to clients

### Qualitative
- Curators report increased confidence in output quality
- Team leads have visibility into rejection reasons
- Reduction in manual Spotify playlist copying

---

## Out of Scope (Future Phases)

### Phase 2: Team Lead Features (2-3 weeks)
- Override curator decisions
- Bulk approve/reject
- Rejection review queue
- Send back for re-review

### Phase 3: Analytics & Insights (2-3 weeks)
- Rejection rate by curator
- Rejection rate by subgenre
- Common rejection reasons (word cloud)
- AI accuracy dashboard
- Review velocity metrics

### Future: Smart Playlist Review Queues
- Auto-matching songs to playlists
- Queue-based approval workflow
- Confidence scores for auto-approval
- (Mentioned in call but separate feature)

---

## Decisions Made

1. **Permissions:** Admin only for MVP
   - Only users with `role='ADMIN'` can approve/reject
   - Curators can view review decisions but not change them
   - Will expand to curators in Phase 2 based on workflow needs

2. **Bulk Actions:** Not in MVP
   - Encourage careful, individual review
   - Add in Phase 2 if needed

3. **Rejection Permanence:** Rejected songs cannot be re-classified
   - AI enrichment skips songs with `review_decision='REJECTED'`
   - Rejected songs are excluded from CSV re-imports
   - Admin can manually change decision if needed (rare edge case)

4. **Notes Requirement:** Optional but encouraged
   - Not required for MVP
   - Track completion rate as quality metric

---

## Timeline

- **Database Migration:** 1 day
- **Backend API:** 1-2 days
- **Frontend Core:** 2 days
- **Frontend Polish:** 1 day
- **Testing:** 1 day

**Total:** 5-7 business days (1 week)

---

## Appendices

### A. User Roles

| Role | Permissions |
|------|-------------|
| **CURATOR** | View songs, view review decisions, edit metadata (cannot approve/reject) |
| **ADMIN** | All curator permissions + approve/reject songs, export approved songs, user management |
| **Team Lead** (future) | Override decisions, bulk actions, analytics |

### B. State Transition Diagram

```
┌─────────┐
│ PENDING │ (default on import)
└────┬────┘
     │
     ├─ Approve ──→ ┌──────────┐
     │              │ APPROVED │
     │              └──────────┘
     │
     └─ Reject ───→ ┌──────────┐
                    │ REJECTED │
                    └──────────┘

Can re-review and change between APPROVED ↔ REJECTED at any time
```

### C. Related Features

- **Upload Batch Filter** (already implemented) - Filter by upload batch
- **Smart Playlists** (future) - Auto-matching with review queue
- **Curator Analytics** (future) - Track performance and quality

---

## References

- **Call Recording:** Danny & MB Check-In (Nov 20, 2025)
- **Current Schema:** `prisma/schema.prisma`
- **Review Modal:** `client/src/components/ReviewModal.tsx`
- **Filter Panel:** `client/src/components/FilterPanel.tsx`
- **Song Table:** `client/src/components/SongTable.tsx`
