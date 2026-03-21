'use client';

// ============================================================
// Coin filter bar – search, sort, signal filter, custom pair search
// ============================================================

import { useState, useRef } from 'react';
import { SignalFilter, SortField } from '@/hooks/useCoinSearch';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  signalFilter: SignalFilter;
  onSignalFilterChange: (f: SignalFilter) => void;
  sortBy: SortField;
  onSortChange: (s: SortField) => void;
  onSearch: (q: string) => void;
  onSearchExact: (symbol: string) => void;
  searching: boolean;
  searchError: string | null;
  hasSearchResults: boolean;
  onClearSearch: () => void;
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
  onSearch,
  onSearchExact,
  searching,
  searchError,
  hasSearchResults,
  onClearSearch,
}: Props) {
  const [customPair, setCustomPair] = useState('');
  const [showCustomSearch, setShowCustomSearch] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQuery = (val: string) => {
    onQueryChange(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (val.trim().length >= 2) onSearch(val.trim());
      else if (!val.trim()) onClearSearch();
    }, 400);
  };

  const handleCustomSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const sym = customPair.trim().toUpperCase();
    if (!sym) return;
    onSearchExact(sym.endsWith('USDT') ? sym : `${sym}USDT`);
  };

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
            placeholder="Filter coins (e.g. BTC, ETH)…"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

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

        {/* Custom pair toggle */}
        <button
          onClick={() => setShowCustomSearch((p) => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium rounded-lg transition-colors"
          title="Search any USDT pair beyond top 100"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Any Pair
        </button>

        {/* Clear search results */}
        {hasSearchResults && (
          <button
            onClick={onClearSearch}
            className="px-2.5 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-lg transition-colors"
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* Row 2 – custom pair search (hidden by default) */}
      {showCustomSearch && (
        <form
          onSubmit={handleCustomSearch}
          className="flex items-center gap-2 p-3 bg-purple-900/20 border border-purple-500/30 rounded-lg"
        >
          <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs text-purple-300 hidden sm:inline">Search any USDT pair:</span>
          <input
            type="text"
            placeholder="e.g. PEPE, SHIB, ORDI…"
            value={customPair}
            onChange={(e) => setCustomPair(e.target.value)}
            className="flex-1 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={searching || !customPair.trim()}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white text-xs rounded transition-colors"
          >
            {searching ? 'Searching…' : 'Search'}
          </button>
        </form>
      )}

      {searchError && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-3 py-1.5">
          ⚠ {searchError}
        </div>
      )}
    </div>
  );
}
