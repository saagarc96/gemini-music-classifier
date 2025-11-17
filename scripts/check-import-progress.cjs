#!/usr/bin/env node

/**
 * Quick progress check for batch import
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkProgress() {
  try {
    // Get total counts
    const total = await prisma.song.count();
    const reviewed = await prisma.song.count({ where: { reviewed: true } });
    const unreviewed = await prisma.song.count({ where: { reviewed: false } });

    // Get recent additions (last hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentlyAdded = await prisma.song.count({
      where: {
        createdAt: { gte: oneHourAgo }
      }
    });

    // Get latest song
    const latestSong = await prisma.song.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { artist: true, title: true, createdAt: true }
    });

    console.log('');
    console.log('═'.repeat(60));
    console.log('IMPORT PROGRESS');
    console.log('═'.repeat(60));
    console.log(`Total songs in database: ${total.toLocaleString()}`);
    console.log(`  Reviewed: ${reviewed.toLocaleString()}`);
    console.log(`  Unreviewed: ${unreviewed.toLocaleString()}`);
    console.log('');
    console.log(`Recently added (last hour): ${recentlyAdded} songs`);
    console.log('');
    if (latestSong) {
      console.log('Latest song imported:');
      console.log(`  ${latestSong.artist} - ${latestSong.title}`);
      console.log(`  ${latestSong.createdAt.toLocaleString()}`);
    }
    console.log('═'.repeat(60));
    console.log('');

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProgress();
