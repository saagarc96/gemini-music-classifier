#!/usr/bin/env node

/**
 * Spotify Playlist Enrichment Script
 *
 * Imports Spotify playlist CSV exports, normalizes BPM, fetches preview URLs,
 * enriches with AI classifications, and imports to database for curator review.
 *
 * Usage:
 *   node scripts/enrich-spotify-playlist.cjs "path/to/spotify-export.csv"
 *   npm run enrich:spotify "path/to/spotify-export.csv"
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const spotifyClient = require('../src/utils/spotify-client.cjs');
const { normalizeBpm } = require('../src/utils/bpm-normalizer.cjs');
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');
const { submitAllExplicitTasks, pollAndUpdateExplicitResults } = require('../src/utils/explicit-batch-helper.cjs');

const prisma = new PrismaClient();

// Configuration
const CONCURRENCY = 5; // Process 5 songs at a time
const OUTPUT_DIR = 'outputs';

/**
 * Parse Spotify CSV export
 * Expected columns: Song, Artist, BPM, Spotify Track Id, ISRC
 */
function parseSpotifyCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true // Handle UTF-8 BOM
  });

  console.log(`Parsed ${records.length} songs from CSV`);

  return records.map((record, index) => ({
    rowNumber: index + 2, // +2 for header and 1-based indexing
    title: record.Song || record.song || record.Title || record.title,
    artist: record.Artist || record.artist,
    bpm: parseInt(record.BPM || record.bpm || record.Tempo || record.tempo) || null,
    spotifyTrackId: record['Spotify Track Id'] || record['Spotify Track ID'] || record.spotify_track_id,
    isrc: record.ISRC || record.isrc,
    // Optional fields that might be in the CSV
    album: record.Album || record.album,
    albumDate: record['Album Date'] || record.album_date,
  }));
}

/**
 * Fetch Spotify metadata for all tracks
 */
async function fetchSpotifyMetadata(songs) {
  console.log('\nFetching Spotify metadata...');

  const trackIds = songs
    .map(s => s.spotifyTrackId)
    .filter(id => id); // Remove null/undefined

  if (trackIds.length === 0) {
    console.log('Warning: No Spotify Track IDs found in CSV');
    return [];
  }

  console.log(`Fetching metadata for ${trackIds.length} tracks...`);
  const tracks = await spotifyClient.getTracksBatch(trackIds);

  // Create a map for easy lookup
  const trackMap = new Map();
  tracks.forEach((track, index) => {
    if (track) {
      trackMap.set(trackIds[index], track);
    }
  });

  console.log(`Successfully fetched ${trackMap.size} tracks (${tracks.filter(t => t === null).length} not found)`);

  return trackMap;
}

/**
 * Process a single song (Gemini only - explicit handled in Phase 3)
 */
