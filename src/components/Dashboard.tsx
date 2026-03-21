'use client';

// ============================================================
// Main dashboard layout with tabbed navigation:
//   Heatmap | Scanner | Top 500 | Watchlist
// ============================================================

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { useWatchList } from '@/hooks/useWatchList';
import { useCoinSearch, filterCoins, SignalFilter, SortField } from '@/hooks/useCoinSearch';
import { formatPrice, formatVolume } from '@/lib/utils';
import MarketScanner from './MarketScanner';
import WatchList from './WatchList';
import CoinFilter from './CoinFilter';
import CoinHeatmap from './CoinHeatmap';
import CoinPagination from './CoinPagination';
import MarketOverviewPanel from './MarketOverviewPanel';
import { SupportedExchange } from '@/lib/exchangeMarket';

const EXCHANGE_OPTIONS: Array<{ id: SupportedExchange; label: string; envKey: string }> = [
  { id: 'binance', label: 'Binance API Key', envKey: 'BINANCE_API_KEY' },
  { id: 'bitget', label: 'Bitget API Key', envKey: 'BITGET_API_KEY' },
  { id: 'mexc', label: 'MEXC API Key', envKey: 'MEXC_API_KEY' },
];

const EXCHANGE_LABELS: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
  mexc: 'MEXC',
};

// ── Top-500 lightweight coin row ────────────────────────────
interface TopCoin {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  rank: number;
}

type Top500SortField = 'volume' | 'change' | 'change_asc' | 'price';
type DashboardTab = 'overview' | 'heatmap' | 'scanner' | 'top500' | 'patterns' | 'watchlist';
const AUTO_PLAY_INTERVAL_MS = 900;

type CandlePattern = {
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Reversal';
  idea: string;
  confirmation: string;
  riskHint: string;
  candles: { open: number; high: number; low: number; close: number }[];
};

