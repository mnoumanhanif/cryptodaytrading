'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { SupportedExchange } from '@/lib/exchangeMarket';

type AddTargets = {
  scanner: boolean;
  watchlist: boolean;
  signals: boolean;
};

interface AddMarketPairModalProps {
  isOpen: boolean;
  selectedExchanges: SupportedExchange[];
  isFull: boolean;
  onClose: () => void;
  onAddCoin: (coin: CoinAnalysis, targets: AddTargets) => void;
}

function getCoinTag(coin: CoinAnalysis): string | null {
  if (coin.volume24h >= 1_000_000_000) return '🔥 High Volume';
  if (Math.abs(coin.priceChangePercent) >= 8) return '⚡ Trending';
  if (coin.tradeSignal.confidence >= 78 || coin.score >= 78) return '🧠 Strong Signal';
  return null;
}

export default function AddMarketPairModal({
  isOpen,
  selectedExchanges,
  isFull,
  onClose,
  onAddCoin,
}: AddMarketPairModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CoinAnalysis[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<CoinAnalysis | null>(null);
  const [targets, setTargets] = useState<AddTargets>({
    scanner: true,
    watchlist: true,
    signals: true,
  });

  useEffect(() => {
    if (!isOpen) return;
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onEsc);
    return () => document.removeEventListener('keydown', onEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults([]);
      setLoading(false);
      setError(null);
      setSelectedCoin(null);
      setTargets({ scanner: true, watchlist: true, signals: true });
    }
  }, [isOpen]);

  const runSearch = useCallback(
    async (value: string) => {
      const normalized = value.trim().toUpperCase();
      if (!normalized) {
        setResults([]);
        setError(null);
        setSelectedCoin(null);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const exchangesParam = selectedExchanges.join(',');
        const response = await fetch(
          `/api/coins/search?q=${encodeURIComponent(normalized)}&limit=20&exchanges=${encodeURIComponent(exchangesParam)}`,
          { cache: 'no-store' }
        );
        if (!response.ok) {
          throw new Error(`Search failed (${response.status})`);
        }
        const data = (await response.json()) as { coins?: CoinAnalysis[] };
        const list = data.coins ?? [];
        setResults(list);
        if (!list.some((coin) => coin.symbol === selectedCoin?.symbol)) {
          setSelectedCoin(null);
        }
      } catch (searchError) {
        setResults([]);
        setSelectedCoin(null);
        setError(searchError instanceof Error ? searchError.message : 'Search failed');
      } finally {
        setLoading(false);
      }
    },
    [selectedCoin?.symbol, selectedExchanges]
  );

  const hasValidTargets = useMemo(
    () => targets.scanner || targets.watchlist || targets.signals,
    [targets]
  );

  const handleAdd = () => {
    if (!selectedCoin || !hasValidTargets || isFull) return;
    onAddCoin(selectedCoin, targets);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4" onClick={onClose} role="presentation">
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">🔍 Add Market Pair</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-gray-400 hover:text-white hover:bg-gray-800"
            aria-label="Close add market pair modal"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(90vh-130px)]">
          <div>
            <label className="block text-xs text-gray-400 mb-2">
              Search any symbol (e.g., BTCUSDT, PEPEUSDT)
            </label>
            <input
              type="text"
              value={query}
              onChange={(event) => {
                const nextValue = event.target.value;
                setQuery(nextValue);
                runSearch(nextValue);
              }}
              placeholder="Search any symbol..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_1px_#06b6d4]"
            />
          </div>

          {isFull && (
            <div className="rounded-lg border border-yellow-600/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
              Custom pair limit reached (100). Remove existing custom pairs before adding more.
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-600/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs text-gray-400">Live Results</p>
            {loading && <div className="text-sm text-gray-500 py-2">Searching market pairs…</div>}
            {!loading && query.trim() !== '' && results.length === 0 && !error && (
              <div className="text-sm text-gray-500 py-2">No matching pairs found.</div>
            )}
            {!loading &&
              results.map((coin) => {
                const isSelected = selectedCoin?.symbol === coin.symbol;
                const tag = getCoinTag(coin);
                return (
                  <button
                    key={coin.symbol}
                    type="button"
                    onClick={() => setSelectedCoin(coin)}
                    className={`w-full rounded-lg border px-3 py-2 text-left transition-colors ${
                      isSelected
                        ? 'border-cyan-500 bg-cyan-500/10'
                        : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{coin.symbol}</span>
                      {tag && (
                        <span className="text-[11px] rounded border border-cyan-600/30 bg-cyan-600/10 px-1.5 py-0.5 text-cyan-200">
                          {tag}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      ${coin.price.toFixed(coin.price >= 1 ? 2 : 6)} · Vol {Math.round(coin.volume24h).toLocaleString()} · {coin.signal}
                    </p>
                  </button>
                );
              })}
          </div>

          {selectedCoin && (
            <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-3 space-y-3">
              <p className="text-sm font-semibold text-white">Add {selectedCoin.symbol} to:</p>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={targets.scanner}
                  onChange={(event) => setTargets((prev) => ({ ...prev, scanner: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                />
                Scanner
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={targets.watchlist}
                  onChange={(event) => setTargets((prev) => ({ ...prev, watchlist: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                />
                Watchlist
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-200">
                <input
                  type="checkbox"
                  checked={targets.signals}
                  onChange={(event) => setTargets((prev) => ({ ...prev, signals: event.target.checked }))}
                  className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                />
                Signals
              </label>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded border border-gray-700 text-gray-300 hover:border-gray-600 text-sm font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!selectedCoin || isFull || !hasValidTargets}
            className="px-4 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
          >
            Add Coin
          </button>
        </div>
      </div>
    </div>
  );
}

