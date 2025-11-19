#!/usr/bin/env node

const fs = require('fs');
const { parse } = require('csv-parse/sync');

// Read all Christmas playlist CSVs and check for duplicate ISRCs
const playlists = [
  'Christmas Funk & Soul.csv',
  'Christmas Folk.csv',
  'Christmas Indie (1).csv',
  'Christmas Pop.csv',
  'Christmas Instrumentals.csv',
  'Christmas Jazz.csv',
  'Christmas Classics.csv',
  'Christmas Coffeehouse.csv'
];

const isrcMap = new Map(); // Track which playlists each ISRC appears in

playlists.forEach(playlist => {
  const filePath = 'playlists/playlists-to-import/' + playlist;
  if (!fs.existsSync(filePath)) {
    console.log('Skipping missing file:', playlist);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, trim: true, bom: true });

  records.forEach(record => {
    const isrc = record.ISRC || record.isrc;
    if (!isrc) return;

    if (!isrcMap.has(isrc)) {
      isrcMap.set(isrc, []);
    }
    isrcMap.get(isrc).push(playlist);
  });
});

// Find ISRCs that appear in multiple playlists
const duplicates = Array.from(isrcMap.entries())
  .filter(([isrc, playlists]) => playlists.length > 1)
  .map(([isrc, playlists]) => ({ isrc, count: playlists.length, playlists }));

console.log('Total unique ISRCs across all playlists:', isrcMap.size);
console.log('ISRCs appearing in multiple playlists:', duplicates.length);

// Show how many duplicates involve Christmas Instrumentals
const instrumentalDupes = duplicates.filter(d =>
  d.playlists.includes('Christmas Instrumentals.csv')
);

console.log('\nChristmas Instrumentals ISRCs that also appear in other playlists:', instrumentalDupes.length);

// Show breakdown by which playlists overlap
const overlapCounts = {};
instrumentalDupes.forEach(d => {
  const others = d.playlists.filter(p => p !== 'Christmas Instrumentals.csv').join(', ');
  overlapCounts[others] = (overlapCounts[others] || 0) + 1;
});

console.log('\nOverlap breakdown:');
Object.entries(overlapCounts)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 10)
  .forEach(([playlists, count]) => {
    console.log('  ' + count + ' songs also in: ' + playlists);
  });

// Show total songs in Christmas Instrumentals CSV
const instrumentalPath = 'playlists/playlists-to-import/Christmas Instrumentals.csv';
const instrumentalContent = fs.readFileSync(instrumentalPath, 'utf-8');
const instrumentalRecords = parse(instrumentalContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true
});

console.log('\nChristmas Instrumentals CSV stats:');
console.log('  Total songs in CSV:', instrumentalRecords.length);
console.log('  Songs with ISRCs:', instrumentalRecords.filter(r => r.ISRC || r.isrc).length);
console.log('  Unique ISRCs (should stay):', instrumentalRecords.length - instrumentalDupes.length);
console.log('  Duplicate ISRCs (replaced by other playlists):', instrumentalDupes.length);
