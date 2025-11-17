import { useState, useMemo, useRef, useEffect } from 'react';
import { Music, LogOut } from 'lucide-react';
import { FilterPanel } from './components/FilterPanel';
import { SongTable } from './components/SongTable';
import { ReviewModal } from './components/ReviewModal';
import { SearchBar } from './components/SearchBar';
import { PaginationControls } from './components/PaginationControls';
import { KeyboardShortcutsHelp } from './components/KeyboardShortcutsHelp';
import { LoginScreen } from './components/LoginScreen';
import { Button } from './components/ui/button';
import { mockSongs, Song } from './data/mockSongs';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [songs, setSongs] = useState<Song[]>(mockSongs);
  const [selectedSong, setSelectedSong] = useState<Song | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSubgenre, setSelectedSubgenre] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedReviewStatus, setSelectedReviewStatus] = useState('unreviewed');
  const [selectedEnergy, setSelectedEnergy] = useState('all');
  const [selectedAccessibility, setSelectedAccessibility] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Apply filters and search
  const filteredSongs = useMemo(() => {
    return songs.filter((song) => {
      // Search filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesTitle = song.title.toLowerCase().includes(query);
        const matchesArtist = song.artist.toLowerCase().includes(query);
        const matchesISRC = song.isrc?.toLowerCase().includes(query) || false;
        
        if (!matchesTitle && !matchesArtist && !matchesISRC) {
          return false;
        }
      }

      // Subgenre filter
      if (selectedSubgenre !== 'all') {
        const hasSubgenre = [song.ai_subgenre_1, song.ai_subgenre_2, song.ai_subgenre_3]
          .filter(Boolean)
          .includes(selectedSubgenre);
        if (!hasSubgenre) return false;
      }

      // Status filter
      if (selectedStatus !== 'all' && song.ai_status !== selectedStatus) {
        return false;
      }

      // Review status filter
      if (selectedReviewStatus === 'reviewed' && !song.reviewed) {
        return false;
      }
      if (selectedReviewStatus === 'unreviewed' && song.reviewed) {
        return false;
      }

      // Energy filter
      if (selectedEnergy !== 'all' && song.ai_energy !== selectedEnergy) {
        return false;
      }

      // Accessibility filter
      if (selectedAccessibility !== 'all' && song.ai_accessibility !== selectedAccessibility) {
        return false;
      }

      return true;
    });
  }, [songs, searchQuery, selectedSubgenre, selectedStatus, selectedReviewStatus, selectedEnergy, selectedAccessibility]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedSubgenre, selectedStatus, selectedReviewStatus, selectedEnergy, selectedAccessibility]);

  // Paginate filtered songs
  const paginatedSongs = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredSongs.slice(startIndex, endIndex);
  }, [filteredSongs, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredSongs.length / pageSize);

  const handleSongClick = (song: Song) => {
    setSelectedSong(song);
    setIsModalOpen(true);
  };

  const handleSave = (songId: number, updates: Partial<Song>) => {
    setSongs((prevSongs) =>
      prevSongs.map((song) =>
        song.id === songId
          ? { ...song, ...updates, reviewed: true, reviewed_at: new Date().toISOString() }
          : song
      )
    );
    toast.success('Classification saved successfully');
  };

  const handleNext = () => {
    if (!selectedSong) return;

    const currentIndex = filteredSongs.findIndex((s) => s.id === selectedSong.id);
    const nextSong = filteredSongs[currentIndex + 1];

    if (nextSong) {
      setSelectedSong(nextSong);
    } else {
      setIsModalOpen(false);
      toast.info('No more songs in current filter');
    }
  };

  const handlePrevious = () => {
    if (!selectedSong) return;

    const currentIndex = filteredSongs.findIndex((s) => s.id === selectedSong.id);
    const previousSong = filteredSongs[currentIndex - 1];

    if (previousSong) {
      setSelectedSong(previousSong);
    } else {
      toast.info('This is the first song in current filter');
    }
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedSong(null);
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: '/',
      callback: () => {
        searchInputRef.current?.focus();
      },
      description: 'Focus search bar',
    },
    {
      key: 'Escape',
      callback: () => {
        if (isModalOpen) {
          handleModalClose();
        } else if (searchQuery) {
          setSearchQuery('');
        }
      },
      description: 'Close modal or clear search',
    },
    {
      key: 'ArrowRight',
      callback: () => {
        if (isModalOpen) {
          handleNext();
        }
      },
      description: 'Next song in modal',
    },
    {
      key: 'ArrowLeft',
      callback: () => {
        if (isModalOpen) {
          handlePrevious();
        }
      },
      description: 'Previous song in modal',
    },
    {
      key: '?',
      callback: () => {
        // This will be handled by the dialog component
      },
      description: 'Show keyboard shortcuts',
    },
  ], true);

  const handleLogin = () => {
    setIsAuthenticated(true);
    toast.success('Welcome back!');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setSelectedSong(null);
    setIsModalOpen(false);
    toast.info('Logged out successfully');
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Music className="w-6 h-6 text-blue-500" />
              <div>
                <h1 className="text-zinc-100">Raina Music Classification Review</h1>
                <p className="text-sm text-zinc-400">AI Classification Review System</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <KeyboardShortcutsHelp />
              <Button
                onClick={handleLogout}
                variant="outline"
                size="sm"
                className="gap-2 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        {/* Search Bar */}
        <SearchBar
          ref={searchInputRef}
          value={searchQuery}
          onChange={setSearchQuery}
        />

        <FilterPanel
          selectedSubgenre={selectedSubgenre}
          selectedStatus={selectedStatus}
          selectedReviewStatus={selectedReviewStatus}
          selectedEnergy={selectedEnergy}
          selectedAccessibility={selectedAccessibility}
          onSubgenreChange={setSelectedSubgenre}
          onStatusChange={setSelectedStatus}
          onReviewStatusChange={setSelectedReviewStatus}
          onEnergyChange={setSelectedEnergy}
          onAccessibilityChange={setSelectedAccessibility}
          totalCount={filteredSongs.length}
        />

        <SongTable songs={paginatedSongs} onSongClick={handleSongClick} />

        {filteredSongs.length > 0 ? (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredSongs.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={handlePageSizeChange}
          />
        ) : (
          <div className="text-center text-zinc-500 py-8">
            No songs found matching your filters
          </div>
        )}
      </main>

      {/* Review Modal */}
      <ReviewModal
        song={selectedSong}
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSave={handleSave}
        onNext={handleNext}
        onPrevious={handlePrevious}
      />
    </div>
  );
}
