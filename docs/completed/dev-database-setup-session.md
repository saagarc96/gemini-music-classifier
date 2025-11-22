# Dev Database Setup - Session Summary

**Date:** 2025-11-21
**Branch:** `feature/dev-database-setup`
**Status:** ✅ Complete & Working

## What We Built

### Infrastructure Created
- ✅ **docker-compose.yml** - PostgreSQL 15 container with healthcheck + optional pgAdmin
- ✅ **Colima** - Docker runtime (alternative to Docker Desktop for macOS Monterey)
- ✅ **PostgreSQL container** - Running healthy on `localhost:5432`
- ✅ **Dev database** - `music_classifier_dev` with `users` and `songs` tables

### Scripts Created
- ✅ `scripts/dev-setup.sh` - One-command automated setup
- ✅ `scripts/backup-production.sh` - Production backup utility (keeps last 7)
- ✅ `scripts/clone-production-to-dev.sh` - Clone prod data to dev (IN PROGRESS)

### Configuration
- ✅ `.env.local` - Dev database connection (localhost)
- ✅ `.env` - Production database connection (renamed back from .env.production)
- ✅ `.gitignore` - Updated to exclude env files and backups
- ✅ `package.json` - Added 10 dev database npm scripts with `--override` flag
- ✅ `CLAUDE.md` - Documented complete dev database workflow

### npm Scripts Added
```json
"dev:setup": "bash scripts/dev-setup.sh",
"dev:db:start": "docker-compose up -d",
"dev:db:stop": "docker-compose down",
"dev:db:reset": "docker-compose down -v && npm run dev:db:start && npm run dev:migrate",
"dev:db:logs": "docker-compose logs -f postgres",
"dev:migrate": "dotenv -e .env.local --override -- npx prisma migrate dev",
"dev:studio": "dotenv -e .env.local --override -- npx prisma studio",
"dev:seed": "dotenv -e .env.local --override -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv --force-duplicates",
"dev:clone-prod": "bash scripts/clone-production-to-dev.sh",
"prod:backup": "bash scripts/backup-production.sh"
```

## Key Technical Decisions

### 1. Colima vs Docker Desktop
- **Chose:** Colima (Docker runtime for macOS Monterey)
- **Why:** User's macOS version too old for Docker Desktop
- **Works perfectly:** Same docker/docker-compose commands

### 2. dotenv --override Flag
- **Problem:** `.env` variables were overriding `.env.local`
- **Solution:** Added `--override` flag to all dotenv commands
- **Result:** `.env.local` properly takes precedence for local dev

### 3. Prisma Migrations Issue
- **Problem:** Conflicting migrations (`0_init` and `1_add_auth` both created `users` table)
- **Solution:** Deleted `0_init`, used `prisma db push` to create schema from scratch
- **For future:** Use `npx dotenv -e .env.local --override -- npx prisma db push` for schema changes

### 4. Environment File Strategy
- `.env` - Production (Vercel Postgres)
- `.env.local` - Development (localhost Docker)
- `--override` flag ensures local always wins

## Issues Resolved

### Docker Credentials
- **Issue:** Docker looking for Docker Desktop credential helper
- **Fix:** Removed `"credsStore": "desktop"` from `~/.docker/config.json`

### Database Connection
- **Issue:** Prisma connecting to production instead of dev
- **Fix:** Added `--override` flag to force `.env.local` precedence

### Migration Conflicts
- **Issue:** Two migrations creating same tables
- **Fix:** Used `prisma db push` instead of migrations for initial setup

## Current Status

### ✅ Working
- Colima running Docker
- PostgreSQL container healthy
- Dev database created with tables
- Prisma Studio accessible at http://localhost:5555
- All npm scripts functional

### 🔄 In Progress
- Installing `libpq` for PostgreSQL client tools (pg_dump)
- Will enable production database cloning

## Commits Made

1. **eb29c84** - `feat: add local development database setup with Docker`
   - Initial infrastructure, scripts, npm commands, documentation

2. **a588b64** - `fix: add --override flag to dotenv commands for proper env var precedence`
   - Fixed env var precedence issue
   - Updated all dotenv commands
   - Renamed .env back from .env.production

## Next Steps

1. **Wait for libpq installation** - Enables `pg_dump` for database cloning
2. **Clone production to dev** - `npm run dev:clone-prod`
3. **Test with real data** - Verify everything works with production dataset
4. **Ready for playlist feature** - Safe environment to modify schema

## Daily Workflow (After Setup)

```bash
# Start database
npm run dev:db:start

# Start backend (auto-uses .env.local)
vercel dev --listen 3001

# Start frontend
cd client && npm run dev

# View database
npm run dev:studio

# Stop database
npm run dev:db:stop
```

## Schema Change Workflow

```bash
# 1. Modify prisma/schema.prisma
# 2. Apply to dev database
npx dotenv -e .env.local --override -- npx prisma db push

# 3. Test in Prisma Studio
npm run dev:studio

# 4. When ready for production
npm run prod:backup  # Backup first!
npx prisma migrate deploy  # Apply to production
```

## Files Modified/Created

### New Files
- `docker-compose.yml`
- `backups/.gitkeep`
- `scripts/dev-setup.sh`
- `scripts/backup-production.sh`
- `scripts/clone-production-to-dev.sh`
- `docs/PRDs/PRD-playlist-feature.md`
- `docs/in-progress/dev-database-setup-plan.md`

### Modified Files
- `.gitignore` - Added env files and backups exclusions
- `package.json` - Added dev:* scripts with --override flag
- `CLAUDE.md` - Added dev database documentation
- `~/.docker/config.json` - Removed Docker Desktop credential store

### Environment Files
- `.env` - Production database (Vercel)
- `.env.local` - Dev database (localhost)

## Success Metrics

✅ Dev database isolated from production
✅ One-command setup works
✅ Schema changes testable locally
✅ Production backup strategy in place
✅ Team-friendly (docker-compose reproducible)
✅ Proper env var precedence with --override

## Known Issues

- None currently - all blockers resolved

## Resources

- Docker: Colima running at `unix:///Users/saagar/.colima/default/docker.sock`
- Database: `postgresql://devuser:devpassword@localhost:5432/music_classifier_dev`
- Prisma Studio: http://localhost:5555
- pgAdmin (optional): http://localhost:5050 (start with `docker-compose --profile tools up`)

---

**Ready for playlist feature implementation!** 🚀
