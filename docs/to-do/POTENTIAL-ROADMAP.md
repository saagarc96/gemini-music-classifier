# Potential Roadmap - Music Classification System

This document tracks potential improvements and features for the music classification system, organized by category. Items can be prioritized and implemented over time as needs evolve.

## Review Interface Improvements

### Bulk Editing
- **Select multiple songs** with checkboxes
- **Bulk update** energy, accessibility, or subgenres for selected songs
- **Bulk approve/reject** classifications
- **Bulk add curator notes**

### Enhanced Filtering
- **Multi-criteria filtering** - Combine multiple filters at once (e.g., "Nu-Disco AND High Energy AND Not Reviewed")
- **Saved filter presets** - Save common filter combinations for quick access
- **Filter by date range** - Created date, reviewed date ranges
- **Advanced search** - Search by artist, title, ISRC with autocomplete

### Mobile Responsiveness
- **Responsive layout** for tablet/mobile devices
- **Touch-friendly** controls for audio player
- **Swipe gestures** for quick approve/reject
- **Mobile-optimized modal** for smaller screens

### Statistics Dashboard
- **Classification distribution** - Pie charts showing energy, accessibility, explicit breakdown
- **Subgenre distribution** - Most common subgenres
- **Curator activity** - Songs reviewed per curator, review velocity
- **Quality metrics** - Success rate, error rate, review completion percentage

### UI/UX Enhancements
- **Keyboard shortcuts** - Navigate songs, play/pause, approve/reject
- **Infinite scroll** - Alternative to pagination for faster browsing
- **Comparison view** - Compare AI classification with user corrections side-by-side
- **Batch preview** - Preview multiple songs before committing changes
- **Dark/light mode toggle** - User preference for interface theme

## Data Pipeline Enhancements

### Resume Capability
- **Checkpoint system** - Save progress at regular intervals during enrichment
- **Crash recovery** - Automatically resume from last successful song after interruption
- **Progress persistence** - Store progress in database, not just in-memory
- **Partial re-run** - Re-enrich only failed songs without reprocessing successes

### Batch Size Configuration
- **Dynamic concurrency** - Adjust based on API rate limits and system load
- **Concurrency profiles** - Preset configurations (low/medium/high) for different scenarios
- **Auto-throttling** - Slow down if API errors detected
- **Queue management** - View and manage pending enrichment jobs

### Retry Logic
- **Automatic retries** - Retry failed API calls with exponential backoff
- **Max retry limits** - Configure maximum retries per song
- **Error categorization** - Different retry strategies for network vs validation errors
- **Manual retry** - UI button to retry individual failed songs

### Cost Tracking
- **API usage dashboard** - Track Gemini and Parallel AI API calls
- **Cost estimation** - Show estimated cost before running enrichment
- **Budget alerts** - Warn when approaching spending limits
- **Cost per playlist** - Track costs at playlist level for client billing

### Performance Optimization
- **Caching layer** - Cache Gemini responses for duplicate songs
- **Batch API support** - Use batch APIs where available for cost savings
- **Parallel processing** - Process multiple playlists simultaneously
- **Resource monitoring** - Track memory/CPU usage during enrichment

## Database & API

### Additional Endpoints
- **GET /api/stats** - System-wide statistics and metrics
- **POST /api/songs/bulk-update** - Update multiple songs in single request
- **GET /api/songs/duplicates** - Find potential duplicate songs
- **POST /api/songs/validate** - Validate song data before saving
- **GET /api/audit-log** - Retrieve change history

### Data Validation
- **Schema validation** - Validate all input data against schema
- **Business rule validation** - Check subgenres exist, energy values valid, etc.
- **Duplicate detection** - Prevent duplicate ISRCs in database
- **Required field enforcement** - Ensure critical fields are populated

### Audit Logging
- **Change tracking** - Log all updates to songs (who, when, what changed)
- **Review history** - Track all review actions per curator
- **Export history** - Log all CSV exports with configuration used
- **API access logs** - Track API usage patterns

### Query Optimization
- **Database indexes** - Add indexes for common query patterns
- **Query caching** - Cache frequently-accessed data
- **Pagination improvements** - Cursor-based pagination for large datasets
- **Materialized views** - Pre-compute common aggregations

### Data Migration Tools
- **Bulk import** - Import songs from CSV to database
- **Data transformation** - Scripts to migrate between schema versions
- **Backup/restore** - Automated database backups
- **Data cleanup** - Remove orphaned records, deduplicate data

## Quality & Testing

### Automated Tests
- **Unit tests** - Test CSV parser, API endpoints, utility functions
- **Integration tests** - Test enrichment pipeline end-to-end
- **UI tests** - Automated browser tests for review interface
- **API contract tests** - Ensure API matches expected schema

