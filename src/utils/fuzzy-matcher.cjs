/**
 * Fuzzy Matching Utility for Duplicate Detection
 *
 * Provides functions for normalizing and comparing artist/title strings
 * to detect potential duplicates with smart pattern detection and configurable thresholds.
 *
 * Features:
 * - Strips common suffixes (Radio Edit, Remix, Remaster, etc.)
 * - Removes "The" prefix from artist names
 * - Normalizes featuring/feat variations
 * - Configurable similarity threshold (default 70% for music duplicates)
 */

// Common patterns to strip from song titles before comparison
const TITLE_SUFFIXES_TO_STRIP = [
  // Edits and versions
  /\s*\(?\s*radio\s+edit\s*\)?/gi,
  /\s*\(?\s*edit\s*\)?/gi,
  /\s*\(?\s*edited\s+version\s*\)?/gi,
  /\s*\(?\s*album\s+version\s*\)?/gi,
  /\s*\(?\s*single\s+version\s*\)?/gi,
  /\s*\(?\s*original\s+version\s*\)?/gi,
  /\s*\(?\s*extended\s+version\s*\)?/gi,
  /\s*\(?\s*extended\s*\)?/gi,

  // Remixes and remasters
  /\s*\(?\s*remix\s*\)?/gi,
  /\s*\(?\s*remaster\s*\)?/gi,
  /\s*\(?\s*remastered\s*\)?/gi,
  /\s*\(?\s*\d{4}\s+remaster\s*\)?/gi,

  // Live and acoustic
  /\s*\(?\s*live\s*\)?/gi,
  /\s*\(?\s*acoustic\s*\)?/gi,
  /\s*\(?\s*unplugged\s*\)?/gi,

  // Explicit/Clean
  /\s*\(?\s*explicit\s*\)?/gi,
  /\s*\(?\s*clean\s*\)?/gi,

  // Featuring variations (but preserve artist name)
  /\s*\(?\s*feat\.?\s+.*?\)?$/gi,
  /\s*\(?\s*featuring\s+.*?\)?$/gi,
  /\s*\(?\s*ft\.?\s+.*?\)?$/gi,
  /\s*\(?\s*with\s+.*?\)?$/gi,
];

/**
 * Strip common suffixes from a title to improve matching
 * Removes parenthetical content like "(Radio Edit)", "(Remix)", etc.
 *
 * @param {string} title - Song title
 * @returns {string} - Title with common suffixes removed
 *
 * @example
 * stripTitleSuffixes('One More Time (Radio Edit)') // 'One More Time'
 * stripTitleSuffixes('Blinding Lights - Remix') // 'Blinding Lights'
 */
function stripTitleSuffixes(title) {
  if (!title) return '';

  let cleaned = title;

  // Apply all suffix patterns
  for (const pattern of TITLE_SUFFIXES_TO_STRIP) {
    cleaned = cleaned.replace(pattern, '');
  }

  // Remove any leftover empty parentheses
  cleaned = cleaned.replace(/\s*\(\s*\)/g, '');

  // Clean up any trailing dashes or whitespace
  cleaned = cleaned.replace(/[\s\-]+$/g, '');

  return cleaned.trim();
}

/**
 * Normalize artist name by removing "The" prefix and featuring variations
 *
 * @param {string} artist - Artist name
 * @returns {string} - Normalized artist name
 *
 * @example
 * normalizeArtist('The Beatles') // 'Beatles'
 * normalizeArtist('Drake feat. Future') // 'Drake'
 * normalizeArtist('The Weeknd & Ariana Grande') // 'Weeknd'
 */
function normalizeArtist(artist) {
  if (!artist) return '';

  let cleaned = artist;

  // Remove "The" prefix
  cleaned = cleaned.replace(/^the\s+/i, '');

  // Remove featuring/feat/ft variations (keep primary artist only)
  cleaned = cleaned.replace(/\s+(feat\.?|featuring|ft\.?|with|&|x)\s+.*$/gi, '');

  return cleaned.trim();
}

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
 * Advanced normalization for artist + title with smart pattern detection
 *
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @returns {Object} - Object with normalized and stripped versions
 *
 * @example
 * smartNormalize('The Beatles', 'Let It Be (Remastered)')
 * // {
 * //   artist: 'beatles',
 * //   title: 'let it be',
 * //   artistStripped: 'beatles',  // 'The' removed
 * //   titleStripped: 'let it be'  // '(Remastered)' removed
 * // }
 */
