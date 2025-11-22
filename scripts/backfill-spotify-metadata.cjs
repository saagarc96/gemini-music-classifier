#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const spotifyClient = require('../src/utils/spotify-client.cjs');

const prisma = new PrismaClient();

async function backfillSpotifyMetadata() {
  console.log('='.repeat(60));
  console.log('Backfill Spotify Metadata (Audio & Artwork)');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Find all songs with Spotify Track ID but missing audio/artwork
    const songsToUpdate = await prisma.song.findMany({
      where: {
        spotifyTrackId: { not: null },
        OR: [
          { sourceFile: null },
          { sourceFile: '' },
          { artwork: null },
          { artwork: '' }
        ]
      },
      select: {
        isrc: true,
        spotifyTrackId: true,
        title: true,
        artist: true,
        sourceFile: true,
        artwork: true
      }
    });

    console.log(`Found ${songsToUpdate.length} songs to update\n`);

    if (songsToUpdate.length === 0) {
      console.log('✓ All songs already have Spotify metadata!');
      return;
    }

    // Fetch Spotify metadata in batches of 50 (API limit)
    const BATCH_SIZE = 50;
    let updated = 0;
    let notFound = 0;
    let errors = 0;

    for (let i = 0; i < songsToUpdate.length; i += BATCH_SIZE) {
      const batch = songsToUpdate.slice(i, i + BATCH_SIZE);
      const trackIds = batch.map(s => s.spotifyTrackId);

      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(songsToUpdate.length / BATCH_SIZE)} (${batch.length} songs)...`);

      try {
        const tracks = await spotifyClient.getTracks(trackIds);

        // Update each song with Spotify metadata
        for (let j = 0; j < batch.length; j++) {
          const song = batch[j];
          const track = tracks[j];

          if (!track) {
            console.log(`  ⚠ ${song.artist} - ${song.title}: Track not found on Spotify`);
            notFound++;
            continue;
          }

          const previewUrl = track.preview_url;
          const albumArt = track.album?.images?.[0]?.url;

          // Only update if we're adding new data
          const needsUpdate =
            (!song.sourceFile && previewUrl) ||
            (!song.artwork && albumArt);

          if (needsUpdate) {
            await prisma.song.update({
              where: { isrc: song.isrc },
              data: {
                sourceFile: previewUrl || song.sourceFile,
                artwork: albumArt || song.artwork,
                spotifyPreviewUrl: previewUrl || undefined,
                spotifyArtworkUrl: albumArt || undefined
              }
            });

            const parts = [];
            if (previewUrl && !song.sourceFile) parts.push('audio');
            if (albumArt && !song.artwork) parts.push('artwork');

            console.log(`  ✓ ${song.artist} - ${song.title}: Added ${parts.join(' + ')}`);
            updated++;
          }
        }
      } catch (error) {
        console.error(`  ✗ Batch error: ${error.message}`);
        errors++;
      }

      // Rate limiting: wait 100ms between batches
      if (i + BATCH_SIZE < songsToUpdate.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('Summary:');
    console.log(`  Updated: ${updated}`);
    console.log(`  Not found on Spotify: ${notFound}`);
    console.log(`  Errors: ${errors}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the backfill
backfillSpotifyMetadata()
  .then(() => {
    console.log('\n✓ Backfill complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n✗ Backfill failed:', error);
    process.exit(1);
  });
