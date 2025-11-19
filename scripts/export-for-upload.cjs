#!/usr/bin/env node

/**
 * Export enriched playlists to Song Upload Template format
 *
 * Usage:
 *   node scripts/export-for-upload.cjs playlists/playlists-to-import/Christmas\ Folk.csv
 *   node scripts/export-for-upload.cjs --all  # Process all CSVs in playlists-to-import
 *
 * Output format: Artist, Name, Energy, BPM, Subgenre, ISRC
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const processAll = args.includes('--all');
const inputPath = args.find(a => !a.startsWith('--'));

if (!processAll && !inputPath) {
  console.error('Usage: node scripts/export-for-upload.cjs <playlist.csv>');
  console.error('       node scripts/export-for-upload.cjs --all');
  process.exit(1);
}

/**
 * Extract subgenre name from filename
 * "Christmas Folk.csv" → "Christmas Folk"
 * "Christmas Indie (1).csv" → "Christmas Indie"
 */
function getSubgenreFromFilename(filename) {
  return path.basename(filename, '.csv')
    .replace(/\s*\(\d+\)\s*$/, '')  // Remove (1), (2), etc.
    .trim();
}

/**
 * Normalize BPM to 50-170 range
 */
function normalizeBpm(bpm) {
  let normalized = parseInt(bpm) || 100;

  while (normalized < 50) {
    normalized *= 2;
  }
  while (normalized > 170) {
    normalized /= 2;
  }

  return Math.round(normalized);
}

/**
 * Process a single playlist CSV
 */
async function processPlaylist(csvPath) {
  const filename = path.basename(csvPath);
  const subgenre = getSubgenreFromFilename(filename);

  console.log(`\nProcessing: ${filename}`);
  console.log(`Subgenre: ${subgenre}`);

  // Read and parse CSV
  const content = fs.readFileSync(csvPath, 'utf-8');
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true
  });

  console.log(`Found ${records.length} songs`);

  // Get all ISRCs for batch database lookup
  const isrcs = records
    .map(r => r.ISRC || r.isrc)
    .filter(Boolean);

  // Batch lookup energy values from database
  const dbSongs = await prisma.song.findMany({
    where: {
      isrc: { in: isrcs }
    },
    select: {
      isrc: true,
      aiEnergy: true
    }
  });

  // Create ISRC → energy map
  const energyMap = new Map();
  dbSongs.forEach(song => {
    energyMap.set(song.isrc, song.aiEnergy);
  });

  console.log(`Found ${dbSongs.length} songs in database`);

  // Transform to upload format
  const outputRecords = records.map(record => {
    const isrc = record.ISRC || record.isrc;
    const bpm = normalizeBpm(record.BPM || record.bpm);
    const energy = energyMap.get(isrc) || 'Medium';  // Default to Medium if not found

    return {
      Artist: record.Artist || record.artist,
      Name: record.Song || record.song || record.Name || record.name,
      Energy: energy,
      BPM: bpm,
      Subgenre: subgenre,
      ISRC: isrc
    };
  });

  // Count energy distribution
  const energyCounts = {};
  outputRecords.forEach(r => {
    energyCounts[r.Energy] = (energyCounts[r.Energy] || 0) + 1;
  });

  console.log('Energy distribution:', energyCounts);

  return {
    subgenre,
    records: outputRecords
  };
}

async function main() {
  try {
    let playlists = [];

    if (processAll) {
      // Find all CSVs in playlists-to-import
      const importDir = 'playlists/playlists-to-import';
      const files = fs.readdirSync(importDir)
        .filter(f => f.endsWith('.csv'))
        .map(f => path.join(importDir, f));
      playlists = files;
    } else {
      playlists = [inputPath];
    }

    // Create output directory
    const outputDir = 'outputs/upload-ready';
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const allRecords = [];

    for (const playlist of playlists) {
      if (!fs.existsSync(playlist)) {
        console.error(`File not found: ${playlist}`);
        continue;
      }

      const result = await processPlaylist(playlist);
      allRecords.push(...result.records);

      // Write individual playlist file
      const outputFilename = `${result.subgenre} - Upload.csv`;
      const outputPath = path.join(outputDir, outputFilename);

      const csv = stringify(result.records, {
        header: true,
        columns: ['Artist', 'Name', 'Energy', 'BPM', 'Subgenre', 'ISRC']
      });

      // Add BOM for Excel compatibility
      fs.writeFileSync(outputPath, '\ufeff' + csv);
      console.log(`✓ Saved: ${outputPath} (${result.records.length} songs)`);
    }

    // If processing multiple playlists, create combined file
    if (playlists.length > 1) {
      const combinedPath = path.join(outputDir, 'All Christmas - Upload.csv');
      const csv = stringify(allRecords, {
        header: true,
        columns: ['Artist', 'Name', 'Energy', 'BPM', 'Subgenre', 'ISRC']
      });

      fs.writeFileSync(combinedPath, '\ufeff' + csv);
      console.log(`\n✓ Combined file: ${combinedPath} (${allRecords.length} songs)`);
    }

    console.log('\n✓ Export complete!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
