/**
 * Database Schema Creation Script (Prisma)
 *
 * This script creates the songs table in Vercel Postgres using Prisma Migrate.
 *
 * Usage:
 *   node scripts/create-schema.js
 *
 * Prerequisites:
 *   - Vercel Postgres database created
 *   - Environment variables set (POSTGRES_PRISMA_URL, POSTGRES_URL_NON_POOLING)
 *   - Prisma installed
 */

import { execSync } from 'child_process';

async function createSchema() {
  console.log('🔨 Creating database schema with Prisma...\n');

  try {
    // Run Prisma migrate to create/update the database schema
    console.log('Running Prisma migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

    console.log('\n🎉 Schema created successfully!');
    console.log('\nNext step: Run `npm run seed` to import your batch CSV\n');

  } catch (error) {
    console.error('❌ Error creating schema:', error);
    console.error('\nTip: Make sure you have run `vercel env pull .env.local` to get your database credentials.');
    process.exit(1);
  }
}

createSchema()
  .catch((error) => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
