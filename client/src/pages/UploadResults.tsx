import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, RefreshCw, Check, X, SkipForward, Music, AlertTriangle } from 'lucide-react';

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

export default function UploadResults() {
  const location = useLocation();
  const navigate = useNavigate();
  const uploadResult = location.state?.uploadResult as UploadResult | undefined;

  // If no results, redirect back to main page
  if (!uploadResult) {
    navigate('/');
    return null;
  }

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
                  Playlist: {uploadResult.playlistName}
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="group p-6 bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl hover:border-green-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Music className="w-5 h-5 text-green-400" />
              </div>
              <div className="text-5xl font-bold text-green-500">
                {uploadResult.summary.imported}
              </div>
            </div>
            <div className="text-base font-semibold text-green-400 mb-1">Imported</div>
            <div className="text-xs text-zinc-400">
              New songs enriched and added
            </div>
          </div>

          <div className="group p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl hover:border-blue-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <SkipForward className="w-5 h-5 text-blue-400" />
              </div>
              <div className="text-5xl font-bold text-blue-500">
                {uploadResult.summary.skipped}
              </div>
            </div>
            <div className="text-base font-semibold text-blue-400 mb-1">Already Exist</div>
            <div className="text-xs text-zinc-400">
              Songs with matching ISRC (skipped)
            </div>
          </div>

          <div className="group p-6 bg-gradient-to-br from-red-500/10 to-red-600/5 border border-red-500/20 rounded-xl hover:border-red-500/40 transition-all">
            <div className="flex items-start justify-between mb-3">
              <div className="p-2 bg-red-500/20 rounded-lg">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div className="text-5xl font-bold text-red-500">
                {uploadResult.summary.errors}
              </div>
            </div>
            <div className="text-base font-semibold text-red-400 mb-1">Errors</div>
            <div className="text-xs text-zinc-400">
              Failed to process
            </div>
          </div>
        </div>

        {/* Results Tabs */}
        <div className="bg-zinc-900 rounded-lg p-6 border border-zinc-800">
          <Tabs
            defaultValue={
              uploadResult.summary.imported > 0
                ? 'imported'
                : uploadResult.summary.skipped > 0
                ? 'skipped'
                : 'errors'
            }
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger
                value="imported"
                className="data-[state=active]:bg-green-500/20"
              >
                <Check className="w-4 h-4 mr-2" />
                Imported ({uploadResult.summary.imported})
              </TabsTrigger>
              <TabsTrigger
                value="skipped"
                className="data-[state=active]:bg-blue-500/20"
              >
                <SkipForward className="w-4 h-4 mr-2" />
                Already Exist ({uploadResult.summary.skipped})
              </TabsTrigger>
              <TabsTrigger
                value="errors"
                className="data-[state=active]:bg-red-500/20"
              >
                <X className="w-4 h-4 mr-2" />
                Errors ({uploadResult.summary.errors})
              </TabsTrigger>
            </TabsList>

            {/* Imported Tab */}
            <TabsContent value="imported" className="space-y-3 mt-6">
              {uploadResult.results.imported.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No songs were imported
                </div>
              ) : (
                uploadResult.results.imported.map((song, i) => (
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

            {/* Skipped/Already Exist Tab */}
            <TabsContent value="skipped" className="space-y-2 mt-6">
              {uploadResult.results.skipped.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No songs were skipped
                </div>
              ) : (
                <>
                  <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg mb-3">
                    <p className="text-sm text-blue-200">
                      These songs are already in your database with the same ISRC.
                      They were added to the playlist but not re-processed.
                    </p>
                  </div>
                  {uploadResult.results.skipped.map((song, i) => (
                    <div
                      key={i}
                      className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg"
                    >
                      <div className="font-medium">
                        {song.artist} - {song.title}
                      </div>
                      <div className="text-sm text-muted-foreground mt-2">
                        ISRC: <span className="font-mono">{song.isrc}</span>
                      </div>
                      <div className="text-xs text-blue-400 mt-1">
                        ✓ Already in database
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
                      {error.artist} - {error.title}
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
