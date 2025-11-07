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
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier.cjs');

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
 * Process a single song
 */
async function processSong(song, spotifyMetadata) {
  try {
    // Get Spotify metadata
    const spotifyTrack = spotifyMetadata.get(song.spotifyTrackId);

    // Normalize BPM
    const bpmResult = normalizeBpm(song.bpm);

    if (bpmResult.transformations.includes('doubled') || bpmResult.transformations.includes('halved')) {
      console.log(`  BPM normalized: ${bpmResult.originalBpm} → ${bpmResult.normalizedBpm} (${bpmResult.transformations.join(', ')})`);
    }

    // Run AI classifications in parallel
    const [geminiResult, explicitResult] = await Promise.all([
      classifySong(song.artist, song.title, {
        bpm: bpmResult.normalizedBpm,
        // We deliberately don't include Spotify's audio features to stay compliant
      }),
      classifyExplicitContent(song.title, song.artist)
    ]);

    // Prepare database record
    const songData = {
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      bpm: bpmResult.normalizedBpm,
      artwork: spotifyTrack?.albumArt || null,
      sourceFile: spotifyTrack?.previewUrl || null,
      spotifyTrackId: song.spotifyTrackId,

      // AI classifications
      aiStatus: geminiResult.status,
      aiErrorMessage: geminiResult.error_message || null,
      aiReasoning: geminiResult.reasoning || null,
      aiContextUsed: geminiResult.context || null,
      aiEnergy: geminiResult.energy || null,
      aiAccessibility: geminiResult.accessibility || null,
      aiExplicit: explicitResult.classification || null,
      aiSubgenre1: geminiResult.subgenre1 || null,
      aiSubgenre2: geminiResult.subgenre2 || null,
      aiSubgenre3: geminiResult.subgenre3 || null,

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

    return {
      success: true,
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      hasPreview: !!spotifyTrack?.previewUrl,
      bpmTransformation: bpmResult.transformations.join(', '),
      aiStatus: geminiResult.status,
    };

  } catch (error) {
    console.error(`  ✗ Error processing ${song.title} by ${song.artist}:`, error.message);
    return {
      success: false,
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      error: error.message,
    };
  }
}

/**
 * Process songs with concurrency control
 */
async function processSongsWithConcurrency(songs, spotifyMetadata, concurrency) {
  const results = [];

  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(songs.length / concurrency);

    console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (songs ${i + 1}-${Math.min(i + concurrency, songs.length)})...`);

    const batchResults = await Promise.all(
      batch.map(song => processSong(song, spotifyMetadata))
    );

    results.push(...batchResults);

    // Print progress for this batch
    batchResults.forEach((result, idx) => {
      const songNum = i + idx + 1;
      if (result.success) {
        const previewIcon = result.hasPreview ? '🎵' : '⚠️';
        console.log(`  ${previewIcon} [${songNum}/${songs.length}] ${result.artist} - ${result.title} (${result.aiStatus})`);
      } else {
        console.log(`  ✗ [${songNum}/${songs.length}] ${result.artist} - ${result.title} - ERROR: ${result.error}`);
      }
    });
  }

  return results;
}

/**
 * Export results to CSV
 */
function exportResultsToCSV(results, outputPath) {
  const header = 'Artist,Title,ISRC,AI Status,Has Preview,BPM Transformation,Error\n';
  const rows = results.map(r =>
    `"${r.artist}","${r.title}","${r.isrc}","${r.aiStatus || 'ERROR'}","${r.hasPreview ? 'Yes' : 'No'}","${r.bpmTransformation || 'N/A'}","${r.error || ''}"`
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
  const withPreview = results.filter(r => r.hasPreview).length;
  const withoutPreview = results.filter(r => r.success && !r.hasPreview).length;

  const statusCounts = {};
  results.forEach(r => {
    const status = r.aiStatus || 'ERROR';
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  console.log('\n' + '='.repeat(60));
  console.log('ENRICHMENT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total songs:           ${results.length}`);
  console.log(`Successfully processed: ${successful}`);
  console.log(`Failed:                ${failed}`);
  console.log(`\nSpotify Preview URLs:`);
  console.log(`  With preview:        ${withPreview} (${Math.round(withPreview/results.length*100)}%)`);
  console.log(`  Without preview:     ${withoutPreview} (${Math.round(withoutPreview/results.length*100)}%)`);
  console.log(`\nAI Classification Status:`);
  Object.entries(statusCounts).forEach(([status, count]) => {
    console.log(`  ${status.padEnd(20)} ${count}`);
  });
  console.log('='.repeat(60));
}

/**
 * Main execution
 */
async function main() {
  try {
    // Get CSV file path from command line
    const csvPath = process.argv[2];

    if (!csvPath) {
      console.error('Error: Please provide a CSV file path');
      console.error('Usage: node scripts/enrich-spotify-playlist.cjs "path/to/spotify-export.csv"');
      process.exit(1);
    }

    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    console.log('='.repeat(60));
    console.log('SPOTIFY PLAYLIST ENRICHMENT');
    console.log('='.repeat(60));
    console.log(`Input file: ${csvPath}`);
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

    // Fetch Spotify metadata
    const spotifyMetadata = await fetchSpotifyMetadata(songs);

    // Process songs
    console.log('\nStarting AI enrichment...\n');
    const results = await processSongsWithConcurrency(songs, spotifyMetadata, CONCURRENCY);

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

module.exports = { parseSpotifyCSV, processSong };