function smartNormalize(artist, title) {
  return {
    // Basic normalization (existing behavior)
    artist: normalizeForMatching(artist),
    title: normalizeForMatching(title),

    // Smart normalization (strips patterns)
    artistStripped: normalizeForMatching(normalizeArtist(artist)),
    titleStripped: normalizeForMatching(stripTitleSuffixes(title))
  };
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
 * @param {number} threshold - Minimum similarity percentage (0-100), default 70
 * @returns {boolean} - True if similarity >= threshold
 *
 * @example
 * isSimilar('Daft Punk', 'Daft  Punk', 90) // true
 * isSimilar('Daft Punk', 'Daft', 70) // false
 */
function isSimilar(str1, str2, threshold = 70) {
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
 * Calculate similarity for artist + title combination with smart pattern detection
 * This is the PRIMARY function for duplicate detection
 *
 * Uses two-stage approach:
 * 1. Compare with smart normalization (strips "The", "(Radio Edit)", etc.)
 * 2. If no match, fall back to basic normalization
 * 3. Returns the HIGHER of the two scores
 *
 * @param {Object} song1 - First song object with artist and title
 * @param {Object} song2 - Second song object with artist and title
 * @param {Object} options - Optional configuration
 * @param {boolean} options.useSmartMatching - Enable smart pattern detection (default: true)
 * @returns {number} - Similarity percentage (0-100)
 *
 * @example
 * calculateSongSimilarity(
 *   { artist: 'The Beatles', title: 'Let It Be' },
 *   { artist: 'Beatles', title: 'Let It Be (Remastered)' }
 * ) // 100% (after smart normalization)
 *
 * calculateSongSimilarity(
 *   { artist: 'Daft Punk', title: 'One More Time' },
 *   { artist: 'Daft Punk', title: 'One More Time (Radio Edit)' }
 * ) // 100% (after stripping "(Radio Edit)")
 */
function calculateSongSimilarity(song1, song2, options = {}) {
  const { useSmartMatching = true } = options;

  if (!useSmartMatching) {
    // Basic comparison (legacy behavior)
    const key1 = createCompositeKey(song1.artist, song1.title);
    const key2 = createCompositeKey(song2.artist, song2.title);
    return calculateSimilarity(key1, key2);
  }

  // Smart normalization
  const norm1 = smartNormalize(song1.artist, song1.title);
  const norm2 = smartNormalize(song2.artist, song2.title);

  // Create composite keys with stripped patterns
  const smartKey1 = `${norm1.artistStripped} ${norm1.titleStripped}`.trim();
  const smartKey2 = `${norm2.artistStripped} ${norm2.titleStripped}`.trim();

  // Calculate similarity with smart normalization
  const smartSimilarity = calculateSimilarity(smartKey1, smartKey2);

  // Also calculate with basic normalization (fallback)
  const basicKey1 = `${norm1.artist} ${norm1.title}`.trim();
  const basicKey2 = `${norm2.artist} ${norm2.title}`.trim();
  const basicSimilarity = calculateSimilarity(basicKey1, basicKey2);

  // Return the HIGHER score (more lenient for duplicate detection)
  return Math.max(smartSimilarity, basicSimilarity);
}

/**
 * Check if two songs are duplicates based on configurable threshold
 * This is the main entry point for duplicate detection in the upload workflow
 *
 * @param {Object} song1 - First song with artist and title
 * @param {Object} song2 - Second song with artist and title
 * @param {number} threshold - Similarity threshold (0-100), default 70%
 * @returns {boolean} - True if songs are considered duplicates
 *
 * @example
 * areSongsDuplicate(
 *   { artist: 'The Weeknd', title: 'Blinding Lights' },
 *   { artist: 'Weeknd', title: 'Blinding Lights (Radio Edit)' },
 *   70
 * ) // true
 */
function areSongsDuplicate(song1, song2, threshold = 70) {
  const similarity = calculateSongSimilarity(song1, song2);
  return similarity >= threshold;
}

module.exports = {
  // Basic utilities
  normalizeForMatching,
  levenshteinDistance,
  calculateSimilarity,
  isSimilar,
  createCompositeKey,

  // Smart pattern detection
  stripTitleSuffixes,
  normalizeArtist,
  smartNormalize,

  // Song-level comparison (PRIMARY for duplicate detection)
  calculateSongSimilarity,
  areSongsDuplicate
};
