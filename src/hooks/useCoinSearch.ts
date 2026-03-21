'use client';

// ============================================================
// Hook for searching & filtering coins (client-side + API)
// ============================================================

import { useState, useCallback, useTransition } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { SupportedExchange } from '@/lib/exchangeMarket';

export type SortField = 'score' | 'change' | 'volume';
export type SignalFilter = 'ALL' | 'BUY' | 'SELL' | 'HOLD';

export interface SearchState {
  query: string;
  signalFilter: SignalFilter;
  sortBy: SortField;
  searchResults: CoinAnalysis[];
  searching: boolean;
  searchError: string | null;
}

/**
 * Filter and sort a list of coins client-side.
 */
export function filterCoins(
  coins: CoinAnalysis[],
  query: string,
  signalFilter: SignalFilter,
  sortBy: SortField
): CoinAnalysis[] {
  let filtered = coins;

  if (query.trim()) {
    const q = query.toUpperCase().replace('USDT', '');
    filtered = filtered.filter((c) => c.symbol.replace('USDT', '').includes(q));
  }

  if (signalFilter !== 'ALL') {
    filtered = filtered.filter((c) => c.signal === signalFilter);
  }

  switch (sortBy) {
    case 'change':
      return [...filtered].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    case 'volume':
      return [...filtered].sort((a, b) => b.volume24h - a.volume24h);
    case 'score':
    default:
      return [...filtered].sort((a, b) => b.score - a.score);
  }
}

/**
 * Hook that provides search state and a function to search for any USDT pair
 * beyond the top 100 list via the /api/coins/search endpoint.
 */
export function useCoinSearch() {
  const [searchResults, setSearchResults] = useState<CoinAnalysis[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const searchCoins = useCallback(async (query: string, exchanges?: SupportedExchange[]) => {
    const q = query.trim().toUpperCase();
    if (!q) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    setSearchError(null);
    try {
      const exchangesParam = exchanges && exchanges.length > 0 ? `&exchanges=${encodeURIComponent(exchanges.join(','))}` : '';
      const res = await fetch(`/api/coins/search?q=${encodeURIComponent(q)}&limit=50${exchangesParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const coins = data.coins ?? [];
      startTransition(() => setSearchResults(coins));
      return coins as CoinAnalysis[];
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
      return [] as CoinAnalysis[];
    } finally {
      setSearching(false);
    }
  }, []);

  const searchExact = useCallback(async (symbol: string, exchanges?: SupportedExchange[]) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return [] as CoinAnalysis[];

    setSearching(true);
    setSearchError(null);
    try {
      const exchangesParam = exchanges && exchanges.length > 0 ? `&exchanges=${encodeURIComponent(exchanges.join(','))}` : '';
      const res = await fetch(`/api/coins/search?symbol=${encodeURIComponent(s)}${exchangesParam}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const coins = data.coins ?? [];
      startTransition(() => setSearchResults(coins));
      return coins as CoinAnalysis[];
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
      return [] as CoinAnalysis[];
    } finally {
      setSearching(false);
    }
  }, []);

  return { searchResults, searching, searchError, searchCoins, searchExact };
}
