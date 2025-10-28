# Product Requirements Document: Music Classification Review Interface

**Project**: Raina Music - AI Classification Review System
**Version**: 1.1 (Updated with Architecture Decisions)
**Date**: 2025-10-27
**Last Updated**: 2025-10-27
**Status**: Draft for Engineering Review

---

## Executive Summary

This document outlines the requirements for building a web-based review interface that allows Raina Music curators to review, correct, and approve AI-generated song classifications (energy levels, accessibility ratings, and subgenres). The system will serve as a human-in-the-loop quality control layer for our Gemini-based batch classification pipeline.

---

## Problem Statement

We have successfully implemented an AI classification system that processes ~20,000 songs across 120 playlists using Google Gemini's Batch API. The system classifies songs by:
- Energy Level (Very Low → Very High)
- Accessibility (Eclectic / Timeless / Commercial / Cheesy)
- Subgenres (200+ curated options)

However, we currently lack:
1. A centralized database to store and query these classifications
2. An interface for curators to review and correct AI results
3. A caching mechanism to reuse previous classifications for songs processed multiple times
4. A way to track which songs have been human-reviewed vs AI-only

---

## Goals & Success Metrics

### Primary Goals
1. Enable curators to efficiently review AI classifications
2. Build a central database for all song classifications (with ISRC as primary key)
3. Support filtering by subgenre to allow specialized curator review
4. Allow curators to stream songs and make corrections inline
5. Cache classifications to avoid reprocessing previously reviewed songs

### Success Metrics
- Curators can review 50+ songs per hour
- 100% of batch output data successfully imported to database
- Audio streaming works for 95%+ of songs with source_file URLs
- Database queries return filtered results in <500ms
- System supports 3-5 concurrent curator sessions

### Non-Goals (Future Phases)
- User authentication (prototype will have no auth; production uses Clerk/WorkOS)
- Real-time collaboration features (soft/hard locking)
- Advanced analytics dashboard
- Bulk approval workflows
- Export functionality back to CSV

---

## User Personas

### Primary User: Music Curator
**Background**: Professional with deep music knowledge across specific genres
**Technical Skill**: Non-technical, comfortable with web interfaces
**Goals**:
- Review AI classifications for accuracy
- Listen to songs before approving
- Focus on specific subgenres they specialize in
- Efficiently process large volumes of songs

**Pain Points**:
- Current system has no review interface
- Cannot listen to songs during review
- No way to filter by genre expertise
- No visibility into which songs need review

---

## Technical Architecture

### Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Frontend | **React 18 + TypeScript + Vite** | Based on Figma Make prototype, excellent type safety, fast dev experience |
| UI Library | **shadcn/ui (Radix UI primitives)** | Pre-built accessible components, dark theme ready, already implemented in prototype |
| Styling | **Tailwind CSS** | Utility-first, matches Figma Make output, dark zinc theme (zinc-950/900/800) |
| Backend (Phase 1) | Vercel Serverless Functions | Fast prototype deployment, no server management, native Vercel integration |
| Backend (Phase 2) | Express.js on Railway | More flexibility for complex queries, long-running operations |
| Database | **Vercel Postgres** (Phase 1 & 2) | Native Vercel integration, one-click setup, PostgreSQL from start (no migration needed) |
| Deployment | Vercel (Phase 1) → Railway (Phase 2) | Serverless first, then move to Railway for full-stack control |
| Authentication | None (Phase 1) → Clerk/WorkOS (Phase 2) | Skip for prototype, add later |
| Audio Streaming | Direct S3 URLs via HTML5 | Simplest approach, no backend proxying needed |
| Subgenres List | Hard-coded in frontend | 243 subgenres from classification prompt, stored in `data/constants.ts` |
| Toast Notifications | Sonner | Elegant toast notifications for save confirmations |

### UI Prototype (Figma Make)

**Location**: `/Users/saagar/Music/New Downloads/Music Classification Review Interface`

**Status**: Complete working prototype with mock data

**Key Features Already Implemented**:
- ✅ FilterPanel with 5 filter types (subgenre, status, review status, energy, accessibility)
- ✅ SongTable with clickable rows
- ✅ ReviewModal with audio player, editable fields, AI reasoning display
- ✅ Dark theme (zinc-950/900/800)
- ✅ Toast notifications (Sonner)
- ✅ Responsive layout
- ✅ TypeScript types for Song model

**Components to Reuse**:
```
src/
├── components/
│   ├── FilterPanel.tsx       ✅ Complete
│   ├── SongTable.tsx          ✅ Complete
│   ├── ReviewModal.tsx        ✅ Complete
│   ├── AudioPlayer.tsx        ✅ Complete
│   └── ui/                    ✅ shadcn/ui components
├── data/
│   └── mockSongs.ts           ⚠️ Replace with API calls
└── App.tsx                    ✅ Main orchestration
```

