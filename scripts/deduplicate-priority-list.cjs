#!/usr/bin/env node

/**
 * Deduplicates the priority list by removing duplicate playlists
 *
 * Identifies duplicates by comparing ISRC sets between CSVs.
 * Keeps the version with the most new songs.
 */

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

async function readCSVISRCs(filePath) {
  return new Promise((resolve) => {
    const isrcs = new Set();

    if (!fs.existsSync(filePath)) {
      resolve(isrcs);
      return;
    }

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => {
        const isrc = row.isrc || row.ISRC;
        if (isrc) {
          isrcs.add(isrc);
        }
      })
      .on('end', () => resolve(isrcs))
      .on('error', () => resolve(isrcs));
  });
}

function areSetsEqual(set1, set2) {
  if (set1.size !== set2.size) return false;
  for (const item of set1) {
    if (!set2.has(item)) return false;
  }
  return true;
}

async function deduplicatePlaylists() {
  console.log('Loading priority list...');

  const priorityFile = path.join(__dirname, '..', 'docs', 'playlist-import-priority.md');
  const content = fs.readFileSync(priorityFile, 'utf-8');

  const playlists = [];
  const lines = content.split('\n');
  let currentPriority = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('## HIGH PRIORITY')) {
      currentPriority = 'high';
    } else if (line.startsWith('## MEDIUM PRIORITY')) {
      currentPriority = 'medium';
    } else if (line.startsWith('## LOW PRIORITY')) {
      currentPriority = 'low';
    }

    if (line.match(/^\d+\.\s+\*\*(.+?)\*\*/)) {
      const name = line.match(/\*\*(.+?)\*\*/)[1];
      const nextLine = lines[i + 1]?.trim();
      const fileMatch = nextLine?.match(/- File: `(.+?)`/);

      if (fileMatch) {
        const file = fileMatch[1];
        const statsLine = lines[i + 2]?.trim();
        const statsMatch = statsLine?.match(/New songs: (\d+) \| Already in DB: (\d+) \| Total: (\d+)/);

        if (statsMatch) {
          playlists.push({
            name,
            file,
            newSongs: parseInt(statsMatch[1]),
            inDb: parseInt(statsMatch[2]),
            total: parseInt(statsMatch[3]),
            priority: currentPriority
          });
        }
      }
    }
  }

  console.log(`Found ${playlists.length} playlists`);
  console.log('\nChecking for duplicates by comparing ISRC sets...');

  // Load ISRC sets
  const playlistsWithISRCs = await Promise.all(
    playlists.map(async (p) => {
      const isrcs = await readCSVISRCs(p.file);
      return { ...p, isrcs };
    })
  );

  // Find duplicates
  const duplicateGroups = [];
  const seen = new Set();

  for (let i = 0; i < playlistsWithISRCs.length; i++) {
    if (seen.has(i)) continue;

    const group = [i];

    for (let j = i + 1; j < playlistsWithISRCs.length; j++) {
      if (seen.has(j)) continue;

      if (areSetsEqual(playlistsWithISRCs[i].isrcs, playlistsWithISRCs[j].isrcs)) {
        group.push(j);
        seen.add(j);
      }
    }

    if (group.length > 1) {
      duplicateGroups.push(group);
    }
  }

  console.log(`\nFound ${duplicateGroups.length} duplicate groups\n`);

  // Show duplicates
  duplicateGroups.forEach((group, idx) => {
    console.log(`Duplicate Group ${idx + 1}:`);
    group.forEach((i) => {
      const p = playlistsWithISRCs[i];
      console.log(`  - ${p.name} (${p.newSongs} new songs)`);
      console.log(`    ${p.file}`);
    });
    console.log('');
  });

  // Create deduplicated list (keep first entry in each duplicate group)
  const deduplicated = playlistsWithISRCs.filter((p, i) => {
    // Check if this index is in a duplicate group (but not the first one)
    for (const group of duplicateGroups) {
      if (group.includes(i) && group[0] !== i) {
        return false;
      }
    }
    return true;
  });

  console.log(`\nOriginal: ${playlists.length} playlists`);
  console.log(`Deduplicated: ${deduplicated.length} playlists`);
  console.log(`Removed: ${playlists.length - deduplicated.length} duplicates`);

  // Calculate stats
  const totalNewSongs = deduplicated.reduce((sum, p) => sum + p.newSongs, 0);
  const highPriority = deduplicated.filter(p => p.priority === 'high').length;
  const mediumPriority = deduplicated.filter(p => p.priority === 'medium').length;
  const lowPriority = deduplicated.filter(p => p.priority === 'low').length;

  console.log(`\nStats:`);
  console.log(`  High priority: ${highPriority} playlists`);
  console.log(`  Medium priority: ${mediumPriority} playlists`);
  console.log(`  Low priority: ${lowPriority} playlists`);
  console.log(`  Total new songs: ${totalNewSongs.toLocaleString()}`);
}

deduplicatePlaylists().catch(console.error);