async function processSongGeminiOnly(song, spotifyMetadata, batchName = null, batchId = null, playlistId = null, skipExisting = true) {
  try {
    // Check if song exists before processing
    const existingSong = await prisma.song.findUnique({
      where: { isrc: song.isrc }
    });
    const wasNew = !existingSong;

    // If song exists and skipExisting is true, just create playlist association
    if (existingSong && skipExisting) {
      // Create playlist association if playlistId provided (upsert to handle duplicates in CSV)
      if (playlistId) {
        await prisma.playlistSong.upsert({
          where: {
            playlistId_songIsrc: { playlistId, songIsrc: song.isrc }
          },
          update: {},
          create: {
            playlistId: playlistId,
            songIsrc: song.isrc,
            wasNew: false
          }
        });
      }

      return {
        success: true,
        skipped: true,
        isrc: song.isrc,
        title: song.title,
        artist: song.artist,
        hasPreview: !!existingSong.spotifyPreviewUrl,
        bpmTransformation: 'N/A',
        aiStatus: existingSong.aiStatus || 'EXISTING',
        wasNew: false,
        aiExplicit: existingSong.aiExplicit || null,
      };
    }

    // Get Spotify metadata
    const spotifyTrack = spotifyMetadata.get(song.spotifyTrackId);

    // Normalize BPM
    const bpmResult = normalizeBpm(song.bpm);

    if (bpmResult.transformations.includes('doubled') || bpmResult.transformations.includes('halved')) {
      console.log(`  BPM normalized: ${bpmResult.originalBpm} → ${bpmResult.normalizedBpm} (${bpmResult.transformations.join(', ')})`);
    }

    // Run Gemini classification only (explicit handled in Phase 3)
    const geminiResult = await classifySong(song.artist, song.title, {
      bpm: bpmResult.normalizedBpm,
    });

    // Prepare database record (aiExplicit is null, will be updated in Phase 3)
    const songData = {
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      bpm: bpmResult.normalizedBpm,
      artwork: spotifyTrack?.albumArt || null,
      sourceFile: spotifyTrack?.previewUrl || null,
      spotifyTrackId: song.spotifyTrackId,
      spotifyPreviewUrl: spotifyTrack?.previewUrl || null,
      spotifyArtworkUrl: spotifyTrack?.albumArt || null,

      // AI classifications
      aiStatus: geminiResult.status,
      aiErrorMessage: geminiResult.error_message || null,
      aiReasoning: geminiResult.reasoning || null,
      aiContextUsed: geminiResult.context || null,
      aiEnergy: geminiResult.energy || null,
      aiAccessibility: geminiResult.accessibility || null,
      aiExplicit: null, // Will be updated in Phase 3
      aiSubgenre1: geminiResult.subgenre1 || null,
      aiSubgenre2: geminiResult.subgenre2 || null,
      aiSubgenre3: geminiResult.subgenre3 || null,

      // Batch tracking
      uploadBatchId: batchId,
      uploadBatchName: batchName,

      // Review status (needs curator review)
      reviewed: false,
      reviewedBy: null,
      reviewedAt: null,
      curatorNotes: null,
    };

    // Upsert to database
    await prisma.song.upsert({
      where: { isrc: song.isrc },
      update: songData,
      create: songData,
    });

    // Create playlist association if playlistId provided (upsert to handle duplicates in CSV)
    if (playlistId) {
      await prisma.playlistSong.upsert({
        where: {
          playlistId_songIsrc: {
            playlistId: playlistId,
            songIsrc: song.isrc
          }
        },
        update: {}, // No update needed, just skip if exists
        create: {
          playlistId: playlistId,
          songIsrc: song.isrc,
          wasNew: wasNew
        }
      });
    }

    return {
      success: true,
      skipped: false,
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      hasPreview: !!spotifyTrack?.previewUrl,
      bpmTransformation: bpmResult.transformations.join(', '),
      aiStatus: geminiResult.status,
      wasNew: wasNew,
      aiExplicit: null, // Will be updated in Phase 3
    };

  } catch (error) {
    console.error(`  ✗ Error processing ${song.title} by ${song.artist}:`, error.message);
    return {
      success: false,
      skipped: false,
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      error: error.message,
      wasNew: false,
      aiExplicit: null,
    };
  }
}

/**
 * Process songs with 3-phase concurrency control
 */
