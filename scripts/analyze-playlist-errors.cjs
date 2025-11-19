#!/usr/bin/env node

/**
 * Analyze error rates from the Coffeehouse and Classics imports
 * Based on the output logs showing which songs hit rate limits
 */

// Christmas Coffeehouse (86 total songs)
const coffeeHouseErrors = {
  // Songs 7-10 - Gemini API fetch failed
  7: 'Taylor Swift - \'tis the damn season',
  8: 'Laufey - The Christmas Waltz',
  9: 'Norah Jones - Christmas Calling (Jolly Jones)',
  10: 'Leon Bridges, Norah Jones - This Christmas I\'m Coming Home',

  // Songs 11-12 - Gemini API fetch failed
  11: 'Ingrid Michaelson - Song for a Winter\'s Night',
  12: 'Ravyn Lenae - O Holy Night - Spotify Singles Holiday',

  // Songs 13, 15 - Database connection errors
  13: 'Norah Jones - White Christmas',
  15: 'Norah Jones - Winter Wonderland',

  // Song 14 - Gemini API fetch failed
  14: 'Norah Jones - Blue Christmas',
};

// Christmas Classics (228 total songs)
const classicsErrors = {
  // Songs 11-15 - Gemini API fetch failed (batch 3)
  11: 'Bing Crosby, Ken Darby Singers, John Scott Trotter & His Orchestra - White Christmas - 1947 Version',
  12: 'José Feliciano - Feliz Navidad',
  13: 'Eartha Kitt, Henri René and His Orchestra - Santa Baby (with Henri René & His Orchestra)',
  14: 'Elvis Presley - Blue Christmas',
  15: 'Burl Ives - A Holly Jolly Christmas',
};

console.log('Christmas Coffeehouse Error Summary:');
console.log('=====================================');
console.log(`Total songs: 86`);
console.log(`Songs with errors: ${Object.keys(coffeeHouseErrors).length}`);
console.log(`Success rate: ${((86 - Object.keys(coffeeHouseErrors).length) / 86 * 100).toFixed(1)}%`);
console.log(`\nSongs that need reprocessing:`);
Object.entries(coffeeHouseErrors).forEach(([num, song]) => {
  console.log(`  [${num}] ${song}`);
});

console.log('\n\nChristmas Classics Error Summary:');
console.log('=====================================');
console.log(`Total songs: 228`);
console.log(`Songs with errors: ${Object.keys(classicsErrors).length}`);
console.log(`Success rate: ${((228 - Object.keys(classicsErrors).length) / 228 * 100).toFixed(1)}%`);
console.log(`\nSongs that need reprocessing:`);
Object.entries(classicsErrors).forEach(([num, song]) => {
  console.log(`  [${num}] ${song}`);
});

console.log('\n\nError Type Breakdown:');
console.log('=====================');
console.log('Parallel AI rate limits (EADDRNOTAVAIL): Most explicit content API calls');
console.log('Gemini API fetch failed: Network/rate limit issues during classification');
console.log('Database connection errors: 2 songs (Coffeehouse #13, #15)');
console.log('\nNote: Songs with rate limit errors use fallback "Unknown" for explicit content classification');
console.log('They ARE saved to database but explicit field may be "Unknown"');
