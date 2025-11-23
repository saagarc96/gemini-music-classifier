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
const enrichedCsvPath = args.find(arg => !arg.startsWith('--'));

if (!enrichedCsvPath) {
  console.error('Usage: node scripts/import-curator-to-db.cjs <enriched-csv> [options]');
  console.error('Options:');
  console.error('  --audio-source=PATH      Path to _updated.csv file with artwork and source_file');
  console.error('  --uploaded-by-name=NAME  Name of person uploading');
  console.error('  --playlist-name=NAME     Custom playlist name (defaults to filename)');
  console.error('  --dry-run                Show what would be imported without writing to DB');
  process.exit(1);
}

const path = require('path');

const options = {
  audioSourcePath: args.find(a => a.startsWith('--audio-source='))?.split('=')[1],
  uploadedByName: args.find(a => a.startsWith('--uploaded-by-name='))?.split('=')[1],
  playlistName: args.find(a => a.startsWith('--playlist-name='))?.split('=')[1],
  dryRun: args.includes('--dry-run')
};

console.log('='.repeat(60));
console.log('Curator CSV Database Import');
console.log('='.repeat(60));
console.log(`Enriched CSV: ${enrichedCsvPath}`);
console.log(`Audio Source: ${options.audioSourcePath || 'Not provided'}`);
console.log(`Playlist Name: ${options.playlistName || path.basename(enrichedCsvPath, '.csv')}`);
console.log(`Uploaded By: ${options.uploadedByName || 'Unknown'}`);
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
    // Generate batch ID and playlist name
    const playlistName = options.playlistName || path.basename(enrichedCsvPath, '.csv');
    const batchId = `curator-${playlistName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now()}`;

    // 1. Load audio source map (if provided)
    let audioMap = null;
    if (options.audioSourcePath) {
      console.log('[1/5] Loading audio source metadata...');
      audioMap = await loadAudioSourceMap(options.audioSourcePath);
      console.log('');
    } else {
      console.log('[1/5] No audio source provided, skipping artwork/audio links\n');
    }

    // 2. Create playlist record (if not dry run)
    let playlist = null;
    if (!options.dryRun) {
      console.log('[2/5] Creating playlist record...');
      playlist = await prisma.playlist.create({
        data: {
          name: playlistName,
          uploadBatchId: batchId,
          uploadedByName: options.uploadedByName || null,
          sourceFile: path.basename(enrichedCsvPath),
          totalSongs: 0,
          newSongs: 0,
          duplicateSongs: 0
        }
      });
      console.log(`  ✓ Created playlist: ${playlist.id}\n`);
    }

    // 3. Load enriched CSV
    console.log('[3/5] Loading enriched CSV...');
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

            // Batch tracking
            uploadBatchId: batchId,
            uploadBatchName: playlistName,

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

    // 4. Show preview/stats
    console.log('[4/5] Import preview:');
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

    // 5. Import to database
    console.log('[5/5] Importing to database...');
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
        // Check if song existed before
        const existingBefore = await prisma.song.findUnique({
          where: { isrc: song.isrc }
        });
        const wasNew = !existingBefore;

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
            uploadBatchId: song.uploadBatchId,
            uploadBatchName: song.uploadBatchName,
            reviewed: song.reviewed,
            reviewedBy: song.reviewedBy,
            reviewedAt: song.reviewedAt
          },
          create: song
        });

        // Create playlist association
        if (playlist) {
          await prisma.playlistSong.create({
            data: {
              playlistId: playlist.id,
              songIsrc: song.isrc,
              wasNew: wasNew
            }
          });
        }

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

    // Update playlist stats
    if (playlist) {
      const playlistSongs = await prisma.playlistSong.findMany({
        where: { playlistId: playlist.id }
      });

      const newSongsCount = playlistSongs.filter(ps => ps.wasNew).length;
      const duplicateSongsCount = playlistSongs.filter(ps => !ps.wasNew).length;

      await prisma.playlist.update({
        where: { id: playlist.id },
        data: {
          totalSongs: playlistSongs.length,
          newSongs: newSongsCount,
          duplicateSongs: duplicateSongsCount
        }
      });

      console.log(`  ✓ Updated playlist stats: ${newSongsCount} new, ${duplicateSongsCount} existing\n`);
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
