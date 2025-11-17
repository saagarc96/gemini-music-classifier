#!/usr/bin/env node

/**
 * Batch Playlist Enrichment Script
 *
 * Processes multiple CSV playlists in priority order:
 * 1. Reads priority list from docs/playlist-import-priority.md
 * 2. Filters out files without ISRCs
 * 3. Processes each playlist with duplicate detection
 * 4. Shows progress and generates summary report
 *
 * Usage:
 *   node scripts/batch-enrich-playlists.cjs
 *   node scripts/batch-enrich-playlists.cjs --concurrency=10
 *   node scripts/batch-enrich-playlists.cjs --priority=high
 *   node scripts/batch-enrich-playlists.cjs --skip-duplicates
 *   node scripts/batch-enrich-playlists.cjs --dry-run
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  concurrency: parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5'),
  priority: args.find(a => a.startsWith('--priority='))?.split('=')[1] || 'all', // high, medium, low, all
  skipDuplicates: args.includes('--skip-duplicates'), // Auto-skip duplicates without prompting
  dryRun: args.includes('--dry-run'), // Preview only, don't process
  startAt: parseInt(args.find(a => a.startsWith('--start-at='))?.split('=')[1] || '0') // Resume from playlist number
};

console.log('='.repeat(80));
console.log('BATCH PLAYLIST ENRICHMENT');
console.log('='.repeat(80));
console.log('Options:');
console.log(`  Priority: ${options.priority}`);
console.log(`  Concurrency: ${options.concurrency} songs at a time`);
console.log(`  Skip duplicates: ${options.skipDuplicates ? 'Yes' : 'Prompt user'}`);
console.log(`  Dry run: ${options.dryRun ? 'Yes' : 'No'}`);
console.log(`  Start at: Playlist #${options.startAt + 1}`);
console.log('='.repeat(80));
console.log('');

// Track overall progress
const overallStats = {
  playlistsProcessed: 0,
  playlistsSkipped: 0,
  playlistsFailed: 0,
  totalSongsEnriched: 0,
  totalSongsSkipped: 0,
  totalErrors: 0,
  startTime: Date.now()
};

/**
 * Main batch processing function
 */
