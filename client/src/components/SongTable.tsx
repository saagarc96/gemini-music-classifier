import { Check, X, AlertCircle } from 'lucide-react';
import { Song } from '../data/mockSongs';
import { Badge } from './ui/badge';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface SongTableProps {
  songs: Song[];
  onSongClick: (song: Song) => void;
}

export function SongTable({ songs, onSongClick }: SongTableProps) {
  const getStatusBadge = (status: Song['ai_status']) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700">
            <Check className="w-3 h-3 mr-1" />
            Success
          </Badge>
        );
      case 'ERROR':
        return (
          <Badge className="bg-red-900/50 text-red-300 border-red-700">
            <X className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      case 'REQUIRES HUMAN REVIEW':
        return (
          <Badge className="bg-amber-900/50 text-amber-300 border-amber-700">
            <AlertCircle className="w-3 h-3 mr-1" />
            Needs Review
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-800 text-zinc-400 border-zinc-700">
            {status}
          </Badge>
        );
    }
  };

  if (songs.length === 0) {
    return (
      <div className="bg-zinc-900 rounded-lg p-12 border border-zinc-800 text-center">
        <p className="text-zinc-400">No songs match the current filters</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left p-4 text-sm text-zinc-400">Artwork</th>
              <th className="text-left p-4 text-sm text-zinc-400">Title</th>
              <th className="text-left p-4 text-sm text-zinc-400">Artist</th>
              <th className="text-left p-4 text-sm text-zinc-400">Energy</th>
              <th className="text-left p-4 text-sm text-zinc-400">Accessibility</th>
              <th className="text-left p-4 text-sm text-zinc-400">Explicit</th>
              <th className="text-left p-4 text-sm text-zinc-400">Subgenres</th>
              <th className="text-left p-4 text-sm text-zinc-400">Status</th>
              <th className="text-center p-4 text-sm text-zinc-400">Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr
                key={song.id}
                onClick={() => onSongClick(song)}
                className="border-b border-zinc-800 hover:bg-zinc-800/50 cursor-pointer transition-colors"
              >
                <td className="p-4">
                  {song.artwork ? (
                    <ImageWithFallback
                      src={song.artwork}
                      alt={`${song.title} artwork`}
                      className="w-12 h-12 rounded object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center text-xs text-zinc-600">
                      No Art
                    </div>
                  )}
                </td>
                <td className="p-4">
                  <div className="text-zinc-100 max-w-xs truncate">{song.title}</div>
                </td>
                <td className="p-4">
                  <div className="text-zinc-300 max-w-xs truncate">{song.artist}</div>
                </td>
                <td className="p-4">
                  <div className="text-zinc-400 text-sm">{song.ai_energy || '—'}</div>
                </td>
                <td className="p-4">
                  <div className="text-zinc-400 text-sm">{song.ai_accessibility || '—'}</div>
                </td>
                <td className="p-4">
                  <div className="text-zinc-400 text-sm">{song.ai_explicit || '—'}</div>
                </td>
                <td className="p-4">
                  <div className="text-zinc-400 text-sm max-w-xs">
                    {[song.ai_subgenre_1, song.ai_subgenre_2, song.ai_subgenre_3]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </div>
                </td>
                <td className="p-4">
                  {getStatusBadge(song.ai_status)}
                </td>
                <td className="p-4 text-center">
                  {song.reviewed ? (
                    <Check className="w-5 h-5 text-emerald-400 mx-auto" />
                  ) : (
                    <span className="text-zinc-600">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