async function processSongsWithConcurrency(songs, spotifyMetadata, concurrency, playlistName = null, batchId = null, playlistId = null, skipExisting = true) {
  const results = [];

  // Filter to get songs that need processing (not skipped)
  const songsToCheck = [];
  const skippedResults = [];

  for (const song of songs) {
    if (skipExisting) {
      const existing = await prisma.song.findUnique({ where: { isrc: song.isrc } });
      if (existing) {
        // Create playlist association for skipped song (upsert to handle duplicates)
        if (playlistId) {
          await prisma.playlistSong.upsert({
            where: {
              playlistId_songIsrc: { playlistId, songIsrc: song.isrc }
            },
            update: {},
            create: { playlistId, songIsrc: song.isrc, wasNew: false }
          });
        }
        skippedResults.push({
          success: true,
          skipped: true,
          isrc: song.isrc,
          title: song.title,
          artist: song.artist,
          hasPreview: !!existing.spotifyPreviewUrl,
          bpmTransformation: 'N/A',
          aiStatus: existing.aiStatus || 'EXISTING',
          wasNew: false,
          aiExplicit: existing.aiExplicit || null,
        });
        continue;
      }
    }
    songsToCheck.push(song);
  }

  if (skippedResults.length > 0) {
    console.log(`\n⏭️ Skipped ${skippedResults.length} songs (already in database)`);
  }

  if (songsToCheck.length === 0) {
    console.log('\nNo new songs to process.');
    return [...skippedResults];
  }

  // === PHASE 1: Submit all explicit tasks upfront ===
  console.log(`\n[2.1] Submitting explicit content tasks for ${songsToCheck.length} songs...`);
  const explicitSubmissions = await submitAllExplicitTasks(songsToCheck, concurrency);
  const submitted = explicitSubmissions.filter(s => s.status === 'submitted').length;
  console.log(`  ✓ Submitted ${submitted}/${songsToCheck.length} tasks`);

  // === PHASE 2: Run Gemini in batches AND save to DB immediately ===
  console.log(`\n[2.2] Running Gemini classification (${songsToCheck.length} songs, concurrency: ${concurrency})...`);

  for (let i = 0; i < songsToCheck.length; i += concurrency) {
    const batch = songsToCheck.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(songsToCheck.length / concurrency);

    console.log(`\n  Batch ${batchNumber}/${totalBatches} (songs ${i + 1}-${Math.min(i + concurrency, songsToCheck.length)})...`);

    const batchResults = await Promise.all(
      batch.map(song => processSongGeminiOnly(song, spotifyMetadata, playlistName, batchId, playlistId, false))
    );

    results.push(...batchResults);

    // Print progress for this batch
    batchResults.forEach((result, idx) => {
      const songNum = i + idx + 1;
      if (result.success) {
        const previewIcon = result.hasPreview ? '🎵' : '⚠️';
        console.log(`    ${previewIcon} [${songNum}/${songsToCheck.length}] ${result.artist} - ${result.title} (${result.aiStatus})`);
      } else {
        console.log(`    ✗ [${songNum}/${songsToCheck.length}] ${result.artist} - ${result.title} - ERROR: ${result.error}`);
      }
    });
  }

  // === PHASE 3: Poll all explicit results and UPDATE records ===
  console.log(`\n[2.3] Polling explicit content results...`);
  await pollAndUpdateExplicitResults(explicitSubmissions, results, prisma);

  // Combine skipped and processed results
  return [...skippedResults, ...results];
}

/**
 * Export results to CSV
 */
function exportResultsToCSV(results, outputPath) {
  const header = 'Artist,Title,ISRC,AI Status,Skipped,Has Preview,BPM Transformation,Error\n';
  const rows = results.map(r =>
    `"${r.artist}","${r.title}","${r.isrc}","${r.aiStatus || 'ERROR'}","${r.skipped ? 'Yes' : 'No'}","${r.hasPreview ? 'Yes' : 'No'}","${r.bpmTransformation || 'N/A'}","${r.error || ''}"`
  ).join('\n');

  fs.writeFileSync(outputPath, header + rows);
  console.log(`\nExported results to: ${outputPath}`);
}

/**
 * Print summary statistics
 */
