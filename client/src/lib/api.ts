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

export interface GetSongsParams {
  page?: number;
  limit?: number;
  subgenre?: string;
  status?: string;
  reviewStatus?: string;
  energy?: string;
  accessibility?: string;
  explicit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface UpdateSongPayload {
  ai_energy: string;
  ai_accessibility: string;
  ai_explicit?: string | null;
  ai_subgenre_1: string;
  ai_subgenre_2?: string | null;
  ai_subgenre_3?: string | null;
  curator_notes?: string | null;
}

/**
 * Fetches songs with optional filtering and pagination
 */
export async function getSongs(params: GetSongsParams = {}): Promise<PaginatedResponse> {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '' && value !== 'all') {
      query.append(key, String(value));
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
