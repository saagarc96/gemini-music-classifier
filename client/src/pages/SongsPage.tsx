import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FilterPanel } from '../components/FilterPanel';
import { SongTable } from '../components/SongTable';
import { ReviewModal } from '../components/ReviewModal';
import { ExportModal } from '../components/ExportModal';
import { UploadModal } from '../components/UploadModal';
import { toast } from 'sonner';
import { getSongs, updateSong, Song, UpdateSongPayload } from '../lib/api';
import Header from '../components/Header';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { Button } from '../components/ui/button';

export default function SongsPage() {
  const navigate = useNavigate();
  const [songs, setSongs] = useState<Song[]>([]);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [selectedSubgenre, setSelectedSubgenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState('all');
  const [selectedApprovalStatus, setSelectedApprovalStatus] = useState('active'); // Default to "Active" (non-rejected songs)
  const [selectedEnergy, setSelectedEnergy] = useState('all');
  const [selectedAccessibility, setSelectedAccessibility] = useState('all');
  const [selectedExplicit, setSelectedExplicit] = useState('all');
  const [selectedBatchId, setSelectedBatchId] = useState('all');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort states
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Selection state
  const [selectedIsrcs, setSelectedIsrcs] = useState<Set<string>>(new Set());

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalSongs, setTotalSongs] = useState(0);
  const [limit, setLimit] = useState(50);

  // Clear selections when filters change
  useEffect(() => {
    setSelectedIsrcs(new Set());
  }, [selectedSubgenre, selectedStatus, selectedReviewStatus, selectedApprovalStatus, selectedEnergy, selectedAccessibility, selectedExplicit, selectedBatchId, selectedPlaylistId, searchQuery]);

  // Fetch songs when filters or page changes
  useEffect(() => {
    fetchSongs();
  }, [selectedSubgenre, selectedStatus, selectedReviewStatus, selectedApprovalStatus, selectedEnergy, selectedAccessibility, selectedExplicit, selectedBatchId, selectedPlaylistId, searchQuery, currentPage, sortBy, sortOrder, limit]);

  const fetchSongs = async () => {
    setLoading(true);
    try {
      const response = await getSongs({
        page: currentPage,
        limit,
        subgenre: selectedSubgenre !== 'all' ? selectedSubgenre : undefined,
        status: selectedStatus !== 'all' ? selectedStatus : undefined,
        reviewStatus: selectedReviewStatus !== 'all' ? selectedReviewStatus : undefined,
        approvalStatus: selectedApprovalStatus !== 'all' ? selectedApprovalStatus : undefined,
        energy: selectedEnergy !== 'all' ? selectedEnergy : undefined,
        accessibility: selectedAccessibility !== 'all' ? selectedAccessibility : undefined,
        explicit: selectedExplicit !== 'all' ? selectedExplicit : undefined,
        uploadBatchId: selectedBatchId !== 'all' ? selectedBatchId : undefined,
        playlistId: selectedPlaylistId !== 'all' ? selectedPlaylistId : undefined,
        search: searchQuery.trim() || undefined,
        sortBy,
        sortOrder,
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

  const handleLimitChange = (newLimit: string) => {
    setLimit(parseInt(newLimit));
    setCurrentPage(1); // Reset to page 1 to avoid showing invalid page
  };

  const handleSongClick = (song: Song) => {
    setSelectedSong(song);
    setIsModalOpen(true);
  };

  const handleSave = async (songId: number, updates: Partial<Song> & { approval_status?: 'APPROVED' | 'REJECTED' | 'PENDING' }) => {
    const song = songs.find((s) => s.id === songId);
    if (!song) return;

    try {
      const payload: UpdateSongPayload = {};

      // Include metadata fields if provided
      if (updates.ai_energy !== undefined) {
        payload.ai_energy = updates.ai_energy || song.ai_energy || '';
        payload.ai_accessibility = updates.ai_accessibility || song.ai_accessibility || '';
        payload.ai_explicit = updates.ai_explicit || song.ai_explicit || null;
        payload.ai_subgenre_1 = updates.ai_subgenre_1 || song.ai_subgenre_1 || '';
        payload.ai_subgenre_2 = updates.ai_subgenre_2 || null;
        payload.ai_subgenre_3 = updates.ai_subgenre_3 || null;
      }

      // Include curator notes if provided
      if (updates.curator_notes !== undefined) {
        payload.curator_notes = updates.curator_notes || null;
      }

      // Include approval status if provided (admin only - handled by API)
      if (updates.approval_status !== undefined) {
        payload.approval_status = updates.approval_status;
      }

      const updatedSong = await updateSong(song.isrc, payload);

      // Update local state
      setSongs((prevSongs) =>
        prevSongs.map((s) => (s.id === songId ? updatedSong : s))
      );

      // Show toast based on action (rejection toast handled in ReviewModal with undo option)
      if (updates.approval_status !== 'REJECTED') {
        toast.success('Changes saved successfully');
      }
    } catch (error: any) {
      console.error('Error saving song:', error);
      toast.error(`Failed to save: ${error.message}`);
    }
  };

  const handleNext = (): boolean => {
    if (!selectedSong) return false;

    const currentIndex = songs.findIndex((s) => s.id === selectedSong.id);
    const nextSong = songs[currentIndex + 1];

    if (nextSong) {
      setSelectedSong(nextSong);
      return true;
    } else {
      // If we're at the end of current page, try to go to next page
      if (currentPage < totalPages) {
        setCurrentPage(currentPage + 1);
        setIsModalOpen(false);
        toast.info('Moving to next page...');
        return true;
      } else {
        // End of queue - handled by the ReviewModal
        return false;
      }
    }
  };

  // Handler for when all pending songs have been reviewed
  const handleEndOfQueue = () => {
    setSelectedApprovalStatus('all');
    setIsModalOpen(false);
    toast.success('All pending songs reviewed!');
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSong(null);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleToggleSelection = (isrc: string) => {
    setSelectedIsrcs(prev => {
      const next = new Set(prev);
      if (next.has(isrc)) {
        next.delete(isrc);
      } else {
        next.add(isrc);
      }
      return next;
    });
  };

  const handleToggleAll = () => {
    const allSelected = songs.length > 0 && songs.every(song => selectedIsrcs.has(song.isrc));
    if (allSelected) {
      // Deselect all on current page
      setSelectedIsrcs(prev => {
        const next = new Set(prev);
        songs.forEach(song => next.delete(song.isrc));
        return next;
      });
    } else {
      // Select all on current page
      setSelectedIsrcs(prev => {
        const next = new Set(prev);
        songs.forEach(song => next.add(song.isrc));
        return next;
      });
    }
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort field with descending as default
      setSortBy(field);
      setSortOrder('desc');
    }
    // Reset to first page when changing sort
    setCurrentPage(1);
  };

  const handleUploadComplete = (result: any) => {
    // Navigate to results page with upload results
    navigate('/upload-results', { state: { uploadResult: result } });
  };

  return (
    <div className="h-screen flex flex-col bg-zinc-950">
      {/* Header with user info and logout */}
      <Header />

      {/* Main Content */}
      <main className="flex-1 overflow-auto px-6 py-4 space-y-4">
        <FilterPanel
          selectedSubgenre={selectedSubgenre}
          selectedStatus={selectedStatus}
          selectedReviewStatus={selectedReviewStatus}
          selectedApprovalStatus={selectedApprovalStatus}
          selectedEnergy={selectedEnergy}
          selectedAccessibility={selectedAccessibility}
          selectedExplicit={selectedExplicit}
          selectedBatchId={selectedBatchId}
          selectedPlaylistId={selectedPlaylistId}
          searchQuery={searchQuery}
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
          onApprovalStatusChange={(value) => {
            setSelectedApprovalStatus(value);
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
          onBatchChange={(value) => {
            setSelectedBatchId(value);
            setCurrentPage(1);
          }}
          onPlaylistChange={(value) => {
            setSelectedPlaylistId(value);
            setCurrentPage(1);
          }}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          onExport={() => setIsExportModalOpen(true)}
          onUpload={() => setIsUploadModalOpen(true)}
          totalCount={totalSongs}
        />

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="text-zinc-400 mt-4">Loading songs...</p>
          </div>
        ) : (
          <>
            <SongTable
              songs={songs}
              selectedIsrcs={selectedIsrcs}
              onSongClick={handleSongClick}
              onToggleSelection={handleToggleSelection}
              onToggleAll={handleToggleAll}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-zinc-800 pt-4">
                <div className="text-sm text-zinc-500">
                  Page {currentPage} of {totalPages} • {totalSongs} total songs
                </div>

                <div className="flex items-center gap-4">
                  {/* Per-page selector */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">Show:</span>
                    <Select value={limit.toString()} onValueChange={handleLimitChange}>
                      <SelectTrigger className="w-[130px] bg-zinc-950 border-zinc-700 text-zinc-100 h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-zinc-900 border-zinc-800">
                        <SelectItem value="25" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          25 per page
                        </SelectItem>
                        <SelectItem value="50" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          50 per page
                        </SelectItem>
                        <SelectItem value="100" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                          100 per page
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Pagination buttons */}
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handlePageChange(1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
                    >
                      First
                    </Button>
                    <Button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      variant="outline"
                      size="sm"
                      className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
                    >
                      Previous
                    </Button>
                    <Button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
                    >
                      Next
                    </Button>
                    <Button
                      onClick={() => handlePageChange(totalPages)}
                      disabled={currentPage === totalPages}
                      variant="outline"
                      size="sm"
                      className="bg-zinc-950 border-zinc-700 hover:bg-zinc-800 text-zinc-100 disabled:opacity-50"
                    >
                      Last
                    </Button>
                  </div>
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
        onEndOfQueue={handleEndOfQueue}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentFilters={{
          subgenre: selectedSubgenre !== 'all' ? selectedSubgenre : undefined,
          status: selectedStatus !== 'all' ? selectedStatus : undefined,
          reviewStatus: selectedReviewStatus !== 'all' ? selectedReviewStatus : undefined,
          approvalStatus: selectedApprovalStatus !== 'all' ? selectedApprovalStatus : undefined,
          energy: selectedEnergy !== 'all' ? selectedEnergy : undefined,
          accessibility: selectedAccessibility !== 'all' ? selectedAccessibility : undefined,
          explicit: selectedExplicit !== 'all' ? selectedExplicit : undefined,
          uploadBatchId: selectedBatchId !== 'all' ? selectedBatchId : undefined,
          playlistId: selectedPlaylistId !== 'all' ? selectedPlaylistId : undefined,
        }}
        totalSongs={totalSongs}
        selectedIsrcs={selectedIsrcs}
      />

      {/* Upload Modal */}
      <UploadModal
        open={isUploadModalOpen}
        onOpenChange={setIsUploadModalOpen}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
