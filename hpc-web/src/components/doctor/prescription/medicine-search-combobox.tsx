"use client";

import * as React from "react";
import {
  Search,
  Pill,
  Check,
  X,
  Loader2,
  AlertCircle,
  Sparkles,
  Building2,
  Clock,
  Utensils,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  searchPrescriptionMedicinesAction,
  type PrescriptionMedicineDirectoryItem,
} from "@/actions/doctor/medicine-search.action";
import { cn } from "@/lib/utils";

interface MedicineSearchComboboxProps {
  value: string;
  onSelect: (item: PrescriptionMedicineDirectoryItem) => void;
  onClear: () => void;
  disabled?: boolean;
}

export function MedicineSearchCombobox({
  value,
  onSelect,
  onClear,
  disabled = false,
}: MedicineSearchComboboxProps) {
  const [query, setQuery] = React.useState("");
  const [isOpen, setIsOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(false);
  const [results, setResults] = React.useState<PrescriptionMedicineDirectoryItem[]>([]);
  const [selectedMeta, setSelectedMeta] = React.useState<PrescriptionMedicineDirectoryItem | null>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

  // Search medicines with debouncing
  const performSearch = React.useCallback(async (searchTerm: string) => {
    setIsLoading(true);
    try {
      const res = await searchPrescriptionMedicinesAction(searchTerm, 20);
      if (res.success && res.data) {
        setResults(res.data);
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load when opened
  React.useEffect(() => {
    if (isOpen && results.length === 0 && !query) {
      performSearch("");
    }
  }, [isOpen, results.length, query, performSearch]);

  // Debounced search on query change
  React.useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      performSearch(query);
    }, 200);
    return () => clearTimeout(timer);
  }, [query, isOpen, performSearch]);

  // Handle clicking outside to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelectItem = (item: PrescriptionMedicineDirectoryItem) => {
    setSelectedMeta(item);
    onSelect(item);
    setIsOpen(false);
    setQuery("");
  };

  const handleClear = () => {
    setSelectedMeta(null);
    onClear();
    setQuery("");
    setIsOpen(false);
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // If a medicine has been selected from directory
  if (value) {
    return (
      <div className="flex items-center justify-between gap-2 p-2 px-3 rounded-lg border border-sky-500/30 bg-sky-500/5 transition-all">
        <div className="flex items-center gap-2 min-w-0">
          <div className="size-6 rounded-md bg-sky-500/10 text-sky-600 flex items-center justify-center shrink-0 border border-sky-500/20">
            <Pill className="size-3.5" />
          </div>
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-foreground tracking-tight truncate">
              {value}
            </span>
            {selectedMeta?.genericName && (
              <span className="text-[11px] text-muted-foreground truncate hidden sm:inline">
                ({selectedMeta.genericName})
              </span>
            )}
            {selectedMeta?.company && (
              <span className="text-[10px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.2 rounded font-mono truncate hidden md:inline">
                {selectedMeta.company}
              </span>
            )}
            <Badge
              variant="outline"
              className="text-[9.5px] px-1.5 py-0 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 shrink-0"
            >
              <Check className="size-2.5" />
              <span>Verified Directory Item</span>
            </Badge>
          </div>
        </div>

        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={handleClear}
          disabled={disabled}
          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer shrink-0 gap-1 rounded"
          title="Change or reselect medicine"
        >
          <X className="size-3" />
          <span>Change</span>
        </Button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
        <Input
          ref={searchInputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search medicine directory (e.g. Tab. Ace Plus, Napa, Maxpro, Tolperisone)..."
          disabled={disabled}
          className="h-9 pl-8 pr-8 text-xs font-medium rounded-lg border-muted-foreground/30 focus-visible:ring-sky-500"
        />
        {isLoading ? (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-sky-500 animate-spin" />
        ) : query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              searchInputRef.current?.focus();
            }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </div>

      {/* Floating Suggestions Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 max-h-64 overflow-y-auto rounded-xl border border-border bg-popover text-popover-foreground shadow-xl">
          <div className="p-1.5 border-b border-border/60 bg-muted/30 flex items-center justify-between text-[11px] text-muted-foreground px-2.5">
            <span className="font-semibold flex items-center gap-1.5 text-sky-600 dark:text-sky-400">
              <Pill className="size-3" />
              <span>Select from Master Medicine Directory</span>
            </span>
            <span className="text-[10px]">
              {results.length} available
            </span>
          </div>

          {isLoading && results.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Loader2 className="size-4 animate-spin text-sky-500" />
              <span>Searching medicine directory...</span>
            </div>
          ) : results.length > 0 ? (
            <div className="p-1 space-y-0.5">
              {results.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectItem(item)}
                  className="w-full text-left p-2 rounded-lg hover:bg-accent/80 transition-colors flex items-start justify-between gap-3 cursor-pointer group"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {item.form && (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20 uppercase">
                          {item.form}
                        </span>
                      )}
                      <span className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">
                        {item.name}
                      </span>
                      {item.strength && (
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {item.strength}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {item.genericName && (
                        <span className="truncate max-w-[200px]">
                          {item.genericName}
                        </span>
                      )}
                      {item.company && (
                        <>
                          <span className="text-muted-foreground/40">•</span>
                          <span className="truncate max-w-[150px] flex items-center gap-0.5">
                            <Building2 className="size-2.5" />
                            {item.company}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Presets preview */}
                    <div className="flex items-center gap-2 pt-0.5 text-[10px] text-sky-700/80 dark:text-sky-300/80">
                      <span className="flex items-center gap-0.5">
                        <Utensils className="size-2.5" />
                        {item.defaultMealTiming === "BEFORE" ? "Before Meal" : "After Meal"}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="size-2.5" />
                        {item.defaultTimes.join(", ")}
                      </span>
                      <span>•</span>
                      <span>{item.defaultDuration}</span>
                    </div>
                  </div>

                  <div className="shrink-0 pt-1">
                    <span className="text-[10.5px] font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
                      Select
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-4 text-center space-y-2">
              <div className="size-8 rounded-full bg-amber-500/10 text-amber-600 mx-auto flex items-center justify-center">
                <AlertCircle className="size-4" />
              </div>
              <div className="text-xs font-semibold text-foreground">
                No medicine found for &quot;{query}&quot;
              </div>
              <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                Doctor prescribing requires verified master directory items for accurate performance reporting. Please ask Admin to add &quot;{query}&quot; to the Medicine Directory.
              </p>
            </div>
          ) : (
            <div className="p-4 text-center text-xs text-muted-foreground">
              Type medicine brand or generic name to search.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
