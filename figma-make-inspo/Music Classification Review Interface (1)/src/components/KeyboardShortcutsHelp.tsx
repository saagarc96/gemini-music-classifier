import { Keyboard } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Button } from './ui/button';

interface ShortcutItem {
  keys: string[];
  description: string;
}

const shortcuts: ShortcutItem[] = [
  { keys: ['Enter'], description: 'Open review modal for selected song' },
  { keys: ['Escape'], description: 'Close modal or clear search' },
  { keys: ['→'], description: 'Next song in review modal' },
  { keys: ['←'], description: 'Previous song in review modal' },
  { keys: ['Ctrl/Cmd', 'S'], description: 'Save current review' },
  { keys: ['Ctrl/Cmd', 'Enter'], description: 'Save & go to next song' },
  { keys: ['/'], description: 'Focus search bar' },
  { keys: ['?'], description: 'Show keyboard shortcuts' },
];

export function KeyboardShortcutsHelp() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Keyboard className="w-4 h-4" />
          Shortcuts
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-zinc-950 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {shortcuts.map((shortcut, idx) => (
            <div key={idx} className="flex items-center justify-between gap-4">
              <span className="text-sm text-zinc-400">{shortcut.description}</span>
              <div className="flex gap-1">
                {shortcut.keys.map((key, keyIdx) => (
                  <kbd
                    key={keyIdx}
                    className="px-2 py-1 text-xs rounded bg-zinc-900 border border-zinc-700 text-zinc-300"
                  >
                    {key}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
