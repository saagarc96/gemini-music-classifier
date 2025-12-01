import { useEffect, useRef, useId } from 'react';

interface SpotifyEmbedProps {
  trackId: string;
  title: string;
  artist: string;
  height?: number;
  autoplay?: boolean;
}

// Extend Window interface for Spotify iFrame API
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (IFrameAPI: SpotifyIFrameAPI) => void;
    SpotifyIframeApi?: SpotifyIFrameAPI;
  }
}

interface SpotifyIFrameAPI {
  createController: (
    element: HTMLElement,
    options: { uri: string; height?: number; width?: string },
    callback: (controller: SpotifyEmbedController) => void
  ) => void;
}

interface SpotifyEmbedController {
  play: () => void;
  togglePlay: () => void;
  loadUri: (uri: string) => void;
  destroy: () => void;
}

// Track if the Spotify API script has been loaded
let spotifyApiLoaded = false;
let spotifyApiReady = false;
let pendingCallbacks: ((api: SpotifyIFrameAPI) => void)[] = [];

function loadSpotifyApi(callback: (api: SpotifyIFrameAPI) => void) {
  if (spotifyApiReady && window.SpotifyIframeApi) {
    callback(window.SpotifyIframeApi);
    return;
  }

  pendingCallbacks.push(callback);

  if (!spotifyApiLoaded) {
    spotifyApiLoaded = true;

    window.onSpotifyIframeApiReady = (IFrameAPI) => {
      window.SpotifyIframeApi = IFrameAPI;
      spotifyApiReady = true;
      pendingCallbacks.forEach(cb => cb(IFrameAPI));
      pendingCallbacks = [];
    };

    const script = document.createElement('script');
    script.src = 'https://open.spotify.com/embed/iframe-api/v1';
    script.async = true;
    script.onerror = () => {
      console.error('Failed to load Spotify iframe API');
      spotifyApiLoaded = false;
      pendingCallbacks = [];
    };
    document.body.appendChild(script);
  }
}

export function SpotifyEmbed({ trackId, title, artist, height = 152, autoplay }: SpotifyEmbedProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<SpotifyEmbedController | null>(null);
  const currentTrackIdRef = useRef<string>(trackId);
  const uniqueId = useId();
  const embedId = `spotify-embed-${uniqueId.replace(/:/g, '-')}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear container using safe DOM methods
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    // Create the element for the embed
    const embedElement = document.createElement('div');
    embedElement.id = embedId;
    container.appendChild(embedElement);

    loadSpotifyApi((IFrameAPI) => {
      // Clean up any existing controller
      if (controllerRef.current) {
        try {
          controllerRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
      }

      IFrameAPI.createController(
        embedElement,
        {
          uri: `spotify:track:${trackId}`,
          height,
          width: '100%',
        },
        (controller) => {
          controllerRef.current = controller;
          currentTrackIdRef.current = trackId;

          // Autoplay after a short delay to ensure embed is ready
          if (autoplay) {
            const SPOTIFY_EMBED_READY_DELAY_MS = 500;
            setTimeout(() => {
              try {
                controller.play();
              } catch (error) {
                console.info('Spotify autoplay blocked or failed:', error);
              }
            }, SPOTIFY_EMBED_READY_DELAY_MS);
          }
        }
      );
    });

    return () => {
      if (controllerRef.current) {
        try {
          controllerRef.current.destroy();
        } catch {
          // Ignore cleanup errors
        }
        controllerRef.current = null;
      }
    };
  }, [trackId, embedId, height, autoplay]);

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <div className="mb-3">
        <p className="text-sm text-zinc-400">Spotify Preview (30 seconds)</p>
      </div>
      <div
        ref={containerRef}
        className="rounded-lg overflow-hidden"
        style={{ minHeight: height }}
        aria-label={`Spotify player for ${title} by ${artist}`}
      />
    </div>
  );
}