const CANDLE_PATTERNS: CandlePattern[] = [
  {
    name: 'Hammer',
    bias: 'Bullish',
    idea: 'Long lower wick after a decline can signal seller exhaustion.',
    confirmation: 'Next candle closes above hammer high with rising volume.',
    riskHint: 'Set stop just below wick low and avoid chasing late entries.',
    candles: [
      { open: 106, high: 108, low: 103, close: 104 },
      { open: 104, high: 105, low: 96, close: 103 },
      { open: 103, high: 109, low: 102, close: 108 },
    ],
  },
  {
    name: 'Bullish Engulfing',
    bias: 'Bullish',
    idea: 'A larger bullish candle fully covers the previous bearish body.',
    confirmation: 'Works best near support or after a pullback in an uptrend.',
    riskHint: 'Place stop below pattern low and target prior resistance zones.',
    candles: [
      { open: 109, high: 110, low: 104, close: 105 },
      { open: 104, high: 112, low: 103, close: 111 },
      { open: 111, high: 113, low: 109, close: 112 },
    ],
  },
  {
    name: 'Shooting Star',
    bias: 'Bearish',
    idea: 'Long upper wick after a rally can indicate failed breakout demand.',
    confirmation: 'Next candle closes lower and momentum indicators weaken.',
    riskHint: 'Stop above wick high; avoid shorts when broader trend is strong.',
    candles: [
      { open: 98, high: 103, low: 97, close: 102 },
      { open: 102, high: 111, low: 101, close: 103 },
      { open: 103, high: 104, low: 98, close: 99 },
    ],
  },
  {
    name: 'Doji (Indecision)',
    bias: 'Reversal',
    idea: 'Open and close are near equal, showing temporary market balance.',
    confirmation: 'Most meaningful at key support/resistance with follow-through for direction.',
    riskHint: 'Reduce size until direction confirms; whipsaws are common.',
    candles: [
      { open: 99, high: 104, low: 98, close: 103 },
      { open: 103, high: 108, low: 101, close: 103.2 },
      { open: 103, high: 104, low: 99, close: 100 },
    ],
  },
  {
    name: 'Morning Star',
    bias: 'Bullish',
    idea: 'Three-candle structure showing transition from selloff to recovery.',
    confirmation: 'Third candle closes deep into first candle with strong volume.',
    riskHint: 'Invalidation under middle candle low; scale out into resistance.',
    candles: [
      { open: 112, high: 113, low: 105, close: 106 },
      { open: 105, high: 106, low: 102, close: 104.5 },
      { open: 105, high: 111, low: 104, close: 110 },
    ],
  },
  {
    name: 'Evening Star',
    bias: 'Bearish',
    idea: 'Three-candle reversal at highs signaling momentum fade.',
    confirmation: 'Third candle closes deep into first candle body.',
    riskHint: 'Stop above middle candle high and avoid over-leverage.',
    candles: [
      { open: 94, high: 100, low: 93, close: 99 },
      { open: 100, high: 103, low: 99, close: 100.5 },
      { open: 100, high: 101, low: 94, close: 95 },
    ],
  },
  {
    name: 'Bearish Engulfing',
    bias: 'Bearish',
    idea: 'A large bearish candle fully engulfs the previous bullish body.',
    confirmation: 'Higher reliability near resistance after an extended move.',
    riskHint: 'Stop above engulfing high; avoid entries into strong support.',
    candles: [
      { open: 101, high: 106, low: 100, close: 105 },
      { open: 106, high: 107, low: 98, close: 99 },
      { open: 99, high: 100, low: 96, close: 97 },
    ],
  },
  {
    name: 'Inverted Hammer',
    bias: 'Bullish',
    idea: 'Small real body with long upper wick after a decline shows buyers probing higher.',
    confirmation: 'Bullish follow-through candle should close above the inverted hammer high.',
    riskHint: 'Use a tight stop below the pattern low and wait for confirmation.',
    candles: [
      { open: 111, high: 112, low: 106, close: 107 },
      { open: 106.5, high: 114, low: 106, close: 107.5 },
      { open: 108, high: 113, low: 107.5, close: 112 },
    ],
  },
  {
    name: 'Three White Soldiers',
    bias: 'Bullish',
    idea: 'Three strong bullish candles with higher closes can signal trend reversal.',
    confirmation: 'Best after downtrend with expanding volume and clean closes.',
    riskHint: 'Avoid buying the third candle if it is overextended into resistance.',
    candles: [
      { open: 92, high: 97, low: 91, close: 96 },
      { open: 95.5, high: 101, low: 95, close: 100 },
      { open: 99.5, high: 105, low: 99, close: 104 },
    ],
  },
  {
    name: 'Three Black Crows',
    bias: 'Bearish',
    idea: 'Three consecutive bearish candles with lower closes can signal downside control.',
    confirmation: 'Most effective after an uptrend or failed breakout.',
    riskHint: 'Avoid late shorts into major support where sharp bounces can occur.',
    candles: [
      { open: 108, high: 109, low: 103, close: 104 },
      { open: 104.5, high: 105, low: 99, close: 100 },
      { open: 100.5, high: 101, low: 95, close: 96 },
    ],
  },
];

function PatternMiniChart({
  candles,
  patternName,
}: {
  candles: { open: number; high: number; low: number; close: number }[];
  patternName: string;
}) {
  const CHART_HEIGHT = 72;
  const CHART_PADDING = 8;
  const MIN_CANDLE_BODY_HEIGHT = 3;
  const maxHigh = Math.max(...candles.map((c) => c.high));
  const minLow = Math.min(...candles.map((c) => c.low));
  const range = Math.max(maxHigh - minLow, 1);
  const priceToY = (price: number) => ((maxHigh - price) / range) * CHART_HEIGHT + CHART_PADDING;

  return (
    <svg
      viewBox={`0 0 ${candles.length * 20} 88`}
      className="w-full h-24 rounded-lg border border-gray-800 bg-gray-950/80 p-1"
      role="img"
      aria-label={`${patternName} chart example`}
    >
      {candles.map((candle, index) => {
        const isBullish = candle.close >= candle.open;
        const yOpen = priceToY(candle.open);
        const yClose = priceToY(candle.close);
        const bodyY = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yOpen - yClose), MIN_CANDLE_BODY_HEIGHT);
        const x = index * 20 + 10;

        return (
          <g key={`${patternName}-${index}`}>
            <line
              x1={x}
              y1={priceToY(candle.high)}
              x2={x}
              y2={priceToY(candle.low)}
              className="stroke-gray-400"
              strokeWidth={1.5}
            />
            <rect
              x={x - 4.5}
              y={bodyY}
              width={9}
              height={bodyHeight}
              className={isBullish ? 'fill-emerald-500/90' : 'fill-rose-500/90'}
              rx={1}
            />
          </g>
        );
      })}
    </svg>
  );
}

