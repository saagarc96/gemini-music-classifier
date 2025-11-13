import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, RefreshCw, Check, X, GitMerge } from 'lucide-react';
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

export default function UploadResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const uploadResult = location.state?.uploadResult as UploadResult | undefined;

  // Track which duplicates have been resolved
  const [resolvedDuplicates, setResolvedDuplicates] = useState<Set<number>>(new Set());
  const [processingDuplicate, setProcessingDuplicate] = useState<number | null>(null);

  // If no results, redirect back to main page
  if (!uploadResult) {
    navigate('/');
    return null;
  }

  const handleAcceptAsNew = async (duplicate: any, index: number) => {
    setProcessingDuplicate(index);
    try {
      // TODO: Call API to save as new song with isDuplicate=true
      toast.success(`"${duplicate.newSong.title}" saved as new song`);
      setResolvedDuplicates(prev => new Set(prev).add(index));
    } catch (error: any) {
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setProcessingDuplicate(null);
    }
  };

  const handleMergeWithExisting = async (duplicate: any, index: number) => {
    setProcessingDuplicate(index);
    try {
      // TODO: Call API to update existing song
      toast.success(`Merged with existing "${duplicate.existingSong.title}"`);
      setResolvedDuplicates(prev => new Set(prev).add(index));
    } catch (error: any) {
      toast.error(`Failed to merge: ${error.message}`);
    } finally {
      setProcessingDuplicate(null);
    }
  };

  const handleSkip = (index: number) => {
    setResolvedDuplicates(prev => new Set(prev).add(index));
    toast.info('Duplicate skipped');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/')}
                className="text-zinc-400 hover:text-zinc-100"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Songs
              </Button>
              <div>
                <h1 className="text-2xl font-bold">Upload Results</h1>
                <p className="text-sm text-zinc-400">
                  Batch ID: {uploadResult.batchId}
                </p>
              </div>
            </div>
            <Button
              onClick={() => navigate('/')}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              View All Songs
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-6 py-8">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="group p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl hover:border-green-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-5xl font-bold text-green-500">
                {uploadResult.summary.successful}
              </div>
            </div>
            <div className="text-base font-semibold text-green-400 mb-1">Enriched & Saved</div>
            <div className="text-xs text-zinc-400">
              New songs added to database
            </div>
          </div>

          <div className="group p-6 bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl hover:border-yellow-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <GitMerge className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="text-5xl font-bold text-yellow-500">
                {uploadResult.summary.duplicates}
              </div>
            </div>
            <div className="text-base font-semibold text-yellow-400 mb-1">Needs Review</div>
            <div className="text-xs text-zinc-400">
              Similar songs found (70%+ match)
            </div>
          </div>

          <div className="group p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl hover:border-blue-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-5xl font-bold text-blue-500">
                {uploadResult.summary.blocked}
              </div>
            </div>
            <div className="text-base font-semibold text-blue-400 mb-1">Already Exists</div>
            <div className="text-xs text-zinc-400">
              Exact ISRC matches (skipped)
            </div>
          </div>

          <div className="group p-6 bg-gradient-to-br from-gray-500/10 to-gray-600/5 border border-gray-500/20 rounded-xl hover:border-gray-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-gray-500/20 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-5xl font-bold text-gray-400">
                {uploadResult.summary.errors}
              </div>
            </div>
            <div className="text-base font-semibold text-gray-300 mb-1">Processing Errors</div>
            <div className="text-xs text-zinc-400">
              Failed to enrich
            </div>
          </div>
        </div>

        {/* Results Tabs */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <Tabs
            defaultValue={
              uploadResult.summary.successful > 0
                ? 'successful'
                : uploadResult.summary.duplicates > 0
                ? 'duplicates'
                : 'blocked'
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger
                value="successful"
                className="data-[state=active]:bg-green-500/20"
              >
                ✅ Enriched ({uploadResult.summary.successful})
              </TabsTrigger>
              <TabsTrigger
                value="duplicates"
                className="data-[state=active]:bg-yellow-500/20"
              >
                ⚠️ Duplicates ({uploadResult.summary.duplicates})
              </TabsTrigger>
              <TabsTrigger
                value="blocked"
                className="data-[state=active]:bg-blue-500/20"
              >
                ℹ️ Existing Matches ({uploadResult.summary.blocked})
              </TabsTrigger>
              <TabsTrigger
                value="errors"
                className="data-[state=active]:bg-gray-500/20"
              >
                ❌ Errors ({uploadResult.summary.errors})
              </TabsTrigger>
            </TabsList>

            {/* Successful Tab */}
            <TabsContent value="successful" className="space-y-3 mt-6">
              {uploadResult.results.successful.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No songs were successfully enriched
                </div>
              ) : (
                uploadResult.results.successful.map((song, i) => (
                  <div
                    key={i}
                    className="p-4 bg-green-500/5 border border-green-500/20 rounded-lg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium">
                          {song.artist} - {song.title}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1">
                          ISRC: <span className="font-mono">{song.isrc}</span>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5 justify-end">
                        {song.aiEnergy && (
                          <span className="px-2 py-1 bg-zinc-800 text-xs rounded">
                            {song.aiEnergy}
                          </span>
                        )}
                        {song.aiAccessibility && (
                          <span className="px-2 py-1 bg-zinc-800 text-xs rounded">
                            {song.aiAccessibility}
                          </span>
                        )}
                        {song.aiSubgenre1 && (
                          <span className="px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded">
                            {song.aiSubgenre1}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </TabsContent>

            {/* Duplicates Tab */}
            <TabsContent value="duplicates" className="space-y-4 mt-6">
              {uploadResult.results.duplicates.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No potential duplicates detected
                </div>
              ) : (
                <>
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-sm text-yellow-200">
                      ⚠️ These songs have {'>'}70% similarity to existing songs in your database.
                      Review each one and choose an action.
                    </p>
                  </div>

                  {uploadResult.results.duplicates.map((dup, i) => {
                    const isResolved = resolvedDuplicates.has(i);
                    const isProcessing = processingDuplicate === i;

                    return (
                      <div
                        key={i}
                        className={`p-5 rounded-lg border transition-all ${
                          isResolved
                            ? 'bg-zinc-800/50 border-zinc-700 opacity-60'
                            : 'bg-yellow-500/5 border-yellow-500/20'
                        }`}
                      >
                        {/* Similarity Badge */}
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 font-bold text-sm rounded-full">
                              {dup.similarity.toFixed(1)}% Match
                            </span>
                            {isResolved && (
                              <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded">
                                ✓ Resolved
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Side-by-Side Comparison */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                          {/* New Song */}
                          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                            <div className="text-xs font-semibold text-blue-400 mb-2">
                              NEW SONG (from upload)
                            </div>
                            <div className="font-medium text-base mb-1">
                              {dup.newSong.artist}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {dup.newSong.title}
                            </div>
                            {dup.newSong.isrc && (
                              <div className="text-xs text-muted-foreground mt-2 font-mono">
                                ISRC: {dup.newSong.isrc}
                              </div>
                            )}
                          </div>

                          {/* Existing Song */}
                          <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                            <div className="text-xs font-semibold text-zinc-400 mb-2">
                              EXISTING SONG (in database)
                            </div>
                            <div className="font-medium text-base mb-1">
                              {dup.existingSong.artist}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {dup.existingSong.title}
                            </div>
                            {dup.existingSong.isrc && (
                              <div className="text-xs text-muted-foreground mt-2 font-mono">
                                ISRC: {dup.existingSong.isrc}
                              </div>
                            )}
                            {dup.existingSong.aiSubgenre1 && (
                              <div className="flex gap-1.5 mt-3">
                                <span className="px-2 py-0.5 bg-zinc-700 text-xs rounded">
                                  {dup.existingSong.aiSubgenre1}
                                </span>
                                {dup.existingSong.aiEnergy && (
                                  <span className="px-2 py-0.5 bg-zinc-700 text-xs rounded">
                                    {dup.existingSong.aiEnergy}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        {!isResolved && (
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleAcceptAsNew(dup, i)}
                              disabled={isProcessing}
                              className="flex-1 bg-blue-600 hover:bg-blue-700"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              {isProcessing ? 'Saving...' : 'Save as New Song'}
                            </Button>
                            <Button
                              onClick={() => handleMergeWithExisting(dup, i)}
                              disabled={isProcessing}
                              variant="outline"
                              className="flex-1 border-zinc-600 hover:bg-zinc-800"
                            >
                              <GitMerge className="w-4 h-4 mr-2" />
                              {isProcessing ? 'Merging...' : 'Merge with Existing'}
                            </Button>
                            <Button
                              onClick={() => handleSkip(i)}
                              disabled={isProcessing}
                              variant="ghost"
                              className="px-4 hover:bg-zinc-800"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Skip
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </TabsContent>

            {/* Blocked/Existing Matches Tab */}
            <TabsContent value="blocked" className="space-y-2 mt-6">
              {uploadResult.results.blocked.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No existing matches found
                </div>
              ) : (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
                    <p className="text-sm text-blue-200">
                      ℹ️ These songs are already in your database with the exact same ISRC
                      code. They were automatically skipped to avoid duplicates.
                    </p>
                  </div>
                  {uploadResult.results.blocked.map((blocked, i) => (
                    <div
                      key={i}
                      className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                    >
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

            {/* Errors Tab */}
            <TabsContent value="errors" className="space-y-2 mt-6">
              {uploadResult.results.errors.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No processing errors occurred
                </div>
              ) : (
                uploadResult.results.errors.map((error, i) => (
                  <div
                    key={i}
                    className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg"
                  >
                    <div className="font-medium">
                      {error.song.artist} - {error.song.title}
                    </div>
                    <div className="text-sm text-destructive mt-2 font-mono">
                      {error.error}
                    </div>
                  </div>
                ))
              )}
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
}
