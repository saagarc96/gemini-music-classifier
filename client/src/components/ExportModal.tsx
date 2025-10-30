import { useState, useEffect } from 'react';
import { Download, FileDown } from 'lucide-react';
import Papa from 'papaparse';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { toast } from 'sonner';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters: {
    subgenre?: string;
    status?: string;
    reviewStatus?: string;
    energy?: string;
    accessibility?: string;
    explicit?: string;
  };
  totalSongs: number;
  selectedIsrcs: Set<string>;
}

interface PreviewData {
  preview: string[];
  totalSongs: number;
  exportOptions: {
    playlistName?: string;
    includeAccessibility: boolean;
    includeExplicit: boolean;
  };
}

export function ExportModal({ isOpen, onClose, currentFilters, totalSongs, selectedIsrcs }: ExportModalProps) {
  const [playlistName, setPlaylistName] = useState('');
  const [includeAccessibility, setIncludeAccessibility] = useState(true);
  const [includeExplicit, setIncludeExplicit] = useState(true);
  const [preview, setPreview] = useState<string[]>([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  // Load preview when modal opens or options change
  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, playlistName, includeAccessibility, includeExplicit, selectedIsrcs]);

  const loadPreview = async () => {
    setIsLoadingPreview(true);
    try {
      const params = new URLSearchParams({
        ...(selectedIsrcs.size > 0 ? {} : currentFilters), // Use filters only if no selection
        preview: 'true',
        includeAccessibility: includeAccessibility.toString(),
        includeExplicit: includeExplicit.toString(),
      });

      // If songs are selected, export only selected ISRCs
      if (selectedIsrcs.size > 0) {
        params.set('isrcs', Array.from(selectedIsrcs).join(','));
      }

      if (playlistName.trim()) {
        params.set('playlistName', playlistName.trim());
      }

      const response = await fetch(`/api/songs/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to load preview');
      }

      const data: PreviewData = await response.json();
      setPreview(data.preview);
    } catch (error) {
      console.error('Error loading preview:', error);
      toast.error('Failed to load preview');
      setPreview([]);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      const params = new URLSearchParams({
        ...(selectedIsrcs.size > 0 ? {} : currentFilters), // Use filters only if no selection
        includeAccessibility: includeAccessibility.toString(),
        includeExplicit: includeExplicit.toString(),
      });

      // If songs are selected, export only selected ISRCs
      if (selectedIsrcs.size > 0) {
        params.set('isrcs', Array.from(selectedIsrcs).join(','));
      }

      if (playlistName.trim()) {
        params.set('playlistName', playlistName.trim());
      }

      const response = await fetch(`/api/songs/export?${params}`);
      if (!response.ok) {
        throw new Error('Failed to export songs');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = 'music-export.csv';
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Download the CSV
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      const exportCount = selectedIsrcs.size > 0 ? selectedIsrcs.size : totalSongs;
      toast.success(`Exported ${exportCount} song${exportCount !== 1 ? 's' : ''} to ${filename}`);
      onClose();
    } catch (error) {
      console.error('Error downloading CSV:', error);
      toast.error('Failed to download CSV');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  // Parse preview data for display using papaparse
  const parsedPreview = preview.length > 0
    ? Papa.parse(preview.join('\n'), { header: false, skipEmptyLines: true })
    : { data: [] as string[][] };

  const previewData = parsedPreview.data as string[][];
  const previewHeader = previewData[0] || [];
  const previewRows = previewData.slice(1);

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <FileDown className="w-5 h-5" />
            Export to CSV
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            {selectedIsrcs.size > 0 ? (
              <>Exporting {selectedIsrcs.size} selected song{selectedIsrcs.size !== 1 ? 's' : ''}</>
            ) : (
              <>Exporting {totalSongs} song{totalSongs !== 1 ? 's' : ''} with current filters</>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Playlist Name Input */}
          <div className="space-y-2">
            <Label htmlFor="playlistName" className="text-zinc-300">
              Playlist Name (Optional)
            </Label>
            <Input
              id="playlistName"
              value={playlistName}
              onChange={(e) => setPlaylistName(e.target.value)}
              placeholder="e.g., Maywood Tennis Club - Reception Sound"
              className="bg-zinc-900 border-zinc-700 text-zinc-100"
            />
            <p className="text-xs text-zinc-500">
              Include as first subgenre for legacy format migration
            </p>
          </div>

          {/* Column Toggles */}
          <div className="space-y-3">
            <Label className="text-zinc-300">Export Columns</Label>
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeAccessibility"
                  checked={includeAccessibility}
                  onCheckedChange={(checked) => setIncludeAccessibility(checked === true)}
                />
                <label
                  htmlFor="includeAccessibility"
                  className="text-sm text-zinc-300 cursor-pointer"
                >
                  Include ACCESSIBILITY column
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="includeExplicit"
                  checked={includeExplicit}
                  onCheckedChange={(checked) => setIncludeExplicit(checked === true)}
                />
                <label
                  htmlFor="includeExplicit"
                  className="text-sm text-zinc-300 cursor-pointer"
                >
                  Include EXPLICIT column
                </label>
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              Uncheck fields not yet supported by your primary system
            </p>
          </div>

          {/* Preview Section */}
          <div className="space-y-2">
            <Label className="text-zinc-300">Preview (First 5 Rows)</Label>
            {isLoadingPreview ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center text-zinc-500">
                Loading preview...
              </div>
            ) : preview.length > 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-zinc-800 text-zinc-300">
                        {previewHeader.map((header, index) => (
                          <th key={index} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-t border-zinc-800 text-zinc-400 hover:bg-zinc-800/50">
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="px-3 py-2 whitespace-nowrap">
                              {cell.substring(0, 30)}
                              {cell.length > 30 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 text-center text-zinc-500">
                No songs to preview
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={onClose}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDownload}
              disabled={isDownloading || (selectedIsrcs.size === 0 && totalSongs === 0)}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {isDownloading ? (
                <>
                  <span className="animate-pulse">Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  {selectedIsrcs.size > 0 ? 'Download Selected' : 'Download CSV'}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
