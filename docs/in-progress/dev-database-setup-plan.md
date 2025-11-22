# Development Database Setup Plan

**Status**: Ready to Execute
**Created**: 2025-11-10
**Updated**: 2025-11-21
**Priority**: HIGH (needed before playlist feature)
**Assigned To**: Implementation ready

## Overview
Set up a local PostgreSQL development database to safely test schema changes, migrations, and new features without risking production data.

## Why This is Important
- ⚠️ Production database has no backups currently
- 🔒 Schema migrations can cause data loss if not tested
- 🚀 Faster development cycle (no fear of breaking production)
- 🧪 Can test with realistic data volumes
- 📋 **CRITICAL**: Required before implementing playlist feature

## Option A: Docker Setup (RECOMMENDED)

### Prerequisites
- Docker Desktop installed and running
- ~500MB disk space
- `dotenv-cli` package (installed in step 1)

### Implementation Steps

#### 1. **Install Dependencies**
```bash
npm install --save-dev dotenv-cli
```

#### 2. **Create Docker Compose File** (`docker-compose.yml` in project root):
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
      - "5432:5432"  # Default port (Docker handles isolation)
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backups:/backups  # Mount backups folder for easy access
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U devuser -d music_classifier_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  # Optional: pgAdmin for GUI database management
  pgadmin:
    image: dpage/pgadmin4:latest
    container_name: music-classifier-pgadmin
    environment:
      PGADMIN_DEFAULT_EMAIL: dev@localhost.com
      PGADMIN_DEFAULT_PASSWORD: admin
    ports:
      - "5050:80"
    depends_on:
      - postgres
    profiles: ["tools"]  # Only start with: docker-compose --profile tools up

volumes:
  postgres_data:
```

**Why these changes:**
- Port 5432 (not 5433) - Docker provides isolation, no conflicts
- Healthcheck ensures DB is ready before running migrations
- Backups volume for easy backup/restore
- pgAdmin optional for GUI lovers (start with `docker-compose --profile tools up`)

#### 3. **Create `.env.local` File** (for local development):
```bash
# Local Development Database (Docker)
POSTGRES_URL_NON_POOLING="postgresql://devuser:devpassword@localhost:5432/music_classifier_dev"
POSTGRES_PRISMA_URL="postgresql://devuser:devpassword@localhost:5432/music_classifier_dev"

# API Keys (same as production - read-only operations are safe)
GEMINI_API_KEY=<copy from .env>
PARALLEL_AI_API_KEY=<copy from .env>
SPOTIFY_CLIENT_ID=<copy from .env>
SPOTIFY_CLIENT_SECRET=<copy from .env>

# Optional: Analytics
BRAINTRUST_API_KEY=<copy from .env>
```

**Note:** For local dev, both database URLs can be identical (no connection pooling needed).

#### 4. **Create `.env.example` Template** (for team/documentation):
```bash
# Database (use .env.local for dev, .env for production)
POSTGRES_URL_NON_POOLING=""
POSTGRES_PRISMA_URL=""

# AI Services
GEMINI_API_KEY=""
PARALLEL_AI_API_KEY=""

# Spotify (optional - for imports)
SPOTIFY_CLIENT_ID=""
SPOTIFY_CLIENT_SECRET=""

# Optional: Analytics
BRAINTRUST_API_KEY=""
```

#### 5. **Start Database**:
```bash
docker-compose up -d
```

#### 6. **Verify Database Connection**:
```bash
# Wait for healthcheck to pass
docker-compose ps

# Should show "healthy" status
# Test connection directly
psql postgresql://devuser:devpassword@localhost:5432/music_classifier_dev -c "\l"
```

#### 7. **Run Initial Migration**:
```bash
# Use 'migrate dev' for local development (not 'migrate deploy')
npx dotenv -e .env.local -- npx prisma migrate dev
```

**Important:**
- `migrate dev` - For local dev (creates migrations, can reset DB)
- `migrate deploy` - For production only (never resets, applies existing migrations)

#### 8. **Seed with Test Data**:
```bash
# Option 1: Quick test with sample CSV
npx dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv --force-duplicates

