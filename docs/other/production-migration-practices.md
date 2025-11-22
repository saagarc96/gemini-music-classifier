# Production Database Migration Best Practices

Since we've discovered that Vercel serverless functions always connect to the production database (even in local development), this guide outlines safe practices for performing intensive database migrations.

## Core Principles

1. **Always backup before migrations**
2. **Test migration SQL on dev database first** (validate syntax/logic)
3. **Use additive changes when possible** (backwards compatible)
4. **Plan rollback strategy before executing**
5. **Perform migrations during low-traffic periods**

## Pre-Migration Checklist

### 1. Backup Production Database

**Before ANY schema change:**

```bash
npm run prod:backup
```

This creates a timestamped backup in `backups/prod_backup_YYYYMMDD_HHMMSS.sql`.

**Verify backup was created:**
```bash
ls -lh backups/
# Should show recent .sql file with reasonable size
```

### 2. Test Migration on Dev Database

Even though your app won't connect to it, the dev database is perfect for validating migration SQL:

```bash
# Start dev database
npm run dev:db:start

# Apply migration to dev database first
npm run dev:migrate

# Verify schema in Prisma Studio
npm run dev:studio
```

**What to check:**
- Migration runs without errors
- Schema changes are correct
- No data loss on dev database
- Foreign key constraints work
- Indexes are created properly

### 3. Review Generated Migration SQL

Prisma generates SQL in `prisma/migrations/[timestamp]_[name]/migration.sql`.

**Review for:**
- `DROP TABLE` commands (extremely dangerous)
- `ALTER TABLE ... DROP COLUMN` (data loss)
- Missing `NOT NULL` defaults (will fail on existing rows)
- Complex multi-table changes (higher risk)

## Migration Execution Strategy

### For Additive Changes (Low Risk)

**Examples:** Adding new table, adding nullable column, creating index

```bash
# 1. Backup production
npm run prod:backup

# 2. Create migration
npx prisma migrate dev --name add_playlist_table

# 3. Test on dev database
npm run dev:migrate

# 4. Verify in dev Prisma Studio
npm run dev:studio

# 5. Apply to production
npx prisma migrate deploy

# 6. Verify production
npx prisma studio  # Check production data
```

**Rollback if needed:**
```bash
# Restore from backup
cat backups/prod_backup_[timestamp].sql | \
  psql "$POSTGRES_URL_NON_POOLING"
```

### For Destructive Changes (High Risk)

**Examples:** Removing columns, changing data types, renaming tables

**Multi-phase approach:**

#### Phase 1: Add New Structure (Safe)
```bash
# Example: Renaming 'artist' to 'artist_name'

# Step 1: Add new column
# Edit schema.prisma:
model Song {
  artist      String  // Keep old column
  artist_name String? // Add new column (nullable)
}

npm run prod:backup
npx prisma migrate dev --name add_artist_name_column
npm run dev:migrate  # Test on dev
npx prisma migrate deploy  # Apply to prod
```

#### Phase 2: Migrate Data
```bash
# Step 2: Copy data (SQL script)
cat > scripts/migrate-artist-data.sql << 'EOF'
UPDATE "Song" SET artist_name = artist WHERE artist_name IS NULL;
EOF

# Apply to dev first
npm run dev:db:start
docker-compose exec -T postgres psql -U devuser -d music_classifier_dev \
  < scripts/migrate-artist-data.sql

# Verify on dev
npm run dev:studio

# Apply to production
cat scripts/migrate-artist-data.sql | psql "$POSTGRES_URL_NON_POOLING"
```

#### Phase 3: Remove Old Structure (After Verification)
```bash
# Step 3: Drop old column (days/weeks later, after confirming app works)
# Edit schema.prisma:
model Song {
  artist_name String  // Make required, remove old column
}

npm run prod:backup
npx prisma migrate dev --name remove_old_artist_column
npm run dev:migrate
npx prisma migrate deploy
```

### For Complex Multi-Table Changes

**Use transactions and staged rollout:**

```sql
-- Example: Adding playlist feature with junction table

BEGIN;

-- Create tables in correct order (respect foreign keys)
CREATE TABLE "Playlist" (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "PlaylistSong" (
  id SERIAL PRIMARY KEY,
  playlist_id INTEGER REFERENCES "Playlist"(id) ON DELETE CASCADE,
  song_isrc VARCHAR(255) REFERENCES "Song"(isrc) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(playlist_id, song_isrc)
);

CREATE INDEX idx_playlist_song_playlist ON "PlaylistSong"(playlist_id);
CREATE INDEX idx_playlist_song_song ON "PlaylistSong"(song_isrc);

COMMIT;
```

**Test transaction on dev:**
```bash
# Save as scripts/add-playlist-schema.sql
npm run dev:db:start
docker-compose exec -T postgres psql -U devuser -d music_classifier_dev \
  < scripts/add-playlist-schema.sql
```

