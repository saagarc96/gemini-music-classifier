/**
 * BPM Normalization Utility
 *
 * Normalizes BPM values to fit within the acceptable range (50-170)
 * as required by the Raina platform.
 */

/**
 * Normalize BPM to acceptable range (50-170)
 * - If BPM < 50: double it
 * - If BPM > 170: halve it
 * - Recursively normalize until within range
 *
 * @param {number} bpm - Original BPM value
 * @param {number} maxIterations - Maximum iterations to prevent infinite loops (default: 5)
 * @returns {Object} { normalizedBpm, originalBpm, transformations }
 */
function normalizeBpm(bpm, maxIterations = 5) {
  if (bpm === null || bpm === undefined || isNaN(bpm)) {
    return {
      normalizedBpm: null,
      originalBpm: bpm,
      transformations: ['invalid-bpm'],
      error: 'Invalid BPM value'
    };
  }

  const originalBpm = bpm;
  const transformations = [];
  let iterations = 0;

  while ((bpm < 50 || bpm > 170) && iterations < maxIterations) {
    if (bpm < 50) {
      bpm = bpm * 2;
      transformations.push('doubled');
    } else if (bpm > 170) {
      bpm = bpm / 2;
      transformations.push('halved');
    }
    iterations++;
  }

  // Check if we hit max iterations (edge case for very extreme values)
  if (iterations >= maxIterations && (bpm < 50 || bpm > 170)) {
    return {
      normalizedBpm: null,
      originalBpm,
      transformations,
      error: `Could not normalize BPM after ${maxIterations} iterations`
    };
  }

  // Round to nearest integer
  const normalizedBpm = Math.round(bpm);

  return {
    normalizedBpm,
    originalBpm,
    transformations: transformations.length > 0 ? transformations : ['no-change'],
    error: null
  };
}

/**
 * Batch normalize BPM values
 * @param {number[]} bpms - Array of BPM values
 * @returns {Array} Array of normalization results
 */
function normalizeBpmBatch(bpms) {
  return bpms.map(bpm => normalizeBpm(bpm));
}

module.exports = {
  normalizeBpm,
  normalizeBpmBatch
};