function printSummary(results) {
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  const skipped = results.filter(r => r.skipped).length;
  const processed = results.filter(r => r.success && !r.skipped).length;
  const withPreview = results.filter(r => r.hasPreview).length;
  const withoutPreview = results.filter(r => r.success && !r.hasPreview && !r.skipped).length;

  const statusCounts = {};
  results.filter(r => !r.skipped).forEach(r => {
    const status = r.aiStatus || 'ERROR';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n' + '='.repeat(60));
  console.log('ENRICHMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total songs in CSV:    ${results.length}`);
  console.log(`Skipped (existing):    ${skipped}`);
  console.log(`Newly processed:       ${processed}`);
  console.log(`Failed:                ${failed}`);
  if (processed > 0) {
    console.log(`\nSpotify Preview URLs (new songs):`);
    const newWithPreview = results.filter(r => r.success && !r.skipped && r.hasPreview).length;
    console.log(`  With preview:        ${newWithPreview} (${Math.round(newWithPreview/processed*100)}%)`);
    console.log(`  Without preview:     ${withoutPreview} (${Math.round(withoutPreview/processed*100)}%)`);
    console.log(`\nAI Classification Status (new songs):`);
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status.padEnd(20)} ${count}`);
    });
  }
  console.log('='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  try {
    // Parse command line arguments
    const args = process.argv.slice(2);
    const csvPath = args.find(arg => !arg.startsWith('--'));

    // Parse options
    const options = {
      uploadedByName: args.find(a => a.startsWith('--uploaded-by-name='))?.split('=')[1],
      skipExisting: !args.includes('--force'), // Skip existing by default, use --force to reprocess
    };

    if (!csvPath) {
      console.error('Error: Please provide a CSV file path');
      console.error('Usage: node scripts/enrich-spotify-playlist.cjs "path/to/spotify-export.csv" [options]');
      console.error('Options:');
      console.error('  --force              Reprocess songs that already exist in DB (default: skip)');
      console.error('  --uploaded-by-name=  Name of the uploader');
      process.exit(1);
    }

    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    // Extract playlist name from filename and generate batch ID
    const playlistName = path.basename(csvPath, '.csv');
    const sanitizedName = playlistName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const timestamp = Date.now().toString();
    // Ensure batch ID fits in VARCHAR(50): "spotify-" (8) + sanitized name + "-" (1) + timestamp (13) = max 50
    const maxNameLength = 50 - 8 - 1 - timestamp.length;
    const truncatedName = sanitizedName.substring(0, maxNameLength);
    const batchId = `spotify-${truncatedName}-${timestamp}`;

    console.log('='.repeat(60));
    console.log('SPOTIFY PLAYLIST ENRICHMENT');
    console.log('='.repeat(60));
    console.log(`Input file: ${csvPath}`);
    console.log(`Playlist name: ${playlistName}`);
    console.log(`Batch ID: ${batchId}`);
    console.log(`Uploaded by: ${options.uploadedByName || 'Unknown'}`);
    console.log(`Skip existing: ${options.skipExisting ? 'Yes (use --force to reprocess)' : 'No (reprocessing all)'}`);
    console.log(`Concurrency: ${CONCURRENCY} songs at a time`);
    console.log('='.repeat(60));

    // Parse CSV
    const songs = parseSpotifyCSV(csvPath);

    if (songs.length === 0) {
      console.error('Error: No songs found in CSV');
      process.exit(1);
    }

    // Validate required fields
    const missingSongs = songs.filter(s => !s.title || !s.artist || !s.isrc);
    if (missingSongs.length > 0) {
      console.warn(`\nWarning: ${missingSongs.length} songs missing required fields (title, artist, or ISRC)`);
      missingSongs.slice(0, 5).forEach(s => {
        console.warn(`  Row ${s.rowNumber}: ${s.title || 'NO TITLE'} by ${s.artist || 'NO ARTIST'}`);
      });
    }

    // Create playlist record
    console.log('\nCreating playlist record...');
    const playlist = await prisma.playlist.create({
      data: {
        name: playlistName,
        uploadBatchId: batchId,
        uploadedByName: options.uploadedByName || null,
        sourceFile: path.basename(csvPath),
        totalSongs: 0,
        newSongs: 0,
        duplicateSongs: 0
      }
    });
    console.log(`✓ Created playlist: ${playlist.id}`);

    // Fetch Spotify metadata
    const spotifyMetadata = await fetchSpotifyMetadata(songs);

    // Process songs
    console.log('\nStarting AI enrichment...\n');
    const results = await processSongsWithConcurrency(songs, spotifyMetadata, CONCURRENCY, playlistName, batchId, playlist.id, options.skipExisting);

    // Update playlist stats
    const newSongsCount = results.filter(r => r.wasNew === true).length;
    const duplicateSongsCount = results.filter(r => r.wasNew === false).length;

    await prisma.playlist.update({
      where: { id: playlist.id },
      data: {
        totalSongs: results.length,
        newSongs: newSongsCount,
        duplicateSongs: duplicateSongsCount
      }
    });

    console.log(`\n✓ Updated playlist stats: ${newSongsCount} new, ${duplicateSongsCount} existing`);

    // Export results
    const outputFilename = `spotify-enrichment-${Date.now()}.csv`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    exportResultsToCSV(results, outputPath);

    // Print summary
    printSummary(results);

    console.log('\n✓ Enrichment complete!');
    console.log(`\nNext steps:`);
    console.log(`  1. Review songs in the web interface: http://localhost:3000`);
    console.log(`  2. Filter by "Review Status: Unreviewed Only" to see new imports`);
    console.log(`  3. Curators can play 30-second Spotify previews for songs with preview URLs`);
    console.log(`  4. Use the playlist filter to view only songs from "${playlistName}"`);

  } catch (error) {
    console.error('\nFatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  parseSpotifyCSV,
  processSongGeminiOnly,
  // Backwards-compatible alias
  processSong: processSongGeminiOnly
};
