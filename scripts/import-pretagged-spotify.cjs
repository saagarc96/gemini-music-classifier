#!/usr/bin/env node

/**
 * Pre-Tagged Curator Spotify Import Script
 *
 * Imports curator-prepared CSVs with pre-filled classification values,
 * skipping AI classification entirely while still fetching Spotify metadata.
 *
 * CSV Format (10 columns):
 *   Song, Artist, BPM, Spotify Track Id, ISRC,
 *   Curator_Energy, Curator_Accessibility, Curator_Explicit, Curator_Subgenre,
 *   Uploaded By
 *
 * Usage:
 *   node scripts/import-pretagged-spotify.cjs "path/to/curator-tagged.csv"
 *   npm run import:pretagged "path/to/curator-tagged.csv"
 *
 * Options:
 *   --playlist-name=NAME    Custom playlist name (defaults to filename)
 *   --dry-run               Show what would be imported without writing to DB
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { PrismaClient } = require('@prisma/client');
const spotifyClient = require('../src/utils/spotify-client.cjs');
const { normalizeBpm } = require('../src/utils/bpm-normalizer.cjs');

const prisma = new PrismaClient();

// Configuration
const CONCURRENCY = 10; // Higher concurrency since no AI calls
const OUTPUT_DIR = 'outputs';

// Valid values for curator fields
const VALID_ENERGY = ['Low', 'Medium', 'High'];
const VALID_ACCESSIBILITY = ['Eclectic', 'Timeless', 'Commercial', 'Cheesy'];
const VALID_EXPLICIT = ['Family Friendly', 'Suggestive', 'Explicit'];

// Common typo corrections
const TYPO_CORRECTIONS = {
  'familly friendly': 'Family Friendly',
  'family freindly': 'Family Friendly',
  'familyfriendly': 'Family Friendly',
};

/**
 * Parse curator-tagged CSV
 * Expected columns: Song, Artist, BPM, Spotify Track Id, ISRC,
 *                   Curator_Energy, Curator_Accessibility, Curator_Explicit, Curator_Subgenre,
 *                   Uploaded By
 */
function parseCuratorCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf-8');

  const records = parse(fileContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true // Handle UTF-8 BOM
  });

  console.log(`Parsed ${records.length} songs from CSV`);

  // Check for required curator columns
  if (records.length > 0) {
    const firstRecord = records[0];
    const requiredColumns = ['Curator_Energy', 'Curator_Accessibility', 'Curator_Explicit', 'Curator_Subgenre'];
    const missingColumns = requiredColumns.filter(col => !(col in firstRecord));

    if (missingColumns.length > 0) {
      console.error(`\n❌ Missing required curator columns: ${missingColumns.join(', ')}`);
      console.error('\nExpected CSV format:');
      console.error('  Song, Artist, BPM, Spotify Track Id, ISRC, Curator_Energy, Curator_Accessibility, Curator_Explicit, Curator_Subgenre, Uploaded By');
      console.error('\nExample:');
      console.error('  Flute Canyon,Native American Instrumentals,62,spotify:track:abc123,US1234567890,Low,Eclectic,Family Friendly,Native American Spa,Kristine');
      process.exit(1);
    }
  }

  return records.map((record, index) => ({
    rowNumber: index + 2, // +2 for header and 1-based indexing
    title: record.Song || record.song || record.Title || record.title,
    artist: record.Artist || record.artist,
    bpm: parseInt(record.BPM || record.bpm || record.Tempo || record.tempo) || null,
    spotifyTrackId: record['Spotify Track Id'] || record['Spotify Track ID'] || record.spotify_track_id,
    isrc: record.ISRC || record.isrc,
    // Curator-provided classification values
    curatorEnergy: record.Curator_Energy || record.curator_energy,
    curatorAccessibility: record.Curator_Accessibility || record.curator_accessibility,
    curatorExplicit: record.Curator_Explicit || record.curator_explicit,
    curatorSubgenre: record.Curator_Subgenre || record.curator_subgenre,
    uploadedBy: record['Uploaded By'] || record.uploaded_by || null,
  }));
}

/**
 * Parse subgenre string into array (max 3)
 */
function parseSubgenres(subgenreStr) {
  if (!subgenreStr) return [null, null, null];

  const subgenres = subgenreStr
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0)
    .slice(0, 3); // Max 3 subgenres

  return [
    subgenres[0] || null,
    subgenres[1] || null,
    subgenres[2] || null,
  ];
}

