# UI Brief: Approve/Reject Feature

**For:** Music Classification Review Interface
**Goal:** Add approve/reject workflow to ReviewModal for admin users

---

## Overview

Admins need to quickly approve or reject AI-classified songs during batch review. The UI should separate the approval decision (quick, at top) from metadata editing (detailed, below).

---

## User Flow

1. Admin opens ReviewModal to review a song
2. Listens to audio preview
3. Makes quick decision: **Approve & Next** or **Reject**
4. (Optional) Edit AI classification metadata if needed
5. Move to next song

---

## ReviewModal Layout

### Current State
```
[Song artwork + metadata]
[Audio player]
[Energy dropdown]
[Accessibility dropdown]
[Explicit dropdown]
[Subgenre 1 dropdown]
[Subgenre 2 dropdown]
[Subgenre 3 dropdown]
[AI Reasoning - collapsible]
[Curator Notes - collapsible]

[Cancel] [Save] [Save & Next]
```

### New State
```
┌────────────────────────────────────────────────────┐
│  [Album Art]  Title - Artist                       │
│               ISRC: US1234567890                   │
│               BPM: 120                             │
│                                                    │
│  [Audio Player ===================== 1:23 / 3:45] │
│                                                    │
│  ─────────────────────────────────────────────────│
│                                                    │
│  Review Decision:                                  │
│  [Approve & Next] [Reject]                         │
│                                                    │
│  ════════════════════════════════════════════════ │
│                                                    │
│  AI Classification                                 │
│                                                    │
│  Energy:         [High ▼]                          │
│  Accessibility:  [Eclectic ▼]                      │
│  Explicit:       [Family Friendly ▼]               │
│                                                    │
│  Subgenre 1:     [2020s Pop ▼]                     │
│  Subgenre 2:     [Soft Pop ▼] [×]                  │
│  Subgenre 3:     [None ▼]                          │
│                                                    │
│  ▸ AI Reasoning (collapsible)                      │
│  ▸ AI Context Used (collapsible)                   │
│  ▸ Curator Notes (collapsible)                     │
│                                                    │
│  [Cancel] [Save Metadata]                          │
└────────────────────────────────────────────────────┘
```

---

## UI Components

### 1. Review Decision Section (NEW)
**Location:** Top, immediately after audio player
**Purpose:** Quick approve/reject without editing metadata

**Components:**
- Section header: "Review Decision:"
- Two buttons side-by-side:
  - Primary: "Approve & Next" (green)
  - Destructive: "Reject" (red)

**Behavior:**
- **Approve & Next:** Saves review decision, marks as approved, closes modal, opens next pending song
- **Reject:** Expands "Curator Notes" section automatically, focuses textarea, prompts for reason

**Permissions:**
- Admin: Shows both buttons
- Curator: Shows message "Admin review required" (no buttons)

---

### 2. Metadata Editing Section (UPDATED)
**Location:** Below review decision section
**Purpose:** Edit AI classifications (optional, independent of approval)

**Changes:**
- Replace "Save & Next" with "Save Metadata"
- "Save Metadata" only updates AI fields, doesn't change review decision

**Behavior:**
- Admin/Curator can edit AI fields
- Saving metadata doesn't affect pending/approved/rejected status

---

### 3. Rejection Flow (NEW)
When admin clicks **Reject**:

```
1. Curator Notes section auto-expands
2. Textarea gets focus with placeholder:
   "Why are you rejecting this song? (optional but recommended)"
3. Reject button changes to "Confirm Rejection"
4. Click "Confirm Rejection" → saves, goes to next song
```

---

## Visual Specifications

### Color Palette (Dark Theme)
- Background: `#09090b` (zinc-950)
- Panels: `#18181b` (zinc-900)
- Borders: `#27272a` (zinc-800)
- Text primary: `#fafafa` (zinc-100)
- Text secondary: `#a1a1aa` (zinc-400)
- Text tertiary: `#52525b` (zinc-600)

### Button Styles

**Approve & Next (Primary)**
```
Background: #16a34a (green-600)
Text: #ffffff
Hover: #15803d (green-700)
Padding: 12px 24px
Border radius: 6px
```

**Reject (Destructive)**
```
Background: #7f1d1d (red-900)
Text: #ef4444 (red-500)
Hover: #991b1b (red-800)
Padding: 12px 24px
Border radius: 6px
```

**Save Metadata (Secondary)**
```
Background: #3b82f6 (blue-500)
Text: #ffffff
Hover: #2563eb (blue-600)
Padding: 10px 20px
Border radius: 6px
```

**Cancel (Tertiary)**
```
Background: #27272a (zinc-800)
Text: #a1a1aa (zinc-400)
Border: 1px solid #3f3f46 (zinc-700)
Hover: #3f3f46 (zinc-700)
Padding: 10px 20px
Border radius: 6px
```

