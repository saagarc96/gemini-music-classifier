#!/usr/bin/env node

/**
 * Merge Results Script
 *
 * Combines all classified playlist CSVs into a single merged file.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.dirname(__dirname);

const INPUT_DIR = path.join(PROJECT_ROOT, 'outputs', 'by-playlist');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'outputs', 'merged');
const OUTPUT_FILE = path.join(OUTPUT_DIR, 'all-classifications.csv');

async function mergeResults() {
  console.log('🔄 Merging playlist results...\n');

  // Read all CSV files
  const files = await fs.readdir(INPUT_DIR);
  const csvFiles = files.filter(f => f.endsWith('.csv'));

  if (csvFiles.length === 0) {
    console.log('❌ No CSV files found in outputs/by-playlist/');
    return;
  }

  console.log(`Found ${csvFiles.length} files to merge:`);
  csvFiles.forEach(f => console.log(`  - ${f}`));

  // Merge all data
  const allRows = [];
  let headers = null;

  for (const file of csvFiles) {
    const filePath = path.join(INPUT_DIR, file);
    const content = await fs.readFile(filePath, 'utf-8');
    const records = parse(content, { columns: true, skip_empty_lines: true });

    if (!headers) {
      headers = Object.keys(records[0]);
    }

    allRows.push(...records);
  }

  console.log(`\n📊 Total songs merged: ${allRows.length}`);

  // Write merged file
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const csv = stringify(allRows, { header: true, columns: headers });
  await fs.writeFile(OUTPUT_FILE, csv);

  console.log(`✅ Merged file created: ${OUTPUT_FILE}`);

  // Statistics
  const energyLevels = {};
  const accessibility = {};
  const explicitContent = {};

  allRows.forEach(row => {
    energyLevels[row.energy] = (energyLevels[row.energy] || 0) + 1;
    accessibility[row.accessibility] = (accessibility[row.accessibility] || 0) + 1;
    explicitContent[row.explicit_content] = (explicitContent[row.explicit_content] || 0) + 1;
  });

  console.log('\n📈 Statistics:');
  console.log('\nEnergy Distribution:');
  Object.entries(energyLevels).sort((a, b) => a[0].localeCompare(b[0])).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${((v / allRows.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nAccessibility Distribution:');
  Object.entries(accessibility).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${((v / allRows.length) * 100).toFixed(1)}%)`);
  });

  console.log('\nExplicit Content Distribution:');
  Object.entries(explicitContent).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
    console.log(`  ${k}: ${v} (${((v / allRows.length) * 100).toFixed(1)}%)`);
  });
}

mergeResults().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
