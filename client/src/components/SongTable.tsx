import { Check, X, AlertCircle } from 'lucide-react';
import { Song } from '../lib/api';
import { Badge } from './ui/badge';
import { Checkbox } from './ui/checkbox';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface SongTableProps {
  songs: Song[];
  selectedIsrcs: Set<string>;
  onSongClick: (song: Song) => void;
  onToggleSelection: (isrc: string) => void;
  onToggleAll: () => void;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  onSort: (field: string) => void;
}

export function SongTable({ songs, selectedIsrcs, onSongClick, onToggleSelection, onToggleAll, sortBy, sortOrder, onSort }: SongTableProps) {
  const allSelected = songs.length > 0 && songs.every(song => selectedIsrcs.has(song.isrc));
  const someSelected = songs.some(song => selectedIsrcs.has(song.isrc)) && !allSelected;

  const getSortIndicator = (field: string) => {
    if (sortBy !== field) return null;
    return (
      <span className="ml-1 inline-block">
        {sortOrder === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

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

  const formatDate = (isoString: string | null) => {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  // Get row background color based on approval status
  const getRowBackgroundStyle = (approvalStatus: Song['approval_status']) => {
    switch (approvalStatus) {
      case 'APPROVED':
        return { backgroundColor: 'rgba(34, 197, 94, 0.08)' }; // subtle green
      case 'REJECTED':
        return { backgroundColor: 'rgba(239, 68, 68, 0.08)' }; // subtle red
      default:
        return {};
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
              <th className="w-12 p-4">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={onToggleAll}
                  aria-label="Select all songs"
                  className={someSelected ? "data-[state=checked]:bg-blue-600" : ""}
                />
              </th>
              <th className="text-left p-4 text-sm text-zinc-400">Artwork</th>
              <th className="text-left p-4 text-sm text-zinc-400">Title</th>
              <th className="text-left p-4 text-sm text-zinc-400">Artist</th>
              <th className="text-left p-4 text-sm text-zinc-400">Energy</th>
              <th className="text-left p-4 text-sm text-zinc-400">Accessibility</th>
              <th className="text-left p-4 text-sm text-zinc-400">Explicit</th>
              <th className="text-left p-4 text-sm text-zinc-400">Subgenres</th>
              <th className="text-left p-4 text-sm text-zinc-400">Status</th>
              <th
                className="text-left p-4 text-sm text-zinc-400 cursor-pointer hover:text-zinc-200 transition-colors select-none"
                onClick={() => onSort('createdAt')}
              >
                Date Added{getSortIndicator('createdAt')}
              </th>
              <th className="text-left p-4 text-sm text-zinc-400 min-w-[180px]">Reviewed By</th>
            </tr>
          </thead>
          <tbody>
            {songs.map((song) => (
              <tr
                key={song.id}
                className="border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
                style={getRowBackgroundStyle(song.approval_status)}
              >
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    checked={selectedIsrcs.has(song.isrc)}
                    onCheckedChange={() => onToggleSelection(song.isrc)}
                    aria-label={`Select ${song.title}`}
                  />
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
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
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-100 max-w-xs truncate">{song.title}</div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-300 max-w-xs truncate">{song.artist}</div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-400 text-sm">{song.ai_energy || '—'}</div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-400 text-sm">{song.ai_accessibility || '—'}</div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-400 text-sm">{song.ai_explicit || '—'}</div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-400 text-sm max-w-xs">
                    {[song.ai_subgenre_1, song.ai_subgenre_2, song.ai_subgenre_3]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  {getStatusBadge(song.ai_status)}
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  <div className="text-zinc-400 text-sm">
                    {formatDate(song.created_at)}
                  </div>
                </td>
                <td className="p-4 cursor-pointer" onClick={() => onSongClick(song)}>
                  {song.approval_status === 'APPROVED' && (
                    <div className="flex items-start gap-2">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#22c55e' }} />
                      <div className="text-sm">
                        <div className="text-zinc-300">{song.approved_by || song.reviewed_by}</div>
                        <div className="text-zinc-500 text-xs">
                          {formatDate(song.approved_at || song.reviewed_at)}
                        </div>
                      </div>
                    </div>
                  )}
                  {song.approval_status === 'REJECTED' && (
                    <div className="flex items-start gap-2">
                      <X className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#ef4444' }} />
                      <div className="text-sm">
                        <div className="text-zinc-400">{song.approved_by || song.reviewed_by}</div>
                        <div className="text-zinc-500 text-xs">
                          {formatDate(song.approved_at || song.reviewed_at)}
                        </div>
                        {song.curator_notes && (
                          <div
                            className="text-xs italic truncate max-w-[150px]"
                            style={{ color: '#71717a' }}
                            title={song.curator_notes}
                          >
                            "{song.curator_notes}"
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {song.approval_status === 'PENDING' && (
                    <span className="text-zinc-600">Pending...</span>
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
