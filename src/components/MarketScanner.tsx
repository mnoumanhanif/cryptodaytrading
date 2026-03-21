'use client';

// ============================================================
// Market scanner – list of scanned coin cards
// Filtering/sorting is handled at the Dashboard level via CoinFilter
// ============================================================

import { CoinAnalysis } from '@/lib/types';
import CoinCard from './CoinCard';

interface MarketScannerProps {
  coins: CoinAnalysis[];
  loading: boolean;
  onAddToWatchlist: (coin: CoinAnalysis) => void;
  isWatching: (symbol: string) => boolean;
}

export default function MarketScanner({
  coins,
  loading,
  onAddToWatchlist,
  isWatching,
}: MarketScannerProps) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-20 bg-gray-800/40 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (!coins.length) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm">No coins match your current filters.</p>
        <p className="text-xs mt-1 text-gray-600">Try adjusting the search or filter criteria.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Results count */}
      <div className="text-xs text-gray-500 mb-3">
        Showing {coins.length} coin{coins.length !== 1 ? 's' : ''}
      </div>

      {/* Coin cards */}
      <div className="space-y-2">
        {coins.map((coin) => (
          <CoinCard
            key={coin.symbol}
            coin={coin}
            onAdd={() => onAddToWatchlist(coin)}
            isWatching={isWatching(coin.symbol)}
          />
        ))}
      </div>
    </div>
  );
}