**Integration Plan**:
1. Copy Figma Make prototype as frontend foundation
2. Replace mock data (`mockSongs.ts`) with API calls to Vercel Functions
3. Update data model to use `approved_*` fields (not just `ai_*`)
4. Add Vercel Postgres connection to backend
5. Deploy to Vercel

---

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│               React + TypeScript Frontend                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │ FilterPanel  │  │  SongTable   │  │ ReviewModal  │      │
│  │   (shadcn)   │  │   (shadcn)   │  │  (shadcn)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│           │                │                  │              │
│           └────────────────┴──────────────────┘              │
│                            │                                 │
└────────────────────────────┼─────────────────────────────────┘
                             │ HTTP/REST
                             ▼
┌─────────────────────────────────────────────────────────────┐
│         Vercel Serverless Functions (Phase 1)                │
│               Express API (Phase 2)                          │
│                                                              │
│  GET  /api/songs?subgenre=X&status=Y&page=N                │
│  GET  /api/songs/:isrc                                      │
│  PATCH /api/songs/:isrc                                     │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │  Vercel Postgres DB  │
                  │  (Both Phase 1 & 2)  │
                  └──────────────────────┘
```

---

## Data Model

### Architecture Decision: Single Set of Editable Fields

**Decision Made**: Curator edits **directly overwrite** `ai_*` fields (no separate `approved_*` fields in prototype)

**Rationale**:
- Simpler schema for prototype (fewer columns)
- Faster implementation and queries
- `reviewed` boolean tracks whether human has touched the record
- Can add separate `approved_*` fields later if analytics/ML feedback loop becomes priority
- Matches Figma Make prototype data model

**UI Behavior**:
- Curator fields **pre-populated with AI values** by default (faster workflow)
- Curator can accept AI values by clicking "Save" without changes
- All saves mark `reviewed = true` and update `modified_at` timestamp

**Trade-off**: Lose original AI predictions once curator edits. This is acceptable for prototype; if AI quality metrics become important, add `original_ai_*` fields in Phase 2.

### Database Schema

#### `songs` Table

| Column | Type | Description | Indexed |
|--------|------|-------------|---------|
| `id` | SERIAL PRIMARY KEY | Auto-increment ID | Yes |
| `isrc` | VARCHAR(12) UNIQUE | International Standard Recording Code | Yes (Primary Lookup) |
| **Original CSV Metadata** | | | |
| `title` | TEXT | Song title | No |
| `artist` | TEXT | Artist name | No |
| `energy` | VARCHAR(20) | Original energy tag from CSV | No |
| `bpm` | INTEGER | Beats per minute | No |
| `subgenre` | TEXT | Original subgenre from CSV | No |
| `artwork` | TEXT | S3 URL to artwork | No |
| `source_file` | TEXT | S3 URL to audio file | No |
| **AI/Curator Classifications (Editable)** | | | |
| `ai_status` | VARCHAR(50) | SUCCESS / ERROR / REQUIRES HUMAN REVIEW / INVALID INPUT | Yes |
| `ai_error_message` | TEXT | Error details if status = ERROR | No |
| `ai_reasoning` | TEXT | AI's explanation for classification (read-only in UI) | No |
| `ai_context_used` | TEXT | Web search context used by AI (read-only in UI) | No |
| `ai_energy` | VARCHAR(20) | Current energy classification (starts as AI, curator can edit) | No |
| `ai_accessibility` | VARCHAR(20) | Current accessibility (starts as AI, curator can edit) | No |
| `ai_subgenre_1` | VARCHAR(100) | Primary subgenre (starts as AI, curator can edit) | Yes |
| `ai_subgenre_2` | VARCHAR(100) | Secondary subgenre (starts as AI, curator can edit) | Yes |
| `ai_subgenre_3` | VARCHAR(100) | Tertiary subgenre (starts as AI, curator can edit) | Yes |
| **Review Metadata** | | | |
| `reviewed` | BOOLEAN | Has a curator reviewed this? | Yes |
| `reviewed_by` | VARCHAR(100) | Curator name/email (future auth, NULL for prototype) | No |
| `reviewed_at` | TIMESTAMP | When review was completed | No |
| `curator_notes` | TEXT | Optional notes from curator | No |
| **Timestamps** | | | |
| `created_at` | TIMESTAMP | When record was created | No |
| `modified_at` | TIMESTAMP | Last modification timestamp | No |

**Indexes**:
- Primary: `isrc`
- Filters: `ai_subgenre_1`, `ai_subgenre_2`, `ai_subgenre_3`, `ai_status`, `reviewed`

**Note**: Field names retain `ai_` prefix for consistency with batch CSV output, but values are editable by curators.

---

## Feature Requirements

### 1. Data Import & Seeding

**Requirement**: Import batch CSV outputs into SQLite database

**Acceptance Criteria**:
- CLI command `npm run seed <path-to-csv>` imports CSV to database
- Supports all 16 columns from current batch output format
- Handles NULL values gracefully
- Uses ISRC as primary key (upsert: updates if exists, inserts if new)
- Logs import summary (X songs imported, Y updated, Z errors)
- Can be run multiple times with different CSV files

**Technical Notes**:
- Use `csv-parser` or `papaparse` for CSV parsing
- Use `better-sqlite3` for SQLite operations
- Set `reviewed = false` for all imported songs

---

### 2. Song Filtering Dashboard

**Requirement**: Allow curators to filter songs by subgenre and other criteria

**UI Components**:
- **Subgenre Dropdown**: Populated with all unique values from `ai_subgenre_1`, `ai_subgenre_2`, `ai_subgenre_3`
  - Multi-select capability
  - Search/autocomplete for 200+ options
- **Status Filter**: Radio buttons for SUCCESS / ERROR / REQUIRES HUMAN REVIEW / ALL
- **Review Status Filter**: Toggle for "Unreviewed only" / "All" / "Reviewed only"
- **Energy Filter** (optional): Multi-select for Very Low → Very High
- **Accessibility Filter** (optional): Multi-select for Eclectic/Timeless/Commercial/Cheesy

**Acceptance Criteria**:
- Filters update immediately on change
- Query parameters reflected in URL (shareable links)
- Shows song count for current filter (e.g., "Showing 127 songs")
- Filters can be combined (e.g., "Nu-Disco" + "Unreviewed" + "REQUIRES HUMAN REVIEW")
- Default view: All unreviewed songs, no filters

---

### 3. Song List Table

**Requirement**: Display filtered songs in a paginated, sortable table

**Columns**:
1. Artwork (thumbnail, 50x50px)
2. Title
3. Artist
4. AI Energy
5. AI Accessibility
6. Subgenre 1 / 2 / 3 (combined display)
7. Status (color-coded badge)
8. Review Status (✓ if reviewed, — if not)

**Interactions**:
- Click any row → Opens review modal
- Pagination: 50 songs per page (configurable)
- Sort by: Title, Artist, Status (default: created_at DESC)

**Acceptance Criteria**:
- Table renders 1000+ songs without performance issues
- Images lazy-load
- Pagination controls at bottom (First / Prev / Page N of M / Next / Last)
- Loading state while fetching data
- Empty state if no songs match filter

---

### 4. Song Review Modal

**Requirement**: Modal overlay for reviewing and editing a single song's classification

**Layout**:

```
┌─────────────────────────────────────────────────────────────┐
│  ✕ Close                                                     │
│                                                              │
│  [Artwork]  Title by Artist                                 │
│             ISRC: XXXXXXXXXXXX                              │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 🔊 [Audio Player with waveform/scrubber]            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  AI Classification                                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Energy:         [Very High ▼]                        │  │
│  │ Accessibility:  [Commercial ▼]                       │  │
│  │ Subgenre 1:     [Nu-Disco ▼]                         │  │
│  │ Subgenre 2:     [Balearic ▼]                         │  │
│  │ Subgenre 3:     [Modern Dance ▼]                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  AI Reasoning (Read-only)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ This remix transforms the Tycho original into...     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Curator Notes (Optional)                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Free text area]                                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Cancel]                              [Save & Next →]      │
└─────────────────────────────────────────────────────────────┘
```

**Editable Fields**:
- Energy: Dropdown with 5 options (Very Low, Low, Medium, High, Very High)
- Accessibility: Dropdown with 4 options (Eclectic, Timeless, Commercial, Cheesy)
- Subgenre 1, 2, 3: Dropdowns with 200+ subgenres (searchable)
- Curator Notes: Free text area

**Read-only Fields**:
- Title, Artist, ISRC, Artwork
- AI Reasoning
- AI Context Used
- Original CSV metadata (energy, bpm, subgenre)

**Interactions**:
- **Audio Player**: HTML5 `<audio>` element with:
  - Play/Pause button
  - Scrubber (seekable)
  - Current time / Total duration
  - Volume control
  - Direct S3 link from `source_file` column
- **Save & Next**: Saves current song, opens next song in filtered list
- **Cancel**: Closes modal without saving
- **Keyboard shortcuts** (optional): Space = play/pause, → = next song, ← = previous song

**Acceptance Criteria**:
- Modal opens in <300ms
- Audio starts playing within 2 seconds of clicking play
- Changes are validated before save (at least one subgenre required)
- On save:
  - Updates `ai_energy`, `ai_accessibility`, `ai_subgenre_1/2/3`, `curator_notes`
  - Sets `reviewed = true`, `reviewed_at = NOW()`, `modified_at = NOW()`
  - Optionally sets `reviewed_by` (if auth added later)
- "Save & Next" automatically advances to next unreviewed song in current filter
- Shows save confirmation (toast notification)

---

### 5. Audio Streaming

**Requirement**: Stream songs from S3 using direct URLs

**Technical Implementation**:
- Use HTML5 `<audio>` element
- Set `src` attribute to `source_file` column value (S3 URL)
- Enable CORS on S3 bucket (if not already enabled)
- Handle missing/invalid URLs gracefully (show error message)

**Acceptance Criteria**:
- Audio loads and plays successfully for 95%+ of songs
- If URL is NULL or invalid, show "Audio unavailable" message
- Preload metadata only (not full audio) to save bandwidth
- Stop playback when modal closes

**Error Handling**:
- If S3 URL returns 403/404, show "Audio file not found"
- If CORS error, show "Streaming configuration error" + log to console

---

### 6. API Endpoints

#### `GET /api/songs`

**Query Parameters**:
- `subgenre`: Comma-separated list of subgenres (searches all 3 subgenre columns)
- `status`: SUCCESS | ERROR | REQUIRES HUMAN REVIEW | INVALID INPUT
- `reviewed`: true | false | all (default: false)
- `energy`: Comma-separated list of energy levels
- `accessibility`: Comma-separated list of accessibility types
- `page`: Page number (default: 1)
- `limit`: Songs per page (default: 50, max: 200)
- `sort`: Field to sort by (default: created_at)
- `order`: asc | desc (default: desc)

**Response**:
```json
{
  "data": [
    {
      "id": 1,
      "isrc": "GBAYE2300262",
      "title": "Tioga Pass",
      "artist": "Yussef Dayes, Rocco Palladino",
      "ai_energy": "Medium",
      "ai_accessibility": "Timeless",
      "ai_subgenre_1": "Nu-Jazz",
      "ai_subgenre_2": "Modern Instrumentals (Organic)",
      "ai_subgenre_3": null,
      "ai_status": "SUCCESS",
      "artwork": "https://...",
      "reviewed": false,
      "reviewed_at": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 127,
    "totalPages": 3
  }
}
```

---

#### `GET /api/songs/:isrc`

**Response**: Single song object with all fields

```json
{
  "id": 4,
  "isrc": "GBAYE2300262",
  "title": "Tioga Pass",
  "artist": "Yussef Dayes, Rocco Palladino",
  "energy": "Medium",
  "bpm": 91,
  "subgenre": "Nu-Jazz",
  "artwork": "https://...",
  "source_file": "https://...",
  "ai_status": "SUCCESS",
  "ai_error_message": null,
  "ai_reasoning": "This instrumental track is a prime example...",
  "ai_context_used": "Used Google Search to verify...",
  "ai_energy": "Medium",
  "ai_accessibility": "Timeless",
  "ai_subgenre_1": "Nu-Jazz",
  "ai_subgenre_2": "Modern Instrumentals (Organic)",
  "ai_subgenre_3": null,
  "reviewed": false,
  "reviewed_by": null,
  "reviewed_at": null,
  "curator_notes": null,
  "created_at": "2025-10-27T12:00:00Z",
  "modified_at": "2025-10-27T12:00:00Z"
}
```

---

#### `PATCH /api/songs/:isrc`

**Request Body**:
```json
{
  "ai_energy": "High",
  "ai_accessibility": "Commercial",
  "ai_subgenre_1": "Nu-Disco (Agnostic)",
  "ai_subgenre_2": "Balearic",
  "ai_subgenre_3": "Modern Dance",
  "curator_notes": "Actually higher energy than AI suggested"
}
```

**Response**:
```json
{
  "success": true,
  "data": { /* updated song object */ }
}
```

**Validation**:
- At least one subgenre must be provided
- Energy must be one of: Very Low, Low, Medium, High, Very High
- Accessibility must be one of: Eclectic, Timeless, Commercial, Cheesy
- Automatically sets `reviewed = true`, `reviewed_at = NOW()`, `modified_at = NOW()`

---

#### `GET /api/subgenres`

**Response**: Array of all unique subgenres from database

```json
{
  "subgenres": [
    "Nu-Jazz",
    "Modern Instrumentals (Organic)",
    "Afrobeats",
    "2000s R&B",
    "..."
  ]
}
```

---

## Caching Strategy (Future Batches)

**Requirement**: When processing new songs, check if ISRC exists in database and reuse previous classification

**Implementation**:
- Before submitting new batch job, query database for all ISRCs in input CSV
- For ISRCs that exist and `reviewed = true`, use cached values instead of sending to Gemini API
- For ISRCs that exist but `reviewed = false`, optionally re-process (configurable flag)
- For new ISRCs, process normally
- After batch completes, merge results with cached data

**Benefits**:
- Reduce API costs (avoid reprocessing same songs)
- Maintain human-reviewed classifications
- Speed up batch processing

**Future Enhancement**: Add `classification_version` field to track changes in prompt/model

---

## Non-Functional Requirements

### Performance
- Page load time: <2 seconds
- Filter query response: <500ms for 10,000 songs
- Audio playback start: <2 seconds
- Concurrent users: Support 5 curators simultaneously

### Scalability
- Database should handle 50,000+ songs without performance degradation
- Pagination required for all song lists
- Consider adding database indexes on frequently queried fields

### Browser Support
- Chrome, Firefox, Safari, Edge (latest 2 versions)
- Desktop only for prototype (mobile not required)

### Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for screen readers
- Color contrast meets WCAG AA standards

---

## Development Phases

### Phase 1: Serverless Prototype (2-3 weeks)
**Deliverables**:
- SQLite database with seed script
- Serverless functions (Vercel Functions or Netlify Functions)
- Vue.js frontend with filtering, table, review modal
- Audio streaming via direct S3 links
- Deploy to Vercel/Netlify

**Tech Stack**: Vue 3 + Vite + Serverless Functions + SQLite

---

### Phase 2: Railway Migration (1-2 weeks)
**Deliverables**:
- Migrate to Express.js backend on Railway
- Migrate SQLite to PostgreSQL (Railway managed DB)
- Add connection pooling
- Optimize queries with proper indexing
- Update deployment pipeline

**Tech Stack**: Vue 3 + Express + PostgreSQL on Railway

---

### Phase 3: Authentication & Advanced Features (2-3 weeks)
**Deliverables**:
- Integrate Clerk or WorkOS for authentication
- Track which curator reviewed each song (`reviewed_by` field)
- Curator-specific dashboards
- Soft locking (show "X is reviewing this song")
- Export reviewed songs back to CSV
- Batch approve functionality

---

## Testing Requirements

### Unit Tests
- API endpoint validation
- Database query functions
- CSV import/seeding logic

### Integration Tests
- End-to-end flow: Import CSV → Filter → Review → Save
- API contract tests (ensure frontend/backend agreement)

### Manual Testing Checklist
- [ ] Import batch CSV successfully
- [ ] Filter by subgenre displays correct songs
- [ ] Audio plays from S3 URLs
- [ ] Save review updates database
- [ ] "Save & Next" advances to next song
- [ ] Pagination works correctly
- [ ] Handle missing artwork/audio gracefully
- [ ] Concurrent editing (2 curators, same song) - last save wins

---

## Decisions Made

### ✅ Database
- **Decision**: Use **Vercel Postgres** from Phase 1
- **Rationale**: Native Vercel integration, one-click setup, no migration needed later, handles 20k songs easily
- **Status**: Confirmed

### ✅ Subgenre List
- **Decision**: **Hard-code 243 subgenres** in frontend (`src/constants/subgenres.js`)
- **Rationale**: List is stable, reduces API calls, faster dropdown performance
- **Status**: Confirmed - extracted from `prompts/classification-prompt.md`

### ✅ Serverless + Database
- **Decision**: Vercel Postgres solves serverless limitations (no file-based DB issues)
- **Rationale**: Hosted DB, connection pooling included, works seamlessly with Vercel Functions
- **Status**: Confirmed

### ✅ Audio Streaming
- **Decision**: Direct S3 URLs, show error if unavailable (no fallback)
- **Rationale**: Simplest approach, S3 is reliable, fallback not critical for prototype
- **Status**: Confirmed

### ✅ Deployment
- **Decision**: **Vercel** for Phase 1
- **Rationale**: Native Postgres integration, simpler than Netlify for full-stack
- **Status**: Confirmed

### ✅ State Management
- **Decision**: **Pinia** (Vue's official store)
- **Rationale**: Sufficient for prototype, TanStack Query adds complexity
- **Status**: Confirmed

### ✅ Real-time Features
- **Decision**: **No WebSockets/SSE in prototype** (Phase 1 or 2)
- **Rationale**: Not required for MVP, can add later if needed
- **Status**: Confirmed

### ✅ Data Model
- **Decision**: **Single set of fields** - curator edits directly overwrite `ai_*` fields
- **Rationale**: Simpler for prototype, faster implementation, can add separate `approved_*` fields later if needed for analytics
- **Status**: Confirmed - prototype will edit AI fields directly, track review status with `reviewed` boolean

### ✅ UI Pre-fill Behavior
- **Decision**: Pre-populate curator fields with AI values by default
- **Rationale**: Faster workflow when AI is mostly correct
- **Status**: Confirmed

### ✅ Save Behavior
- **Decision**: Mark as reviewed even if curator doesn't change values (explicit approval)
- **Rationale**: Curator explicitly approved AI suggestions
- **Status**: Confirmed

### ✅ Frontend Framework
- **Decision**: **React + TypeScript + shadcn/ui** (based on Figma Make prototype)
- **Rationale**: Figma Make generated a complete, polished prototype with:
  - Clean dark theme (zinc-950/900/800 color scheme)
  - All required components already built (FilterPanel, SongTable, ReviewModal, AudioPlayer)
  - shadcn/ui (Radix UI primitives) for accessibility
  - TypeScript for type safety
  - Sonner for toast notifications
- **Status**: Confirmed - use Figma Make prototype as foundation

### ✅ UI Design & Filtering
- **Decision**: Include **full filtering** in prototype (subgenre, status, review status, energy, accessibility)
- **Rationale**: Already implemented in Figma Make prototype, provides complete UX
- **Status**: Confirmed - implemented in `FilterPanel.tsx`

### ✅ Pagination
- **Decision**: Add **pagination** to SongTable (50 songs per page, configurable)
- **Rationale**: Better performance with 20k+ songs, prevents loading all data at once
- **Status**: Confirmed - will implement using shadcn/ui Pagination component

---

## Remaining Open Questions (Optional Features)

1. **Keyboard Shortcuts**: Should we implement Space=play/pause, Arrow keys=navigate songs? (Nice-to-have, not required for prototype)

---

## Success Criteria

This prototype will be considered successful if:
1. ✅ Curators can review 50+ songs per hour
2. ✅ All batch CSV data is imported without errors
3. ✅ Audio streaming works for 95%+ of songs
4. ✅ Filtering by subgenre returns results in <500ms
5. ✅ System supports 3-5 concurrent curators
6. ✅ Engineering team can deploy to Vercel/Railway in <1 hour
7. ✅ No data loss during review/save operations

---

## Appendix

### Sample CSV Schema
```csv
title,artist,energy,isrc,bpm,subgenre,artwork,source_file,ai_status,ai_error_message,ai_reasoning,ai_context_used,ai_energy,ai_accessibility,ai_subgenre_1,ai_subgenre_2,ai_subgenre_3
```

### Complete Subgenres List (243 Total)

**Format**: Hard-coded in `src/constants/subgenres.js` as JavaScript array

#### Decades (6)
- 50s Standards, 50s Vocal Jazz, 60s Vocal Jazz, 70s Pop, 80s Dance, 80s Pop, 90s Pop

#### Ambient & Soundscapes (3)
- Ambient, Calming Frequencies, Natural Soundscape

#### Electronic & Dance - Modern (30)
- 2000s Dance, 2010s and 2020s Pop (Dance Remixes), 90s Dance, Afro Nu-Disco, Afro-Dance, Afro-House, Afro-Lounge, Balearic, Chillout, Deep House (Jazz), Deep House (Vocal), Disco House, EDM Classics, French Electronica, Global Electronica (Non French), Indie Dance, Indie Electronica, Latin Dance, Latin Nu-Disco, Latin-Lounge, Lounge (Agnostic), Lounge (French), Modern Dance, Nu-Disco (Agnostic), Organic House (Afro), Organic House (Agnostic), Organic House (Indo), Organic House (Latin), Organic House (Middle Eastern), Soulful House, Tropical House, Trip-Hop, World Lounge

#### Funk, Soul & Disco - Classic & Modern (22)
- 80s R&B, Afro-Disco, Afrobeat, Disco Classics (70s and 80s), Disco Edits, Doo-Wop, French Funk & Soul, French Indie, Funk & Soul Classics, Funk Classics, Hip-Hop Samples, Italo-Disco, Latin-Disco, Modern Disco, Modern Funk, Modern Instrumentals (Organic), Modern Soul, Motown, Neo-Soul, Refined Covers, Soul Classics

#### Hip-Hop & R&B (25)
- 2000s Hip-Hop, 2000s R&B, 2000s Reggaeton, 2010s Hip-Hop, 2010s R&B, 2010s Reggaeton, 2020s Hip-Hop, 2020s R&B, 2020s Reggaeton, 80s Hip-Hop, 90s & 00s Dancehall, 90s Hip-Hop, 90s R&B, Afrobeats, Alternative R&B, Amapiano, Clean 90s Hip-Hop, Golden Era Hip-Hop, Hip Hop Instrumentals, Mumble Rap, Neo Soul, New Jack Swing

#### Christmas (6)
- Christmas Acoustic, Christmas Classics, Christmas Coffeehouse, Christmas Indie, Christmas Indie Acoustic, Christmas Jazz

#### Jazz & Classical (10)
- 20s Jazz & Big-Band, Ambient Piano, Bossa Nova Covers, Classic Bossa Nova, Japanese Jazz, Jazz & Piano, Jazz Piano Standards, Jazz Standards, Modern Bossa Nova, Nu-Jazz, Classical

#### Pop - 2000s-2020s (15)
- 2000s Indie Pop, 2000s Pop, 2000s Pop Rock, 2010s Indie Pop, 2010s Pop, 2020s Indie Pop, 2020s Pop, Classic Country Pop, Country Remixed, Global Pop (Eastern), Indie Soft Pop, Modern Country Pop, 2010s and 2020s Pop Dance Originals & Remixes, Soft Pop

#### Rock & Alternative (25)
- 2000s Garage Rock, 2000s Indie Rock, 2010s Indie Rock, 2020s Indie Rock, 80s Rock, 90s Alternative, 90s Grunge, 90s Rock, Alt Modern Country, Bluegrass, Blues, Classic Rock, Garage Rock (60s & 70s), Indie Folk, Indie Sleaze, Indie Soft Rock, Irish Rock Classics, New Wave, Outlaw Country (Classics), Outlaw Country (Modern), Psychedelic Rock, Rockabilly, Roots Country, Ska, Spanish Indie, Stadium Rock, Yacht Rock

#### World & Regional (23)
- Afro Funk & Soul (Classics), Afro Funk & Soul (Modern), Afro Funk Instrumentals, Classic Bachata, Classic Latin Pop, Classic Merengue, Classic Salsa, Cuban Jazz, East Asian Instrumentals, French Disco, French Jazz, French Pop, Global Disco, Global Disco House, Global Instrumentals (Organic), Hawaiian Easy Listening, Latin Funk & Soul (Classic), Latin Funk & Soul (Modern), Latin Funk Instrumentals, Middle Eastern Funk & Soul, Modern Reggae, Reggae Classics, Roots Reggae

**Implementation**:
```javascript
// src/constants/subgenres.js
export const SUBGENRES = [
  // Decades
  "50s Standards",
  "50s Vocal Jazz",
  // ... (all 243 subgenres)
];

export const ENERGY_LEVELS = [
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High"
];

export const ACCESSIBILITY_LEVELS = [
  "Eclectic",
  "Timeless",
  "Commercial",
  "Cheesy"
];
```

### Reference: Batch Output Location
Test data: `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv`

---

## Implementation Plan & Next Steps

### Phase 1: Backend Setup (Est. 2-3 hours)

#### Step 1: Create Vercel Postgres Database (5 min)
1. Go to Vercel dashboard → Storage → Create Database → Postgres
2. Note the database connection details (auto-added to project env vars)

#### Step 2: Create Database Schema (15 min)
Create `scripts/create-schema.js`:
```javascript
import { sql } from '@vercel/postgres';

async function createSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS songs (
      id SERIAL PRIMARY KEY,
      isrc VARCHAR(12) UNIQUE NOT NULL,
      title TEXT,
      artist TEXT,
      energy VARCHAR(20),
      bpm INTEGER,
      subgenre TEXT,
      artwork TEXT,
      source_file TEXT,
      ai_status VARCHAR(50),
      ai_error_message TEXT,
      ai_reasoning TEXT,
      ai_context_used TEXT,
      ai_energy VARCHAR(20),
      ai_accessibility VARCHAR(20),
      ai_subgenre_1 VARCHAR(100),
      ai_subgenre_2 VARCHAR(100),
      ai_subgenre_3 VARCHAR(100),
      reviewed BOOLEAN DEFAULT false,
      reviewed_by VARCHAR(100),
      reviewed_at TIMESTAMP,
      curator_notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;

  await sql`CREATE INDEX IF NOT EXISTS idx_isrc ON songs(isrc)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subgenre_1 ON songs(ai_subgenre_1)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subgenre_2 ON songs(ai_subgenre_2)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_subgenre_3 ON songs(ai_subgenre_3)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_status ON songs(ai_status)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_reviewed ON songs(reviewed)`;

  console.log('✅ Schema created');
}

createSchema().catch(console.error);
```

Run: `node scripts/create-schema.js`

#### Step 3: Build CSV Seed Script (30 min)
Create `scripts/seed.js` to import `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv`

Key logic:
- Parse CSV using `csv-parse`
- Convert "NULL" strings to actual null
- Upsert by ISRC (INSERT ... ON CONFLICT DO UPDATE)
- Handle missing ISRC with temp ID
- Set `reviewed = false` for all imported songs

#### Step 4: Create API Endpoints (1.5 hours)

**`api/songs/index.ts`** - GET /api/songs?page=1&limit=50&subgenre=X&status=Y
- Query with pagination
- Apply filters (subgenre searches across all 3 columns)
- Return `{ data: Song[], pagination: { page, limit, total, totalPages } }`

**`api/songs/[isrc].ts`** - PATCH /api/songs/:isrc
- Validate request body
- Update `ai_energy`, `ai_accessibility`, `ai_subgenre_1/2/3`, `curator_notes`
- Set `reviewed = true`, `reviewed_at = NOW()`, `modified_at = NOW()`
- Return updated song

---

### Phase 2: Frontend Integration (Est. 3-4 hours)

#### Step 5: Copy Figma Make Prototype (10 min)
1. Copy `/Users/saagar/Music/New Downloads/Music Classification Review Interface/src` to new project
2. Keep all components: FilterPanel, SongTable, ReviewModal, AudioPlayer, ui/
3. Install dependencies from Figma Make's `package.json`

#### Step 6: Extract & Hard-code Subgenres (20 min)
1. Extract 243 subgenres from `prompts/classification-prompt.md`
2. Create `src/data/constants.ts`:
```typescript
export const SUBGENRES = [
  "50s Standards",
  "50s Vocal Jazz",
  // ... all 243
];

export const ENERGY_LEVELS = [
  "Very Low", "Low", "Medium", "High", "Very High"
];

export const ACCESSIBILITY_TYPES = [
  "Eclectic", "Timeless", "Commercial", "Cheesy"
];

export const AI_STATUSES = [
  "SUCCESS", "ERROR", "REQUIRES HUMAN REVIEW", "INVALID INPUT"
];
```

#### Step 7: Create API Client (30 min)
Create `src/lib/api.ts`:
```typescript
export interface Song {
  id: number;
  isrc: string;
  title: string;
  artist: string;
  // ... all fields
}

export interface PaginatedResponse {
  data: Song[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export async function getSongs(params: {
  page?: number;
  limit?: number;
  subgenre?: string;
  status?: string;
  reviewStatus?: string;
  energy?: string;
  accessibility?: string;
}): Promise<PaginatedResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value) query.append(key, String(value));
  });

  const res = await fetch(`/api/songs?${query}`);
  return res.json();
}

