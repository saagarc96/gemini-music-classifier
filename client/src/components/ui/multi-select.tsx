"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon, XIcon } from "lucide-react";

import { cn } from "./utils";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Badge } from "./badge";

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  className?: string;
  maxDisplayedItems?: number;
}

export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  className,
  maxDisplayedItems = 2,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((item) => item !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const handleRemove = (e: React.MouseEvent, value: string) => {
    e.stopPropagation();
    onChange(selected.filter((item) => item !== value));
  };

  // Get labels for selected values
  const selectedLabels = selected
    .map((value) => options.find((opt) => opt.value === value)?.label || value)
    .filter(Boolean);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 min-h-9",
            "bg-zinc-950 border-zinc-700 text-zinc-100",
            "focus-visible:border-ring focus-visible:ring-ring/50",
            className
          )}
        >
          <div className="flex flex-1 flex-wrap gap-1 overflow-hidden">
            {selected.length === 0 ? (
              <span className="text-zinc-500">{placeholder}</span>
            ) : selected.length <= maxDisplayedItems ? (
              selectedLabels.map((label, index) => (
                <Badge
                  key={selected[index]}
                  variant="secondary"
                  className="text-xs px-1.5 py-0 h-5 bg-zinc-700 text-zinc-200 border-zinc-600 hover:bg-zinc-600"
                >
                  {label}
                  <button
                    type="button"
                    className="ml-1 rounded-full outline-none hover:text-zinc-100"
                    onClick={(e) => handleRemove(e, selected[index])}
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </Badge>
              ))
            ) : (
              <Badge
                variant="secondary"
                className="text-xs px-1.5 py-0 h-5 bg-zinc-700 text-zinc-200 border-zinc-600"
              >
                {selected.length} selected
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            {selected.length > 0 && (
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-zinc-700"
                onClick={handleClear}
              >
                <XIcon className="h-3.5 w-3.5 text-zinc-400 hover:text-zinc-200" />
              </button>
            )}
            <ChevronDownIcon className="h-4 w-4 opacity-50" />
          </div>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-zinc-900 border-zinc-700"
        align="start"
      >
        <Command className="bg-zinc-900">
          <CommandInput
            placeholder={searchPlaceholder}
            className="text-zinc-100 placeholder:text-zinc-500"
          />
          <CommandList className="max-h-60">
            <CommandEmpty className="text-zinc-500">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="text-zinc-100 cursor-pointer aria-selected:bg-zinc-700"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-zinc-600 bg-transparent"
                      )}
                    >
                      {isSelected && <CheckIcon className="h-3 w-3 stroke-[4] text-white" style={{ filter: 'drop-shadow(0 0 1px white)' }} />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