async function batchEnrichPlaylists() {
  try {
    // 1. Load priority list
    console.log('[1/4] Loading priority list...');
    const playlists = await loadPriorityList();
    console.log(`  ✓ Found ${playlists.length} playlists\n`);

    // 2. Filter by priority
    const filteredPlaylists = filterByPriority(playlists, options.priority);
    console.log(`[2/4] Filtered by priority (${options.priority})...`);
    console.log(`  ✓ ${filteredPlaylists.length} playlists to process\n`);

    // 3. Apply start-at offset
    const playlistsToProcess = filteredPlaylists.slice(options.startAt);
    console.log(`[3/4] Starting from playlist #${options.startAt + 1}...`);
    console.log(`  ✓ ${playlistsToProcess.length} playlists remaining\n`);

    if (options.dryRun) {
      console.log('[DRY RUN] Preview of playlists to process:');
      playlistsToProcess.slice(0, 10).forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name} (${p.newSongs} new songs) - ${p.priority} priority`);
      });
      if (playlistsToProcess.length > 10) {
        console.log(`  ... and ${playlistsToProcess.length - 10} more`);
      }
      console.log('\n[DRY RUN] Complete. Run without --dry-run to process.');
      return;
    }

    // 4. Process each playlist
    console.log(`[4/4] Processing ${playlistsToProcess.length} playlists...\n`);
    console.log('='.repeat(80));
    console.log('');

    for (let i = 0; i < playlistsToProcess.length; i++) {
      const playlist = playlistsToProcess[i];
      const playlistNumber = options.startAt + i + 1;
      const totalPlaylists = filteredPlaylists.length;

      console.log('\n' + '━'.repeat(80));
      console.log(`PLAYLIST ${playlistNumber}/${totalPlaylists}: ${playlist.name}`);
      console.log('━'.repeat(80));
      console.log(`File: ${playlist.file}`);
      console.log(`New songs: ${playlist.newSongs} | Already in DB: ${playlist.inDb} | Total: ${playlist.total}`);
      console.log(`Priority: ${playlist.priority.toUpperCase()}`);
      console.log('━'.repeat(80));
      console.log('');

      // Check if file exists
      if (!fs.existsSync(playlist.file)) {
        console.log(`⚠️  File not found, skipping...\n`);
        overallStats.playlistsSkipped++;
        continue;
      }

      try {
        // Build enrichment command
        const enrichCmd = buildEnrichCommand(playlist.file, options);

        console.log(`Running: ${enrichCmd}\n`);

        // Execute enrichment script
        execSync(enrichCmd, {
          stdio: 'inherit', // Show live output
          cwd: path.join(__dirname, '..'),
          env: { ...process.env }
        });

        overallStats.playlistsProcessed++;
        console.log(`\n✓ Playlist ${playlistNumber}/${totalPlaylists} complete\n`);

      } catch (error) {
        console.error(`\n❌ Failed to process playlist: ${error.message}\n`);
        overallStats.playlistsFailed++;

        // Ask if user wants to continue
        const shouldContinue = await askToContinue();
        if (!shouldContinue) {
          console.log('\n🛑 Batch processing stopped by user');
          break;
        }
      }

      // Show progress summary every 5 playlists
      if ((playlistNumber) % 5 === 0) {
        showProgressSummary(playlistNumber, totalPlaylists);
      }
    }

    // 5. Final summary
    console.log('\n' + '='.repeat(80));
    console.log('BATCH PROCESSING COMPLETE');
    console.log('='.repeat(80));
    await showFinalSummary();
    console.log('='.repeat(80));

  } catch (error) {
    console.error('\n❌ Fatal error:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Loads the priority list from markdown file
 */
async function loadPriorityList() {
  const priorityFile = path.join(__dirname, '..', 'docs', 'playlist-import-priority.md');
  const content = fs.readFileSync(priorityFile, 'utf-8');

  const playlists = [];
  const lines = content.split('\n');

  let currentPriority = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect priority sections
    if (line.startsWith('## HIGH PRIORITY')) {
      currentPriority = 'high';
    } else if (line.startsWith('## MEDIUM PRIORITY')) {
      currentPriority = 'medium';
    } else if (line.startsWith('## LOW PRIORITY')) {
      currentPriority = 'low';
    }

    // Parse playlist entries (look for numbered items with bold names)
    if (line.match(/^\d+\.\s+\*\*(.+?)\*\*/)) {
      const name = line.match(/\*\*(.+?)\*\*/)[1];

      // Get file path from next line
      const nextLine = lines[i + 1]?.trim();
      const fileMatch = nextLine?.match(/- File: `(.+?)`/);

      if (fileMatch) {
        const file = fileMatch[1];

        // Get stats from next line
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

  return playlists;
}

/**
 * Filters playlists by priority level
 */
function filterByPriority(playlists, priority) {
  if (priority === 'all') {
    return playlists;
  }
  return playlists.filter(p => p.priority === priority);
}

/**
 * Builds the enrichment command
 */
function buildEnrichCommand(csvPath, options) {
  const scriptPath = path.join(__dirname, 'enrich-playlist.cjs');

  let cmd = `node "${scriptPath}" "${csvPath}"`;
  cmd += ` --concurrency=${options.concurrency}`;

  if (options.skipDuplicates) {
    cmd += ' --force-duplicates'; // Skip duplicate detection
  }

  return cmd;
}

/**
 * Shows progress summary
 */
function showProgressSummary(current, total) {
  const elapsed = Math.floor((Date.now() - overallStats.startTime) / 1000);
  const avgPerPlaylist = elapsed / current;
  const remaining = (total - current) * avgPerPlaylist;

  console.log('\n' + '─'.repeat(80));
  console.log('PROGRESS SUMMARY');
  console.log('─'.repeat(80));
  console.log(`Processed: ${overallStats.playlistsProcessed}/${total} playlists`);
  console.log(`Skipped: ${overallStats.playlistsSkipped}`);
  console.log(`Failed: ${overallStats.playlistsFailed}`);
  console.log(`Time elapsed: ${formatDuration(elapsed)}`);
  console.log(`Estimated remaining: ${formatDuration(remaining)}`);
  console.log('─'.repeat(80));
}

/**
 * Shows final summary with database stats
 */
async function showFinalSummary() {
  const elapsed = Math.floor((Date.now() - overallStats.startTime) / 1000);

  // Get database stats
  const totalSongs = await prisma.song.count();
  const reviewedSongs = await prisma.song.count({ where: { reviewed: true } });
  const unreviewedSongs = totalSongs - reviewedSongs;

  console.log('\nProcessing Stats:');
  console.log(`  Playlists processed: ${overallStats.playlistsProcessed}`);
  console.log(`  Playlists skipped: ${overallStats.playlistsSkipped}`);
  console.log(`  Playlists failed: ${overallStats.playlistsFailed}`);
  console.log(`  Total time: ${formatDuration(elapsed)}`);
  console.log('');
  console.log('Database Stats:');
  console.log(`  Total songs: ${totalSongs.toLocaleString()}`);
  console.log(`  Reviewed: ${reviewedSongs.toLocaleString()}`);
  console.log(`  Unreviewed: ${unreviewedSongs.toLocaleString()}`);
  console.log('');
}

/**
 * Formats duration in seconds to human-readable string
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

/**
 * Asks user if they want to continue after an error
 */
function askToContinue() {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question('\nContinue with next playlist? (Y/n): ', (answer) => {
      readline.close();
      const shouldContinue = !answer || answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      resolve(shouldContinue);
    });
  });
}

// Run the script
batchEnrichPlaylists().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