/**
 * Validate curator values and return normalized values with warnings
 */
function validateCuratorValues(song) {
  const warnings = [];

  // Normalize and validate Energy
  let energy = song.curatorEnergy;
  if (energy) {
    // Try to match case-insensitively
    const matched = VALID_ENERGY.find(v => v.toLowerCase() === energy.toLowerCase());
    if (matched) {
      energy = matched;
    } else {
      warnings.push(`Invalid Energy "${energy}" (expected: ${VALID_ENERGY.join(', ')})`);
      energy = null;
    }
  }

  // Normalize and validate Accessibility
  let accessibility = song.curatorAccessibility;
  if (accessibility) {
    const matched = VALID_ACCESSIBILITY.find(v => v.toLowerCase() === accessibility.toLowerCase());
    if (matched) {
      accessibility = matched;
    } else {
      warnings.push(`Invalid Accessibility "${accessibility}" (expected: ${VALID_ACCESSIBILITY.join(', ')})`);
      accessibility = null;
    }
  }

  // Normalize and validate Explicit
  let explicit = song.curatorExplicit;
  if (explicit) {
    // Check for common typos first
    const typoKey = explicit.toLowerCase();
    if (TYPO_CORRECTIONS[typoKey]) {
      explicit = TYPO_CORRECTIONS[typoKey];
    } else {
      const matched = VALID_EXPLICIT.find(v => v.toLowerCase() === explicit.toLowerCase());
      if (matched) {
        explicit = matched;
      } else {
        warnings.push(`Invalid Explicit "${explicit}" (expected: ${VALID_EXPLICIT.join(', ')})`);
        explicit = null;
      }
    }
  }

  return {
    energy,
    accessibility,
    explicit,
    warnings,
  };
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
    return new Map();
  }

  console.log(`Fetching metadata for ${trackIds.length} tracks...`);

  try {
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
  } catch (error) {
    console.warn(`⚠️ Spotify API error: ${error.message}`);
    console.warn('  Continuing without Spotify metadata (no preview URLs or artwork)');
    return new Map();
  }
}

/**
 * Process a single song (no AI calls)
 */