### Validation & Quality Checks
- **Gemini response validation** - Ensure responses match expected format
- **Subgenre validation** - Verify subgenres exist in master list
- **Confidence scoring** - Track AI classification confidence
- **Anomaly detection** - Flag unusual classifications for review

### Quality Metrics Dashboard
- **Classification accuracy** - Track human corrections vs AI suggestions
- **Inter-rater reliability** - Consistency between different curators
- **Processing success rate** - % of songs successfully enriched
- **API reliability** - Track API uptime and error rates

### Error Handling Improvements
- **Graceful degradation** - Continue processing even if some songs fail
- **Error notifications** - Alert curators when critical errors occur
- **Error recovery UI** - Easy way to view and fix errors in interface
- **Detailed error messages** - Provide actionable error information

## CSV Export Features

### Custom Field Mapping
- **Field selection** - Choose which fields to include in export ✅ (Implemented)
- **Column renaming** - Custom column names for different systems
- **Value transformation** - Custom formatting rules per field
- **Conditional exports** - Different formats based on song properties

### Batch Export
- **Export templates** - Save export configurations as templates
- **Scheduled exports** - Automatically export at regular intervals
- **Multi-format export** - JSON, XML, CSV formats
- **Compression** - Export as ZIP for large datasets

### Format Templates
- **Legacy format** - Current system format (without new fields) ✅ (Implemented)
- **Full format** - All fields included ✅ (Implemented)
- **Spotify format** - Format for Spotify import
- **Custom templates** - User-defined export templates

## Workflow & Integration

### Unstructured CSV Upload
- **File upload UI** - Drag-and-drop CSV upload
- **Column mapping** - Map uploaded CSV columns to our schema
- **Preview before import** - Show parsed data before processing
- **Error handling** - Validate CSV format, show parsing errors

### Fuzzy Matching System
- **ISRC exact matching** - Match songs by ISRC (highest confidence)
- **Artist-Title fuzzy matching** - 85% similarity threshold for fuzzy matches
- **Match confidence scoring** - Show match quality percentage
- **Manual match confirmation** - Review low-confidence matches before accepting

### Full Curator Workflow
1. **Upload** - Curator uploads Spotify playlist CSV
2. **Match** - System matches to existing songs (ISRC + fuzzy)
3. **Identify New Songs** - Flag songs not in database
4. **Enrich** - Run AI classification on new songs only
5. **Review** - Human-in-the-loop review of all classifications
6. **Export** - Download final CSV for primary system import

### Round-Trip Features
- **Import status tracking** - See which songs were imported successfully
- **Sync detection** - Detect when exported songs are modified externally
- **Re-import** - Update database from primary system changes
- **Conflict resolution** - Handle conflicts between systems gracefully

## System Administration

### User Management
- **Multiple curators** - Support for multiple user accounts
- **Role-based access** - Admin vs curator vs viewer roles
- **Activity tracking** - Track which curator reviewed which songs
- **Workload distribution** - Assign songs to specific curators

### Configuration Management
- **Environment configs** - Separate dev/staging/production configs
- **Feature flags** - Enable/disable features without code changes
- **API key rotation** - Easy API key updates without downtime
- **System health checks** - Monitor system status

### Monitoring & Alerts
- **Performance monitoring** - Track response times, throughput
- **Error alerts** - Slack/email notifications for critical errors
- **Usage alerts** - Notify when approaching API limits
- **System status page** - Public-facing status page

## Client-Specific Features

### Playlist Management
- **Playlist metadata** - Store venue name, type, target audience
- **Playlist versioning** - Track changes to playlists over time
- **Playlist comparison** - Compare two versions side-by-side
- **Playlist templates** - Create new playlists from templates

### Client Portal
- **Client dashboard** - View playlists for specific clients
- **Client feedback** - Clients can provide feedback on classifications
- **Client reports** - Custom reports per client
- **Client branding** - White-label interface per client

### Reporting
- **Classification reports** - Summary of classifications per playlist
- **Cost reports** - API costs per client/playlist
- **Quality reports** - Review completion, error rates
- **Custom reports** - Configurable report builder

---

## Priority Legend
- 🔴 **Critical** - Blocking current workflow
- 🟡 **High** - Significantly improves workflow
- 🟢 **Medium** - Nice to have, moderate impact
- ⚪ **Low** - Future consideration

## Completed Features
- ✅ CSV enrichment pipeline with Gemini + Parallel AI
- ✅ Review interface with filtering and pagination
- ✅ Database layer with Prisma ORM
- ✅ Audio streaming integration
- ✅ Multi-source data merger with fuzzy matching
- ✅ Data quality analysis dashboard
- ✅ CSV export with configurable fields
- ✅ BrainTrust observability integration

---

*Last Updated: 2025-10-29*
