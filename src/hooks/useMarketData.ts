'use client';

// ============================================================
// Hook for live market data with 30-second auto-refresh
// Includes graceful error recovery for Vercel deployments
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { CoinAnalysis, ScannerResponse } from '@/lib/types';
import { SupportedExchange } from '@/lib/exchangeMarket';

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';

const SCAN_BATCH_SIZE = 10;
const REFRESH_INTERVAL_MS = 30_000;

/** Fetch scanner data directly from Binance (used in static export mode) */
async function fetchFromBinance(): Promise<ScannerResponse> {
  const { getTopUSDTPairs, fetchKlines } = await import('@/lib/binance');
  const { analyzeCoin } = await import('@/lib/analyzer');

  const tickers = await getTopUSDTPairs(1000);
  const coins: CoinAnalysis[] = [];

  for (let i = 0; i < tickers.length; i += SCAN_BATCH_SIZE) {
    const batch = tickers.slice(i, i + SCAN_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (ticker) => {
        const candles = await fetchKlines(ticker.symbol, '1h', 100);
        return analyzeCoin(ticker, candles);
      })
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        coins.push(result.value);
      }
    }
  }

  coins.sort((a, b) => b.score - a.score);
  return { coins, timestamp: Date.now(), totalScanned: tickers.length };
}

export function useMarketData(selectedExchanges: SupportedExchange[] = ['binance']) {
  const [coins, setCoins] = useState<CoinAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number>(0);
  const [totalScanned, setTotalScanned] = useState(0);

  const fetchData = useCallback(async (customSymbols: string[] = []) => {
    try {
      setError(null);
      const exchangesParam = selectedExchanges.join(',');
      const data: ScannerResponse = isStaticExport
        ? await fetchFromBinance()
        : await fetch(`/api/scanner?exchanges=${encodeURIComponent(exchangesParam)}&limit=1000`).then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          });
      let mergedCoins = data.coins;

      if (!isStaticExport && customSymbols.length > 0) {
        const requestedSymbols = Array.from(
          new Set(
            customSymbols
              .map((symbol) => symbol.trim().toUpperCase())
              .filter((symbol) => symbol.length > 0)
              .map((symbol) => (symbol.endsWith('USDT') ? symbol : `${symbol}USDT`))
          )
        );

        if (requestedSymbols.length > 0) {
          const existing = new Set(mergedCoins.map((coin) => coin.symbol));
          const missingSymbols = requestedSymbols.filter((symbol) => !existing.has(symbol));

          if (missingSymbols.length > 0) {
            const customResults = await Promise.allSettled(
              missingSymbols.map(async (symbol) => {
                const res = await fetch(
                  `/api/coins/search?symbol=${encodeURIComponent(symbol)}&limit=1&exchanges=${encodeURIComponent(exchangesParam)}`,
                  { cache: 'no-store' }
                );
                if (!res.ok) return null;
                const payload = (await res.json()) as { coins?: CoinAnalysis[] };
                return payload.coins?.[0] ?? null;
              })
            );

            const customCoins = customResults
              .filter((item): item is PromiseFulfilledResult<CoinAnalysis | null> => item.status === 'fulfilled')
              .map((item) => item.value)
              .filter((item): item is CoinAnalysis => item != null);

            if (customCoins.length > 0) {
              mergedCoins = [...mergedCoins, ...customCoins];
            }
          }
        }
      }

      setCoins(mergedCoins);
      setLastUpdated(data.timestamp);
      setTotalScanned(Math.max(data.totalScanned, mergedCoins.length));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [selectedExchanges]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [fetchData]);

  return { coins, loading, error, lastUpdated, totalScanned, refetch: fetchData };
}
