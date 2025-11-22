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
