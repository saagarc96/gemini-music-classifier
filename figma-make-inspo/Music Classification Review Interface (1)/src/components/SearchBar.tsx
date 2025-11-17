import { forwardRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from './ui/input';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  ({ value, onChange, placeholder = "Search by title, artist, or ISRC..." }, ref) => {
    return (
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <Input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pl-10 pr-24 bg-zinc-900 border-zinc-800 text-zinc-100 placeholder:text-zinc-500"
        />
        {!value && (
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 px-2 py-1 text-xs rounded bg-zinc-800 border border-zinc-700 text-zinc-500">
            /
          </kbd>
        )}
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    );
  }
);

SearchBar.displayName = 'SearchBar';
