# PRD: Approve/Reject Feature - REVISED

> **Revision Date:** 2025-01-25
> **Status:** Implementation In Progress
> **Original PRDs:** `PRD-approve-reject-feature.md`, `PRD-approve-reject-UI-BRIEF.md`

---

## Implementation Status (Updated 2025-11-25)

| Phase | Status | Notes |
|-------|--------|-------|
| **Phase 1: Database & API** | ✅ Complete | Migration created, API endpoints updated |
| **Phase 2: Frontend - Filtering** | ✅ Complete | Filter added to FilterPanel, SongsPage updated |
| **Phase 3: Frontend - ReviewModal** | ✅ Complete | Approve/Reject buttons, undo toast, admin-only visibility |
| **Phase 4: Frontend - Visual Indicators** | ✅ Complete | Row background tinting implemented |
| **Phase 5: Import Scripts** | ⏳ Pending | Still needs implementation |

### Files Modified
- `prisma/schema.prisma` - Added approvalStatus, approvedBy, approvedById, approvedAt fields
- `prisma/migrations/2_add_approval_workflow/migration.sql` - Migration file
- `api/songs/index.ts` - Added approvalStatus filter
- `api/songs/[isrc].ts` - Added approval logic with admin check
- `api/songs/export.ts` - Default to approved-only export
- `client/src/data/constants.ts` - Added APPROVAL_STATUSES, APPROVAL_STATUS_LABELS
- `client/src/lib/api.ts` - Updated Song interface and GetSongsParams
- `client/src/components/FilterPanel.tsx` - Added Approval Status dropdown
- `client/src/components/ReviewModal.tsx` - Added Approve/Reject buttons
- `client/src/components/SongTable.tsx` - Added row background tinting
- `client/src/pages/SongsPage.tsx` - Added approval status state and handlers

---

## Summary of Decisions

| Decision | Choice |
|----------|--------|
| Rejection flow | Single-click + 5-second undo toast |
| End of queue behavior | Auto-switch filter to "All" |
| Save Metadata behavior | Close modal after saving |
| Curator permissions | Can edit AI fields, cannot approve/reject |
| Schema design | Keep `reviewed` + add separate `approvalStatus` |
| Export button | No counts displayed |
| Default filter | "Pending Review" |
| Modal layout | Single-column (no change) |
| Approval field name | `approvalStatus` |
| Rejected songs | Hidden from exports (future: separate list) |
| Re-import behavior | Skip previously rejected songs |
| Rejection reason | Use curator notes (no separate field) |
| Button position | Top of modal |
| Table indicator | Row background tint |
| Field validation | Allow partial (no required fields) |

---

## 1. Database Schema Changes

### New Fields on Song Model

```prisma
model Song {
  // ... existing fields ...

  // EXISTING - Keep as-is (metadata review tracking)
  reviewed      Boolean   @default(false)
  reviewedBy    String?   @map("reviewed_by") @db.VarChar(100)
  reviewedById  String?   @map("reviewed_by_id")
  reviewer      User?     @relation("ReviewedBy", fields: [reviewedById], references: [id], onDelete: SetNull)
  reviewedAt    DateTime? @map("reviewed_at")
  curatorNotes  String?   @map("curator_notes")

  // NEW - Approval workflow (separate from metadata review)
  approvalStatus   String    @default("PENDING") @map("approval_status") @db.VarChar(20)
  approvedBy       String?   @map("approved_by") @db.VarChar(100)
  approvedById     String?   @map("approved_by_id")
  approver         User?     @relation("ApprovedBy", fields: [approvedById], references: [id], onDelete: SetNull)
  approvedAt       DateTime? @map("approved_at")

  // Index for filtering
  @@index([approvalStatus], map: "idx_approval_status")
}
```

### Approval Status Values
- `PENDING` - Default, awaiting admin review
- `APPROVED` - Ready for export
- `REJECTED` - Excluded from exports, visible in UI

### Migration SQL
```sql
ALTER TABLE songs
ADD COLUMN approval_status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
ADD COLUMN approved_by VARCHAR(100),
ADD COLUMN approved_by_id TEXT,
ADD COLUMN approved_at TIMESTAMP;

CREATE INDEX idx_approval_status ON songs(approval_status);

-- Foreign key for approver
ALTER TABLE songs
ADD CONSTRAINT fk_approved_by_user
FOREIGN KEY (approved_by_id) REFERENCES users(id) ON DELETE SET NULL;
```

---

## 2. API Changes

### GET /api/songs

**New Query Parameter:**
- `approvalStatus`: `all` | `pending` | `approved` | `rejected`

**Filter Logic:**
```typescript
if (approvalStatus && approvalStatus !== 'all') {
  where.approvalStatus = approvalStatus.toUpperCase();
}
```

**Response Shape (new fields):**
```typescript
{
  // ... existing fields ...
  approval_status: "PENDING" | "APPROVED" | "REJECTED",
  approved_by: string | null,
  approved_at: string | null  // ISO timestamp
}
```

### PATCH /api/songs/:isrc

