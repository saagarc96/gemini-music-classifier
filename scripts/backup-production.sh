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
ls -t "$BACKUP_DIR"/backup_*.sql 2>/dev/null | tail -n +8 | xargs -r rm || true

echo "📋 Remaining backups:"
ls -lh "$BACKUP_DIR"/backup_*.sql 2>/dev/null || echo "  (this is the first backup)"
