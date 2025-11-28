import { useState, useCallback, useEffect, useRef } from 'react';
import { Upload, X, CheckCircle, XCircle, Loader2, FileMusic, ChevronDown, ChevronRight, SkipForward, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
import { Progress } from './ui/progress';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from './ui/collapsible';
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
    imported: Array<{
      isrc: string;
      title: string;
      artist: string;
      aiEnergy?: string;
      aiAccessibility?: string;
      aiSubgenre1?: string;
    }>;
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
  const [songCount, setSongCount] = useState(0);
  const [validationError, setValidationError] = useState<string>('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [batchId, setBatchId] = useState<string | null>(null);
  const [displayedSongs, setDisplayedSongs] = useState<UploadResult['results']['imported']>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);

  // Animate songs into the feed during upload simulation
  useEffect(() => {
    if (uploadState === 'complete' && result) {
      // Stagger in the imported songs for visual feedback
      const songs = result.results.imported;
      let index = 0;
      setDisplayedSongs([]);

      const interval = setInterval(() => {
        if (index < songs.length && index < 10) { // Show max 10 in the feed
          setDisplayedSongs(prev => [...prev, songs[index]]);
          index++;
          // Auto-scroll to bottom
          if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
          }
        } else {
          clearInterval(interval);
        }
      }, 80);

      return () => clearInterval(interval);
    }
  }, [uploadState, result]);

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

    if (!file.name.endsWith('.csv')) {
      setValidationError('Please upload a CSV file');
      return false;
    }

    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      setValidationError('CSV file is empty');
      return false;
    }

    const header = lines[0].toLowerCase();
    const hasTitle = header.includes('title') || header.includes('song');
    if (!header.includes('artist') || !hasTitle) {
      setValidationError('CSV must contain Artist and Title (or Song) columns');
      return false;
    }

    const count = lines.length - 1;
    if (count > 250) {
      setValidationError(`Too many songs: ${count} (maximum 250)`);
      return false;
    }

    if (count === 0) {
      setValidationError('CSV contains no songs');
      return false;
    }

    setSongCount(count);
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

  const clearFile = () => {
    setSelectedFile(null);
    setSongCount(0);
    setValidationError('');
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploadState('uploading');
    setProgress({ current: 0, total: songCount });

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
      setProgress({ current: uploadResult.summary.total, total: uploadResult.summary.total });
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
    setSongCount(0);
    setValidationError('');
    setResult(null);
    setUploadState('idle');
    setProgress({ current: 0, total: 0 });
    setBatchId(null);
    setDisplayedSongs([]);
    setDetailsOpen(false);
    onOpenChange(false);
  };

  const handleViewInLibrary = () => {
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
    handleClose();
  };

  const handleUploadAnother = () => {
    setSelectedFile(null);
    setSongCount(0);
    setResult(null);
    setUploadState('idle');
    setProgress({ current: 0, total: 0 });
    setBatchId(null);
    setDisplayedSongs([]);
    setDetailsOpen(false);
  };

  const playlistName = selectedFile?.name.replace(/\.csv$/i, '') || 'Playlist';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg">
        {/* IDLE STATE */}
        {uploadState === 'idle' && (
          <>
            <DialogHeader>
              <DialogTitle>Upload Playlist</DialogTitle>
              <DialogDescription>
                Add songs from a CSV file (max 250 songs)
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Drop Zone or File Preview */}
              {!selectedFile ? (
                <div
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200
                    ${dragActive
                      ? 'border-blue-500 bg-blue-500/5'
                      : validationError
                      ? 'border-red-500/50'
                      : 'border-zinc-700 hover:border-zinc-600'
                    }
                  `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  <Upload className="mx-auto h-10 w-10 text-zinc-500 mb-3" />
                  <p className="text-sm text-zinc-400 mb-3">
                    Drag and drop your CSV file here, or
                  </p>
                  <label htmlFor="file-upload">
                    <Button variant="outline" size="sm" className="cursor-pointer" asChild>
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
              ) : (
                /* Minimal File Preview */
                <div className="flex items-center gap-3 p-4 rounded-lg border border-zinc-800 bg-zinc-900/50">
                  <div className="p-2.5 rounded-lg bg-zinc-800">
                    <FileMusic className="w-5 h-5 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{selectedFile.name}</p>
                    <p className="text-sm text-zinc-500">{songCount} songs</p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                </div>
              )}

              {validationError && (
                <div className="flex items-center gap-2 text-sm text-red-400">
                  <XCircle className="h-4 w-4 flex-shrink-0" />
                  {validationError}
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              {selectedFile && (
                <Button variant="ghost" onClick={clearFile} className="text-zinc-400">
                  Change File
                </Button>
              )}
              <Button onClick={handleUpload} disabled={!selectedFile}>
                <Upload className="mr-2 h-4 w-4" />
                Upload & Enrich
              </Button>
            </DialogFooter>
          </>
        )}

        {/* UPLOADING STATE */}
        {uploadState === 'uploading' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Enriching {playlistName}
              </DialogTitle>
              <DialogDescription>
                {songCount} songs being processed
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              {/* Animated progress bar */}
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full animate-pulse"
                  style={{
                    width: progress.current > 0 && progress.total > 0
                      ? `${(progress.current / progress.total) * 100}%`
                      : '30%',
                    transition: 'width 0.5s ease-out'
                  }}
                />
              </div>

              <p className="text-sm text-zinc-400 text-center">
                AI classification in progress...
              </p>
              <p className="text-xs text-zinc-500 text-center">
                This may take a few minutes depending on the number of songs.
              </p>
            </div>
          </>
        )}

        {/* COMPLETE STATE */}
        {uploadState === 'complete' && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Upload Complete
              </DialogTitle>
              <DialogDescription>
                {result.playlistName}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {/* Stats Row - Clear labels */}
              <div className="flex items-center gap-4 text-sm">
                <span className="text-green-400 font-medium">
                  {result.summary.imported} imported
                </span>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-400">
                  {result.summary.skipped} existing
                </span>
                {result.summary.errors > 0 && (
                  <>
                    <span className="text-zinc-500">•</span>
                    <span className="text-red-400">
                      {result.summary.errors} errors
                    </span>
                  </>
                )}
              </div>

              {/* Live Feed of Imported Songs */}
              {displayedSongs.length > 0 && (
                <div
                  ref={feedRef}
                  className="max-h-48 overflow-y-auto space-y-1.5 pr-2"
                >
                  {displayedSongs.map((song, i) => (
                    <div
                      key={song.isrc || i}
                      className="flex items-center gap-2 text-sm animate-fade-in"
                      style={{ animationDelay: `${i * 50}ms` }}
                    >
                      <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      <span className="truncate flex-1 text-zinc-300">
                        {song.artist} – {song.title}
                      </span>
                      {song.aiSubgenre1 && (
                        <span className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400 flex-shrink-0">
                          {song.aiSubgenre1}
                        </span>
                      )}
                    </div>
                  ))}
                  {result.summary.imported > 10 && (
                    <p className="text-xs text-zinc-500 pt-1">
                      and {result.summary.imported - 10} more...
                    </p>
                  )}
                </div>
              )}

              {/* Expandable Details */}
              {(result.summary.skipped > 0 || result.summary.errors > 0) && (
                <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
                  <CollapsibleTrigger className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-300 transition-colors">
                    {detailsOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                    View details
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-3 space-y-3">
                    {/* Skipped Songs */}
                    {result.summary.skipped > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-zinc-400 flex items-center gap-1.5">
                          <SkipForward className="w-3.5 h-3.5" />
                          Already in database
                        </p>
                        <div className="max-h-24 overflow-y-auto space-y-1 pl-5">
                          {result.results.skipped.slice(0, 5).map((song, i) => (
                            <p key={i} className="text-xs text-zinc-500 truncate">
                              {song.artist} – {song.title}
                            </p>
                          ))}
                          {result.summary.skipped > 5 && (
                            <p className="text-xs text-zinc-600">
                              +{result.summary.skipped - 5} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Errors */}
                    {result.summary.errors > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-red-400 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Processing errors
                        </p>
                        <div className="max-h-24 overflow-y-auto space-y-1 pl-5">
                          {result.results.errors.map((err, i) => (
                            <p key={i} className="text-xs text-red-400/80 truncate">
                              {err.artist} – {err.title}: {err.error}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={handleUploadAnother} className="text-zinc-400">
                Upload Another
              </Button>
              <Button onClick={handleViewInLibrary}>
                View in Library
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>

      {/* CSS for fade-in animation */}
      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </Dialog>
  );
}
