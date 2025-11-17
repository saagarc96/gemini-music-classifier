#!/usr/bin/env node

/**
 * Add media URL columns to songs table
 */

const { Client } = require('pg');

async function migrate() {
  const client = new Client({
    connectionString: process.env.POSTGRES_URL_NON_POOLING
  });

  try {
    await client.connect();
    console.log('Connected to database');

    // Add columns if they don't exist
    await client.query(`
      ALTER TABLE songs
      ADD COLUMN IF NOT EXISTS s3_url TEXT,
      ADD COLUMN IF NOT EXISTS artwork_url TEXT,
      ADD COLUMN IF NOT EXISTS spotify_preview_url TEXT,
      ADD COLUMN IF NOT EXISTS spotify_artwork_url TEXT;
    `);

    console.log('✅ Successfully added media URL columns to songs table');
    console.log('   - s3_url');
    console.log('   - artwork_url');
    console.log('   - spotify_preview_url');
    console.log('   - spotify_artwork_url');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
