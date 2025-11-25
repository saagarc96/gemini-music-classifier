import { useState, useEffect } from 'react';
import { FileDown, Upload } from 'lucide-react';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { SUBGENRES, ENERGY_LEVELS, ACCESSIBILITY_TYPES, EXPLICIT_TYPES, AI_STATUSES, APPROVAL_STATUSES, APPROVAL_STATUS_LABELS } from '../data/constants';
import { getUploadBatches, getPlaylists, type UploadBatch, type Playlist } from '../lib/api';

interface FilterPanelProps {
  selectedSubgenre: string;
  selectedStatus: string;
  selectedReviewStatus: string;
  selectedApprovalStatus: string;
  selectedEnergy: string;
  selectedAccessibility: string;
  selectedExplicit: string;
  selectedBatchId: string;
  selectedPlaylistId: string;
  searchQuery: string;
  onSubgenreChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onReviewStatusChange: (value: string) => void;
  onApprovalStatusChange: (value: string) => void;
  onEnergyChange: (value: string) => void;
  onAccessibilityChange: (value: string) => void;
  onExplicitChange: (value: string) => void;
  onBatchChange: (value: string) => void;
  onPlaylistChange: (value: string) => void;
  onSearchChange: (value: string) => void;
  onExport: () => void;
  onUpload: () => void;
  totalCount: number;
}

export function FilterPanel({
  selectedSubgenre,
  selectedStatus,
  selectedReviewStatus,
  selectedApprovalStatus,
  selectedEnergy,
  selectedAccessibility,
  selectedExplicit,
  selectedBatchId,
  selectedPlaylistId,
  searchQuery,
  onSubgenreChange,
  onStatusChange,
  onReviewStatusChange,
  onApprovalStatusChange,
  onEnergyChange,
  onAccessibilityChange,
  onExplicitChange,
  onBatchChange,
  onPlaylistChange,
  onSearchChange,
  onExport,
  onUpload,
  totalCount,
}: FilterPanelProps) {
  const [uploadBatches, setUploadBatches] = useState<UploadBatch[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);

  // Fetch upload batches on mount
  useEffect(() => {
    async function fetchBatches() {
      try {
        const batches = await getUploadBatches();
        // Sort by upload date descending (most recent first)
        const sortedBatches = batches.sort((a, b) => {
          return new Date(b.uploadDate).getTime() - new Date(a.uploadDate).getTime();
        });
        setUploadBatches(sortedBatches);
      } catch (error) {
        console.error('Failed to load upload batches:', error);
      }
    }
    fetchBatches();
  }, []);

  // Fetch playlists on mount
  useEffect(() => {
    async function fetchPlaylistsData() {
      try {
        const playlistsData = await getPlaylists();
        setPlaylists(playlistsData);
      } catch (error) {
        console.error('Failed to load playlists:', error);
      }
    }
    fetchPlaylistsData();
  }, []);

  // Format date for display
  function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  return (
    <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-700">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-zinc-100">Filters</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-400">
            Showing {totalCount} {totalCount === 1 ? 'song' : 'songs'}
          </span>
          <Button
            size="sm"
            onClick={onUpload}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Upload className="w-4 h-4 mr-2" />
            Upload CSV
          </Button>
          <Button
            size="sm"
            onClick={onExport}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            disabled={totalCount === 0}
          >
            <FileDown className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search by artist, title, or ISRC..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="bg-zinc-950 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
        <div className="space-y-2">
          <Label htmlFor="subgenre" className="text-zinc-300">Subgenre</Label>
          <Select value={selectedSubgenre} onValueChange={onSubgenreChange}>
            <SelectTrigger id="subgenre" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All subgenres" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 max-h-80">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All Subgenres
              </SelectItem>
              {SUBGENRES.map((genre) => (
                <SelectItem
                  key={genre}
                  value={genre}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {genre}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="status" className="text-zinc-300">AI Status</Label>
          <Select value={selectedStatus} onValueChange={onStatusChange}>
            <SelectTrigger id="status" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All Statuses
              </SelectItem>
              {AI_STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {status}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="reviewed" className="text-zinc-300">Review Status</Label>
          <Select value={selectedReviewStatus} onValueChange={onReviewStatusChange}>
            <SelectTrigger id="reviewed" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All
              </SelectItem>
              <SelectItem value="unreviewed" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                Unreviewed Only
              </SelectItem>
              <SelectItem value="reviewed" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                Reviewed Only
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="approval" className="text-zinc-300">Approval Status</Label>
          <Select value={selectedApprovalStatus} onValueChange={onApprovalStatusChange}>
            <SelectTrigger id="approval" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              {APPROVAL_STATUSES.map((status) => (
                <SelectItem
                  key={status}
                  value={status}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {APPROVAL_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="energy" className="text-zinc-300">Energy</Label>
          <Select value={selectedEnergy} onValueChange={onEnergyChange}>
            <SelectTrigger id="energy" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All energy levels" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All Energy Levels
              </SelectItem>
              {ENERGY_LEVELS.map((level) => (
                <SelectItem
                  key={level}
                  value={level}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {level}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="accessibility" className="text-zinc-300">Accessibility</Label>
          <Select value={selectedAccessibility} onValueChange={onAccessibilityChange}>
            <SelectTrigger id="accessibility" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All
              </SelectItem>
              {ACCESSIBILITY_TYPES.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="explicit" className="text-zinc-300">Explicit Content</Label>
          <Select value={selectedExplicit} onValueChange={onExplicitChange}>
            <SelectTrigger id="explicit" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All
              </SelectItem>
              {EXPLICIT_TYPES.map((type) => (
                <SelectItem
                  key={type}
                  value={type}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch" className="text-zinc-300">Upload Batch</Label>
          <Select value={selectedBatchId} onValueChange={onBatchChange}>
            <SelectTrigger id="batch" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All Uploads" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 max-h-80">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All Uploads
              </SelectItem>
              {uploadBatches.map((batch) => (
                <SelectItem
                  key={batch.uploadBatchId}
                  value={batch.uploadBatchId}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {batch.uploadBatchName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="playlist" className="text-zinc-300">Playlist</Label>
          <Select value={selectedPlaylistId} onValueChange={onPlaylistChange}>
            <SelectTrigger id="playlist" className="bg-zinc-950 border-zinc-700 text-zinc-100">
              <SelectValue placeholder="All Playlists" />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 max-h-80">
              <SelectItem value="all" className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100">
                All Playlists
              </SelectItem>
              {playlists.map((playlist) => (
                <SelectItem
                  key={playlist.id}
                  value={playlist.id}
                  className="text-zinc-100 focus:bg-zinc-700 focus:text-zinc-100"
                >
                  {playlist.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