**New Request Body Fields:**
```typescript
{
  // Existing metadata fields (any user can update)
  ai_energy?: string,
  ai_accessibility?: string,
  ai_explicit?: string,
  ai_subgenre_1?: string,
  ai_subgenre_2?: string,
  ai_subgenre_3?: string,
  curator_notes?: string,

  // NEW: Approval action (admin only)
  approval_status?: "APPROVED" | "REJECTED"
}
```

**Authorization Logic:**
```typescript
// Anyone authenticated can update metadata
if (payload.ai_energy || payload.curator_notes /* etc */) {
  // Allow - metadata update
}

// Only admins can change approval status
if (payload.approval_status) {
  if (user.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin role required for approval actions' });
  }

  updateData.approvalStatus = payload.approval_status;
  updateData.approvedBy = user.name;
  updateData.approvedById = user.id;
  updateData.approvedAt = new Date();
}
```

### GET /api/songs/export

**Default Behavior Change:**
- Only export songs where `approvalStatus = 'APPROVED'`
- Query param `includeAll=true` to export all statuses (for admin use)

**Updated Filter:**
```typescript
where.approvalStatus = includeAll ? undefined : 'APPROVED';
```

---

## 3. Frontend Changes

### 3.1 Constants Update

**File:** `client/src/data/constants.ts`

```typescript
// Add new constants
export const APPROVAL_STATUSES = [
  "all",
  "pending",
  "approved",
  "rejected",
] as const;

export type ApprovalStatus = (typeof APPROVAL_STATUSES)[number];

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  all: "All Statuses",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
};
```

### 3.2 Song Interface Update

**File:** `client/src/lib/api.ts`

```typescript
export interface Song {
  // ... existing fields ...

  // Existing metadata review
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  curator_notes: string | null;

  // NEW: Approval workflow
  approval_status: "PENDING" | "APPROVED" | "REJECTED";
  approved_by: string | null;
  approved_at: string | null;
}
```

### 3.3 FilterPanel Update

**File:** `client/src/components/FilterPanel.tsx`

Add new filter dropdown for Approval Status:
- Position: After existing "Review Status" filter
- Options: All Statuses, Pending Review, Approved, Rejected
- Default on load: "Pending Review"

```tsx
<Select value={selectedApprovalStatus} onValueChange={onApprovalStatusChange}>
  <SelectTrigger>
    <SelectValue placeholder="Approval Status" />
  </SelectTrigger>
  <SelectContent>
    {APPROVAL_STATUSES.map(status => (
      <SelectItem key={status} value={status}>
        {APPROVAL_STATUS_LABELS[status]}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

### 3.4 SongTable Update

**File:** `client/src/components/SongTable.tsx`

**Row Background Tinting:**
```tsx
<TableRow
  style={{
    backgroundColor:
      song.approval_status === 'APPROVED' ? 'rgba(34, 197, 94, 0.08)' :  // subtle green
      song.approval_status === 'REJECTED' ? 'rgba(239, 68, 68, 0.08)' :  // subtle red
      undefined  // no tint for pending
  }}
>
```

### 3.5 ReviewModal Update

**File:** `client/src/components/ReviewModal.tsx`

#### Button Layout Change

**Current (bottom):**
```
[Cancel] .......................... [Save] [Save & Next]
```

**New (top + bottom):**
```
TOP (after song info, before Audio Player):
┌─────────────────────────────────────────────────────────┐
│ [Reject]  [Save Metadata]  [Approve & Next]             │
│  ^red      ^outline         ^green, primary             │
└─────────────────────────────────────────────────────────┘

BOTTOM:
[Cancel] - closes modal without saving
```

#### Button Behaviors

| Button | Action | Closes Modal | Requires Admin |
|--------|--------|--------------|----------------|
| Reject | Set `approvalStatus: REJECTED`, advance to next | Yes (via next) | Yes |
| Save Metadata | Save AI fields + notes only | Yes | No |
| Approve & Next | Set `approvalStatus: APPROVED`, advance to next | Yes (via next) | Yes |
| Cancel | Discard changes | Yes | No |

#### Admin-Only Button Visibility

```tsx
const { user } = useAuth();
const isAdmin = user?.role === 'ADMIN';

// In render:
{isAdmin && (
  <>
    <Button variant="destructive" onClick={handleReject}>
      Reject
    </Button>
    <Button
      className="bg-green-600 hover:bg-green-700"
      onClick={handleApproveAndNext}
    >
      Approve & Next
    </Button>
  </>
)}

<Button variant="outline" onClick={handleSaveMetadata}>
  Save Metadata
</Button>
```

#### Rejection Flow (Single-Click + Undo)

```tsx
const handleReject = async () => {
  // 1. Save rejection immediately
  await onSave(song.id, {
    approval_status: 'REJECTED',
    curator_notes: notes,
  });

  // 2. Show undo toast
  toast('Song rejected', {
    action: {
      label: 'Undo',
      onClick: () => handleUndoRejection(song.isrc),
    },
    duration: 5000,
  });

  // 3. Advance to next song
  onNext();
};

