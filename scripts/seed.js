/**
 * CSV Seed Script (Prisma)
 *
 * Imports batch classification CSV into Vercel Postgres database using Prisma Client.
 *
 * Usage:
 *   node scripts/seed.js
 *
 * Prerequisites:
 *   - Schema created (run create-schema.js first)
 *   - Environment variables set (POSTGRES_PRISMA_URL)
 *   - Prisma Client generated
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to batch CSV output
const CSV_PATH = path.join(__dirname, '../archives/outputs-from-energy-tagger/outputs/batch-output-2025-10-27T03-23-47.csv');

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting seed process...\n');

  // Check if CSV file exists
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`❌ CSV file not found at: ${CSV_PATH}`);
    console.error('Please ensure the batch output CSV exists at the specified path.');
    process.exit(1);
  }

  console.log(`📂 Reading CSV from: ${CSV_PATH}\n`);

  try {
    // Read and parse CSV
    const csvContent = fs.readFileSync(CSV_PATH, 'utf-8');

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      cast: (value, context) => {
        // Convert "NULL" string to actual null
        if (value === 'NULL' || value === '' || value === 'null') {
          return null;
        }
        // Convert numeric strings to numbers for bpm
        if (context.column === 'bpm' && value) {
          const num = parseInt(value, 10);
          return isNaN(num) ? null : num;
        }
        return value;
      },
    });

    console.log(`📊 Found ${records.length} songs in CSV\n`);

    let inserted = 0;
    let updated = 0;
    let errors = 0;

    // Process each song
    for (const [index, row] of records.entries()) {
      try {
        // Generate temp ISRC if missing
        const isrc = row.isrc && row.isrc !== 'NULL' && row.isrc.trim() !== ''
          ? row.isrc
          : `TEMP-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        // Upsert song using Prisma (insert or update if ISRC exists)
        const result = await prisma.song.upsert({
          where: { isrc },
          create: {
            isrc,
            title: row.title,
            artist: row.artist,
            energy: row.energy,
            bpm: row.bpm,
            subgenre: row.subgenre,
            artwork: row.artwork,
            sourceFile: row.source_file,
            aiStatus: row.ai_status,
            aiErrorMessage: row.ai_error_message,
            aiReasoning: row.ai_reasoning,
            aiContextUsed: row.ai_context_used,
            aiEnergy: row.ai_energy,
            aiAccessibility: row.ai_accessibility,
            aiSubgenre1: row.ai_subgenre_1,
            aiSubgenre2: row.ai_subgenre_2,
            aiSubgenre3: row.ai_subgenre_3,
            reviewed: false,
          },
          update: {
            title: row.title,
            artist: row.artist,
            aiStatus: row.ai_status,
            aiErrorMessage: row.ai_error_message,
            aiReasoning: row.ai_reasoning,
            aiContextUsed: row.ai_context_used,
            aiEnergy: row.ai_energy,
            aiAccessibility: row.ai_accessibility,
            aiSubgenre1: row.ai_subgenre_1,
            aiSubgenre2: row.ai_subgenre_2,
            aiSubgenre3: row.ai_subgenre_3,
            modifiedAt: new Date(),
          },
        });

        // Track if this was an insert or update
        // Prisma upsert always returns the record, so we check if createdAt == modifiedAt
        const isNew = result.createdAt.getTime() === result.modifiedAt.getTime();
        if (isNew) {
          inserted++;
        } else {
          updated++;
        }

        // Progress indicator every 10 songs
        if ((index + 1) % 10 === 0) {
          console.log(`   Processed ${index + 1}/${records.length} songs...`);
        }

      } catch (error) {
        errors++;
        console.error(`   ❌ Error processing song "${row.title}" by ${row.artist}:`);
        console.error(`      ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(60));
    console.log('🎉 Seed completed!\n');
    console.log(`   ✅ Inserted: ${inserted} songs`);
    console.log(`   🔄 Updated:  ${updated} songs`);
    if (errors > 0) {
      console.log(`   ❌ Errors:   ${errors} songs`);
    }
    console.log('='.repeat(60));
    console.log('\nNext step: Start the development server with `cd client && npm run dev`\n');

  } catch (error) {
    console.error('❌ Fatal error during seed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .catch((error) => {
    console.error('❌ Unhandled error:', error);
    prisma.$disconnect();
    process.exit(1);
  });