# Option 2: Clone production data (see scripts below)
npm run dev:clone-prod
```

#### 9. **Update npm Scripts** (add to `package.json`):
```json
{
  "scripts": {
    "dev:setup": "bash scripts/dev-setup.sh",
    "dev:db:start": "docker-compose up -d",
    "dev:db:stop": "docker-compose down",
    "dev:db:reset": "docker-compose down -v && npm run dev:db:start && npm run dev:migrate",
    "dev:db:logs": "docker-compose logs -f postgres",
    "dev:migrate": "dotenv -e .env.local -- npx prisma migrate dev",
    "dev:studio": "dotenv -e .env.local -- npx prisma studio",
    "dev:seed": "dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv --force-duplicates",
    "dev:clone-prod": "bash scripts/clone-production-to-dev.sh",
    "prod:backup": "bash scripts/backup-production.sh"
  }
}
```

### Daily Workflow
```bash
# First time only
npm run dev:setup  # Automated setup script (see below)

# Daily workflow
npm run dev:db:start              # Start database
vercel dev --listen 3001           # Start backend (auto-uses .env.local)
cd client && npm run dev           # Start frontend (separate terminal)

# View/manage database
npm run dev:studio                 # Open Prisma Studio
# OR
docker-compose --profile tools up  # Start pgAdmin at localhost:5050

# Check database logs
npm run dev:db:logs

# Stop database when done
npm run dev:db:stop

# Nuclear option: Reset everything
npm run dev:db:reset
```

### Benefits
- ✅ One command to start/stop database
- ✅ Isolated from production
- ✅ Easy to reset/destroy
- ✅ No system-wide Postgres installation needed
- ✅ Team members can use same setup
- ✅ Healthcheck prevents migration failures
- ✅ Backups easily accessible in ./backups folder

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
POSTGRES_PRISMA_URL="postgresql://localhost:5432/music_classifier_dev"

# Copy other env vars from .env
```

4. **Verify Connection**:
```bash
psql music_classifier_dev -c "\l"
```

5. **Continue from step 7 in Option A** (migrations, seeding, npm scripts)

### Benefits
- ✅ No Docker required
- ✅ Faster queries (native)
- ✅ Familiar Postgres tools

### Drawbacks
- ❌ Affects system-wide Postgres installation
- ❌ Harder to reset/destroy
- ❌ Requires manual Postgres management
- ❌ Harder for team to replicate setup

---

## Automated Setup Scripts

### 1. One-Command Setup Script

Create `scripts/dev-setup.sh`:
```bash
#!/bin/bash
set -e

echo "🚀 Setting up development database..."

# 1. Check Docker is running
if ! docker info > /dev/null 2>&1; then
  echo "❌ Docker is not running. Please start Docker Desktop."
  exit 1
fi

# 2. Install dependencies
echo "📦 Installing dotenv-cli..."
npm install --save-dev dotenv-cli

# 3. Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ .env.local not found. Please create it first (see docs)."
  exit 1
fi

# 4. Start database
echo "🐘 Starting PostgreSQL..."
docker-compose up -d

# 5. Wait for healthcheck
echo "⏳ Waiting for database to be ready..."
timeout 30s bash -c 'until docker-compose ps | grep -q "healthy"; do sleep 1; done' || {
  echo "❌ Database health check timed out"
  exit 1
}

# 6. Run migrations
echo "🔄 Running migrations..."
npx dotenv -e .env.local -- npx prisma migrate dev --name initial

# 7. Seed with test data
echo "🌱 Seeding test data..."
npx dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv --force-duplicates || true

echo ""
echo "✅ Dev database ready!"
echo ""
echo "🎯 Next steps:"
echo "  - Run: vercel dev --listen 3001"
echo "  - View DB: npm run dev:studio"
echo "  - Logs: npm run dev:db:logs"
echo ""
```