export async function updateSong(isrc: string, updates: Partial<Song>): Promise<Song> {
  const res = await fetch(`/api/songs/${isrc}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
  return res.json();
}
```

#### Step 8: Update App.tsx for API Integration (1 hour)
Replace mock data with:
- `useEffect` to fetch songs on mount and filter changes
- Track pagination state (page, limit, total)
- Call `updateSong` on save
- Add loading states

#### Step 9: Add Pagination to SongTable (30 min)
- Use shadcn/ui Pagination component
- Show "Page X of Y"
- Update page state on navigation
- Re-fetch data when page changes

#### Step 10: Test with Real Data (30 min)
- Run seed script to import batch CSV
- Test filtering by subgenre, status, review status
- Test editing classifications
- Test save & next functionality
- Verify audio streaming works

---

### Phase 3: Deployment (Est. 30 min)

#### Step 11: Deploy to Vercel
1. Push code to GitHub
2. Connect repository to Vercel
3. Vercel auto-detects React/Vite
4. Environment variables (Postgres URL) auto-injected
5. Deploy completes in ~2 min

---

## Total Estimated Time: 6-8 hours

**What's Already Done** (thanks to Figma Make):
- ✅ Complete UI design (dark theme, responsive)
- ✅ All components (FilterPanel, SongTable, ReviewModal, AudioPlayer)
- ✅ Filtering logic
- ✅ TypeScript types
- ✅ shadcn/ui styling

**What Needs Building**:
- ⚠️ Vercel Postgres database + schema
- ⚠️ CSV seed script
- ⚠️ 2 API endpoints (GET, PATCH)
- ⚠️ Replace mock data with API calls
- ⚠️ Add pagination to SongTable
- ⚠️ Hard-code 243 subgenres

---

## What You Need to Provide to Get Started

### 1. ✅ Vercel Account Access
- Ensure Claude has permission to create Postgres database in your Vercel project
- Or: You create the database and provide connection URL

### 2. ✅ Confirm File Locations
- Figma Make prototype: `/Users/saagar/Music/New Downloads/Music Classification Review Interface` ✅
- Batch CSV: `archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv` ✅
- Classification prompt: `prompts/classification-prompt.md` ✅

### 3. ✅ Project Structure Decision
**Option A**: Build in current `gemini-music-classifier` directory
- Add `client/` folder for React frontend
- Add `api/` folder for Vercel Functions
- Keep batch processing code separate

**Option B**: Create new separate repo `music-review-interface`
- Cleaner separation
- Easier to deploy independently
- Can link to batch processing outputs

**Which do you prefer?**

### 4. ✅ Confirm Go-Ahead
Once you say "go", Claude will:
1. Set up Vercel Postgres database
2. Create schema and seed script
3. Build API endpoints
4. Integrate Figma Make prototype
5. Add pagination
6. Test with your batch CSV
7. Deploy to Vercel

**Estimated completion: 6-8 hours of development time**

---

**Document Status**: ✅ Ready for Implementation
**Next Step**: User confirms project structure preference and gives go-ahead to start building