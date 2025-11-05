/**
 * Subgenre Data Loader
 * Provides utilities for loading and formatting subgenre data
 *
 * This module serves as the single source of truth for subgenre data,
 * loading from data/subgenres.json and providing multiple output formats.
 */

const fs = require('fs');
const path = require('path');

// Cache for loaded subgenre data
let cachedSubgenres = null;

/**
 * Loads subgenres from data/subgenres.json
 * @returns {Object} Subgenre data with categories
 * @throws {Error} If the file cannot be read or parsed
 */
function loadSubgenres() {
  if (cachedSubgenres) {
    return cachedSubgenres;
  }

  const dataPath = path.join(__dirname, '../../data/subgenres.json');

  try {
    const rawData = fs.readFileSync(dataPath, 'utf8');
    cachedSubgenres = JSON.parse(rawData);
    return cachedSubgenres;
  } catch (error) {
    throw new Error(`Failed to load subgenres from ${dataPath}: ${error.message}`);
  }
}

/**
 * Gets a flat array of all subgenres across all categories
 * @returns {string[]} All subgenres in a single flat array
 */
function getAllSubgenres() {
  const data = loadSubgenres();
  return data.categories.flatMap(cat => cat.subgenres);
}

/**
 * Gets subgenres organized by category
 * @returns {Array<{name: string, subgenres: string[]}>} Array of category objects
 */
function getSubgenresByCategory() {
  const data = loadSubgenres();
  return data.categories;
}

/**
 * Formats subgenres as markdown for prompt injection
 * Preserves the category structure with headers
 * @returns {string} Markdown-formatted subgenre list
 */
function formatSubgenresForPrompt() {
  const data = loadSubgenres();
  let markdown = '';

  data.categories.forEach((category, index) => {
    // Add category header
    markdown += `### ${category.name}\n\n`;

    // Add subgenres as bullet list
    category.subgenres.forEach(subgenre => {
      markdown += `- ${subgenre}\n`;
    });

    // Add spacing between categories (but not after the last one)
    if (index < data.categories.length - 1) {
      markdown += '\n';
    }
  });

  return markdown;
}

/**
 * Loads the classification prompt with subgenres injected
 * Replaces the {{SUBGENRES_LIST}} placeholder with formatted subgenres
 * @returns {string} Complete prompt ready for Gemini API
 * @throws {Error} If the prompt file cannot be read or placeholder not found
 */
function loadClassificationPrompt() {
  const promptPath = path.join(__dirname, '../../prompts/classification-prompt.md');

  try {
    let prompt = fs.readFileSync(promptPath, 'utf8');

    // Check if placeholder exists
    if (!prompt.includes('{{SUBGENRES_LIST}}')) {
      throw new Error('Placeholder {{SUBGENRES_LIST}} not found in classification prompt');
    }

    // Inject subgenres
    const subgenresMarkdown = formatSubgenresForPrompt();
    prompt = prompt.replace('{{SUBGENRES_LIST}}', subgenresMarkdown);

    return prompt;
  } catch (error) {
    throw new Error(`Failed to load classification prompt from ${promptPath}: ${error.message}`);
  }
}

/**
 * Gets statistics about the subgenre data
 * @returns {Object} Statistics including total count and counts by category
 */
function getSubgenreStats() {
  const data = loadSubgenres();
  const stats = {
    totalCategories: data.categories.length,
    totalSubgenres: 0,
    byCategory: {}
  };

  data.categories.forEach(category => {
    const count = category.subgenres.length;
    stats.byCategory[category.name] = count;
    stats.totalSubgenres += count;
  });

  return stats;
}

module.exports = {
  loadSubgenres,
  getAllSubgenres,
  getSubgenresByCategory,
  formatSubgenresForPrompt,
  loadClassificationPrompt,
  getSubgenreStats
};