Make executable:
```bash
chmod +x scripts/dev-setup.sh
```

### 2. Production Backup Script

Create `scripts/backup-production.sh`:
```bash
#!/bin/bash
set -e

# Source the correct environment
ENV_FILE="${1:-.env}"  # Default to .env, or pass .env.local
source "$ENV_FILE"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

echo "📦 Backing up database from $ENV_FILE..."
pg_dump "$POSTGRES_URL_NON_POOLING" > "$BACKUP_DIR/backup_$TIMESTAMP.sql"

echo "✅ Backup saved to $BACKUP_DIR/backup_$TIMESTAMP.sql"
echo "📊 Size: $(du -h "$BACKUP_DIR/backup_$TIMESTAMP.sql" | cut -f1)"

# Keep only last 7 backups
echo "🧹 Cleaning old backups (keeping last 7)..."
ls -t "$BACKUP_DIR"/backup_*.sql | tail -n +8 | xargs -r rm

echo "📋 Remaining backups:"
ls -lh "$BACKUP_DIR"/backup_*.sql
```

Make executable:
```bash
chmod +x scripts/backup-production.sh
```

### 3. Clone Production to Dev Script

Create `scripts/clone-production-to-dev.sh`:
```bash
#!/bin/bash
set -e

echo "⚠️  WARNING: This will REPLACE all data in your dev database!"
read -p "Continue? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Cancelled."
  exit 1
fi

echo "🔒 Backing up production database..."
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p backups

# Export from production
source .env
pg_dump "$POSTGRES_URL_NON_POOLING" > backups/prod_backup_$TIMESTAMP.sql

echo "📦 Dropping and recreating dev database..."
source .env.local
docker-compose exec -T postgres psql -U devuser -d postgres -c "DROP DATABASE IF EXISTS music_classifier_dev;"
docker-compose exec -T postgres psql -U devuser -d postgres -c "CREATE DATABASE music_classifier_dev;"

echo "📥 Importing to dev database..."
docker-compose exec -T postgres psql -U devuser -d music_classifier_dev < backups/prod_backup_$TIMESTAMP.sql

echo "✅ Done! Dev database now has production data from $TIMESTAMP"
echo "📊 Backup saved to: backups/prod_backup_$TIMESTAMP.sql"
```

Make executable:
```bash
chmod +x scripts/clone-production-to-dev.sh
```

---

## Environment Variable Strategy

### Current Setup (Production)
- `.env` → Production Vercel Postgres
- Used by all scripts by default
- **Risk:** Easy to accidentally modify production

### Proposed Setup (with Dev DB)
- `.env` → Production Vercel Postgres (for production deployments)
- `.env.local` → Local dev database (for local development)
- `.env.example` → Template for team members (no secrets)
- `.env.test` → Test database (for automated tests - future)

### Tool Behavior
- **Vercel CLI** (`vercel dev`) → Automatically uses `.env.local` if exists, else `.env`
- **Prisma** → Uses `POSTGRES_URL_NON_POOLING` from environment
- **Node scripts** → Use `dotenv -e .env.local` to explicitly load dev environment

### Safety Features
- `.env.local` in `.gitignore` (never committed)
- `.env` remains unchanged (always points to production)
- Scripts default to `.env` unless explicitly told otherwise
- Always verify which DB you're connected to before destructive operations

---

## Database Seeding Strategy

### Option 1: Clone Production Data (Recommended for realistic testing)
```bash
npm run dev:clone-prod
```

**Pros:**
- Realistic data volumes
- Test with actual edge cases
- Reproduce production bugs locally

**Cons:**
- Takes longer to import
- May contain sensitive data
- Larger database size

### Option 2: Use Test CSVs (Faster, less data)
```bash
npm run dev:seed
```

**Pros:**
- Fast to import (50 songs)
- No sensitive data
- Repeatable/predictable

**Cons:**
- Not realistic volume
- May miss edge cases
- Limited test coverage

