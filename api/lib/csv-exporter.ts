/**
 * CSV Exporter Utility
 *
 * Generates CSV files in the format required by the primary system.
 * Supports dynamic column selection and field transformation.
 */

export interface ExportOptions {
  playlistName?: string;          // Optional playlist name to prepend to subgenres
  includeAccessibility?: boolean;  // Include Familiarity column (default: true)
  includeExplicit?: boolean;       // Include Explicit column (default: true)
}

export interface SongExportData {
  artist: string;
  title: string;
  aiEnergy: string | null;
  bpm: number | null;
  aiSubgenre1: string | null;
  aiSubgenre2: string | null;
  aiSubgenre3: string | null;
  isrc: string;
  aiAccessibility: string | null;
  aiExplicit: string | null;
}

/**
 * Escape CSV field value
 * Wraps in quotes if contains comma, quote, or newline
 */
function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    // Escape quotes by doubling them
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Capitalize first letter of each word
 * Example: "medium" -> "Medium", "very high" -> "Very High"
 */
function capitalizeEnergy(energy: string | null): string {
  if (!energy) return 'Medium'; // Default to Medium

  return energy
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Convert accessibility to uppercase
 * Example: "Timeless" -> "TIMELESS"
 */
function formatAccessibility(accessibility: string | null): string {
  if (!accessibility) return 'TIMELESS'; // Default
  return accessibility.toUpperCase();
}

/**
 * Map explicit values to target format
 * "Family Friendly" -> "FAMILY"
 * "Suggestive" -> "SUGGESTIVE"
 * "Explicit" -> "EXPLICIT"
 */
function formatExplicit(explicit: string | null): string {
  if (!explicit) return 'FAMILY'; // Default

  const normalized = explicit.toLowerCase();

  if (normalized.includes('family')) {
    return 'FAMILY';
  } else if (normalized.includes('suggestive')) {
    return 'SUGGESTIVE';
  } else if (normalized.includes('explicit')) {
    return 'EXPLICIT';
  }

  return 'FAMILY'; // Default fallback
}

/**
 * Build subgenre string with optional playlist name prefix
 * Format: "Playlist Name;Subgenre1;Subgenre2;Subgenre3"
 *
 * If no playlist name: "Subgenre1;Subgenre2;Subgenre3"
 */
function buildSubgenreString(
  playlistName: string | undefined,
  sub1: string | null,
  sub2: string | null,
  sub3: string | null
): string {
  const parts: string[] = [];

  // Add playlist name if provided
  if (playlistName && playlistName.trim()) {
    parts.push(playlistName.trim());
  }

  // Add subgenres
  if (sub1) parts.push(sub1);
  if (sub2) parts.push(sub2);
  if (sub3) parts.push(sub3);

  return parts.join(';');
}

/**
 * Generate CSV column headers based on export options
 */
function generateHeaders(options: ExportOptions): string[] {
  const headers = [
    'Artist',
    'Name',
    'Energy',
    'BPM',
    'Subgenre',
    'ISRC'
  ];

  // Add conditional columns
  if (options.includeAccessibility !== false) {
    headers.push('Familiarity');
  }

  if (options.includeExplicit !== false) {
    headers.push('Explicit');
  }

  return headers;
}

/**
 * Generate CSV row data for a single song
 */
function generateRow(song: SongExportData, options: ExportOptions): string[] {
  const row = [
    escapeCsvField(song.artist || ''),
    escapeCsvField(song.title || ''),
    capitalizeEnergy(song.aiEnergy),
    (song.bpm && song.bpm > 0 ? song.bpm : 100).toString(), // Default to 100 if missing
    escapeCsvField(buildSubgenreString(
      options.playlistName,
      song.aiSubgenre1,
      song.aiSubgenre2,
      song.aiSubgenre3
    )),
    song.isrc || ''
  ];

  // Add conditional columns
  if (options.includeAccessibility !== false) {
    row.push(formatAccessibility(song.aiAccessibility));
  }

  if (options.includeExplicit !== false) {
    row.push(formatExplicit(song.aiExplicit));
  }

  return row;
}

/**
 * Export songs to CSV format
 *
 * @param songs - Array of song data to export
 * @param options - Export configuration options
 * @returns CSV string with UTF-8 BOM for Excel compatibility
 */
export function exportSongsToCSV(
  songs: SongExportData[],
  options: ExportOptions = {}
): string {
  if (songs.length === 0) {
    // Return just headers if no songs
    const headers = generateHeaders(options);
    return headers.join(',');
  }

  // Generate headers
  const headers = generateHeaders(options);
  const csvLines = [headers.join(',')];

  // Generate data rows
  for (const song of songs) {
    const row = generateRow(song, options);
    csvLines.push(row.join(','));
  }

  // Join with newlines
  const csvContent = csvLines.join('\n');

  return csvContent;
}

/**
 * Generate filename for CSV export
 * Format: "playlist-name-export-YYYY-MM-DD.csv" or "music-export-YYYY-MM-DD.csv"
 */
export function generateExportFilename(playlistName?: string): string {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

  if (playlistName && playlistName.trim()) {
    // Convert playlist name to slug format
    const slug = playlistName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens

    return `${slug}-export-${date}.csv`;
  }

  return `music-export-${date}.csv`;
}
