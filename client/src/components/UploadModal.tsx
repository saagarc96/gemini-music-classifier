import { useState, useCallback, useEffect } from 'react';
import { Upload, X, CheckCircle, XCircle, Loader2, Music, SkipForward, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Progress } from './ui/progress';
import { toast } from 'sonner';

interface UploadResult {
  batchId: string;
  playlistId: string;
  playlistName: string;
  summary: {
    total: number;
    imported: number;
    skipped: number;
    errors: number;
  };
  results: {
    imported: Array<any>;
    skipped: Array<{
      isrc: string;
      title: string;
      artist: string;
    }>;
    errors: Array<{
      title: string;
      artist: string;
      error: string;
    }>;
  };
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (result: UploadResult) => void;
}

type UploadState = 'idle' | 'uploading' | 'complete';

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [validationError, setValidationError] = useState<string>('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [batchId, setBatchId] = useState<string | null>(null);

  // Poll for progress during upload
  useEffect(() => {
    if (uploadState !== 'uploading' || !batchId) return;

    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/api/songs/upload-status?batchId=${batchId}`);
        if (response.ok) {
          const status = await response.json();
          setProgress({
            current: status.processed,
            total: status.total || progress.total
          });
        }
      } catch (error) {
        console.error('Progress poll error:', error);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [uploadState, batchId, progress.total]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const validateCSV = async (file: File): Promise<boolean> => {
    setValidationError('');

    // Check file type
    if (!file.name.endsWith('.csv')) {
      setValidationError('Please upload a CSV file');
      return false;
    }

    // Read file content
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      setValidationError('CSV file is empty');
      return false;
    }

    // Parse header
    const header = lines[0].toLowerCase();
    const hasTitle = header.includes('title') || header.includes('song');
    if (!header.includes('artist') || !hasTitle) {
      setValidationError('CSV must contain Artist and Title (or Song) columns');
      return false;
    }

    // Check song limit (250 max, excluding header)
    const songCount = lines.length - 1;
    if (songCount > 250) {
      setValidationError(`Too many songs: ${songCount} (maximum 250 songs per upload)`);
      return false;
    }

    if (songCount === 0) {
      setValidationError('CSV contains no songs (only header row)');
      return false;
    }

    // Generate preview (first 5 rows)
    const preview = lines.slice(0, 6).map(line => {
      // Simple CSV parsing (handles basic cases)
      return line.split(',').map(cell => cell.trim());
    });
    setCsvPreview(preview);

    return true;
  };

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const valid = await validateCSV(file);
      if (valid) {
        setSelectedFile(file);
      }
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const valid = await validateCSV(file);
      if (valid) {
        setSelectedFile(file);
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setProgress({ current: 0, total: csvPreview.length - 1 }); // Estimate from preview

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/songs/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Upload failed: ${response.statusText}`);
      }

      const uploadResult: UploadResult = await response.json();
      setBatchId(uploadResult.batchId);
      setResult(uploadResult);
      setUploadState('complete');

      toast.success(
        `Upload complete: ${uploadResult.summary.imported} imported, ${uploadResult.summary.skipped} already exist`
      );

    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      console.error('Upload error:', error);
      setUploadState('idle');
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCsvPreview([]);
    setValidationError('');
    setResult(null);
    setUploadState('idle');
    setProgress({ current: 0, total: 0 });
    setBatchId(null);
    onOpenChange(false);
  };

  const handleViewSongs = () => {
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
    handleClose();
  };

  const handleUploadAnother = () => {
    setSelectedFile(null);
    setCsvPreview([]);
    setResult(null);
    setUploadState('idle');
    setProgress({ current: 0, total: 0 });
    setBatchId(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload CSV</DialogTitle>
          <DialogDescription className="text-base">
            Upload a CSV file with songs to enrich and add to the database (maximum 250 songs)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Results View */}
          {uploadState === 'complete' && result && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div
                  className="p-4 rounded-lg text-center border"
                  style={{ backgroundColor: '#14532d', borderColor: '#22c55e' }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Music className="h-5 w-5" style={{ color: '#22c55e' }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: '#22c55e' }}>
                    {result.summary.imported}
                  </div>
                  <div className="text-sm" style={{ color: '#4ade80' }}>Imported</div>
                </div>
                <div
                  className="p-4 rounded-lg text-center border"
                  style={{ backgroundColor: '#1e3a5f', borderColor: '#3b82f6' }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <SkipForward className="h-5 w-5" style={{ color: '#3b82f6' }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: '#3b82f6' }}>
                    {result.summary.skipped}
                  </div>
                  <div className="text-sm" style={{ color: '#60a5fa' }}>Already Exist</div>
                </div>
                <div
                  className="p-4 rounded-lg text-center border"
                  style={{ backgroundColor: '#7f1d1d', borderColor: '#ef4444' }}
                >
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <AlertTriangle className="h-5 w-5" style={{ color: '#ef4444' }} />
                  </div>
                  <div className="text-3xl font-bold" style={{ color: '#ef4444' }}>
                    {result.summary.errors}
                  </div>
                  <div className="text-sm" style={{ color: '#f87171' }}>Errors</div>
                </div>
              </div>

              {/* Playlist Info */}
              <div className="p-4 rounded-lg border border-zinc-700 bg-zinc-800/50">
                <p className="text-sm text-zinc-400">
                  Created playlist: <span className="font-medium text-zinc-200">{result.playlistName}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  You can filter by this playlist in the main view
                </p>
              </div>

              {/* Error Details (if any) */}
              {result.summary.errors > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-red-400">Error Details:</p>
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-red-900 bg-red-950/30 p-3">
                    {result.results.errors.map((err, i) => (
                      <p key={i} className="text-xs text-red-300">
                        • {err.artist} - {err.title}: {err.error}
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button
                  onClick={handleViewSongs}
                  className="flex-1"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  View Imported Songs
                </Button>
                <Button
                  variant="outline"
                  onClick={handleUploadAnother}
                >
                  Upload Another
                </Button>
              </div>
            </div>
          )}

          {/* Uploading State with Progress */}
          {uploadState === 'uploading' && (
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                <span className="text-sm font-medium">
                  {progress.total > 0
                    ? `Processing ${progress.current} of ${progress.total} songs...`
                    : 'Starting upload...'
                  }
                </span>
              </div>

              {progress.total > 0 && (
                <>
                  <Progress
                    value={(progress.current / progress.total) * 100}
                    className="h-2"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {Math.round((progress.current / progress.total) * 100)}% complete
                  </p>
                </>
              )}

              <p className="text-xs text-zinc-500 text-center">
                This may take several minutes depending on the number of songs
              </p>
            </div>
          )}

          {/* Idle State - File Upload */}
          {uploadState === 'idle' && (
            <>
              {/* File Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-primary bg-primary/5'
                    : validationError
                    ? 'border-destructive'
                    : 'border-muted-foreground/25'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Drag and drop your CSV file here, or
                  </p>
                  <label htmlFor="file-upload">
                    <Button variant="outline" className="cursor-pointer" asChild>
                      <span>Browse Files</span>
                    </Button>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                </div>
              </div>

              {validationError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <XCircle className="h-4 w-4" />
                  {validationError}
                </div>
              )}

              {selectedFile && !validationError && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-green-500" />
                      <div>
                        <p className="font-medium">{selectedFile.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {csvPreview.length > 0 && `${csvPreview.length - 1} songs`}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSelectedFile(null);
                        setCsvPreview([]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* CSV Preview */}
                  {csvPreview.length > 0 && (
                    <div className="space-y-3">
                      <p className="text-sm font-semibold text-zinc-200">Preview (first 5 rows):</p>
                      <div className="overflow-x-auto rounded-lg border border-zinc-700 bg-zinc-900">
                        <table className="w-full text-xs">
                          <thead className="bg-zinc-800">
                            <tr>
                              {csvPreview[0].map((header, i) => (
                                <th key={i} className="px-3 py-2 text-left font-semibold text-zinc-200 whitespace-nowrap">
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="text-zinc-300">
                            {csvPreview.slice(1, 6).map((row, i) => (
                              <tr key={i} className="border-t border-zinc-800 hover:bg-zinc-800/50">
                                {row.map((cell, j) => (
                                  <td key={j} className="px-3 py-2 whitespace-nowrap">
                                    {cell}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleUpload}
                    className="w-full"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload and Process
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
