# Development Database Setup Plan

**Status**: To Do
**Created**: 2025-11-10
**Priority**: HIGH (needed before next major feature)
**Assigned To**: Future Claude agent

## Overview
Set up a local PostgreSQL development database to safely test schema changes, migrations, and new features without risking production data.

## Why This is Important
- ⚠️ Production database has no backups currently
- 🔒 Schema migrations can cause data loss if not tested
- 🚀 Faster development cycle (no fear of breaking production)
- 🧪 Can test with realistic data volumes

## Option A: Docker Setup (RECOMMENDED)

### Prerequisites
- Docker Desktop installed and running
- ~500MB disk space

### Implementation Steps

1. **Create Docker Compose File** (`docker-compose.yml` in project root):
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    container_name: music-classifier-dev-db
    environment:
      POSTGRES_USER: devuser
      POSTGRES_PASSWORD: devpassword
      POSTGRES_DB: music_classifier_dev
    ports:
      - "5433:5432"  # Use 5433 to avoid conflicts with local Postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  postgres_data:
```

2. **Create `.env.local` File** (for local development):
```bash
# Local Development Database (Docker)
POSTGRES_URL_NON_POOLING="postgresql://devuser:devpassword@localhost:5433/music_classifier_dev"
POSTGRES_URL="postgresql://devuser:devpassword@localhost:5433/music_classifier_dev"
POSTGRES_PRISMA_URL="postgresql://devuser:devpassword@localhost:5433/music_classifier_dev"

# Copy all other env vars from .env
GEMINI_API_KEY=<from .env>
PARALLEL_AI_API_KEY=<from .env>
# ... etc
```

3. **Start Database**:
```bash
docker-compose up -d
```

4. **Run Migrations**:
```bash
# Load .env.local instead of .env
npx dotenv -e .env.local -- npx prisma migrate deploy
```

5. **Seed with Test Data**:
```bash
# Option 1: Import from production (backup first!)
npx dotenv -e .env.local -- npm run seed

# Option 2: Use existing test CSV
npx dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv
```

6. **Update npm Scripts** (add to `package.json`):
```json
{
  "scripts": {
    "dev:db:start": "docker-compose up -d",
    "dev:db:stop": "docker-compose down",
    "dev:db:reset": "docker-compose down -v && docker-compose up -d",
    "dev:migrate": "dotenv -e .env.local -- npx prisma migrate dev",
    "dev:studio": "dotenv -e .env.local -- npx prisma studio",
    "dev:seed": "dotenv -e .env.local -- node scripts/seed.js"
  }
}
```

### Daily Workflow
```bash
# Start dev database
npm run dev:db:start

# Run migrations on dev
npm run dev:migrate

# Start dev servers (they'll use .env.local automatically)
npm run dev  # or vercel dev --listen 3001

# View database
npm run dev:studio

# Stop database when done
npm run dev:db:stop
```

### Benefits
- ✅ One command to start/stop database
- ✅ Isolated from production
- ✅ Easy to reset/destroy
- ✅ No system-wide Postgres installation needed
- ✅ Team members can use same setup

---

## Option B: Local Postgres Installation

### Prerequisites
- Homebrew (macOS)
- ~2GB disk space

### Implementation Steps

1. **Install PostgreSQL**:
```bash
brew install postgresql@15
brew services start postgresql@15
```

2. **Create Development Database**:
```bash
createdb music_classifier_dev
```

3. **Create `.env.local` File**:
```bash
POSTGRES_URL_NON_POOLING="postgresql://localhost:5432/music_classifier_dev"
POSTGRES_URL="postgresql://localhost:5432/music_classifier_dev"
POSTGRES_PRISMA_URL="postgresql://localhost:5432/music_classifier_dev"