## Emergency Rollback Procedures

### Quick Rollback (Recent Backup)

```bash
# 1. Stop accepting new writes (if possible)
# Comment out write endpoints temporarily

# 2. Restore from backup
npm run prod:backup  # Create pre-rollback backup first!

# 3. Apply previous backup
cat backups/prod_backup_[before_migration_timestamp].sql | \
  psql "$POSTGRES_URL_NON_POOLING"

# 4. Verify data
npx prisma studio
```

### Rollback with Migration Reset

```bash
# If migration is already in git history:

# 1. Backup current state
npm run prod:backup

# 2. Mark migration as rolled back
npx prisma migrate resolve --rolled-back [migration_name]

# 3. Manually revert schema changes
# Edit prisma/schema.prisma

# 4. Generate client
npx prisma generate
```

## Common Migration Patterns

### Adding Required Column to Existing Table

**Problem:** Can't add `NOT NULL` column to table with existing rows.

**Solution:**
```prisma
// Step 1: Add as nullable
model Song {
  new_field String?  // Nullable first
}

// Migrate
// Then populate data...

// Step 2: Make required later
model Song {
  new_field String  // Remove ? after data populated
}
```

### Changing Column Type

**Problem:** Direct type change may fail on existing data.

**Solution:**
```bash
# 1. Add new column with new type
# 2. Migrate data with transformation
# 3. Drop old column
# 4. Rename new column (or update app to use new column name)
```

### Renaming Column

**Prisma generates DROP + ADD, losing data!**

**Solution:**
```bash
# 1. Don't rename in Prisma schema yet
# 2. Manually create migration with ALTER TABLE RENAME COLUMN
# 3. Then update Prisma schema to match
```

**Example:**
```sql
-- In migration.sql (manually edit after prisma migrate dev):
ALTER TABLE "Song" RENAME COLUMN "old_name" TO "new_name";
```

## Monitoring After Migration

### Verify Migration Success

```bash
# 1. Check Prisma Studio for schema changes
npx prisma studio

# 2. Test critical queries
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.song.findFirst().then(console.log).catch(console.error);
"

# 3. Check application logs (Vercel dashboard)
vercel logs --follow

# 4. Test review interface
# Open http://localhost:3000 and verify:
# - Songs load
# - Filters work
# - Can edit songs
# - No console errors
```

### Performance Monitoring

After adding indexes or constraints:

```sql
-- Check index usage (run on production)
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan as scans
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan ASC;
```

## Development Workflow with Production DB

### Daily Development (Non-Schema Changes)

```bash
# Terminal 1: Backend (connects to production)
vercel dev --listen 3001

# Terminal 2: Frontend
cd client && npm run dev

# Work on UI, business logic, API endpoints
# All changes affect production database!
```

**Safe practices:**
- Test with specific ISRCs you know
- Use test playlists (mark them clearly: "TEST - Delete Me")
- Avoid bulk operations during development
- Use `--dry-run` flags when available

### Schema Changes (Use Dev DB First)

```bash
# 1. Start dev database
npm run dev:db:start

# 2. Make schema changes
# Edit prisma/schema.prisma

# 3. Test migration on dev
npm run dev:migrate

# 4. Verify in Prisma Studio (dev DB)
npm run dev:studio

# 5. Apply to production when ready
npm run prod:backup
npx prisma migrate deploy
```

## Backup Retention Strategy

```bash
# Keep backups organized
backups/
├── prod_backup_20250121_103000.sql  # Before playlist feature
├── prod_backup_20250121_143000.sql  # Before subgenre refactor
└── prod_backup_20250122_090000.sql  # Latest

# Compress old backups
gzip backups/prod_backup_20250121_*.sql

# Archive monthly
mkdir -p backups/archive/2025-01/
mv backups/prod_backup_202501*.sql.gz backups/archive/2025-01/
```

## Summary: Safe Migration Workflow

1. ✅ **Backup production** (`npm run prod:backup`)
2. ✅ **Create migration** (`npx prisma migrate dev --name ...`)
3. ✅ **Test on dev database** (`npm run dev:migrate`)
4. ✅ **Review generated SQL** (`prisma/migrations/`)
5. ✅ **Apply to production** (`npx prisma migrate deploy`)
6. ✅ **Verify application** (test UI, check logs)
7. ✅ **Monitor for issues** (first 24 hours)
8. ✅ **Keep backup for 7+ days** before deleting

## When Things Go Wrong

**Symptoms:**
- Application crashes after migration
- Songs not loading
- Constraint violation errors
- Slow queries

**Immediate actions:**
1. Check Vercel logs: `vercel logs --follow`
2. Check database in Prisma Studio: `npx prisma studio`
3. Verify migration status: `npx prisma migrate status`
4. If critical: Rollback immediately (see above)

**Always remember:**
- Production backups are your safety net
- Test migrations on dev database first
- Use additive changes when possible
- Plan rollback before executing
