interface SpotifyEmbedProps {
  trackId: string;
  title: string;
  artist: string;
  height?: number;
}

export function SpotifyEmbed({ trackId, title, artist, height = 152 }: SpotifyEmbedProps) {
  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
      <div className="mb-3">
        <p className="text-sm text-zinc-400">Spotify Preview (30 seconds)</p>
      </div>
      <iframe
        src={`https://open.spotify.com/embed/track/${trackId}?utm_source=generator`}
        width="100%"
        height={height}
        frameBorder="0"
        allow="encrypted-media"
        loading="lazy"
        title={`Spotify player for ${title} by ${artist}`}
        className="rounded-lg"
      />
    </div>
  );
}