### Option 3: Generate Synthetic Data (Future - for load testing)
Create a script to generate 10,000+ synthetic songs for performance testing.

**Use case:**
- Test pagination performance
- Stress test API endpoints
- Verify indexes are working

---

## Backup Strategy (Production - CRITICAL)

### Automated Backups (Vercel Postgres)
Vercel Postgres Pro plan includes automated daily backups.

**Check if enabled:**
```bash
vercel postgres --help
# Or check Vercel dashboard
```

**Recommendation:** Enable if not already active (worth the cost).

### Manual Backup Script
```bash
# Backup production
npm run prod:backup

# Backup dev (if needed)
npm run prod:backup .env.local
```

**Retention policy:**
- Last 7 backups kept automatically
- Older backups deleted to save space
- Before migrations: Always backup manually

### Pre-Migration Backup Checklist
Before running ANY migration on production:
- [ ] Run manual backup: `npm run prod:backup`
- [ ] Verify backup file exists and has reasonable size
- [ ] Test migration on dev database first: `npm run dev:migrate`
- [ ] Verify no data loss warnings in migration output
- [ ] Have rollback plan ready (restore from backup)
- [ ] Confirm `.env` points to production (not `.env.local`)

---

## Migration Workflow (After Dev DB Setup)

### Development Phase
```bash
# 1. Make schema changes in prisma/schema.prisma
# (e.g., add Playlist and PlaylistSong models)

# 2. Create migration on dev DB
npm run dev:migrate
# Prisma will prompt for migration name: "add-playlists"

# 3. Test thoroughly on dev DB
npm run dev:studio  # Visual inspection
npm run dev:seed    # Test with fresh data

# 4. If migration looks good, verify files created
ls -la prisma/migrations/

# 5. Commit migration files
git add prisma/migrations/ prisma/schema.prisma
git commit -m "feat: add playlists schema for multi-playlist support"
```

### Production Deployment
```bash
# 1. Backup production first! (CRITICAL)
npm run prod:backup

# 2. Verify you're targeting production
source .env
echo $POSTGRES_URL_NON_POOLING  # Should be vercel-storage.com

# 3. Run migration on production (applies existing migrations only)
npx prisma migrate deploy

# 4. Verify migration succeeded
npx prisma studio  # Check tables were created

# 5. Deploy code to Vercel
git push origin main

# 6. Monitor for errors
vercel logs --follow
```

---

## Testing Checklist

After dev database setup, verify:
- [ ] Docker containers start successfully: `docker-compose ps`
- [ ] Database healthcheck passes (shows "healthy")
- [ ] Can connect to database: `psql postgresql://devuser:devpassword@localhost:5432/music_classifier_dev`
- [ ] Migrations run successfully: `npm run dev:migrate`
- [ ] Can seed dev DB with test data: `npm run dev:seed`
- [ ] Vercel dev connects to dev DB (not production): `vercel dev --listen 3001`
- [ ] Prisma Studio opens correct database: `npm run dev:studio`
- [ ] Can reset dev DB without affecting production: `npm run dev:db:reset`
- [ ] `.env` still points to production: `cat .env | grep POSTGRES`
- [ ] `.env.local` in `.gitignore`: `git check-ignore .env.local`
- [ ] Backup script works: `npm run prod:backup`

---

## Files to Create

### New Files:
- ✅ `docker-compose.yml` - Docker Postgres setup
- ✅ `.env.local` - Local development environment variables
- ✅ `.env.example` - Template for team members (no secrets)
- ✅ `scripts/backup-production.sh` - Manual backup script
- ✅ `scripts/dev-setup.sh` - Automated first-time setup
- ✅ `scripts/clone-production-to-dev.sh` - Clone prod data to dev
- ✅ `backups/.gitkeep` - Create backups directory

### Modified Files:
- ✅ `package.json` - Add dev database npm scripts
- ✅ `.gitignore` - Add `.env.local`, `backups/*.sql`
- ✅ `README.md` - Document local development setup
- ✅ `CLAUDE.md` - Update with dev database workflow