// ── Top-500 Panel ────────────────────────────────────────────
function Top500Panel({
  selectedExchanges,
  isWatching,
}: {
  selectedExchanges: SupportedExchange[];
  isWatching: (symbol: string) => boolean;
}) {
  const [coins, setCoins] = useState<TopCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(20);
  const [total, setTotal] = useState(500);
  const [sort, setSort] = useState<Top500SortField>('volume');
  const [search, setSearch] = useState('');

  const LIMIT = 25;

  const fetchPage = useCallback(
    async (p: number, s: Top500SortField) => {
      setLoading(true);
      setError(null);
      try {
        const selectedExchangeParam = selectedExchanges.join(',');
        const res = await fetch(
          `/api/coins/top?page=${p}&limit=${LIMIT}&sort=${s}&total=500&exchanges=${encodeURIComponent(selectedExchangeParam)}`
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setCoins(data.coins ?? []);
        setPage(data.page ?? p);
        setTotalPages(data.totalPages ?? 20);
        setTotal(data.total ?? 500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [selectedExchanges]
  );

  // Initial + sort change
  useEffect(() => {
    setPage(1);
    fetchPage(1, sort);
  }, [sort, fetchPage]);

  // Page change
  const handlePageChange = (p: number) => {
    fetchPage(p, sort);
    // Update URL for bookmarking
    const params = new URLSearchParams(window.location.search);
    params.set('tab', 'top500');
    params.set('page', String(p));
    window.history.pushState({}, '', `?${params.toString()}`);
  };

  // Client-side search filter
  const displayCoins = useMemo(() => {
    let filtered = coins;
    if (search.trim()) {
      const q = search.trim().toUpperCase().replace('USDT', '');
      filtered = filtered.filter((c) => c.symbol.replace('USDT', '').includes(q));
    }
    return filtered;
  }, [coins, search]);

  const SORTS: { value: Top500SortField; label: string }[] = [
    { value: 'volume', label: 'Volume' },
    { value: 'change', label: '% Change ↓' },
    { value: 'change_asc', label: '% Change ↑' },
    { value: 'price', label: 'Price' },
  ];

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-40">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            placeholder="Filter by symbol…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-600 rounded-lg pl-8 pr-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-400 hidden sm:inline">Sort:</span>
          {SORTS.map((s) => (
            <button
              key={s.value}
              onClick={() => setSort(s.value)}
              className={`px-2 py-1 rounded transition-colors ${
                sort === s.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {total} coins total
        </span>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-500 border-b border-gray-800">
              <th className="text-left py-2 pl-2 w-8">#</th>
              <th className="text-left py-2">Coin</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">24h Change</th>
              <th className="text-right py-2 hidden sm:table-cell">24h High</th>
              <th className="text-right py-2 hidden sm:table-cell">24h Low</th>
              <th className="text-right py-2 pr-2">Volume</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: LIMIT }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-800/50">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="py-2.5 px-2">
                        <div className="h-4 bg-gray-800/60 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : displayCoins.map((coin) => {
                  const sym = coin.symbol.replace('USDT', '');
                  const watching = isWatching(coin.symbol);
                  return (
                    <tr
                      key={coin.symbol}
                      className="top500-row border-b border-gray-800/50 transition-colors"
                    >
                      <td className="py-2.5 pl-2 text-xs text-gray-600">{coin.rank}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{sym}</span>
                          <span className="text-xs text-gray-500">USDT</span>
                          {watching && (
                            <span className="text-[10px] bg-blue-600/20 text-blue-400 border border-blue-600/30 rounded px-1">
                              ★
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 text-right font-mono text-gray-200">
                        {formatPrice(coin.price)}
                      </td>
                      <td
                        className={`py-2.5 text-right font-medium ${
                          coin.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {coin.priceChangePercent >= 0 ? '+' : ''}
                        {coin.priceChangePercent.toFixed(2)}%
                      </td>
                      <td className="py-2.5 text-right text-gray-400 hidden sm:table-cell">
                        {formatPrice(coin.high24h)}
                      </td>
                      <td className="py-2.5 text-right text-gray-400 hidden sm:table-cell">
                        {formatPrice(coin.low24h)}
                      </td>
                      <td className="py-2.5 pr-2 text-right text-gray-400">
                        {formatVolume(coin.volume24h)}
                      </td>
                    </tr>
                  );
                })}
          </tbody>
        </table>
      </div>

      {!loading && displayCoins.length === 0 && (
        <div className="text-center py-8 text-gray-500 text-sm">
          No coins match your filter.
        </div>
      )}

      {/* Pagination */}
      <CoinPagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  );
}

function CandlePatternsPanel() {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/70 bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Famous Candlestick Patterns</h3>
        <p className="text-xs text-gray-400 mt-1">
          Use these as contextual indicators, not standalone signals. Always confirm with volume, structure, and risk limits.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {CANDLE_PATTERNS.map((pattern) => {
          return (
            <PatternLearningCard key={pattern.name} pattern={pattern} />
          );
        })}
      </div>
    </div>
  );
}

function PatternLearningCard({ pattern }: { pattern: CandlePattern }) {
  const [visibleCandles, setVisibleCandles] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const totalCandles = pattern.candles.length;
  const tone =
    pattern.bias === 'Bullish'
      ? 'text-green-300 border-green-500/30 bg-green-500/10'
      : pattern.bias === 'Bearish'
      ? 'text-red-300 border-red-500/30 bg-red-500/10'
      : 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';

  useEffect(() => {
    if (!autoPlay) return;

    if (visibleCandles >= totalCandles) {
      setAutoPlay(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCandles((current) => Math.min(totalCandles, current + 1));
    }, AUTO_PLAY_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [autoPlay, totalCandles, visibleCandles]);

  const simulationState =
    visibleCandles === 1
      ? 'Setup candle'
      : visibleCandles === totalCandles
      ? 'Pattern confirmed'
      : 'Pattern forming';

  return (
    <div className="rounded-xl border border-gray-700/70 bg-gray-900/60 p-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-100">{pattern.name}</h4>
        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone}`}>{pattern.bias}</span>
      </div>

      <PatternMiniChart candles={pattern.candles.slice(0, visibleCandles)} patternName={pattern.name} />

      <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2">
        <p className="text-[11px] text-cyan-200">
          Simulation: Candle {visibleCandles} / {totalCandles} · {simulationState}
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setAutoPlay(false);
            setVisibleCandles((current) => Math.max(1, current - 1));
          }}
          disabled={visibleCandles <= 1}
          className="px-2 py-1 text-[11px] rounded border border-gray-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800"
        >
          ◀ Prev
        </button>
        <button
          onClick={() => {
            setAutoPlay(false);
            setVisibleCandles((current) => Math.min(totalCandles, current + 1));
          }}
          disabled={visibleCandles >= totalCandles}
          className="px-2 py-1 text-[11px] rounded border border-gray-700 text-gray-300 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-800"
        >
          Next ▶
        </button>
        <button
          onClick={() => {
            if (autoPlay) {
              setAutoPlay(false);
              return;
            }
            if (visibleCandles >= totalCandles) setVisibleCandles(1);
            setAutoPlay(true);
          }}
          className="px-2 py-1 text-[11px] rounded border border-cyan-600/60 text-cyan-200 hover:bg-cyan-500/10"
        >
          {autoPlay ? 'Pause' : 'Auto Play'}
        </button>
      </div>

      <p className="text-xs text-gray-300">{pattern.idea}</p>
      <p className="text-xs text-gray-400">
        <span className="text-gray-200 font-medium">Confirm:</span> {pattern.confirmation}
      </p>
      <p className="text-xs text-cyan-300/90">
        <span className="text-cyan-200 font-medium">Risk:</span> {pattern.riskHint}
      </p>
    </div>
  );
}

function ExchangeSelector({
  selectedExchanges,
  onSelectedExchangesChange,
}: {
  selectedExchanges: SupportedExchange[];
  onSelectedExchangesChange: (exchanges: SupportedExchange[]) => void;
}) {
  const toggleExchange = (exchange: SupportedExchange) => {
    const nextSelection = selectedExchanges.includes(exchange)
      ? selectedExchanges.filter((item) => item !== exchange)
      : [...selectedExchanges, exchange];
    if (nextSelection.length > 0) {
      onSelectedExchangesChange(nextSelection);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 mb-4">
      <p className="text-xs text-gray-400 mb-2">Select exchange API key(s) for all dashboard tabs</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {EXCHANGE_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`flex items-start gap-2 rounded border px-3 py-2 cursor-pointer transition-colors ${
              selectedExchanges.includes(option.id)
                ? 'border-cyan-500 bg-cyan-500/10'
                : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
            }`}
          >
            <input
              type="checkbox"
              checked={selectedExchanges.includes(option.id)}
              onChange={() => toggleExchange(option.id)}
              className="mt-0.5 h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
            />
            <span className="text-sm text-white leading-tight">
              {option.label}
              <span className="block text-[11px] text-gray-500">{option.envKey}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────
export default function Dashboard() {
  const [selectedExchanges, setSelectedExchanges] = useState<SupportedExchange[]>(['binance']);
  const { coins, loading, error, lastUpdated, totalScanned, refetch } = useMarketData(selectedExchanges);
  const { items, addCoin, removeCoin, isWatching } = useWatchList();
  const { searchResults, searching, searchError, searchCoins, searchExact } = useCoinSearch();

  const [query, setQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [activeTab, setActiveTab] = useState<DashboardTab>('scanner');
  const selectedExchangeLabels = selectedExchanges.map((exchange) => EXCHANGE_LABELS[exchange]).join(', ');

  // Sync tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as DashboardTab | null;
    if (tab && ['overview', 'heatmap', 'scanner', 'top500', 'patterns', 'watchlist'].includes(tab)) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    if (tab !== 'top500') params.delete('page');
    window.history.pushState({}, '', `?${params.toString()}`);
  };

  const handleSearch = (q: string) => {
    searchCoins(q, selectedExchanges);
  };

  const handleSearchExact = (symbol: string) => {
    searchExact(symbol, selectedExchanges);
    setQuery('');
  };

  const handleClearSearch = () => {
    searchCoins('');
    setQuery('');
  };

  const displayCoins = useMemo(() => {
    const merged = [...coins];
    const existingSymbols = new Set(coins.map((coin) => coin.symbol));
    for (const coin of searchResults) {
      if (!existingSymbols.has(coin.symbol)) {
        merged.push(coin);
      }
    }
    return filterCoins(merged, query, signalFilter, sortBy);
  }, [searchResults, coins, query, signalFilter, sortBy]);

  // Count signals in a single pass instead of three separate filter calls
  const { buyCount, sellCount, holdCount } = useMemo(() => {
    let buy = 0, sell = 0, hold = 0;
    for (const c of coins) {
      if (c.signal === 'BUY') buy++;
      else if (c.signal === 'SELL') sell++;
      else hold++;
    }
    return { buyCount: buy, sellCount: sell, holdCount: hold };
  }, [coins]);

  const TABS: { id: DashboardTab; label: string }[] = [
    { id: 'overview', label: '🌐 Overview' },
    { id: 'heatmap', label: '🔥 Heatmap' },
    { id: 'scanner', label: '📊 Scanner' },
    { id: 'top500', label: '📋 Top 500' },
    { id: 'patterns', label: '🕯 Patterns' },
    { id: 'watchlist', label: `⭐ Watchlist${items.length > 0 ? ` (${items.length})` : ''}` },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              CryptoScanner
            </h1>
            <span className="text-xs text-gray-500 hidden sm:inline">
              Technical Analysis Dashboard
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <div className="flex gap-3 text-xs">
              <span className="text-green-400">
                {buyCount} <span className="text-gray-500">BUY</span>
              </span>
              <span className="text-yellow-400">
                {holdCount} <span className="text-gray-500">HOLD</span>
              </span>
              <span className="text-red-400">
                {sellCount} <span className="text-gray-500">SELL</span>
              </span>
            </div>

            <div className="text-xs text-gray-500 hidden md:block">
              {totalScanned > 0 && `${totalScanned} pairs scanned`}
              {lastUpdated > 0 && (
                <span className="ml-2">
                  Updated {new Date(lastUpdated).toLocaleTimeString()}
                </span>
              )}
            </div>

            <button
              onClick={refetch}
              disabled={loading}
              className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors disabled:opacity-50"
              title="Refresh"
            >
              <svg
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            ⚠ {error}. Data may be stale. Auto-retrying...
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="max-w-7xl mx-auto px-4 pt-5">
        <div className="flex gap-1 sm:gap-2 border-b border-gray-800 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800 -mb-px'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <ExchangeSelector
          selectedExchanges={selectedExchanges}
          onSelectedExchangesChange={setSelectedExchanges}
        />

        {/* Market overview tab */}
        {activeTab === 'overview' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Market Overview
              </h2>
              <span className="text-xs text-gray-500">Multi-exchange snapshot</span>
            </div>
            <MarketOverviewPanel selectedExchanges={selectedExchanges} />
          </div>
        )}

        {/* Heatmap tab */}
        {activeTab === 'heatmap' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                Market Heatmap
              </h2>
              <span className="text-xs text-gray-500">{selectedExchangeLabels} · Auto-refreshes every 30s</span>
            </div>
            <CoinHeatmap
              coins={coins}
              loading={loading}
              onAddToWatchlist={addCoin}
              isWatching={isWatching}
            />
          </div>
        )}

        {/* Scanner tab */}
        {activeTab === 'scanner' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Scanner */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                  Market Scanner
                  {searchResults.length > 0 && (
                    <span className="text-xs text-purple-400 font-normal ml-1">
                      — {searchResults.length} custom results
                    </span>
                  )}
                </h2>
                {searchResults.length > 0 && (
                  <span className="text-xs text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded">
                    Custom Search
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 -mt-1">{selectedExchangeLabels} live scanner feed</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500">Results</p>
                  <p className="text-sm font-semibold text-white">{displayCoins.length}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500">BUY</p>
                  <p className="text-sm font-semibold text-green-400">{buyCount}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500">SELL</p>
                  <p className="text-sm font-semibold text-red-400">{sellCount}</p>
                </div>
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500">HOLD</p>
                  <p className="text-sm font-semibold text-yellow-400">{holdCount}</p>
                </div>
              </div>

              <CoinFilter
                query={query}
                onQueryChange={setQuery}
                signalFilter={signalFilter}
                onSignalFilterChange={setSignalFilter}
                sortBy={sortBy}
                onSortChange={setSortBy}
                onSearch={handleSearch}
                onSearchExact={handleSearchExact}
                searching={searching}
                searchError={searchError}
                hasSearchResults={searchResults.length > 0}
                onClearSearch={handleClearSearch}
              />

              <MarketScanner
                coins={displayCoins}
                loading={loading}
                onAddToWatchlist={addCoin}
                isWatching={isWatching}
              />
            </div>

            {/* Right: Watchlist sidebar */}
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                Watchlist
                {items.length > 0 && (
                  <span className="text-xs text-gray-500 font-normal">({items.length})</span>
                )}
              </h2>
              <WatchList items={items} coins={coins} onRemove={removeCoin} />
            </div>
          </div>
        )}

        {/* Top 500 tab */}
        {activeTab === 'top500' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                Top 500 Coins
              </h2>
              <span className="text-xs text-gray-500">{selectedExchangeLabels} · 25 coins per page</span>
            </div>
            <Top500Panel selectedExchanges={selectedExchanges} isWatching={isWatching} />
          </div>
        )}

        {/* Candlestick patterns tab */}
        {activeTab === 'patterns' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Trader Learning Center
              </h2>
              <span className="text-xs text-gray-500">{selectedExchangeLabels} context + pattern playbook</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
              {[...coins]
                .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
                .slice(0, 5)
                .map((coin) => (
                  <div key={coin.symbol} className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                    <p className="text-[11px] text-gray-500">{coin.symbol.replace('USDT', '')}</p>
                    <p
                      className={`text-sm font-semibold ${
                        coin.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {coin.priceChangePercent >= 0 ? '+' : ''}
                      {coin.priceChangePercent.toFixed(2)}%
                    </p>
                  </div>
                ))}
            </div>
            <CandlePatternsPanel />
          </div>
        )}

        {/* Watchlist tab */}
        {activeTab === 'watchlist' && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Watchlist
              {items.length > 0 && (
                <span className="text-xs text-gray-500 font-normal">({items.length} coins)</span>
              )}
            </h2>
            <div className="max-w-2xl">
              <WatchList items={items} coins={coins} onRemove={removeCoin} />
            </div>
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <footer className="border-t border-gray-800 mt-8">
        <div className="max-w-7xl mx-auto px-4 py-4 text-center text-xs text-gray-600">
          ⚠ This is a technical analysis tool, not financial advice. Past patterns don&apos;t guarantee
          future performance. Trade at your own risk.
        </div>
      </footer>
    </div>
  );
}
