#!/usr/bin/env node

/**
 * Import Curator-Enriched CSV to Database
 *
 * Imports enriched curator CSVs to the database with:
 * 1. Audio streaming links (source_file) from isrc_output _updated.csv
 * 2. Artwork URLs from isrc_output _updated.csv
 * 3. Mark all as reviewed=true with reviewedBy="curator"
 * 4. Parse subgenres into 3 separate fields
 *
 * Usage:
 *   node scripts/import-curator-to-db.cjs path/to/enriched.csv --audio-source path/to/_updated.csv
 *   node scripts/import-curator-to-db.cjs path/to/enriched.csv --audio-source path/to/_updated.csv --dry-run
 */

require('dotenv').config();

const fs = require('fs');
const csv = require('csv-parser');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const enrichedCsvPath = args[0];

if (!enrichedCsvPath) {
  console.error('Usage: node scripts/import-curator-to-db.cjs <enriched-csv> [options]');
  console.error('Options:');
  console.error('  --audio-source=PATH  Path to _updated.csv file with artwork and source_file');
  console.error('  --dry-run            Show what would be imported without writing to DB');
  process.exit(1);
}

const options = {
  audioSourcePath: args.find(a => a.startsWith('--audio-source='))?.split('=')[1],
  dryRun: args.includes('--dry-run')
};

console.log('='.repeat(60));
console.log('Curator CSV Database Import');
console.log('='.repeat(60));
console.log(`Enriched CSV: ${enrichedCsvPath}`);
console.log(`Audio Source: ${options.audioSourcePath || 'Not provided'}`);
console.log(`Dry Run: ${options.dryRun}`);
console.log('='.repeat(60));
console.log('');

/**
 * Normalizes artist/title for matching
 */
