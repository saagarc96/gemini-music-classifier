import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { Dialog, DialogContent } from './ui/dialog';
import { AudioPlayer } from './AudioPlayer';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Button } from './ui/button';
import { Song } from '../lib/api';
import { ENERGY_LEVELS, ACCESSIBILITY_TYPES, SUBGENRES } from '../data/constants';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface ReviewModalProps {
  song: Song | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (songId: number, updates: Partial<Song>) => void;
  onNext: () => void;
}

export function ReviewModal({ song, isOpen, onClose, onSave, onNext }: ReviewModalProps) {
  const [energy, setEnergy] = useState<string | undefined>(undefined);
  const [accessibility, setAccessibility] = useState<string | undefined>(undefined);
  const [subgenre1, setSubgenre1] = useState<string | undefined>(undefined);
  const [subgenre2, setSubgenre2] = useState<string | undefined>(undefined);
  const [subgenre3, setSubgenre3] = useState<string | undefined>(undefined);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (song) {
      setEnergy(song.ai_energy && song.ai_energy.trim() !== '' ? song.ai_energy : undefined);
      setAccessibility(song.ai_accessibility && song.ai_accessibility.trim() !== '' ? song.ai_accessibility : undefined);
      setSubgenre1(song.ai_subgenre_1 && song.ai_subgenre_1.trim() !== '' ? song.ai_subgenre_1 : undefined);
      setSubgenre2(song.ai_subgenre_2 && song.ai_subgenre_2.trim() !== '' ? song.ai_subgenre_2 : undefined);
      setSubgenre3(song.ai_subgenre_3 && song.ai_subgenre_3.trim() !== '' ? song.ai_subgenre_3 : undefined);
      setNotes(song.curator_notes || '');
    }
  }, [song]);

  const handleSave = () => {
    if (!song) return;

    onSave(song.id, {
      ai_energy: energy || '',
      ai_accessibility: accessibility || '',
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
      ai_subgenre_1: subgenre1 || '',
      ai_subgenre_2: (subgenre2 && subgenre2 !== '_none') ? subgenre2 : null,
      ai_subgenre_3: (subgenre3 && subgenre3 !== '_none') ? subgenre3 : null,
      curator_notes: notes || null,
      reviewed: true,
      reviewed_at: new Date().toISOString(),
    });
    onNext();
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

          {/* Audio Player */}
          <AudioPlayer
            src={song.source_file}
            title={song.title}
            artist={song.artist}
          />

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
              <Select value={subgenre2 || ''} onValueChange={(val) => setSubgenre2(val || undefined)}>
                <SelectTrigger id="subgenre2" className="bg-zinc-900 border-zinc-800 text-zinc-100">
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

            <div className="space-y-2">
              <Label htmlFor="subgenre3" className="text-zinc-300">Subgenre 3</Label>
              <Select value={subgenre3 || ''} onValueChange={(val) => setSubgenre3(val || undefined)}>
                <SelectTrigger id="subgenre3" className="bg-zinc-900 border-zinc-800 text-zinc-100">
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
          </div>

          {/* AI Reasoning - Read Only */}
          {song.ai_reasoning && (
            <div className="space-y-2">
              <Label className="text-zinc-300">AI Reasoning</Label>
              <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-400">
                {song.ai_reasoning}
              </div>
            </div>
          )}

          {/* AI Context - Read Only */}
          {song.ai_context_used && (
            <div className="space-y-2">
              <Label className="text-zinc-300">AI Context Used</Label>
              <div className="bg-zinc-900 border border-zinc-800 rounded-md p-3 text-sm text-zinc-400">
                {song.ai_context_used}
              </div>
            </div>
          )}

          {/* Curator Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-zinc-300">Curator Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this classification..."
              className="bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-600 min-h-24"
            />
          </div>

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
