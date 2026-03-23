'use client';

// ============================================================
// Coin filter bar – local search, sort, signal filter
// ============================================================

import { SignalFilter, SortField } from '@/hooks/useCoinSearch';

interface Props {
  query: string;
  onQueryChange: (q: string) => void;
  signalFilter: SignalFilter;
  onSignalFilterChange: (f: SignalFilter) => void;
  sortBy: SortField;
  onSortChange: (s: SortField) => void;
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
}: Props) {
  const handleQuery = (val: string) => {
    onQueryChange(val);
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
            placeholder="Filter current results (e.g. BTC, ETH)"
            value={query}
            onChange={(e) => handleQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:shadow-[0_0_0_1px_#22c55e]"
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
      </div>
    </div>
  );
}