function normalizeForMatching(str) {
  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Loads audio source CSV (_updated.csv) into a lookup map
 */
async function loadAudioSourceMap(audioSourcePath) {
  return new Promise((resolve, reject) => {
    const audioMap = new Map();

    fs.createReadStream(audioSourcePath)
      .pipe(csv())
      .on('data', (row) => {
        if (!row.artist || !row.title) return;

        const key = normalizeForMatching(row.artist) + '|||' + normalizeForMatching(row.title);
        audioMap.set(key, {
          artwork: row.artwork,
          sourceFile: row.source_file
        });
      })
      .on('end', () => {
        console.log(`  Loaded ${audioMap.size} songs from audio source`);
        resolve(audioMap);
      })
      .on('error', reject);
  });
}

/**
 * Parses subgenre column into array of musical subgenres (excluding playlist names)
 */
function parseSubgenres(subgenreRaw) {
  if (!subgenreRaw) return [];

  const KNOWN_PLAYLISTS = [
    'Bazaar Meat (Late)',
    "Benny's Evening",
    'The Longboard (Evening)',
    'The Wild Ones (Late)',
    'Municipal Bar (Late Night)',
    'Municipal Bar (Afternoon)',
    'Close Company (Early)',
    'Close Company Late Night',
    "Capon's Chophouse (Lunch)",
    "Capon's Chophouse (Dinner)",
    'Cathedrale (John)',
    'DTF (Soultronica)',
    'Nexus Club (Happy Hour)',
    'Cabana Sass (Dinner)',
    "Waymore's (Punk, Ska & Adjacent)",
    'Moxy Mid-Morning (NYC 2025)',
    'Hotel Contessa Pool',
    'Klocke Estate (Daytime)',
    'Klocke Estate (Evening)',
    'Yacht Rock',
    'Wyncatcher Atrium',
    'Hot Eye (Non-Peak)'
  ];

  const parts = subgenreRaw.split(';').map(s => s.trim()).filter(s => s);
  return parts.filter(s => !KNOWN_PLAYLISTS.includes(s));
}

/**
 * Normalizes ACCESSIBILITY values to Title Case
 */
function normalizeAccessibility(value) {
  if (!value) return null;

  const normalized = value.toLowerCase();

  // Map to Title Case
  const mapping = {
    'eclectic': 'Eclectic',
    'timeless': 'Timeless',
    'commercial': 'Commercial',
    'cheesy': 'Cheesy'
  };

  return mapping[normalized] || null;
}

/**
 * Normalizes EXPLICIT values to proper format
 */
function normalizeExplicit(value) {
  if (!value) return null;

  const lower = value.toLowerCase();

  if (lower.includes('family')) return 'Family Friendly';
  if (lower.includes('suggestive')) return 'Suggestive';
  if (lower.includes('explicit')) return 'Explicit';

  return null;
}

/**
 * Main import function
 */
async function importToDatabase() {
  try {
    // 1. Load audio source map (if provided)
    let audioMap = null;
    if (options.audioSourcePath) {
      console.log('[1/4] Loading audio source metadata...');
      audioMap = await loadAudioSourceMap(options.audioSourcePath);
      console.log('');
    } else {
      console.log('[1/4] No audio source provided, skipping artwork/audio links\n');
    }

    // 2. Load enriched CSV
    console.log('[2/4] Loading enriched CSV...');
    const songs = await new Promise((resolve, reject) => {
      const results = [];

      fs.createReadStream(enrichedCsvPath)
        .pipe(csv())
        .on('data', (row) => {
          if (!row.Artist || !row.Name) return;

          // Parse subgenres
          const musicalSubgenres = parseSubgenres(row.Subgenre);

          // Match audio source
          let audioData = null;
          if (audioMap) {
            const key = normalizeForMatching(row.Artist) + '|||' + normalizeForMatching(row.Name);
            audioData = audioMap.get(key);
          }

          results.push({
            isrc: row.ISRC,
            title: row.Name,
            artist: row.Artist,
            energy: row.Energy || null,
            bpm: row.BPM ? parseInt(row.BPM, 10) : null,
            subgenre: row.Subgenre || null,
            artwork: audioData?.artwork || null,
            sourceFile: audioData?.sourceFile || null,

            // AI classifications
            aiStatus: 'SUCCESS',
            aiEnergy: row.Energy || null,
            aiAccessibility: normalizeAccessibility(row.ACCESSIBILITY),
            aiExplicit: normalizeExplicit(row.EXPLICIT),
            aiSubgenre1: musicalSubgenres[0] || null,
            aiSubgenre2: musicalSubgenres[1] || null,
            aiSubgenre3: musicalSubgenres[2] || null,

            // Mark as reviewed by curator
            reviewed: true,
            reviewedBy: 'curator',
            reviewedAt: new Date()
          });
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });

    console.log(`  ✓ Loaded ${songs.length} songs\n`);

    // 3. Show preview/stats
    console.log('[3/4] Import preview:');
    const withAudio = songs.filter(s => s.sourceFile).length;
    const withArtwork = songs.filter(s => s.artwork).length;
    const withISRC = songs.filter(s => s.isrc).length;

    console.log(`  Total songs: ${songs.length}`);
    console.log(`  With ISRC: ${withISRC}`);
    console.log(`  With audio link: ${withAudio}`);
    console.log(`  With artwork: ${withArtwork}`);
    console.log(`  All marked as: reviewed=true, reviewedBy="curator"`);
    console.log('');

    if (options.dryRun) {
      console.log('[DRY RUN] First 3 songs that would be imported:');
      songs.slice(0, 3).forEach(song => {
        console.log(`  - ${song.artist} - ${song.title}`);
        console.log(`    ISRC: ${song.isrc || 'MISSING'}`);
        console.log(`    Audio: ${song.sourceFile ? 'YES' : 'NO'}`);
        console.log(`    Artwork: ${song.artwork ? 'YES' : 'NO'}`);
        console.log(`    Subgenres: ${[song.aiSubgenre1, song.aiSubgenre2, song.aiSubgenre3].filter(Boolean).join(', ')}`);
        console.log(`    ACCESSIBILITY: ${song.aiAccessibility || 'NONE'}`);
        console.log(`    EXPLICIT: ${song.aiExplicit || 'NONE'}`);
        console.log('');
      });
      console.log('[DRY RUN] Exiting without database writes');
      return;
    }

    // 4. Import to database
    console.log('[4/4] Importing to database...');
    let imported = 0;
    let updated = 0;
    let skipped = 0;

    for (const song of songs) {
      if (!song.isrc) {
        console.log(`  Skipping ${song.artist} - ${song.title}: No ISRC`);
        skipped++;
        continue;
      }

      try {
        const result = await prisma.song.upsert({
          where: { isrc: song.isrc },
          update: {
            title: song.title,
            artist: song.artist,
            energy: song.energy,
            bpm: song.bpm,
            subgenre: song.subgenre,
            artwork: song.artwork,
            sourceFile: song.sourceFile,
            aiStatus: song.aiStatus,
            aiEnergy: song.aiEnergy,
            aiAccessibility: song.aiAccessibility,
            aiExplicit: song.aiExplicit,
            aiSubgenre1: song.aiSubgenre1,
            aiSubgenre2: song.aiSubgenre2,
            aiSubgenre3: song.aiSubgenre3,
            reviewed: song.reviewed,
            reviewedBy: song.reviewedBy,
            reviewedAt: song.reviewedAt
          },
          create: song
        });

        if (result.id) {
          const action = result.createdAt.getTime() === result.modifiedAt.getTime() ? 'created' : 'updated';
          if (action === 'created') imported++;
          else updated++;
        }
      } catch (error) {
        console.error(`  Error importing ${song.artist} - ${song.title}:`, error.message);
        skipped++;
      }
    }

    console.log(`  ✓ Complete\n`);

    console.log('Summary:');
    console.log(`  Created: ${imported}`);
    console.log(`  Updated: ${updated}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total processed: ${songs.length}`);
    console.log('');

    console.log('='.repeat(60));
    console.log('✓ Import complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
importToDatabase().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
