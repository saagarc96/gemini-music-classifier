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
  echo "❌ .env.local not found. Please create it first."
  echo ""
  echo "Create .env.local with these database settings:"
  echo "POSTGRES_URL_NON_POOLING=\"postgresql://devuser:devpassword@localhost:5432/music_classifier_dev\""
  echo "POSTGRES_PRISMA_URL=\"postgresql://devuser:devpassword@localhost:5432/music_classifier_dev\""
  echo ""
  echo "Copy other environment variables from .env"
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

# 7. Seed with test data (optional - will fail gracefully if CSV doesn't exist)
echo "🌱 Seeding test data..."
if [ -f "test-data/test-spotify-csv/sample-50-songs.csv" ]; then
  npx dotenv -e .env.local -- npm run enrich:playlist test-data/test-spotify-csv/sample-50-songs.csv --force-duplicates || true
else
  echo "⚠️  Test CSV not found - skipping seed (you can add data later)"
fi

echo ""
echo "✅ Dev database ready!"
echo ""
echo "🎯 Next steps:"
echo "  - Run: vercel dev --listen 3001"
echo "  - View DB: npm run dev:studio"
echo "  - Logs: npm run dev:db:logs"
echo ""
