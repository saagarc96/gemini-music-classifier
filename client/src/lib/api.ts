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
    let errorMessage = `Request failed with status ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error.error || error.message || errorMessage;
    } catch {
      // Non-JSON response (502, HTML error pages, etc.)
      const text = await response.text().catch(() => '');
      if (text) {
        console.error('Non-JSON error response:', text.substring(0, 500));
      }
    }
    throw new Error(errorMessage);
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
