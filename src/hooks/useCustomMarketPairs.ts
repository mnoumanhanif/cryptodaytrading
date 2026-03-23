'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CustomMarketPair } from '@/lib/types';

const STORAGE_KEY = 'crypto-custom-market-pairs';
const MAX_CUSTOM_COINS = 100;

function loadPairs(): CustomMarketPair[] {
  if (typeof window === 'undefined') return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = stored ? (JSON.parse(stored) as CustomMarketPair[]) : [];
    return parsed.filter((pair) => typeof pair.symbol === 'string');
  } catch {
    return [];
  }
}

function savePairs(pairs: CustomMarketPair[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
}

function normalizeSymbol(rawSymbol: string): string {
  const cleaned = rawSymbol.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!cleaned) return '';
  return cleaned.endsWith('USDT') ? cleaned : `${cleaned}USDT`;
}

export function useCustomMarketPairs() {
  const [pairs, setPairs] = useState<CustomMarketPair[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setPairs(loadPairs());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    savePairs(pairs);
  }, [pairs, mounted]);

  const addPair = useCallback((symbol: string, targets: Omit<CustomMarketPair, 'symbol' | 'addedAt'>) => {
    const normalized = normalizeSymbol(symbol);
    if (!normalized) return;
    setPairs((prev) => {
      if (prev.some((item) => item.symbol === normalized)) return prev;
      if (prev.length >= MAX_CUSTOM_COINS) return prev;
      return [
        ...prev,
        {
          symbol: normalized,
          addedAt: Date.now(),
          scanner: targets.scanner,
          watchlist: targets.watchlist,
          signals: targets.signals,
        },
      ];
    });
  }, []);

  const removePair = useCallback((symbol: string) => {
    const normalized = normalizeSymbol(symbol);
    setPairs((prev) => prev.filter((item) => item.symbol !== normalized));
  }, []);

  const hasPair = useCallback(
    (symbol: string) => {
      const normalized = normalizeSymbol(symbol);
      return pairs.some((item) => item.symbol === normalized);
    },
    [pairs]
  );

  const scannerSymbols = useMemo(() => pairs.filter((item) => item.scanner).map((item) => item.symbol), [pairs]);
  const signalsSymbols = useMemo(() => pairs.filter((item) => item.signals).map((item) => item.symbol), [pairs]);
  const watchlistSymbols = useMemo(() => pairs.filter((item) => item.watchlist).map((item) => item.symbol), [pairs]);

  return {
    pairs,
    addPair,
    removePair,
    hasPair,
    scannerSymbols,
    signalsSymbols,
    watchlistSymbols,
    count: pairs.length,
    max: MAX_CUSTOM_COINS,
    isFull: pairs.length >= MAX_CUSTOM_COINS,
  };
}
