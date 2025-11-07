/**
 * Spotify API Client
 *
 * Handles authentication and track metadata retrieval using Client Credentials flow.
 * Provides batch lookup functionality for efficient API usage.
 */

const axios = require('axios');

class SpotifyClient {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
    this.tokenExpiry = null;

    if (!this.clientId || !this.clientSecret) {
      throw new Error('Missing Spotify API credentials. Please set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env');
    }
  }

  /**
   * Get access token using Client Credentials flow
   * Automatically refreshes if token is expired
   */
  async getAccessToken() {
    // Return cached token if still valid (with 5 minute buffer)
    if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry - 300000) {
      return this.accessToken;
    }

    const authString = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    const response = await axios.post('https://accounts.spotify.com/api/token',
      'grant_type=client_credentials',
      {
        headers: {
          'Authorization': `Basic ${authString}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    const data = response.data;
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000); // Convert seconds to milliseconds

    return this.accessToken;
  }

  /**
   * Get track details for a single Spotify track ID
   * @param {string} trackId - Spotify track ID
   * @returns {Promise<Object>} Track metadata including preview URL and artwork
   */
  async getTrack(trackId) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const track = response.data;

      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        previewUrl: track.preview_url, // May be null (~20% of tracks)
        albumArt: track.album.images[0]?.url || null,
        albumArtMedium: track.album.images[1]?.url || null,
        albumArtSmall: track.album.images[2]?.url || null,
        durationMs: track.duration_ms,
        explicit: track.explicit,
        isrc: track.external_ids?.isrc || null
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Track not found
      }
      throw new Error(`Failed to fetch track ${trackId}: ${error.message}`);
    }
  }

  /**
   * Get track details for multiple Spotify track IDs (batch request)
   * Spotify allows up to 50 tracks per request
   * @param {string[]} trackIds - Array of Spotify track IDs (max 50)
   * @returns {Promise<Object[]>} Array of track metadata
   */
  async getTracks(trackIds) {
    if (!trackIds || trackIds.length === 0) {
      return [];
    }

    if (trackIds.length > 50) {
      throw new Error('Maximum 50 track IDs per batch request');
    }

    const token = await this.getAccessToken();
    const ids = trackIds.join(',');

    const response = await axios.get(`https://api.spotify.com/v1/tracks?ids=${ids}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = response.data;

    return data.tracks.map(track => {
      if (!track) {
        return null; // Track not found or invalid ID
      }

      return {
        id: track.id,
        name: track.name,
        artists: track.artists.map(a => a.name),
        previewUrl: track.preview_url, // May be null (~20% of tracks)
        albumArt: track.album.images[0]?.url || null,
        albumArtMedium: track.album.images[1]?.url || null,
        albumArtSmall: track.album.images[2]?.url || null,
        durationMs: track.duration_ms,
        explicit: track.explicit,
        isrc: track.external_ids?.isrc || null
      };
    });
  }

  /**
   * Batch fetch tracks with automatic chunking for large arrays
   * Handles arrays larger than 50 by splitting into multiple requests
   * @param {string[]} trackIds - Array of Spotify track IDs (any size)
   * @param {number} delayMs - Delay between batches to respect rate limits (default 100ms)
   * @returns {Promise<Object[]>} Array of track metadata
   */
  async getTracksBatch(trackIds, delayMs = 100) {
    if (!trackIds || trackIds.length === 0) {
      return [];
    }

    const chunks = [];
    for (let i = 0; i < trackIds.length; i += 50) {
      chunks.push(trackIds.slice(i, i + 50));
    }

    const results = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunkResults = await this.getTracks(chunks[i]);
      results.push(...chunkResults);

      // Add delay between requests to avoid rate limiting (except for last chunk)
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    return results;
  }

  /**
   * Search for a track by ISRC code
   * Useful for matching CSV data to Spotify tracks
   * @param {string} isrc - ISRC code
   * @returns {Promise<Object|null>} Track metadata or null if not found
   */
  async searchByIsrc(isrc) {
    const token = await this.getAccessToken();

    const response = await axios.get(`https://api.spotify.com/v1/search`, {
      params: {
        q: `isrc:${isrc}`,
        type: 'track',
        limit: 1
      },
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = response.data;

    if (!data.tracks || !data.tracks.items || data.tracks.items.length === 0) {
      return null; // No track found for this ISRC
    }

    const track = data.tracks.items[0];

    return {
      id: track.id,
      name: track.name,
      artists: track.artists.map(a => a.name),
      previewUrl: track.preview_url,
      albumArt: track.album.images[0]?.url || null,
      albumArtMedium: track.album.images[1]?.url || null,
      albumArtSmall: track.album.images[2]?.url || null,
      durationMs: track.duration_ms,
      explicit: track.explicit,
      isrc: track.external_ids?.isrc || null
    };
  }
}

// Export singleton instance
module.exports = new SpotifyClient();
