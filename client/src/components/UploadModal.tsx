import { useState, useCallback, useEffect } from 'react';
import {
  processBatch,
  chunkArray,
  type ProcessedSong,
  type UploadResponse,
} from '../lib/api';

// Request notification permission
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

// Send browser notification
const sendNotification = (title: string, body: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    // Only notify if page is not focused
    if (document.hidden) {
      const notification = new Notification(title, {
        body,
        icon: '/favicon.ico',
        tag: 'upload-complete', // Prevents duplicate notifications
      });

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);

      // Focus window when clicked
      notification.onclick = () => {
        window.focus();
        notification.close();
      };
    }
  }
};
import { Upload, CheckCircle, XCircle, Loader2, FileMusic } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog';
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
    imported: ProcessedSong[];
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

type UploadState = 'idle' | 'preparing' | 'processing' | 'complete';

interface BatchProgress {
  phase: 'preparing' | 'processing' | 'finalizing';
  currentBatch: number;
  totalBatches: number;
  songsProcessed: number;
  totalSongs: number;
}

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>('idle');
  const [songCount, setSongCount] = useState(0);
  const [validationError, setValidationError] = useState<string>('');
  const [result, setResult] = useState<UploadResult | null>(null);
  const [batchProgress, setBatchProgress] = useState<BatchProgress>({
    phase: 'preparing',
    currentBatch: 0,
    totalBatches: 0,
    songsProcessed: 0,
    totalSongs: 0,
  });
  const [batchId, setBatchId] = useState<string | null>(null);

  // Update page title based on upload state
  useEffect(() => {
    const originalTitle = 'Music Classifier';

    if (uploadState === 'preparing') {
      document.title = `⏳ Preparing ${songCount} songs...`;
    } else if (uploadState === 'processing') {
      document.title = `⏳ Processing batch ${batchProgress.currentBatch}/${batchProgress.totalBatches}...`;
    } else if (uploadState === 'complete' && result) {
      document.title = `✓ ${result.summary.imported} songs imported`;
      // Reset title after 5 seconds
      const timeout = setTimeout(() => {
        document.title = originalTitle;
      }, 5000);
      return () => clearTimeout(timeout);
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [uploadState, songCount, result, batchProgress]);

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

    // Request notification permission when upload starts
    requestNotificationPermission();

    setUploadState('preparing');
    setBatchProgress({
      phase: 'preparing',
      currentBatch: 0,
      totalBatches: 0,
      songsProcessed: 0,
      totalSongs: songCount,
    });

    try {
      // Step 1: Quick upload - parse CSV, check ISRCs, get songs to process
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

      const uploadResponse: UploadResponse = await response.json();
      setBatchId(uploadResponse.batchId);

      // Initialize result tracking
      const allImported: ProcessedSong[] = [];
      const allErrors: Array<{ artist: string; title: string; error: string }> = [];

      // Step 2: Process songs in batches if there are songs to process
      if (uploadResponse.songsToProcess.length > 0) {
        setUploadState('processing');

        const BATCH_SIZE = 10;
        const batches = chunkArray(uploadResponse.songsToProcess, BATCH_SIZE);

        setBatchProgress(prev => ({
          ...prev,
          phase: 'processing',
          totalBatches: batches.length,
          totalSongs: uploadResponse.songsToProcess.length,
        }));

        for (let i = 0; i < batches.length; i++) {
          setBatchProgress(prev => ({
            ...prev,
            currentBatch: i + 1,
          }));

          try {
            const batchResult = await processBatch(
              uploadResponse.batchId,
              uploadResponse.playlistId,
              uploadResponse.playlistName,
              batches[i]
            );

            // Add results progressively
            allImported.push(...batchResult.results);
            allErrors.push(...batchResult.errors);

            // Update progress
            setBatchProgress(prev => ({
              ...prev,
              songsProcessed: prev.songsProcessed + batchResult.processed + batchResult.errors.length,
            }));

          } catch (batchError: any) {
            console.error(`Batch ${i + 1} failed:`, batchError);
            // Add all songs in failed batch to errors
            for (const song of batches[i]) {
              allErrors.push({
                artist: song.artist,
                title: song.title,
                error: batchError.message || 'Batch processing failed',
              });
            }
          }
        }
      }

      // Step 3: Finalize
      setBatchProgress(prev => ({ ...prev, phase: 'finalizing' }));

      const finalResult: UploadResult = {
        batchId: uploadResponse.batchId,
        playlistId: uploadResponse.playlistId,
        playlistName: uploadResponse.playlistName,
        summary: {
          total: uploadResponse.summary.total,
          imported: allImported.length,
          skipped: uploadResponse.summary.skipped,
          errors: allErrors.length,
        },
        results: {
          imported: allImported,
          skipped: uploadResponse.skippedSongs,
          errors: allErrors,
        },
      };

      setResult(finalResult);
      setUploadState('complete');

      // Send browser notification if tab is not focused
      sendNotification(
        'Upload Complete',
        `${finalResult.summary.imported} songs imported from ${finalResult.playlistName}`
      );

      toast.success(
        `Upload complete: ${finalResult.summary.imported} imported, ${finalResult.summary.skipped} already exist`
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
    setBatchProgress({
      phase: 'preparing',
      currentBatch: 0,
      totalBatches: 0,
      songsProcessed: 0,
      totalSongs: 0,
    });
    setBatchId(null);
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
    setBatchProgress({
      phase: 'preparing',
      currentBatch: 0,
      totalBatches: 0,
      songsProcessed: 0,
      totalSongs: 0,
    });
    setBatchId(null);
  };

  const playlistName = selectedFile?.name.replace(/\.csv$/i, '') || 'Playlist';

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl w-[90vw]">
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

        {/* PREPARING STATE */}
        {uploadState === 'preparing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Preparing Upload
              </DialogTitle>
              <DialogDescription>
                Analyzing {songCount} songs...
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full animate-pulse w-1/4" />
              </div>

              <p className="text-sm text-zinc-400 text-center">
                Parsing CSV and checking for duplicates...
              </p>
            </div>
          </>
        )}

        {/* PROCESSING STATE */}
        {uploadState === 'processing' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                Processing {playlistName}
              </DialogTitle>
              <DialogDescription>
                Batch {batchProgress.currentBatch} of {batchProgress.totalBatches}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              {/* Progress bar */}
              <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full"
                  style={{
                    width: batchProgress.totalSongs > 0
                      ? `${(batchProgress.songsProcessed / batchProgress.totalSongs) * 100}%`
                      : '0%',
                    transition: 'width 0.5s ease-out'
                  }}
                />
              </div>

              <p className="text-sm text-zinc-400 text-center">
                {batchProgress.songsProcessed} / {batchProgress.totalSongs} songs processed
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

            <div className="py-4">
              {/* Stats Row */}
              <div className="flex items-center justify-center gap-3 text-sm">
                <span className="text-green-400 font-medium">
                  {result.summary.imported} imported
                </span>
                <span className="text-zinc-600">•</span>
                <span className="text-zinc-400">
                  {result.summary.skipped} existing
                </span>
                {result.summary.errors > 0 && (
                  <>
                    <span className="text-zinc-600">•</span>
                    <span className="text-red-400">
                      {result.summary.errors} errors
                    </span>
                  </>
                )}
              </div>
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
    </Dialog>
  );
}