# Copy other env vars from .env
```

4. **Continue from step 4 in Option A** (migrations, seeding, etc.)

### Benefits
- ✅ No Docker required
- ✅ Faster queries (native)
- ✅ Familiar Postgres tools

### Drawbacks
- ❌ Affects system-wide Postgres installation
- ❌ Harder to reset/destroy
- ❌ Requires manual Postgres management

---

## Environment Variable Strategy

### Current Setup (Production)
- `.env` → Production Vercel Postgres
- Used by all scripts by default

### Proposed Setup (with Dev DB)
- `.env` → Production Vercel Postgres (for production deployments)
- `.env.local` → Local dev database (for local development)
- `.env.test` → Test database (for automated tests - future)

### Tool Behavior
- **Vercel CLI** (`vercel dev`) → Uses `.env.local` if exists, else `.env`
- **Prisma** → Uses `POSTGRES_URL_NON_POOLING` from environment
- **Node scripts** → Use `dotenv` to load `.env.local` explicitly

---

## Database Seeding Strategy

### Option 1: Clone Production Data (Recommended for realistic testing)
```bash
# 1. Export production data (on production .env)
npm run export -- --output=production-backup.csv

# 2. Import to dev database (on .env.local)
npx dotenv -e .env.local -- npm run enrich:playlist production-backup.csv --force-duplicates
```

### Option 2: Use Test CSVs (Faster, less data)
```bash
npx dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv
```

### Option 3: Generate Synthetic Data (Future - for load testing)
Create a script to generate 10,000+ synthetic songs for performance testing.

---

## Backup Strategy (Production - CRITICAL)

While setting up dev database, also implement production backups:

### Automated Backups (Vercel Postgres)
Vercel Postgres Pro plan includes daily backups. Check if enabled:
```bash
vercel postgres --help
```

### Manual Backup Script
Create `scripts/backup-production.sh`:
```bash
#!/bin/bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
pg_dump $POSTGRES_URL_NON_POOLING > backups/production_$TIMESTAMP.sql
echo "Backup saved to backups/production_$TIMESTAMP.sql"
```

### Pre-Migration Backup Checklist
Before running ANY migration on production:
1. ✅ Run manual backup
2. ✅ Test migration on dev database first
3. ✅ Verify no data loss warnings
4. ✅ Have rollback plan ready

---

## Migration Workflow (After Dev DB Setup)

### Development Phase
```bash
# 1. Make schema changes in prisma/schema.prisma
# 2. Create migration on dev DB
npm run dev:migrate

# 3. Test thoroughly on dev DB
npm run dev:studio

# 4. If good, commit migration files
git add prisma/migrations/
git commit -m "feat: add new schema fields"
```

### Production Deployment
```bash
# 1. Backup production first!
./scripts/backup-production.sh

# 2. Run migration on production
npx prisma migrate deploy

# 3. Verify migration succeeded
npx prisma studio

# 4. Deploy code to Vercel
git push origin main
```

---

## Testing Checklist

After dev database setup, test:
- [ ] Migrations run successfully on dev DB
- [ ] Can seed dev DB with test data
- [ ] Dev servers connect to dev DB (not production)
- [ ] Prisma Studio opens correct database
- [ ] Can reset dev DB without affecting production
- [ ] `.env` still points to production (verify before deploy!)

---

## Files to Create

### New Files:
- `docker-compose.yml` - Docker Postgres setup (if using Docker)
- `.env.local` - Local development environment variables
- `.env.example` - Template for team members
- `scripts/backup-production.sh` - Manual backup script
- `.gitignore` - Add `.env.local` (already ignored?)

### Modified Files:
- `package.json` - Add dev database npm scripts
- `README.md` - Document local development setup
- `CLAUDE.md` - Update with dev database workflow

---

## Estimated Time
- **Docker setup**: 30 minutes
- **Migration testing**: 30 minutes
- **Seeding with data**: 15 minutes
- **Documentation**: 15 minutes
- **Total**: ~1.5 hours

---

## Benefits Summary
- ✅ Safe to test schema changes
- ✅ Faster development cycle
- ✅ Realistic testing with production-like data
- ✅ No fear of breaking production
- ✅ Can test destructive operations (deletes, drops)
- ✅ Easier onboarding for new developers
- ✅ Foundation for automated testing (future)

---

## Next Steps (After Setup)

1. **Implement Automated Tests** - Use dev database for integration tests
2. **CI/CD Pipeline** - Run tests against dev DB in GitHub Actions
3. **Staging Environment** - Create separate staging database on Vercel
4. **Backup Automation** - Scheduled backups of production database
5. **Monitoring** - Set up alerts for database issues

---

## Questions to Answer During Setup

1. How much production data to clone for dev? (All vs sample)
2. Should dev database auto-reset daily? (Fresh start each day)
3. Need separate staging database on Vercel?
4. What's the backup retention policy? (7 days? 30 days?)
