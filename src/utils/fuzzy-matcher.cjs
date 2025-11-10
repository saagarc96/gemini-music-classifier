/**
 * Fuzzy Matching Utility for Duplicate Detection
 *
 * Provides functions for normalizing and comparing artist/title strings
 * to detect potential duplicates with configurable similarity thresholds.
 */

/**
 * Normalizes a string for fuzzy matching
 * - Converts to lowercase
 * - Removes special characters and punctuation
 * - Collapses whitespace
 * - Trims leading/trailing spaces
 *
 * @param {string} str - Input string to normalize
 * @returns {string} - Normalized string
 */
function normalizeForMatching(str) {
  if (!str) return '';

  return str
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove special chars
    .replace(/\s+/g, ' ')    // Collapse whitespace
    .trim();
}

/**
 * Calculate Levenshtein distance between two strings
 * (minimum number of single-character edits required to transform one string into another)
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Levenshtein distance
 */
function levenshteinDistance(str1, str2) {
  const len1 = str1.length;
  const len2 = str2.length;

  // Create 2D array for dynamic programming
  const matrix = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;

  // Fill in the rest of the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate similarity percentage between two strings (0-100)
 * Uses Levenshtein distance normalized by the length of the longer string
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity percentage (0-100)
 *
 * @example
 * calculateSimilarity('Daft Punk', 'Daft  Punk') // ~95-100% (extra space)
 * calculateSimilarity('Daft Punk', 'Daft') // ~50% (missing word)
 * calculateSimilarity('The Beatles', 'Beatles') // ~75% (missing 'The')
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;

  // Normalize both strings
  const norm1 = normalizeForMatching(str1);
  const norm2 = normalizeForMatching(str2);

  // Exact match after normalization
  if (norm1 === norm2) return 100;

  // Calculate Levenshtein distance
  const distance = levenshteinDistance(norm1, norm2);

  // Normalize by length of longer string
  const maxLength = Math.max(norm1.length, norm2.length);

  if (maxLength === 0) return 0;

  // Convert to similarity percentage
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity * 100) / 100; // Round to 2 decimal places
}

/**
 * Check if two strings are similar based on a threshold
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} threshold - Minimum similarity percentage (0-100), default 85
 * @returns {boolean} - True if similarity >= threshold
 *
 * @example
 * isSimilar('Daft Punk', 'Daft  Punk', 90) // true
 * isSimilar('Daft Punk', 'Daft', 90) // false
 */
function isSimilar(str1, str2, threshold = 85) {
  return calculateSimilarity(str1, str2) >= threshold;
}

/**
 * Create a composite key for matching artist + title
 * Useful for checking if two songs are the same based on both fields
 *
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {string} - Normalized composite key
 *
 * @example
 * createCompositeKey('Daft Punk', 'One More Time') // 'daft punk one more time'
 */
function createCompositeKey(artist, title) {
  const normArtist = normalizeForMatching(artist);
  const normTitle = normalizeForMatching(title);
  return `${normArtist} ${normTitle}`.trim();
}

/**
 * Calculate similarity for artist + title combination
 *
 * @param {Object} song1 - First song object with artist and title
 * @param {Object} song2 - Second song object with artist and title
 * @returns {number} - Similarity percentage (0-100)
 *
 * @example
 * calculateSongSimilarity(
 *   { artist: 'Daft Punk', title: 'One More Time' },
 *   { artist: 'Daft Punk', title: 'One More Time (Radio Edit)' }
 * ) // ~85-90%
 */
function calculateSongSimilarity(song1, song2) {
  const key1 = createCompositeKey(song1.artist, song1.title);
  const key2 = createCompositeKey(song2.artist, song2.title);
  return calculateSimilarity(key1, key2);
}

module.exports = {
  normalizeForMatching,
  levenshteinDistance,
  calculateSimilarity,
  isSimilar,
  createCompositeKey,
  calculateSongSimilarity
};
