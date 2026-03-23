'use client';

// ============================================================
// Coin filter bar – local search, sort, signal filter
// Supports expanded API search for coins not in local list
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { SignalFilter, SortField } from '@/hooks/useCoinSearch';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  signalFilter: SignalFilter;
  onSignalFilterChange: (f: SignalFilter) => void;
  sortBy: SortField;
  onSortChange: (s: SortField) => void;
  // Expanded search props
  onApiSearch?: (query: string) => void;
  apiSearching?: boolean;
  apiResultCount?: number;
  localResultCount?: number;
}

const SIGNALS: SignalFilter[] = ['ALL', 'BUY', 'HOLD', 'SELL'];
const SORTS: { value: SortField; label: string }[] = [
  { value: 'score', label: 'Score' },
  { value: 'change', label: '% Change' },
  { value: 'volume', label: 'Volume' },
];

export default function CoinFilter({
  query,
  onQueryChange,
  signalFilter,
  onSignalFilterChange,
  sortBy,
  onSortChange,
  onApiSearch,
  apiSearching,
  apiResultCount,
  localResultCount,
}: Props) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);
  const [hasSearchedApi, setHasSearchedApi] = useState(false);

  const handleQuery = (val: string) => {
    onQueryChange(val);
    setHasSearchedApi(false);
  };

  // Debounce the API search - auto-trigger after 600ms of no typing
  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      setHasSearchedApi(false);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 600);

    return () => clearTimeout(timer);
  }, [query]);

  // Auto-trigger API search when debounced query changes and local results are low
  useEffect(() => {
    if (
      debouncedQuery.trim() &&
      onApiSearch &&
      !hasSearchedApi &&
      (localResultCount === 0 || (localResultCount !== undefined && localResultCount < 3))
    ) {
      onApiSearch(debouncedQuery);
      setHasSearchedApi(true);
    }
  }, [debouncedQuery, onApiSearch, hasSearchedApi, localResultCount]);

  const handleManualApiSearch = useCallback(() => {
    if (query.trim() && onApiSearch) {
      onApiSearch(query);
      setHasSearchedApi(true);
    }
  }, [query, onApiSearch]);

  const showSearchButton = query.trim().length >= 2 && onApiSearch;

  return (
    <div className="space-y-3">
      {/* Row 1 – text search + signal filter + sort */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search input */}
        <div className="relative flex-1 min-w-48">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search any coin (e.g. RIVER, BTC)"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && showSearchButton) {
                handleManualApiSearch();
              }
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:shadow-[0_0_0_1px_#22c55e]"
          />
        </div>

        {/* Search from exchange button */}
        {showSearchButton && (
          <button
            type="button"
            onClick={handleManualApiSearch}
            disabled={apiSearching}
            className="px-3 py-2 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {apiSearching ? (
              <>
                <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search Exchange
              </>
            )}
          </button>
        )}

        {/* Signal filter */}
        <div className="flex gap-1">
          {SIGNALS.map((s) => {
            const active = signalFilter === s;
            const color =
              s === 'BUY'
                ? active ? 'bg-green-600 text-white' : 'text-green-400'
                : s === 'SELL'
                ? active ? 'bg-red-600 text-white' : 'text-red-400'
                : s === 'HOLD'
                ? active ? 'bg-yellow-600 text-white' : 'text-yellow-400'
                : active ? 'bg-gray-600 text-white' : 'text-gray-400';
            return (
              <button
                key={s}
                onClick={() => onSignalFilterChange(s)}
                className={`px-2.5 py-1 text-xs font-medium rounded-lg border border-gray-700 hover:border-gray-500 transition-colors ${color}`}
              >
                {s}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 text-xs text-gray-400">
          <span className="hidden sm:inline">Sort:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => onSortChange(s.value)}
              className={`px-2 py-1 rounded transition-colors ${
                sortBy === s.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