---

## Interactive States

### Rejection State
```
Before Reject:
┌──────────────────────────────────┐
│ Review Decision:                 │
│ [Approve & Next] [Reject]        │
│                                  │
│ ▸ Curator Notes                  │
└──────────────────────────────────┘

After clicking Reject:
┌──────────────────────────────────┐
│ Review Decision:                 │
│ [Approve & Next] [Reject] ✓      │
│                                  │
│ ▾ Curator Notes                  │
│ ┌──────────────────────────────┐ │
│ │ Why are you rejecting this   │ │
│ │ song? (optional but rec...)  │ │
│ │ [cursor here]                │ │
│ └──────────────────────────────┘ │
│                                  │
│ [Confirm Rejection]              │
└──────────────────────────────────┘
```

### Permission-Based Display

**Admin View:**
- Shows "Review Decision" section with both buttons
- Full editing capabilities

**Curator View:**
```
┌──────────────────────────────────┐
│ Review Status:                   │
│ ⏱️ Pending Admin Review           │
└──────────────────────────────────┘
```
- No approve/reject buttons
- Can edit metadata only

---

## Filter Panel Updates

Add to existing filter dropdown:

**Review Status Filter:**
```
┌─────────────────────────┐
│ Review Status: [All ▼] │
│                         │
│ Dropdown options:       │
│ • All                   │
│ • Pending Review        │ (default)
│ • Approved              │
│ • Rejected              │
└─────────────────────────┘
```

---

## Song Table Updates

**Reviewed By Column:**

Current:
```
Reviewed By
───────────
✓ Danny K.
  Nov 20
```

New:
```
Reviewed By
───────────
✓ Danny K.     (approved - green check)
  Nov 20

✗ Michaela B.  (rejected - red X)
  Nov 19
  "Too cheesy"

⏱ Pending...   (pending - gray)
```

**Visual Indicators:**
- ✅ Green check + name/date = Approved
- ❌ Red X + name/date + notes preview = Rejected
- ⏱️ Gray text "Pending..." = Not reviewed

---

## Responsive Behavior

**Desktop (> 1024px):**
- Modal: 900px max width
- Two-column layout for dropdowns (Energy | Accessibility)

**Tablet (768px - 1024px):**
- Modal: 90% viewport width
- Single column layout

**Mobile (< 768px):**
- Full screen modal
- Stack all elements vertically
- Buttons full width

---

## Accessibility

- All buttons have clear focus states (blue ring, 2px)
- ARIA labels on all interactive elements
- Keyboard navigation:
  - Tab through buttons/dropdowns
  - Enter to activate
  - Esc to close modal
- Screen reader announces review status

---

## Edge Cases to Design For

1. **Very long rejection notes** - Truncate in table with "..." and tooltip
2. **No album artwork** - Show placeholder with "No Art" text
3. **Multiple reviewers** - Show most recent reviewer only
4. **Loading state** - Skeleton loader while audio preview loads
5. **Error state** - Red banner if save fails

---

## Component Hierarchy

```
<ReviewModal>
  <Header>
    <AlbumArt />
    <SongMetadata />
  </Header>

  <AudioPlayer />

  <Divider />

  <ReviewDecisionSection>   <!-- NEW -->
    {isAdmin && (
      <>
        <SectionLabel>Review Decision:</SectionLabel>
        <ButtonGroup>
          <ApproveButton />
          <RejectButton />
        </ButtonGroup>
      </>
    )}
    {!isAdmin && <PendingBadge />}
  </ReviewDecisionSection>

  <Divider />

  <MetadataSection>
    <SectionLabel>AI Classification</SectionLabel>
    <FormFields>
      <EnergySelect />
      <AccessibilitySelect />
      <ExplicitSelect />
      <Subgenre1Select />
      <Subgenre2Select />
      <Subgenre3Select />
    </FormFields>
  </MetadataSection>

  <CollapsibleSections>
    <AIReasoning />
    <AIContext />
    <CuratorNotes />     <!-- Auto-expands on Reject -->
  </CollapsibleSections>

  <Footer>
    <CancelButton />
    <SaveMetadataButton />
  </Footer>
</ReviewModal>
```

---

## Prototype Checklist

- [ ] ReviewModal with new layout
- [ ] Approve & Next button (green)
- [ ] Reject button (red) with expansion behavior
- [ ] Save Metadata button (blue)
- [ ] Permission-based rendering (Admin vs Curator)
- [ ] Curator Notes auto-expansion on reject
- [ ] Filter Panel with Review Status dropdown
- [ ] Song Table with approval/rejection badges
- [ ] Responsive layouts (desktop, tablet, mobile)
- [ ] Dark theme color palette applied
