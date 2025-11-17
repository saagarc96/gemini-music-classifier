#!/usr/bin/env node

/**
 * Reprocess songs with ERROR status
 *
 * Usage: node scripts/reprocess-errors.cjs --batch-name=medium-priority-batch-4 --concurrency=5
 */

const { PrismaClient } = require('@prisma/client');
const { classifySong } = require('../src/classifiers/gemini-classifier.cjs');
const { classifyExplicitContent } = require('../src/classifiers/explicit-classifier.cjs');

const prisma = new PrismaClient();

// Parse command line args
const args = process.argv.slice(2);
const batchName = args.find(a => a.startsWith('--batch-name='))?.split('=')[1];
const concurrency = parseInt(args.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '5');

if (!batchName) {
  console.error('Usage: node scripts/reprocess-errors.cjs --batch-name=BATCH_NAME [--concurrency=5]');
  process.exit(1);
}

async function reprocessErrors() {
  try {
    console.log('='.repeat(60));
    console.log('Reprocess Error Songs Script');
    console.log('='.repeat(60));
    console.log(`Batch Name: ${batchName}`);
    console.log(`Concurrency: ${concurrency}`);
    console.log('='.repeat(60));
    console.log('');

    // Find all ERROR songs for this batch
    const errorSongs = await prisma.song.findMany({
      where: {
        uploadBatchId: batchName,
        aiStatus: 'ERROR'
      },
      orderBy: {
        createdAt: 'asc'
      }
    });

    console.log(`Found ${errorSongs.length} songs with ERROR status\n`);

    if (errorSongs.length === 0) {
      console.log('✓ No errors to reprocess!');
      return;
    }

    let successCount = 0;
    let stillErrorCount = 0;

    // Process in batches
    for (let i = 0; i < errorSongs.length; i += concurrency) {
      const batch = errorSongs.slice(i, i + concurrency);
      console.log(`\nProcessing batch ${Math.floor(i / concurrency) + 1}/${Math.ceil(errorSongs.length / concurrency)} (${batch.length} songs)...`);

      const promises = batch.map(async (song) => {
        try {
          console.log(`  Reprocessing: ${song.artist} - ${song.title}`);

          // Run Gemini classification
          const geminiResult = await classifySong(song.artist, song.title, {
            bpm: song.bpm
          });

          if (geminiResult.status !== 'SUCCESS') {
            console.log(`  ⚠ Still failed: ${song.artist} - ${song.title}`);
            stillErrorCount++;
            return;
          }

          // Run explicit classification
          const explicitResult = await classifyExplicitContent(song.artist, song.title);

          // Update database
          await prisma.song.update({
            where: { isrc: song.isrc },
            data: {
              aiEnergy: geminiResult.energy,
              aiAccessibility: geminiResult.accessibility,
              aiSubgenre1: geminiResult.subgenre1,
              aiSubgenre2: geminiResult.subgenre2,
              aiSubgenre3: geminiResult.subgenre3,
              aiExplicit: explicitResult.classification,
              aiReasoning: geminiResult.reasoning,
              aiContextUsed: geminiResult.context,
              aiStatus: 'SUCCESS',
              modifiedAt: new Date()
            }
          });

          console.log(`  ✓ Fixed: ${song.artist} - ${song.title}`);
          successCount++;
        } catch (error) {
          console.error(`  ✗ Error reprocessing ${song.artist} - ${song.title}:`, error.message);
          stillErrorCount++;
        }
      });

      await Promise.all(promises);
    }

    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log('='.repeat(60));
    console.log(`Total errors found: ${errorSongs.length}`);
    console.log(`Successfully fixed: ${successCount}`);
    console.log(`Still have errors: ${stillErrorCount}`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reprocessErrors();
