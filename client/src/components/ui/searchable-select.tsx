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

export interface SearchableSelectOption {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: SearchableSelectOption[];
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  allowClear?: boolean;
  className?: string;
}

export function SearchableSelect({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  allowClear = false,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (selectedValue: string) => {
    onChange(selectedValue);
    setOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
  };

  // Get label for selected value
  const selectedLabel = value
    ? options.find((opt) => opt.value === value)?.label || value
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 h-9 min-h-9",
            "bg-zinc-900 border-zinc-800 text-zinc-100",
            "focus-visible:border-ring focus-visible:ring-ring/50",
            className
          )}
        >
          <span className={cn("truncate", !selectedLabel && "text-zinc-500")}>
            {selectedLabel || placeholder}
          </span>
          <div className="flex items-center gap-1">
            {allowClear && value && (
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
        side="bottom"
        sideOffset={4}
        avoidCollisions={false}
      >
        <Command className="bg-zinc-900 flex flex-col" style={{ maxHeight: '250px' }}>
          <CommandInput
            placeholder={searchPlaceholder}
            className="text-zinc-100 placeholder:text-zinc-500 shrink-0"
          />
          <CommandList
            className="flex-1 overflow-y-auto overflow-x-hidden"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#52525b #27272a', minHeight: 0 }}
          >
            <CommandEmpty className="text-zinc-500">{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {(options || []).map((option) => {
                const isSelected = value === option.value;
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => handleSelect(option.value)}
                    className="text-zinc-100 cursor-pointer aria-selected:bg-zinc-700"
                  >
                    <div
                      className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-full border",
                        isSelected
                          ? "bg-blue-600 border-blue-600"
                          : "border-zinc-600 bg-transparent"
                      )}
                    >
                      {isSelected && (
                        <CheckIcon
                          className="h-3 w-3 stroke-[4] text-white"
                          style={{ filter: "drop-shadow(0 0 1px white)" }}
                        />
                      )}
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
