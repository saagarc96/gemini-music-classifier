import { useState, useEffect } from 'react';
import { Music } from 'lucide-react';
import { FilterPanel } from './components/FilterPanel';
import { SongTable } from './components/SongTable';
import { ReviewModal } from './components/ReviewModal';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { getSongs, updateSong, Song, UpdateSongPayload } from './lib/api';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedSubgenre, setSelectedSubgenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState('unreviewed');
  const [selectedEnergy, setSelectedEnergy] = useState('all');
  const [selectedAccessibility, setSelectedAccessibility] = useState('all');
  const [selectedExplicit, setSelectedExplicit] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSongs, setTotalSongs] = useState(0);
  const limit = 50;

  // Fetch songs when filters or page changes
  useEffect(() => {
    fetchSongs();
  }, [selectedSubgenre, selectedStatus, selectedReviewStatus, selectedEnergy, selectedAccessibility, selectedExplicit, currentPage]);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const response = await getSongs({
        page: currentPage,
        limit,
        subgenre: selectedSubgenre !== 'all' ? selectedSubgenre : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        reviewStatus: selectedReviewStatus !== 'all' ? selectedReviewStatus : undefined,
        energy: selectedEnergy !== 'all' ? selectedEnergy : undefined,
        accessibility: selectedAccessibility !== 'all' ? selectedAccessibility : undefined,
        explicit: selectedExplicit !== 'all' ? selectedExplicit : undefined,
      });

      setSongs(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalSongs(response.pagination.total);
    } catch (error: any) {
      console.error('Error fetching songs:', error);
      toast.error(`Failed to fetch songs: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSongClick = (song: Song) => {
    setSelectedSong(song);
    setIsModalOpen(true);
  };

  const handleSave = async (songId: number, updates: Partial<Song>) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    try {
      const payload: UpdateSongPayload = {
        ai_energy: updates.ai_energy || song.ai_energy || '',
        ai_accessibility: updates.ai_accessibility || song.ai_accessibility || '',
        ai_explicit: updates.ai_explicit || song.ai_explicit || null,
        ai_subgenre_1: updates.ai_subgenre_1 || song.ai_subgenre_1 || '',
        ai_subgenre_2: updates.ai_subgenre_2 || null,
        ai_subgenre_3: updates.ai_subgenre_3 || null,
        curator_notes: updates.curator_notes || null,
      };

      const updatedSong = await updateSong(song.isrc, payload);

      // Update local state
      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      toast.success('Classification saved successfully');
    } catch (error: any) {
      console.error('Error saving song:', error);
      toast.error(`Failed to save: ${error.message}`);
    }
  };

  const handleNext = () => {
    if (!selectedSong) return;

    const currentIndex = songs.findIndex((s) => s.id === selectedSong.id);
    const nextSong = songs[currentIndex + 1];

    if (nextSong) {
      setSelectedSong(nextSong);
    } else {
      // If we're at the end of current page, try to go to next page
      if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
        setIsModalOpen(false);
        toast.info('Moving to next page...');
      } else {
        setIsModalOpen(false);
        toast.info('No more songs in current filter');
      }
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSong(null);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-blue-500" />
            <div>
              <h1 className="text-zinc-100">Raina Music Classification Review</h1>
              <p className="text-sm text-zinc-400">AI Classification Review System</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <FilterPanel
          selectedSubgenre={selectedSubgenre}
          selectedStatus={selectedStatus}
          selectedReviewStatus={selectedReviewStatus}
          selectedEnergy={selectedEnergy}
          selectedAccessibility={selectedAccessibility}
          selectedExplicit={selectedExplicit}
          onSubgenreChange={(value) => {
            setSelectedSubgenre(value);
            setCurrentPage(1); // Reset to page 1 on filter change
          }}
          onStatusChange={(value) => {
            setSelectedStatus(value);
            setCurrentPage(1);
          }}
          onReviewStatusChange={(value) => {
            setSelectedReviewStatus(value);
            setCurrentPage(1);
          }}
          onEnergyChange={(value) => {
            setSelectedEnergy(value);
            setCurrentPage(1);
          }}
          onAccessibilityChange={(value) => {
            setSelectedAccessibility(value);
            setCurrentPage(1);
          }}
          onExplicitChange={(value) => {
            setSelectedExplicit(value);
            setCurrentPage(1);
          }}
          totalCount={totalSongs}
        />

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-zinc-400 mt-4">Loading songs...</p>
          </div>
        ) : (
          <>
            <SongTable songs={songs} onSongClick={handleSongClick} />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <div className="text-sm text-zinc-500">
                  Page {currentPage} of {totalPages} • {totalSongs} total songs
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    First
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Next
                  </button>
                  <button
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1 rounded bg-zinc-800 text-zinc-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700"
                  >
                    Last
                  </button>
                </div>
              </div>
            )}

            {songs.length === 0 && !loading && (
              <div className="text-center py-12 text-zinc-500">
                No songs match the current filters
              </div>
            )}
          </>
        )}
      </main>

      {/* Review Modal */}
      <ReviewModal
        song={selectedSong}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        onNext={handleNext}
      />
    </div>
  );
}