const handleUndoRejection = async (isrc: string) => {
  await updateSong(isrc, { approval_status: 'PENDING' });
  toast.success('Rejection undone');
  // Refresh current view
};
```

#### End-of-Queue Handling

```tsx
const handleApproveAndNext = async () => {
  await onSave(song.id, { approval_status: 'APPROVED' });

  // Check if this was the last pending song
  const hasNextSong = onNext(); // Returns false if no more songs

  if (!hasNextSong) {
    // Auto-switch filter to "All"
    onFilterChange('all');
    toast.success('All pending songs reviewed!');
  }
};
```

### 3.6 SongsPage Update

**File:** `client/src/pages/SongsPage.tsx`

```typescript
// Add state
const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('pending');

// Update fetchSongs
const fetchSongs = async () => {
  const response = await getSongs({
    // ... existing params
    approvalStatus: selectedApprovalStatus !== 'all' ? selectedApprovalStatus : undefined,
  });
};

// Add handler for filter change from modal
const handleFilterChange = (newFilter: string) => {
  setSelectedApprovalStatus(newFilter);
};
```

---

## 4. Export Behavior

### Default Export (Client-Facing)
- Only includes `APPROVED` songs
- No UI indication of count
- Filtered by current view filters (subgenre, energy, etc.)

### Admin Export Option
- Checkbox: "Include all statuses (admin only)"
- When checked, exports PENDING and REJECTED too
- Adds `approval_status` column to CSV

---

## 5. Re-Import Behavior

When running `npm run enrich:playlist` or similar import scripts:

```typescript
// In import script
const existingSong = await prisma.song.findUnique({ where: { isrc } });

if (existingSong?.approvalStatus === 'REJECTED') {
  console.log(`Skipping rejected song: ${isrc}`);
  continue; // Skip this song entirely
}

// Proceed with import/update for non-rejected songs
```

---

## 6. Future Enhancement: Rejected Songs List

> **Note:** Not in MVP scope, add as separate feature later

- Separate page/tab: `/rejected` or filter-only view
- Shows all rejected songs with rejection date
- Ability to "Restore" (set back to PENDING)
- Bulk delete option for admins

---

## 7. Implementation Order

### Phase 1: Database & API (Backend)
1. Create Prisma migration for new fields
2. Update GET /api/songs with approvalStatus filter
3. Update PATCH /api/songs/:isrc with approval logic + admin check
4. Update GET /api/songs/export to filter by approved only

### Phase 2: Frontend - Filtering
1. Add constants for approval statuses
2. Update Song interface
3. Add approval status filter to FilterPanel
4. Update SongsPage state and fetch logic
5. Set default filter to "Pending Review"

### Phase 3: Frontend - ReviewModal
1. Add Approve/Reject buttons at top of modal
2. Implement admin-only visibility
3. Implement rejection with undo toast
4. Implement approve & next with end-of-queue handling
5. Update Save Metadata to close modal

### Phase 4: Frontend - Visual Indicators
1. Add row background tinting to SongTable
2. Test color contrast for accessibility

### Phase 5: Import Scripts
1. Update enrich:playlist to skip rejected songs
2. Update other import scripts similarly

---

## 8. Testing Checklist

- [x] Admin can approve songs ✅ (Implemented 2025-11-25)
- [x] Admin can reject songs ✅ (Implemented 2025-11-25)
- [x] Curator cannot see approve/reject buttons ✅ (Implemented 2025-11-25)
- [x] Curator can save metadata ✅ (Implemented 2025-11-25)
- [x] Undo toast appears for 5 seconds after rejection ✅ (Implemented 2025-11-25)
- [x] Undo actually reverts the rejection ✅ (Implemented 2025-11-25)
- [ ] End-of-queue switches filter to "All" (TODO: Need to implement)
- [x] Export only includes approved songs by default ✅ (Implemented 2025-11-25)
- [ ] Re-import skips rejected songs (TODO: Phase 5 - Import Scripts)
- [x] Row tinting displays correctly ✅ (Implemented 2025-11-25)
- [x] Filter defaults to "Pending Review" on load ✅ (Implemented 2025-11-25)

---

## 9. Changes from Original PRDs

| Original | Revised | Reason |
|----------|---------|--------|
| Two-step rejection confirmation | Single-click + undo toast | Faster workflow, undo provides safety |
| Close modal on end-of-queue | Auto-switch to "All" filter | User requested |
| Save Metadata keeps modal open | Close modal | Consistent with current Save behavior |
| `reviewDecision` field | `approvalStatus` field | Clearer naming, separate from `reviewed` |
| Count in export button | No count | Simpler UI |
| Remember last filter | Default to Pending | Focus on work queue |
| Two-column layout | Single-column | Simpler, lower risk |
| Separate rejection reason field | Use curator notes | Less complexity |
| Buttons at bottom | Buttons at top | Visible without scrolling |
| Status badge column | Row background tint | Subtler visual indicator |
| Required fields for approval | Allow partial | Trust curator judgment |
