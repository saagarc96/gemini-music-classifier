import { useState, useCallback } from 'react';
import { Upload, X, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { toast } from 'sonner';

interface UploadResult {
  batchId: string;
  summary: {
    total: number;
    successful: number;
    duplicates: number;
    blocked: number;
    errors: number;
  };
  results: {
    successful: Array<any>;
    duplicates: Array<{
      newSong: any;
      existingSong: any;
      similarity: number;
    }>;
    blocked: Array<{
      song: any;
      reason: string;
      existingIsrc: string;
    }>;
    errors: Array<{
      song: any;
      error: string;
    }>;
  };
}

interface UploadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploadComplete?: (result: UploadResult) => void;
}

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [validationError, setValidationError] = useState<string>('');

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

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch('/api/songs/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result: UploadResult = await response.json();

      toast.success(
        `Upload complete: ${result.summary.successful} songs enriched, ${result.summary.duplicates} duplicates detected`
      );

      // Close modal and navigate to results page
      handleClose();

      if (onUploadComplete) {
        onUploadComplete(result);
      }
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setCsvPreview([]);
    setValidationError('');
    onOpenChange(false);
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
                    disabled={uploading}
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
                  disabled={uploading}
                  className="w-full"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing... (this may take several minutes)
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload and Process
                    </>
                  )}
                </Button>
              </div>
            )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