### .gitignore Additions
```bash
# Environment files
.env.local
.env.production

# Database backups
backups/*.sql

# Keep backups directory but not files
!backups/.gitkeep
```

---

## Estimated Time

- **Docker setup**: 15 minutes (with automated script)
- **Migration testing**: 30 minutes
- **Seeding with data**: 15 minutes (test CSV) or 60 minutes (clone production)
- **Documentation**: 15 minutes
- **Total**: ~1-2 hours (depending on data seeding choice)

---

## Benefits Summary

- ✅ Safe to test schema changes (playlists feature!)
- ✅ Faster development cycle (no network latency)
- ✅ Realistic testing with production-like data
- ✅ No fear of breaking production
- ✅ Can test destructive operations (deletes, drops, resets)
- ✅ Easier onboarding for new developers
- ✅ Foundation for automated testing (future)
- ✅ Backup strategy in place
- ✅ One-command setup for entire team

---

## Next Steps (After Setup)

### Immediate (This Session)
1. **Run dev setup**: `npm run dev:setup`
2. **Verify everything works**: Run testing checklist
3. **Implement playlist feature**: Safe to modify schema now
4. **Test migration locally**: `npm run dev:migrate`
5. **Deploy to production**: Only after thorough testing

### Short Term (Next 2 Weeks)
1. **Document workflow** - Update README and CLAUDE.md
2. **Team training** - Share setup instructions with team
3. **Backup automation** - Schedule daily production backups

### Long Term (Future)
1. **Implement Automated Tests** - Use dev database for integration tests
2. **CI/CD Pipeline** - Run tests against dev DB in GitHub Actions
3. **Staging Environment** - Create separate staging database on Vercel
4. **Monitoring** - Set up alerts for database issues
5. **Load Testing** - Generate synthetic data for performance testing

---

## Questions to Answer During Setup

1. ✅ **How much production data to clone for dev?**
   - **Answer:** Start with test CSV (50 songs), clone production if needed for specific testing

2. ✅ **Should dev database auto-reset daily?**
   - **Answer:** No - manual reset only (`npm run dev:db:reset`)

3. ⏳ **Need separate staging database on Vercel?**
   - **Answer:** Future consideration - dev database sufficient for now

4. ✅ **What's the backup retention policy?**
   - **Answer:** Keep last 7 backups locally, rely on Vercel for long-term retention

5. ✅ **Use pgAdmin or Prisma Studio?**
   - **Answer:** Both available - Prisma Studio by default, pgAdmin optional

---

## Troubleshooting

### Docker won't start
```bash
# Check if Docker Desktop is running
docker info

# Check for port conflicts
lsof -i :5432

# View logs
docker-compose logs postgres
```

### Can't connect to database
```bash
# Verify container is healthy
docker-compose ps

# Check environment variables
source .env.local
echo $POSTGRES_URL_NON_POOLING

# Test connection directly
psql "$POSTGRES_URL_NON_POOLING" -c "\l"
```

### Migration fails
```bash
# Check which database you're targeting
source .env.local  # Should be dev
echo $POSTGRES_URL_NON_POOLING

# Reset dev database and try again
npm run dev:db:reset
npm run dev:migrate
```

### Prisma connects to wrong database
```bash
# Verify .env.local exists
cat .env.local

# Explicitly use .env.local
npx dotenv -e .env.local -- npx prisma studio
```

---

## Summary

This plan provides:
- ✅ Complete Docker-based dev database setup
- ✅ Automated setup script (run once)
- ✅ Production backup strategy
- ✅ Safe migration workflow (dev → prod)
- ✅ Team-friendly setup (docker-compose)
- ✅ Clear separation of dev/prod environments
- ✅ npm scripts for all common operations
- ✅ Comprehensive testing checklist

**Ready to execute!** Run `npm run dev:setup` to begin.

---

**Document Version:** 2.0
**Last Updated:** 2025-11-21
**Next Review:** After successful implementation
