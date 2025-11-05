#!/usr/bin/env node

/**
 * Validate Subgenres Data
 *
 * This script validates data/subgenres.json for:
 * - Duplicate subgenres
 * - Empty or whitespace-only subgenres
 * - Consistent data structure
 *
 * Usage: node scripts/validate-subgenres.cjs
 */

const { loadSubgenres, getAllSubgenres, getSubgenreStats } = require('../src/utils/subgenre-loader.cjs');

console.log('\n🔍 Subgenre Validation Report\n');
console.log('=' .repeat(50) + '\n');

try {
  // Load data
  const data = loadSubgenres();
  const allSubgenres = getAllSubgenres();
  const stats = getSubgenreStats();

  // Display statistics
  console.log('📊 Statistics:');
  console.log(`  Total categories: ${stats.totalCategories}`);
  console.log(`  Total subgenres: ${stats.totalSubgenres}\n`);

  // Validation 1: Check for duplicates
  console.log('🔎 Checking for duplicates...');
  const seen = new Set();
  const duplicates = [];

  allSubgenres.forEach(subgenre => {
    const normalized = subgenre.trim().toLowerCase();
    if (seen.has(normalized)) {
      duplicates.push(subgenre);
    }
    seen.add(normalized);
  });

  if (duplicates.length > 0) {
    console.error('  ❌ DUPLICATES FOUND:');
    duplicates.forEach(dup => console.error(`     - "${dup}"`));
    process.exit(1);
  } else {
    console.log('  ✅ No duplicates found');
  }

  // Validation 2: Check for empty or whitespace-only strings
  console.log('\n🔎 Checking for empty subgenres...');
  const empties = allSubgenres.filter(s => !s || s.trim() === '');

  if (empties.length > 0) {
    console.error('  ❌ EMPTY SUBGENRES FOUND');
    process.exit(1);
  } else {
    console.log('  ✅ No empty subgenres found');
  }

  // Validation 3: Check data structure
  console.log('\n🔎 Checking data structure...');
  let structureValid = true;

  data.categories.forEach((category, index) => {
    if (!category.name || typeof category.name !== 'string') {
      console.error(`  ❌ Category ${index} has invalid name`);
      structureValid = false;
    }

    if (!Array.isArray(category.subgenres)) {
      console.error(`  ❌ Category "${category.name}" subgenres is not an array`);
      structureValid = false;
    }

    if (category.subgenres.length === 0) {
      console.error(`  ❌ Category "${category.name}" has no subgenres`);
      structureValid = false;
    }
  });

  if (!structureValid) {
    process.exit(1);
  } else {
    console.log('  ✅ Data structure is valid');
  }

  // Display category breakdown
  console.log('\n📂 Categories:\n');
  data.categories.forEach(category => {
    console.log(`  ${category.name}`);
    console.log(`    └─ ${category.subgenres.length} subgenres`);
  });

  console.log('\n' + '='.repeat(50));
  console.log('✅ All validations passed!\n');

} catch (error) {
  console.error('\n❌ Validation failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
