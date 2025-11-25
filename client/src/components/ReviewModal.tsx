import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, User, X } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';
import { Dialog, DialogContent } from './ui/dialog';
import { AudioPlayer } from './AudioPlayer';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Song, updateSong } from '../lib/api';
import { ENERGY_LEVELS, ACCESSIBILITY_TYPES, EXPLICIT_TYPES, SUBGENRES } from '../data/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { useAuth } from '../contexts/AuthContext';
import { Badge } from './ui/badge';
import { toast } from 'sonner';

interface ReviewModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (songId: number, updates: Partial<Song> & { approval_status?: 'APPROVED' | 'REJECTED' | 'PENDING' }) => void;
  onNext: () => boolean; // Returns true if there's a next song
  onEndOfQueue: () => void; // Called when all pending songs have been reviewed
}

export function ReviewModal({ song, isOpen, onClose, onSave, onNext, onEndOfQueue }: ReviewModalProps) {
  const { user } = useAuth();
  const [energy, setEnergy] = useState<string | undefined>(undefined);
  const [accessibility, setAccessibility] = useState<string | undefined>(undefined);
  const [explicit, setExplicit] = useState<string | undefined>(undefined);
  const [subgenre1, setSubgenre1] = useState<string | undefined>(undefined);
  const [subgenre2, setSubgenre2] = useState<string | undefined>(undefined);
  const [subgenre3, setSubgenre3] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const [notesOpen, setNotesOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const lastRejectedIsrc = useRef<string | null>(null);

  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    if (song) {
      setEnergy(song.ai_energy && song.ai_energy.trim() !== '' ? song.ai_energy : undefined);
      setAccessibility(song.ai_accessibility && song.ai_accessibility.trim() !== '' ? song.ai_accessibility : undefined);
      setExplicit(song.ai_explicit && song.ai_explicit.trim() !== '' ? song.ai_explicit : undefined);
      setSubgenre1(song.ai_subgenre_1 && song.ai_subgenre_1.trim() !== '' ? song.ai_subgenre_1 : undefined);
      setSubgenre2(song.ai_subgenre_2 && song.ai_subgenre_2.trim() !== '' ? song.ai_subgenre_2 : undefined);
      setSubgenre3(song.ai_subgenre_3 && song.ai_subgenre_3.trim() !== '' ? song.ai_subgenre_3 : undefined);
      setNotes(song.curator_notes || '');
      setNotesOpen(false); // Reset notes collapsible when song changes
    }
  }, [song]);

  const clearSubgenre2 = () => setSubgenre2(undefined);
  const clearSubgenre3 = () => setSubgenre3(undefined);

  const handleSave = () => {
    if (!song) return;

    onSave(song.id, {
      ai_energy: energy || '',
      ai_accessibility: accessibility || '',
      ai_explicit: explicit || null,
      ai_subgenre_1: subgenre1 || '',
      ai_subgenre_2: (subgenre2 && subgenre2 !== '_none') ? subgenre2 : null,
      ai_subgenre_3: (subgenre3 && subgenre3 !== '_none') ? subgenre3 : null,
      curator_notes: notes || null,
      reviewed: true,
      reviewed_at: new Date().toISOString(),
    });
    onClose();
  };

  const handleSaveAndNext = () => {
    if (!song) return;

    onSave(song.id, {
      ai_energy: energy || '',
      ai_accessibility: accessibility || '',
      ai_explicit: explicit || null,
      ai_subgenre_1: subgenre1 || '',
      ai_subgenre_2: (subgenre2 && subgenre2 !== '_none') ? subgenre2 : null,
      ai_subgenre_3: (subgenre3 && subgenre3 !== '_none') ? subgenre3 : null,
      curator_notes: notes || null,
      reviewed: true,
      reviewed_at: new Date().toISOString(),
    });
    onNext();
  };

  // Handle next (admin only) - auto-saves any metadata edits and moves to next
  const handleNext = async () => {
    if (!song || !isAdmin) return;
    setIsLoading(true);

    try {
      // Auto-save any metadata edits
      await onSave(song.id, {
        ai_energy: energy || '',
        ai_accessibility: accessibility || '',
        ai_explicit: explicit || null,
        ai_subgenre_1: subgenre1 || '',
        ai_subgenre_2: (subgenre2 && subgenre2 !== '_none') ? subgenre2 : null,
        ai_subgenre_3: (subgenre3 && subgenre3 !== '_none') ? subgenre3 : null,
        curator_notes: notes || null,
        reviewed: true,
        reviewed_at: new Date().toISOString(),
      });

      // Check if there's a next song
      const hasNext = onNext();
      if (!hasNext) {
        // End of queue - switch filter to "All"
        onEndOfQueue();
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Handle reject (admin only)
  const handleReject = async () => {
    if (!song || !isAdmin) return;
    setIsLoading(true);

    const rejectedIsrc = song.isrc;
    lastRejectedIsrc.current = rejectedIsrc;

    try {
      await onSave(song.id, {
        approval_status: 'REJECTED',
        curator_notes: notes || null,
      });

      // Show undo toast
      toast('Song rejected', {
        action: {
          label: 'Undo',
          onClick: async () => {
            try {
              await updateSong(rejectedIsrc, { approval_status: 'PENDING' });
              toast.success('Rejection undone');
            } catch (error) {
              toast.error('Failed to undo rejection');
            }
          },
        },
        duration: 5000,
      });

      // Check if there's a next song
      const hasNext = onNext();
      if (!hasNext) {
        // End of queue - switch filter to "All"
        onEndOfQueue();
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!song) return null;

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border-zinc-800">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            {song.artwork ? (
              <ImageWithFallback
                src={song.artwork}
                alt={`${song.title} artwork`}
                className="w-24 h-24 rounded-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-600">
                No Art
              </div>
            )}
            <div className="flex-1">
              <h2 className="text-zinc-100 mb-1">
                {song.title}
              </h2>
              <p className="text-zinc-400 mb-2">{song.artist}</p>
              {song.isrc && (
                <p className="text-sm text-zinc-500">ISRC: {song.isrc}</p>
              )}
              {song.bpm && (
                <p className="text-sm text-zinc-500">BPM: {song.bpm}</p>
              )}
            </div>
          </div>

          {/* Review Status */}
          <div className="flex items-center justify-between p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-zinc-300">
                Reviewing as: <span className="font-medium text-zinc-100">{user?.name}</span>
              </span>
              <Badge variant="outline" className="text-xs bg-zinc-800 border-zinc-700 text-zinc-300">
                {user?.role}
              </Badge>
            </div>
            {song.reviewed && song.reviewed_by && (
              <div className="text-xs text-zinc-500">
                Previously reviewed by <span className="text-zinc-400">{song.reviewed_by}</span>
              </div>
            )}
          </div>

          {/* Audio Player */}
          <AudioPlayer
            src={song.source_file}
            spotifyTrackId={song.spotify_track_id}
            title={song.title}
            artist={song.artist}
          />

          {/* Admin Review Actions */}
          {isAdmin && (
            <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-800" style={{ backgroundColor: '#18181b' }}>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-zinc-300">Admin Review</span>
                {song.approval_status === 'REJECTED' && (
                  <Badge className="text-xs" style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' }}>
                    Rejected
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleReject}
                  disabled={isLoading}
                  size="sm"
                  style={{ backgroundColor: '#7f1d1d', color: '#ef4444', borderColor: '#7f1d1d' }}
                  className="hover:opacity-90"
                >
                  <X className="w-4 h-4 mr-1" />
                  Reject
                </Button>
                <Button
                  onClick={handleNext}
                  disabled={isLoading}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Next
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* AI Classification */}
          <div className="space-y-4">
            <h3 className="text-zinc-200">AI Classification</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="energy" className="text-zinc-300">Energy</Label>
                <Select value={energy || ''} onValueChange={(val) => setEnergy(val || undefined)}>
                  <SelectTrigger id="energy" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectValue placeholder="Select energy level" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ENERGY_LEVELS.map((level) => (
                      <SelectItem
                        key={level}
                        value={level}
                        className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        {level}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="accessibility" className="text-zinc-300">Accessibility</Label>
                <Select value={accessibility || ''} onValueChange={(val) => setAccessibility(val || undefined)}>
                  <SelectTrigger id="accessibility" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                    <SelectValue placeholder="Select accessibility" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800">
                    {ACCESSIBILITY_TYPES.map((type) => (
                      <SelectItem
                        key={type}
                        value={type}
                        className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                      >
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="explicit" className="text-zinc-300">Explicit Content</Label>
              <Select value={explicit || ''} onValueChange={(val) => setExplicit(val || undefined)}>
                <SelectTrigger id="explicit" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Select explicit content rating" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {EXPLICIT_TYPES.map((type) => (
                    <SelectItem
                      key={type}
                      value={type}
                      className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subgenre1" className="text-zinc-300">Subgenre 1 *</Label>
              <Select value={subgenre1 || ''} onValueChange={(val) => setSubgenre1(val || undefined)}>
                <SelectTrigger id="subgenre1" className="bg-zinc-900 border-zinc-800 text-zinc-100">
                  <SelectValue placeholder="Select primary subgenre" />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {SUBGENRES.map((genre) => (
                    <SelectItem
                      key={genre}
                      value={genre}
                      className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                    >
                      {genre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subgenre2" className="text-zinc-300">Subgenre 2</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={subgenre2 || ''} onValueChange={(val) => setSubgenre2(val || undefined)}>
                    <SelectTrigger id="subgenre2" className="w-full bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue placeholder="Select secondary subgenre (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="_none" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                        None
                      </SelectItem>
                      {SUBGENRES.map((genre) => (
                        <SelectItem
                          key={genre}
                          value={genre}
                          className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                        >
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {subgenre2 && subgenre2 !== '_none' && (
                  <button
                    type="button"
                    onClick={clearSubgenre2}
                    style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#7f1d1d', color: '#ef4444' }}
                    title="Clear subgenre 2"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="subgenre3" className="text-zinc-300">Subgenre 3</Label>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={subgenre3 || ''} onValueChange={(val) => setSubgenre3(val || undefined)}>
                    <SelectTrigger id="subgenre3" className="w-full bg-zinc-900 border-zinc-800 text-zinc-100">
                      <SelectValue placeholder="Select tertiary subgenre (optional)" />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-800">
                      <SelectItem value="_none" className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100">
                        None
                      </SelectItem>
                      {SUBGENRES.map((genre) => (
                        <SelectItem
                          key={genre}
                          value={genre}
                          className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                        >
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {subgenre3 && subgenre3 !== '_none' && (
                  <button
                    type="button"
                    onClick={clearSubgenre3}
                    style={{ padding: '6px', borderRadius: '6px', backgroundColor: '#7f1d1d', color: '#ef4444' }}
                    title="Clear subgenre 3"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* AI Reasoning - Read Only */}
          {song.ai_reasoning && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors group">
                <Label className="text-zinc-300 cursor-pointer">AI Reasoning</Label>
                <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-400">
                  {song.ai_reasoning}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* AI Context - Read Only */}
          {song.ai_context_used && (
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors group">
                <Label className="text-zinc-300 cursor-pointer">AI Context Used</Label>
                <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-400">
                  {song.ai_context_used}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Curator Notes */}
          <Collapsible open={notesOpen} onOpenChange={setNotesOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 bg-zinc-900 border border-zinc-800 rounded-md hover:bg-zinc-800 transition-colors group">
              <Label className="text-zinc-300 cursor-pointer">Curator Notes (Optional)</Label>
              <ChevronDown className="w-4 h-4 text-zinc-400 transition-transform group-data-[state=open]:rotate-180" />
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this classification... (useful for rejection reasons)"
                className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-24"
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Actions */}
          <div className="flex justify-between pt-4 border-t border-zinc-800">
            <Button
              onClick={onClose}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
            >
              Cancel
            </Button>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                variant="outline"
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
              >
                Save
              </Button>
              <Button
                onClick={handleSaveAndNext}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Save & Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
