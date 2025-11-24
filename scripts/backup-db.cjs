#!/usr/bin/env node
/**
 * Database Backup Script
 * Exports all data from database as JSON
 */

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backup() {
  console.log('Starting database backup...\n');

  try {
    // Fetch all data
    console.log('Fetching users...');
    const users = await prisma.user.findMany();
    console.log(`  ✓ ${users.length} users`);

    console.log('Fetching songs...');
    const songs = await prisma.song.findMany();
    console.log(`  ✓ ${songs.length} songs`);

    console.log('Fetching playlists...');
    const playlists = await prisma.playlist.findMany();
    console.log(`  ✓ ${playlists.length} playlists`);

    console.log('Fetching playlist songs...');
    const playlistSongs = await prisma.playlistSong.findMany();
    console.log(`  ✓ ${playlistSongs.length} playlist songs`);

    // Create backup object
    const backup = {
      timestamp: new Date().toISOString(),
      users,
      songs,
      playlists,
      playlistSongs
    };

    // Generate filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    const filename = `backups/db_backup_${timestamp}.json`;

    // Ensure backups directory exists
    if (!fs.existsSync('backups')) {
      fs.mkdirSync('backups');
    }

    // Write to file
    fs.writeFileSync(filename, JSON.stringify(backup, null, 2));

    const stats = fs.statSync(filename);
    const sizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`\n✓ Backup complete!`);
    console.log(`  File: ${filename}`);
    console.log(`  Size: ${sizeInMB} MB`);
    console.log(`  Total records: ${users.length + songs.length + playlists.length + playlistSongs.length}`);

  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backup();
