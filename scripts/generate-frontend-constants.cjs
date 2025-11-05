#!/usr/bin/env node

/**
 * Generate Frontend Constants from Subgenres Data
 *
 * This script generates client/src/data/constants.ts from data/subgenres.json
 * Run this after updating subgenres.json to keep frontend in sync
 *
 * Usage: npm run generate:constants
 */

const fs = require('fs');
const path = require('path');

// Paths
const subgenresPath = path.join(__dirname, '../data/subgenres.json');
const outputPath = path.join(__dirname, '../client/src/data/constants.ts');

console.log('\n🔧 Generating Frontend Constants\n');
console.log(`  Reading from: ${subgenresPath}`);
console.log(`  Writing to: ${outputPath}\n`);

try {
  // Load subgenres data
  const subgenresData = JSON.parse(fs.readFileSync(subgenresPath, 'utf8'));

  // Extract flat list of all subgenres
  const allSubgenres = subgenresData.categories.flatMap(cat => cat.subgenres);

  // Sort alphabetically for easier dropdown navigation
  allSubgenres.sort();

  // Generate TypeScript file content
  const output = `/**
 * Music Classification Constants
 *
 * AUTO-GENERATED from data/subgenres.json
 * DO NOT EDIT MANUALLY - Run: npm run generate:constants
 *
 * Last generated: ${new Date().toISOString()}
 */

export const SUBGENRES = ${JSON.stringify(allSubgenres, null, 2)};

export const ENERGY_LEVELS = [
  "Very Low",
  "Low",
  "Medium",
  "High",
  "Very High",
] as const;

export const ACCESSIBILITY_TYPES = [
  "Eclectic",
  "Timeless",
  "Commercial",
  "Cheesy",
] as const;

export const EXPLICIT_TYPES = [
  "Explicit",
  "Suggestive",
  "Family Friendly",
] as const;

export const AI_STATUSES = [
  "SUCCESS",
  "ERROR",
  "REQUIRES HUMAN REVIEW",
  "INVALID INPUT",
] as const;

export const REVIEW_STATUSES = [
  "all",
  "reviewed",
  "unreviewed",
] as const;

// TypeScript types for compile-time safety
export type EnergyLevel = (typeof ENERGY_LEVELS)[number];
export type AccessibilityType = (typeof ACCESSIBILITY_TYPES)[number];
export type ExplicitType = (typeof EXPLICIT_TYPES)[number];
export type AIStatus = (typeof AI_STATUSES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];
export type Subgenre = (typeof SUBGENRES)[number];
`;

  // Write the generated file
  fs.writeFileSync(outputPath, output, 'utf8');

  // Print success message with stats
  console.log('✅ Success!\n');
  console.log(`  Generated ${allSubgenres.length} subgenres`);
  console.log(`  Across ${subgenresData.categories.length} categories:`);
  subgenresData.categories.forEach(cat => {
    console.log(`    - ${cat.name}: ${cat.subgenres.length} subgenres`);
  });
  console.log('');

} catch (error) {
  console.error('❌ Error generating constants:', error.message);
  process.exit(1);
}
