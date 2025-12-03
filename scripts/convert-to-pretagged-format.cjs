#!/usr/bin/env node

/**
 * Convert Spotify Export to Pre-Tagged Curator Format
 *
 * Takes a full Spotify export CSV and converts it to the minimal
 * pre-tagged curator format with default classification values.
 *
 * Usage:
 *   node scripts/convert-to-pretagged-format.cjs input.csv \
 *     --energy=Low --accessibility=Eclectic --explicit="Family Friendly" \
 *     --subgenre="Native American Spa" --uploaded-by="Kristine"
 */

const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

// Parse command line arguments
const args = process.argv.slice(2);
const inputPath = args.find(arg => !arg.startsWith('--'));

// Parse options
const options = {
  energy: args.find(a => a.startsWith('--energy='))?.split('=')[1] || 'Low',
  accessibility: args.find(a => a.startsWith('--accessibility='))?.split('=')[1] || 'Eclectic',
  explicit: args.find(a => a.startsWith('--explicit='))?.split('=')[1] || 'Family Friendly',
  subgenre: args.find(a => a.startsWith('--subgenre='))?.split('=')[1] || '',
  uploadedBy: args.find(a => a.startsWith('--uploaded-by='))?.split('=')[1] || '',
  output: args.find(a => a.startsWith('--output='))?.split('=')[1],
};

if (!inputPath) {
  console.error('Usage: node scripts/convert-to-pretagged-format.cjs input.csv [options]');
  console.error('');
  console.error('Options:');
  console.error('  --energy=VALUE          Default energy (Low/Medium/High)');
  console.error('  --accessibility=VALUE   Default accessibility (Eclectic/Timeless/Commercial/Cheesy)');
  console.error('  --explicit=VALUE        Default explicit (Family Friendly/Suggestive/Explicit)');
  console.error('  --subgenre=VALUE        Default subgenre(s), semicolon-separated');
  console.error('  --uploaded-by=NAME      Curator name');
  console.error('  --output=PATH           Output file path (default: input-pretagged.csv)');
  console.error('');
  console.error('Example:');
  console.error('  node scripts/convert-to-pretagged-format.cjs "HRT Spa.csv" \\');
  console.error('    --energy=Low --accessibility=Eclectic --explicit="Family Friendly" \\');
  console.error('    --subgenre="Native American Spa" --uploaded-by="Kristine"');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`Error: File not found: ${inputPath}`);
  process.exit(1);
}

// Read and parse input CSV
const fileContent = fs.readFileSync(inputPath, 'utf-8');
const records = parse(fileContent, {
  columns: true,
  skip_empty_lines: true,
  trim: true,
  bom: true
});

console.log(`Parsed ${records.length} songs from: ${inputPath}`);
console.log(`\nDefault values:`);
console.log(`  Energy: ${options.energy}`);
console.log(`  Accessibility: ${options.accessibility}`);
console.log(`  Explicit: ${options.explicit}`);
console.log(`  Subgenre: ${options.subgenre || '(none)'}`);
console.log(`  Uploaded By: ${options.uploadedBy || '(none)'}`);

// Convert to pretagged format
const converted = records.map(record => ({
  Song: record.Song || record.song || record.Title || record.title || '',
  Artist: record.Artist || record.artist || '',
  BPM: record.BPM || record.bpm || record.Tempo || record.tempo || '',
  'Spotify Track Id': record['Spotify Track Id'] || record['Spotify Track ID'] || record.spotify_track_id || '',
  ISRC: record.ISRC || record.isrc || '',
  Curator_Energy: options.energy,
  Curator_Accessibility: options.accessibility,
  Curator_Explicit: options.explicit,
  Curator_Subgenre: options.subgenre,
  'Uploaded By': options.uploadedBy,
}));

// Generate output path
const outputPath = options.output || inputPath.replace('.csv', '-pretagged.csv');

// Write output CSV
const header = 'Song,Artist,BPM,Spotify Track Id,ISRC,Curator_Energy,Curator_Accessibility,Curator_Explicit,Curator_Subgenre,Uploaded By\n';
const rows = converted.map(r =>
  `"${(r.Song || '').replace(/"/g, '""')}","${(r.Artist || '').replace(/"/g, '""')}",${r.BPM},"${r['Spotify Track Id']}","${r.ISRC}","${r.Curator_Energy}","${r.Curator_Accessibility}","${r.Curator_Explicit}","${r.Curator_Subgenre}","${r['Uploaded By']}"`
).join('\n');

fs.writeFileSync(outputPath, header + rows);

console.log(`\n✓ Converted ${converted.length} songs`);
console.log(`✓ Output written to: ${outputPath}`);
console.log(`\nNext step:`);
console.log(`  npm run import:pretagged "${outputPath}"`);
