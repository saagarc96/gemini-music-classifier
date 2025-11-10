# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Redesigned login page with minimal dark theme
  - Centered single-card layout with Raina logo
  - Password visibility toggle with Eye/EyeOff icons
  - "Remember Me" checkbox functionality
  - Purple gradient sign-in button with hover animations
  - Removed colorful gradient panels for cleaner aesthetic
  - Enhanced form validation with toast notifications
  - Dark zinc theme (zinc-950/900 palette)
  - Borderless design for seamless dark appearance

- Sortable "Date Added" column in song table
  - Click column header to toggle sort order (ascending/descending)
  - Visual indicators (↑/↓) show current sort direction
  - Date formatting using native Intl.DateTimeFormat API
  - Sort state persists across pagination
  - Resets to page 1 when changing sort criteria

### Fixed
- **Critical**: Subgenre filter bug for values with spaces
  - Fixed Vite proxy not converting `+` to spaces in URL encoding
  - Subgenres like "Alternative R&B", "90s Alternative" now filter correctly
  - Root cause: Browser encodes spaces as `+`, but proxy was forwarding literally
  - Solution: Added rewrite function to convert `+` to `%20` before forwarding to API
  - Affected all 167 subgenres containing spaces in their names

### Changed
- Project structure reorganization
  - Moved `docs/test-spotify csv/` → `test-data/test-spotify-csv/`
  - Moved `curator-enrichments/` → `test-data/curator-enrichments/`
  - Updated documentation references to reflect new paths
  - All test and enrichment data now consolidated in `test-data/` directory

## [1.2.0] - 2025-01-05

### Added
- CSV Export Feature
  - Export songs with current filters applied
  - Select specific songs via checkboxes for targeted export
  - Configurable column visibility (ACCESSIBILITY, EXPLICIT)
  - Real-time CSV preview showing first 5 rows
  - Optional playlist name prefix for legacy format compatibility
  - UTF-8 BOM encoding for Excel compatibility
  - Dynamic export modal with filter summary

- Curator CSV Enrichment Pipeline
  - Import curator-reviewed CSVs with ISRC matching
  - Fuzzy matching by Artist + Title when ISRC missing
  - Automatic enrichment of missing ACCESSIBILITY/EXPLICIT fields
  - Preserves all existing curator data (energy, subgenres, BPM)
  - Sets `reviewed=true` status on import
  - Audio link integration from ISRC database

- Spotify CSV Enrichment Workflow
  - Import Spotify playlist exports (120+ columns)
  - 30-second preview URL support for curator playback
  - BPM normalization (50-170 range)
  - Batch Spotify API integration (50 tracks per call)
  - Artwork and track metadata fetching
  - Compliant with Spotify Developer Terms

### Fixed
- Case sensitivity in dropdown filters
  - Changed subgenre filter to case-insensitive matching
  - Fixed dropdown values showing empty due to case mismatch
  - Standardized all dropdown values to Title Case
  - Updated database migration to normalize existing values

### Changed
- Subgenre Management
  - Single source of truth in `data/subgenres.json`
  - Auto-generated frontend constants
  - Runtime injection into classification prompts
  - Added validation script to prevent duplicates
  - 167 subgenres across 10 categories

## [1.1.0] - 2025-01-04

### Added
- Review Interface (React + TypeScript + Vite)
  - Dark zinc-themed UI with shadcn/ui components
  - Pagination (50 songs/page, configurable to 200)
  - Multi-criteria filtering (subgenre, status, energy, accessibility, explicit, review status)
  - Real-time search by artist, title, or ISRC
  - Inline editing with validation
  - Audio streaming from S3
  - Curator notes functionality
  - Automatic timestamp tracking

- Backend API (Vercel Serverless Functions)
  - `GET /api/songs` - Paginated list with filters
  - `PATCH /api/songs/:isrc` - Update classifications
  - `GET /api/songs/export` - CSV export with filtering

- Database Layer (Prisma + Vercel Postgres)
  - Type-safe ORM with auto-generated types
  - Migration versioning
  - Indexes on ISRC, subgenres, status, reviewed
  - 20+ fields per song record

### Changed
- Migrated from @vercel/postgres to Prisma ORM
  - Better type safety and developer experience
  - Cleaner query syntax
  - Auto-generated TypeScript interfaces
  - Migration tracking

## [1.0.0] - 2025-01-03

### Added
- Initial batch processing pipeline
  - Gemini Batch API integration
  - 5-phase orchestration (prepare → submit → monitor → process → export)
  - System instruction embedding (17KB prompt per request)
  - BrainTrust logging for quality tracking
  - Web search integration for context gathering

- Classification System
  - Energy levels (Very Low → Very High)
  - Accessibility categories (Eclectic → Cheesy)
  - 200+ subgenres organized by category
  - Decade-specific rules
  - Instrumental vs vocal detection

- Core Infrastructure
  - CSV playlist input processing
  - JSONL batch file generation
  - Job monitoring with polling
  - Result parsing and validation
  - Multi-playlist merging

### Technical Details
- Model: `gemini-flash-latest`
- Processing time: 12-24 hours typical
- Rate limits: 10M tokens/model, 100 concurrent batches
- Cost savings: 50% via batch API

---

## Commit History

### 2025-01-10
- `a861d87` - feat: redesign login page with minimal dark theme

### 2025-01-06
- `eb54555` - fix: Vite proxy URL encoding for subgenre filters with spaces
- `667600d` - feat: add sortable Date Added column to song table
- `80b1d42` - fix: make subgenre filter case-insensitive

### 2025-01-05
- `04fa674` - feat: add curator CSV enrichment pipeline and fix dropdown case sensitivity
- `74785b7` - docs: add CSV export feature documentation to CLAUDE.md
- `b465843` - feat: add CSV export feature with filtering and preview

### 2025-01-04
- `87ba019` - fix: Switch to @google/genai SDK and fix subgenre array parsing
- `55d01f9` - fix: Improve Gemini response parsing and BPM type handling

---

## Notes

### Breaking Changes
None in recent releases. The system maintains backward compatibility with existing CSV formats.

### Deprecations
- Old `subgenre` field in database schema (superseded by `aiSubgenre1/2/3`)
- Batch API workflow (superseded by real-time enrichment with standard Gemini API)

### Security
- All API endpoints use Vercel authentication
- Database credentials managed via environment variables
- No sensitive data in version control

### Performance
- Pagination limits prevent large data transfers
- Database indexes optimize filter queries
- Vite HMR provides instant development feedback
- Parallel AI processing for explicit content detection
