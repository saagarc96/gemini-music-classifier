#!/usr/bin/env node

/**
 * Check Quota Script
 *
 * Displays current quota usage and recommendations for next batch submission.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

const PROGRESS_FILE = path.join(PROJECT_ROOT, 'playlists', 'processed', 'completed.json');

async function checkQuota() {
  console.log('🔍 Checking quota and progress...\n');

  // Load progress
  let progress;
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf-8');
    progress = JSON.parse(data);
  } catch (err) {
    progress = { processed: [], lastUpdate: null };
  }

  console.log('📊 Processing Progress:');
  console.log(`   Playlists processed: ${progress.processed.length}`);
  if (progress.lastUpdate) {
    const lastUpdate = new Date(progress.lastUpdate);
    const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);
    console.log(`   Last update: ${lastUpdate.toLocaleString()} (${hoursSince.toFixed(1)} hours ago)`);
  }

  // Count available playlists
  const INPUT_DIR = path.join(PROJECT_ROOT, 'playlists', 'input', 'isrc_output');
  const files = await fs.readdir(INPUT_DIR);
  const totalPlaylists = files.filter(f => f.endsWith('_high_confidence.csv')).length;
  const remaining = totalPlaylists - progress.processed.length;

  console.log(`   Total playlists: ${totalPlaylists}`);
  console.log(`   Remaining: ${remaining}`);
  console.log(`   Progress: ${((progress.processed.length / totalPlaylists) * 100).toFixed(1)}%`);

  // Estimate completion
  const playlistsPerDay = 5.5; // Average of 5-6
  const daysRemaining = Math.ceil(remaining / playlistsPerDay);

  console.log(`\n⏱️  Estimated completion: ${daysRemaining} days at 5-6 playlists/day`);

  // Recommendations
  console.log('\n💡 Recommendations:');

  if (progress.lastUpdate) {
    const lastUpdate = new Date(progress.lastUpdate);
    const hoursSince = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60);

    if (hoursSince < 2) {
      console.log('   ⚠️  Wait at least 2 hours between submissions');
      const waitMinutes = Math.ceil((2 - hoursSince) * 60);
      console.log(`   ⏳ Wait ${waitMinutes} more minutes before next submission`);
    } else {
      console.log('   ✅ Safe to submit next batch');
    }
  } else {
    console.log('   ✅ No previous submissions - safe to start');
  }

  // Daily submission plan
  const today = new Date().getHours();
  if (today < 12) {
    console.log('   📅 Morning session: Submit 2-3 playlists now');
    console.log('   📅 Afternoon session: Submit 2-3 more after 2pm');
  } else if (today < 17) {
    console.log('   📅 Afternoon session: Submit 2-3 playlists now');
    console.log('   📅 Evening session: Submit 2-3 more after 6pm (if needed)');
  } else {
    console.log('   📅 Save remaining submissions for tomorrow morning');
  }

  console.log('\n🔗 Quota Dashboard:');
  console.log('   https://aistudio.google.com/u/1/usage?tab=rate-limit');
}

checkQuota().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
