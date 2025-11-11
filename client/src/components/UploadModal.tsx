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
  onUploadComplete?: () => void;
}

export function UploadModal({ open, onOpenChange, onUploadComplete }: UploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
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
    if (!header.includes('artist') || !header.includes('title')) {
      setValidationError('CSV must contain Artist and Title columns');
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
    setUploadResult(null);

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
      setUploadResult(result);

      toast.success(
        `Upload complete: ${result.summary.successful} songs enriched, ${result.summary.duplicates} duplicates detected`
      );

      if (onUploadComplete) {
        onUploadComplete();
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
    setUploadResult(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload CSV</DialogTitle>
          <DialogDescription>
            Upload a CSV file with songs to enrich and add to the database (maximum 250 songs)
          </DialogDescription>
        </DialogHeader>

        {!uploadResult ? (
          <div className="space-y-6">
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
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Preview (first 5 rows):</p>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            {csvPreview[0].map((header, i) => (
                              <th key={i} className="px-4 py-2 text-left font-medium">
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.slice(1, 6).map((row, i) => (
                            <tr key={i} className="border-t">
                              {row.map((cell, j) => (
                                <td key={j} className="px-4 py-2">
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
        ) : (
          /* Results View */
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Upload Summary</h3>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-green-500 mb-1">
                    {uploadResult.summary.successful}
                  </div>
                  <div className="text-sm font-medium text-green-400">Enriched & Saved</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    New songs added to database
                  </div>
                </div>
                <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-500 mb-1">
                    {uploadResult.summary.duplicates}
                  </div>
                  <div className="text-sm font-medium text-yellow-400">Potential Duplicates</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Similar songs found (70%+ match)
                  </div>
                </div>
                <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-blue-500 mb-1">
                    {uploadResult.summary.blocked}
                  </div>
                  <div className="text-sm font-medium text-blue-400">Existing Matches Found</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Already in database (skipped)
                  </div>
                </div>
                <div className="p-4 bg-gray-500/10 border border-gray-500/20 rounded-lg">
                  <div className="text-3xl font-bold text-gray-400 mb-1">
                    {uploadResult.summary.errors}
                  </div>
                  <div className="text-sm font-medium text-gray-300">Processing Errors</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    Failed to enrich
                  </div>
                </div>
              </div>
            </div>

            <Tabs defaultValue={uploadResult.summary.successful > 0 ? "successful" : uploadResult.summary.duplicates > 0 ? "duplicates" : "blocked"} className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="successful" className="data-[state=active]:bg-green-500/20">
                  ✅ Enriched ({uploadResult.summary.successful})
                </TabsTrigger>
                <TabsTrigger value="duplicates" className="data-[state=active]:bg-yellow-500/20">
                  ⚠️ Duplicates ({uploadResult.summary.duplicates})
                </TabsTrigger>
                <TabsTrigger value="blocked" className="data-[state=active]:bg-blue-500/20">
                  ℹ️ Existing Matches ({uploadResult.summary.blocked})
                </TabsTrigger>
                <TabsTrigger value="errors" className="data-[state=active]:bg-gray-500/20">
                  ❌ Errors ({uploadResult.summary.errors})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="successful" className="space-y-2 max-h-[400px] overflow-y-auto mt-4">
                {uploadResult.results.successful.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    No songs were successfully enriched
                  </div>
                ) : (
                  uploadResult.results.successful.map((song, i) => (
                    <div key={i} className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <div className="font-medium text-lg">
                        {song.artist} - {song.title}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2 flex flex-wrap gap-2">
                        <span className="px-2 py-1 bg-muted rounded">{song.aiEnergy}</span>
                        <span className="px-2 py-1 bg-muted rounded">{song.aiAccessibility}</span>
                        <span className="px-2 py-1 bg-muted rounded">{song.aiSubgenre1}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2">ISRC: {song.isrc}</div>
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="duplicates" className="space-y-3 max-h-[400px] overflow-y-auto mt-4">
                {uploadResult.results.duplicates.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    No potential duplicates detected
                  </div>
                ) : (
                  uploadResult.results.duplicates.map((dup, i) => (
                    <div key={i} className="p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="font-medium">New Song:</div>
                        <div className="text-sm font-bold text-yellow-500">
                          {dup.similarity.toFixed(1)}% Match
                        </div>
                      </div>
                      <div className="text-sm mb-3">
                        {dup.newSong.artist} - {dup.newSong.title}
                      </div>
                      <div className="font-medium text-muted-foreground text-sm mb-1">
                        Similar to existing song:
                      </div>
                      <div className="text-sm">
                        {dup.existingSong.artist} - {dup.existingSong.title}
                      </div>
                      {dup.existingSong.isrc && (
                        <div className="text-xs text-muted-foreground mt-2">
                          Existing ISRC: {dup.existingSong.isrc}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </TabsContent>

              <TabsContent value="blocked" className="space-y-2 max-h-[400px] overflow-y-auto mt-4">
                {uploadResult.results.blocked.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    No existing matches found
                  </div>
                ) : (
                  <>
                    <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
                      <p className="text-sm text-blue-200">
                        ℹ️ These songs are already in your database with the exact same ISRC code.
                        They were automatically skipped to avoid duplicates.
                      </p>
                    </div>
                    {uploadResult.results.blocked.map((blocked, i) => (
                      <div key={i} className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                        <div className="font-medium">
                          {blocked.song.artist} - {blocked.song.title}
                        </div>
                        <div className="text-sm text-muted-foreground mt-2">
                          ISRC: <span className="font-mono">{blocked.existingIsrc}</span>
                        </div>
                        <div className="text-xs text-blue-400 mt-1">
                          ✓ Already in database - skipped
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </TabsContent>

              <TabsContent value="errors" className="space-y-2 max-h-[400px] overflow-y-auto mt-4">
                {uploadResult.results.errors.length === 0 ? (
                  <div className="text-center py-20 text-muted-foreground">
                    No processing errors occurred
                  </div>
                ) : (
                  uploadResult.results.errors.map((error, i) => (
                    <div key={i} className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <div className="font-medium">
                        {error.song.artist} - {error.song.title}
                      </div>
                      <div className="text-sm text-destructive mt-2 font-mono">{error.error}</div>
                    </div>
                  ))
                )}
              </TabsContent>
            </Tabs>

            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
