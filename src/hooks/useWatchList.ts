'use client';

// ============================================================
// Hook for managing watchlist state with localStorage persistence
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { WatchListItem, CoinAnalysis } from '@/lib/types';

const STORAGE_KEY = 'crypto-watchlist';

function loadWatchlist(): WatchListItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: WatchListItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useWatchList() {
  const [items, setItems] = useState<WatchListItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadWatchlist());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveWatchlist(items);
    }
  }, [items, mounted]);

  const addCoin = useCallback((coin: CoinAnalysis) => {
    setItems((prev) => {
      if (prev.find((item) => item.symbol === coin.symbol)) return prev;
      return [
        ...prev,
        {
          symbol: coin.symbol,
          entryPrice: coin.price,
          addedAt: Date.now(),
          targetPrice: coin.risk.targetPrice,
          stopLoss: coin.risk.stopLoss,
        },
      ];
    });
  }, []);

  const removeCoin = useCallback((symbol: string) => {
    setItems((prev) => prev.filter((item) => item.symbol !== symbol));
  }, []);

  const isWatching = useCallback(
    (symbol: string) => items.some((item) => item.symbol === symbol),
    [items]
  );

  return { items, addCoin, removeCoin, isWatching, mounted };
}
