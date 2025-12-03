/**
 * API Client
 *
 * Handles all communication with the backend API.
 */

export interface Song {
  id: number;
  isrc: string;
  title: string;
  artist: string;
  energy: string | null;
  bpm: number | null;
  subgenre: string | null;
  artwork: string | null;
  source_file: string | null;
  spotify_track_id: string | null;
  ai_status: string | null;
  ai_error_message: string | null;
  ai_reasoning: string | null;
  ai_context_used: string | null;
  ai_energy: string | null;
  ai_accessibility: string | null;
  ai_explicit: string | null;
  ai_subgenre_1: string | null;
  ai_subgenre_2: string | null;
  ai_subgenre_3: string | null;
  reviewed: boolean;
  reviewed_by: string | null;
  reviewed_at: string | null;
  curator_notes: string | null;
  // Approval workflow fields
  approval_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  modified_at: string;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse {
  data: Song[];
  pagination: PaginationInfo;
}

export interface UploadBatch {
  uploadBatchId: string;
  uploadBatchName: string;
  uploadDate: string;
  totalSongs: number;
  reviewedSongs: number;
  unreviewedSongs: number;
}

export interface Playlist {
  id: string;
  name: string;
  uploadedAt: string;
  uploadedByName: string | null;
  totalSongs: number;
  newSongs: number;
  duplicateSongs: number;
}

export interface GetSongsParams {
  page?: number;
  limit?: number;
  // Multi-select filters (arrays)
  subgenres?: string[];
  energies?: string[];
  accessibilities?: string[];
  explicits?: string[];
  // Single-select filters (strings)
  status?: string;
  reviewStatus?: string;
  approvalStatus?: string;
  uploadBatchId?: string;
  playlistId?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateSongPayload {
  ai_energy?: string;
  ai_accessibility?: string;
  ai_explicit?: string | null;
  ai_subgenre_1?: string;
  ai_subgenre_2?: string | null;
  ai_subgenre_3?: string | null;
  curator_notes?: string | null;
  // Approval workflow (admin only)
  approval_status?: 'APPROVED' | 'REJECTED' | 'PENDING';
}

/**
 * Fetches songs with optional filtering and pagination
 */
export async function getSongs(params: GetSongsParams = {}): Promise<PaginatedResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      // Handle array values (multi-select filters) - join with comma
      if (Array.isArray(value)) {
        if (value.length > 0) {
          query.append(key, value.join(','));
        }
      } else {
        query.append(key, String(value));
      }
    }
  });

  const url = `/api/songs${query.toString() ? `?${query.toString()}` : ''}`;

  const response = await fetch(url, {
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch songs' }));
    throw new Error(error.error || 'Failed to fetch songs');
  }

  return response.json();
}

/**
 * Updates a song's classification fields
 */
export async function updateSong(isrc: string, payload: UpdateSongPayload): Promise<Song> {
  const response = await fetch(`/api/songs/${isrc}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to update song' }));
    throw new Error(error.error || 'Failed to update song');
  }

  const result = await response.json();
  return result.data;
}

/**
 * Fetches all upload batches with metadata
 */
export async function getUploadBatches(): Promise<UploadBatch[]> {
  const response = await fetch('/api/songs/batches', {
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch upload batches' }));
    throw new Error(error.error || 'Failed to fetch upload batches');
  }

  const data = await response.json();
  return data.batches;
}

/**
 * Fetches all playlists sorted by upload date
 */
export async function getPlaylists(): Promise<Playlist[]> {
  const response = await fetch('/api/playlists', {
    credentials: 'include', // Include cookies for authentication
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch playlists' }));
    throw new Error(error.error || 'Failed to fetch playlists');
  }

  const data = await response.json();
  return data.playlists;
}

export interface UploadStatus {
  batchId: string;
  playlistId: string;
  playlistName: string;
  total: number;
  processed: number;
  complete: boolean;
  newSongs: number;
  duplicateSongs: number;
}

// New upload flow interfaces
export interface SongToProcess {
  artist: string;
  title: string;
  isrc?: string;
  bpm?: number;
  spotifyTrackId?: string;
  s3Url?: string;
  artworkUrl?: string;
  spotifyPreviewUrl?: string;
  spotifyArtworkUrl?: string;
}

export interface UploadResponse {
  batchId: string;
  playlistId: string;
  playlistName: string;
  status: 'ready' | 'processing' | 'complete';
  summary: {
    total: number;
    toProcess: number;
    skipped: number;
  };
  songsToProcess: SongToProcess[];
  skippedSongs: Array<{
    isrc: string;
    title: string;
    artist: string;
  }>;
}

export interface ProcessedSong {
  isrc: string;
  title: string;
  artist: string;
  aiEnergy?: string | null;
  aiAccessibility?: string | null;
  aiSubgenre1?: string | null;
  aiSubgenre2?: string | null;
  aiSubgenre3?: string | null;
  aiExplicit?: string | null;
  status: 'success' | 'error';
  error?: string;
}

export interface ProcessBatchResponse {
  batchId: string;
  processed: number;
  results: ProcessedSong[];
  errors: Array<{ artist: string; title: string; error: string }>;
}

// Explicit detection interfaces
export interface ExplicitSubmission {
  index: number;
  runId: string | null;
  artist: string;
  title: string;
  status: 'submitted' | 'error';
  error?: string;
}

export interface SubmitExplicitResponse {
  submitted: number;
  total: number;
  submissions: ExplicitSubmission[];
}

export interface ExplicitResult {
  isrc: string;
  classification: string | null;
  status: 'success' | 'error';
  error?: string;
}

export interface PollExplicitResponse {
  polled: number;
  successful: number;
  results: ExplicitResult[];
}

/**
 * Gets the status of an upload batch (for progress tracking)
 */
export async function getUploadStatus(batchId: string): Promise<UploadStatus> {
  const response = await fetch(`/api/songs/upload-status?batchId=${encodeURIComponent(batchId)}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to get upload status' }));
    throw new Error(error.error || 'Failed to get upload status');
  }

  return response.json();
}

/**
 * Submit all explicit detection tasks upfront (fast, non-blocking)
 */
export async function submitAllExplicit(
  songs: Array<{ artist: string; title: string }>
): Promise<SubmitExplicitResponse> {
  const response = await fetch('/api/songs/submit-explicit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ songs }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to submit explicit tasks' }));
    throw new Error(error.error || 'Failed to submit explicit tasks');
  }

  return response.json();
}

/**
 * Process a batch of songs with Gemini classification only
 */
export async function processBatch(
  batchId: string,
  playlistId: string,
  uploadBatchName: string,
  songs: SongToProcess[]
): Promise<ProcessBatchResponse> {
  const response = await fetch('/api/songs/process-batch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      batchId,
      playlistId,
      uploadBatchName,
      songs,
    }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to process batch' }));
    throw new Error(error.error || 'Failed to process batch');
  }

  return response.json();
}

/**
 * Poll all explicit detection results and update database
 */
export async function pollAllExplicit(
  submissions: Array<{ runId: string; isrc: string; artist: string; title: string }>
): Promise<PollExplicitResponse> {
  const response = await fetch('/api/songs/poll-explicit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ submissions }),
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to poll explicit results' }));
    throw new Error(error.error || 'Failed to poll explicit results');
  }

  return response.json();
}

/**
 * Utility to chunk an array into smaller batches
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