async function processSong(song, spotifyMetadata, batchName = null, batchId = null, playlistId = null, dryRun = false) {
  try {
    // Skip songs without ISRC
    if (!song.isrc) {
      return {
        success: false,
        skipped: false,
        isrc: null,
        title: song.title,
        artist: song.artist,
        error: 'Missing ISRC',
        wasNew: false,
      };
    }

    // Check if song exists before processing
    const existingSong = await prisma.song.findUnique({
      where: { isrc: song.isrc }
    });
    const wasNew = !existingSong;

    // Get Spotify metadata
    const spotifyTrack = spotifyMetadata.get(song.spotifyTrackId);

    // Normalize BPM
    const bpmResult = normalizeBpm(song.bpm);

    // Validate curator values
    const validated = validateCuratorValues(song);

    // Parse subgenres
    const [subgenre1, subgenre2, subgenre3] = parseSubgenres(song.curatorSubgenre);

    if (dryRun) {
      return {
        success: true,
        skipped: false,
        isrc: song.isrc,
        title: song.title,
        artist: song.artist,
        hasPreview: !!spotifyTrack?.previewUrl,
        hasEmbed: !!song.spotifyTrackId,
        bpmTransformation: bpmResult.transformations.join(', ') || 'none',
        aiStatus: 'CURATOR_TAGGED',
        wasNew: wasNew,
        warnings: validated.warnings,
        energy: validated.energy,
        subgenres: [subgenre1, subgenre2, subgenre3].filter(Boolean).join('; '),
      };
    }

    // Generate Spotify embed URL from track ID (works even when preview_url is null)
    const spotifyEmbedUrl = song.spotifyTrackId
      ? `https://open.spotify.com/embed/track/${song.spotifyTrackId}?utm_source=generator`
      : null;

    // Prepare database record
    const songData = {
      isrc: song.isrc,
      title: song.title,
      artist: song.artist,
      bpm: bpmResult.normalizedBpm,
      artwork: spotifyTrack?.albumArt || null,
      sourceFile: spotifyTrack?.previewUrl || spotifyEmbedUrl, // Fallback to embed URL
      spotifyTrackId: song.spotifyTrackId,
      spotifyPreviewUrl: spotifyTrack?.previewUrl || null,
      spotifyArtworkUrl: spotifyTrack?.albumArt || null,

      // Curator-provided classifications (stored in AI fields for compatibility)
      aiStatus: 'CURATOR_TAGGED',
      aiErrorMessage: null,
      aiReasoning: `Pre-tagged by curator: ${song.uploadedBy || 'Unknown'}`,
      aiContextUsed: null,
      aiEnergy: validated.energy,
      aiAccessibility: validated.accessibility,
      aiExplicit: validated.explicit,
      aiSubgenre1: subgenre1,
      aiSubgenre2: subgenre2,
      aiSubgenre3: subgenre3,

      // Batch tracking
      uploadBatchId: batchId,
      uploadBatchName: batchName,

      // Review status (pre-approved by curator)
      reviewed: true,
      reviewedBy: song.uploadedBy || 'curator',
      reviewedAt: new Date(),
      curatorNotes: null,
    };

    // Upsert to database
    await prisma.song.upsert({
      where: { isrc: song.isrc },
      update: songData,
      create: songData,
    });

    // Create playlist association if playlistId provided
    if (playlistId) {
      await prisma.playlistSong.create({
        data: {
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
      hasEmbed: !!song.spotifyTrackId,
      bpmTransformation: bpmResult.transformations.join(', ') || 'none',
      aiStatus: 'CURATOR_TAGGED',
      wasNew: wasNew,
      warnings: validated.warnings,
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
    };
  }
}

/**
 * Process songs with concurrency control
 */
async function processSongsWithConcurrency(songs, spotifyMetadata, concurrency, playlistName = null, batchId = null, playlistId = null, dryRun = false) {
  const results = [];

  for (let i = 0; i < songs.length; i += concurrency) {
    const batch = songs.slice(i, i + concurrency);
    const batchNumber = Math.floor(i / concurrency) + 1;
    const totalBatches = Math.ceil(songs.length / concurrency);

    console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (songs ${i + 1}-${Math.min(i + concurrency, songs.length)})...`);

    const batchResults = await Promise.all(
      batch.map(song => processSong(song, spotifyMetadata, playlistName, batchId, playlistId, dryRun))
    );

    results.push(...batchResults);

    // Print progress for this batch
    batchResults.forEach((result, idx) => {
      const songNum = i + idx + 1;
      if (result.success) {
        const playbackIcon = result.hasPreview ? '🎵' : (result.hasEmbed ? '🔊' : '⚠️');
        const newIcon = result.wasNew ? '✨' : '♻️';
        console.log(`  ${playbackIcon}${newIcon} [${songNum}/${songs.length}] ${result.artist} - ${result.title}`);
        if (result.warnings && result.warnings.length > 0) {
          result.warnings.forEach(w => console.log(`      ⚠️ ${w}`));
        }
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
  const header = 'Artist,Title,ISRC,Status,New,Has Preview,BPM Transform,Warnings,Error\n';
  const rows = results.map(r =>
    `"${r.artist || ''}","${r.title || ''}","${r.isrc || ''}","${r.aiStatus || 'ERROR'}","${r.wasNew ? 'Yes' : 'No'}","${r.hasPreview ? 'Yes' : 'No'}","${r.bpmTransformation || 'N/A'}","${(r.warnings || []).join('; ')}","${r.error || ''}"`
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
  const newSongs = results.filter(r => r.wasNew).length;
  const updated = results.filter(r => r.success && !r.wasNew).length;
  const withPreview = results.filter(r => r.success && r.hasPreview).length;
  const withEmbed = results.filter(r => r.success && r.hasEmbed).length;
  const withWarnings = results.filter(r => r.warnings && r.warnings.length > 0).length;

  console.log('\n' + '='.repeat(60));
  console.log('IMPORT SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total songs in CSV:    ${results.length}`);
  console.log(`Successfully imported: ${successful}`);
  console.log(`  - New songs:         ${newSongs}`);
  console.log(`  - Updated existing:  ${updated}`);
  console.log(`Failed:                ${failed}`);
  console.log(`\nSpotify Playback:`);
  console.log(`  With 30s preview:    ${withPreview} (${successful > 0 ? Math.round(withPreview/successful*100) : 0}%)`);
  console.log(`  With embed player:   ${withEmbed} (${successful > 0 ? Math.round(withEmbed/successful*100) : 0}%)`);
  if (withWarnings > 0) {
    console.log(`\n⚠️ Songs with validation warnings: ${withWarnings}`);
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
      playlistName: args.find(a => a.startsWith('--playlist-name='))?.split('=')[1],
      dryRun: args.includes('--dry-run'),
    };

    if (!csvPath) {
      console.error('Error: Please provide a CSV file path');
      console.error('Usage: node scripts/import-pretagged-spotify.cjs "path/to/curator-tagged.csv" [options]');
      console.error('Options:');
      console.error('  --playlist-name=NAME  Custom playlist name (defaults to filename)');
      console.error('  --dry-run             Show what would be imported without writing to DB');
      process.exit(1);
    }

    if (!fs.existsSync(csvPath)) {
      console.error(`Error: File not found: ${csvPath}`);
      process.exit(1);
    }

    // Extract playlist name from filename and generate batch ID
    const playlistName = options.playlistName || path.basename(csvPath, '.csv');
    const sanitizedName = playlistName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const timestamp = Date.now().toString();
    const maxNameLength = 50 - 10 - 1 - timestamp.length; // "pretagged-" prefix
    const truncatedName = sanitizedName.substring(0, maxNameLength);
    const batchId = `pretagged-${truncatedName}-${timestamp}`;

    console.log('='.repeat(60));
    console.log('PRE-TAGGED CURATOR IMPORT');
    console.log('='.repeat(60));
    console.log(`Input file: ${csvPath}`);
    console.log(`Playlist name: ${playlistName}`);
    console.log(`Batch ID: ${batchId}`);
    console.log(`Mode: ${options.dryRun ? 'DRY RUN (no database writes)' : 'LIVE'}`);
    console.log(`Concurrency: ${CONCURRENCY} songs at a time`);
    console.log('='.repeat(60));

    // Parse CSV
    const songs = parseCuratorCSV(csvPath);

    if (songs.length === 0) {
      console.error('Error: No songs found in CSV');
      process.exit(1);
    }

    // Get unique uploader names
    const uploaders = [...new Set(songs.map(s => s.uploadedBy).filter(Boolean))];
    if (uploaders.length > 0) {
      console.log(`\nUploaded by: ${uploaders.join(', ')}`);
    }

    // Validate required fields
    const missingSongs = songs.filter(s => !s.title || !s.artist || !s.isrc);
    if (missingSongs.length > 0) {
      console.warn(`\nWarning: ${missingSongs.length} songs missing required fields (title, artist, or ISRC)`);
      missingSongs.slice(0, 5).forEach(s => {
        console.warn(`  Row ${s.rowNumber}: ${s.title || 'NO TITLE'} by ${s.artist || 'NO ARTIST'} (ISRC: ${s.isrc || 'MISSING'})`);
      });
    }

    // Create playlist record (unless dry run)
    let playlistId = null;
    if (!options.dryRun) {
      console.log('\nCreating playlist record...');
      const playlist = await prisma.playlist.create({
        data: {
          name: playlistName,
          uploadBatchId: batchId,
          uploadedByName: uploaders[0] || null,
          sourceFile: path.basename(csvPath),
          totalSongs: 0,
          newSongs: 0,
          duplicateSongs: 0
        }
      });
      playlistId = playlist.id;
      console.log(`✓ Created playlist: ${playlist.id}`);
    }

    // Fetch Spotify metadata
    const spotifyMetadata = await fetchSpotifyMetadata(songs);

    // Process songs
    console.log('\nImporting curator-tagged songs...\n');
    const results = await processSongsWithConcurrency(songs, spotifyMetadata, CONCURRENCY, playlistName, batchId, playlistId, options.dryRun);

    // Update playlist stats (unless dry run)
    if (!options.dryRun && playlistId) {
      const newSongsCount = results.filter(r => r.wasNew === true).length;
      const duplicateSongsCount = results.filter(r => r.wasNew === false && r.success).length;

      await prisma.playlist.update({
        where: { id: playlistId },
        data: {
          totalSongs: results.filter(r => r.success).length,
          newSongs: newSongsCount,
          duplicateSongs: duplicateSongsCount
        }
      });

      console.log(`\n✓ Updated playlist stats: ${newSongsCount} new, ${duplicateSongsCount} existing`);
    }

    // Export results
    const outputFilename = `pretagged-import-${Date.now()}.csv`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    exportResultsToCSV(results, outputPath);

    // Print summary
    printSummary(results);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN COMPLETE - No changes were made to the database');
    } else {
      console.log('\n✓ Import complete!');
      console.log(`\nAll ${results.filter(r => r.success).length} songs are marked as reviewed and ready for export.`);
    }

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

module.exports = { parseCuratorCSV, processSong };
