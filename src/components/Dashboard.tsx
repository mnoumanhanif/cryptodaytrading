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
  { id: 'bybit', label: 'Bybit API Key', envKey: 'BYBIT_API_KEY' },
  { id: 'bitget', label: 'Bitget API Key', envKey: 'BITGET_API_KEY' },
];

const EXCHANGE_LABELS: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
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
type DashboardTab = 'dashboard' | 'signals' | 'predictions' | 'marketdata' | 'journal';
const AUTO_PLAY_INTERVAL_MS = 900;
const DEFAULT_LONG_STOP_LOSS_FACTOR = 0.985;
const DEFAULT_LONG_TARGET_FACTOR = 1.03;
const DEFAULT_SHORT_BASE_MOVE_FACTOR = 0.015;
const DEFAULT_SHORT_TARGET_MULTIPLIER = 1.8;
const MIN_NOTIFICATION_MOVE_PERCENT = 1.5;
const MAX_WATCHLIST_NOTIFICATIONS = 6;
const VOLUME_RATIO_TO_CONFIDENCE_FACTOR = 30;
const SENTIMENT_PRICE_CHANGE_WEIGHT = 8;
const SENTIMENT_VOLUME_RATIO_WEIGHT = 20;
const NEWS_IMPACT_PRICE_WEIGHT = 10;
const NEWS_IMPACT_VOLUME_WEIGHT = 25;
const NEWS_IMPACT_SENTIMENT_WEIGHT = 0.35;
const SMART_WATCHLIST_VOLATILITY_WEIGHT = 0.35;
const SMART_WATCHLIST_LIQUIDITY_WEIGHT = 0.35;
const SMART_WATCHLIST_SENTIMENT_WEIGHT = 0.3;
const LIQUIDATION_PRESSURE_HIGH_MULTIPLIER = 1.35;
const LIQUIDATION_PRESSURE_LOW_MULTIPLIER = 0.85;
const LIQUIDATION_INTENSITY_VOLUME_WEIGHT = 25;
const LIQUIDATION_INTENSITY_VOLATILITY_WEIGHT = 3;
const SMART_WATCHLIST_VOLATILITY_MULTIPLIER = 8;
const SMART_WATCHLIST_LIQUIDITY_MULTIPLIER = 35;

type CandlePattern = {
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Reversal';
  idea: string;
  confirmation: string;
  riskHint: string;
  candles: { open: number; high: number; low: number; close: number }[];
};

type PatternCoinMatches = Record<string, string[]>;
type SuggestionBias = 'LONG' | 'SHORT';
type SuggestionTemplate = {
  name: string;
  setup: string;
  confirmation: string;
  invalidation: string;
};
type TradeSuggestion = {
  patternName: string;
  symbol: string;
  bias: SuggestionBias;
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  riskRewardRatio: number;
  confidence: number;
  setup: string;
  confirmation: string;
  invalidation: string;
  expectedProfitPercent: number;
  expectedLossPercent: number;
};

type NewsRiskItem = {
  symbol: string;
  source: 'Crypto News' | 'X (Twitter)' | 'Market Wire';
  headline: string;
  sentimentScore: number;
  twitterTrendScore: number;
  newsImpactScore: number;
  riskLevel: 'High' | 'Medium';
};

type LiquidationHeatItem = {
  symbol: string;
  longLiquidationPressure: number;
  shortLiquidationPressure: number;
  imbalance: number;
  intensity: number;
};

type WhaleActivityItem = {
  symbol: string;
  side: 'BUY' | 'SELL';
  estimatedUsd: number;
  confidence: number;
};


type SignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
type SignalBand = 'AVOID' | 'RISKY' | 'GOOD' | 'STRONG';

type SignalOpportunityRow = {
  symbol: string;
  price: number;
  signalStrength: SignalStrength;
  scoreBand: SignalBand;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  confidence: number;
  bias: 'LONG' | 'SHORT';
  volumeRatio: number;
  priceChangePercent: number;
  indicatorScore: number;
};

function matchesPattern(coin: { signal: 'BUY' | 'SELL' | 'HOLD'; score: number; priceChangePercent: number }, pattern: CandlePattern): boolean {
  if (pattern.bias === 'Bullish') {
    return coin.signal === 'BUY' && coin.score >= 50;
  }
  if (pattern.bias === 'Bearish') {
    return coin.signal === 'SELL' && coin.score >= 50;
  }
  return coin.signal === 'HOLD' || Math.abs(coin.priceChangePercent) < 1;
}

function buildPatternCoinMatches(
  coins: Array<{ symbol: string; signal: 'BUY' | 'SELL' | 'HOLD'; score: number; priceChangePercent: number }>
): PatternCoinMatches {
  return CANDLE_PATTERNS.reduce<PatternCoinMatches>((acc, pattern) => {
    const names = coins
      .filter((coin) => matchesPattern(coin, pattern))
      .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
      .slice(0, 3)
      .map((coin) => coin.symbol.replace('USDT', ''));
    acc[pattern.name] = names;
    return acc;
  }, {});
}

async function fetchBinancePatternMatches(): Promise<PatternCoinMatches> {
  const response = await fetch('/api/scanner?exchanges=binance&limit=120', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    coins?: Array<{ symbol: string; signal: 'BUY' | 'SELL' | 'HOLD'; score: number; priceChangePercent: number }>;
  };
  return buildPatternCoinMatches(data.coins ?? []);
}

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

const LONG_SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  { name: 'Bull Flag Breakout', setup: 'Trend continuation after shallow pullback.', confirmation: 'Close above flag resistance with volume expansion.', invalidation: 'Break below flag low.' },
  { name: 'Ascending Triangle', setup: 'Higher lows pressing into a horizontal resistance.', confirmation: 'Break and hold above resistance level.', invalidation: 'Close back inside triangle.' },
  { name: 'Cup and Handle', setup: 'Rounded base followed by light handle retrace.', confirmation: 'Breakout above cup rim.', invalidation: 'Handle low breaks.' },
  { name: 'Inverse Head and Shoulders', setup: 'Three-trough reversal with rising neckline pressure.', confirmation: 'Neckline breakout and retest hold.', invalidation: 'Right-shoulder low fails.' },
  { name: 'Falling Wedge Reversal', setup: 'Contracting downside channel losing momentum.', confirmation: 'Upside wedge breakout candle closes strong.', invalidation: 'Fresh low inside wedge.' },
  { name: 'Retest of Broken Resistance', setup: 'Prior resistance flips into support.', confirmation: 'Support retest holds with rejection wick.', invalidation: 'Support decisively breaks.' },
  { name: 'Volume Expansion Breakout', setup: 'Consolidation near local highs.', confirmation: 'Range breakout with above-average volume.', invalidation: 'False breakout and quick re-entry to range.' },
  { name: 'Higher-Low Trend Continuation', setup: 'Pullback prints higher low in uptrend.', confirmation: 'Momentum resumes above prior swing high.', invalidation: 'Higher low is violated.' },
  { name: 'Golden Cross Momentum', setup: 'Fast moving average crosses above slow average.', confirmation: 'Price sustains above both averages.', invalidation: 'Cross fails and price falls below slow MA.' },
  { name: 'Support Bounce with RSI Reset', setup: 'Price taps support while RSI normalizes.', confirmation: 'Bullish candle closes off support.', invalidation: 'Support closes below with momentum.' },
];

const SHORT_SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
  { name: 'Bear Flag Breakdown', setup: 'Downtrend pause forms weak upward channel.', confirmation: 'Breakdown below channel support.', invalidation: 'Close above flag high.' },
  { name: 'Descending Triangle', setup: 'Lower highs compress into flat support.', confirmation: 'Support breakdown with sell volume.', invalidation: 'Reclaim and hold above support.' },
  { name: 'Head and Shoulders Top', setup: 'Three-peak exhaustion pattern at highs.', confirmation: 'Neckline break then failed retest.', invalidation: 'Right shoulder high is reclaimed.' },
  { name: 'Rising Wedge Breakdown', setup: 'Weakening rally in narrowing channel.', confirmation: 'Bearish break below wedge base.', invalidation: 'Wedge high breakout.' },
  { name: 'Double Top Rejection', setup: 'Second high fails at resistance zone.', confirmation: 'Neckline break confirms reversal.', invalidation: 'Second top breaks and holds.' },
  { name: 'Failed Breakout Trap', setup: 'Price breaks highs then quickly reverses.', confirmation: 'Back below breakout level with momentum.', invalidation: 'Immediate reclaim of breakout level.' },
  { name: 'Resistance Rejection', setup: 'Price rallies into heavy resistance zone.', confirmation: 'Multiple rejection wicks + lower close.', invalidation: 'Resistance converts into support.' },
  { name: 'Lower-High Continuation', setup: 'Bear trend pullback stalls below prior high.', confirmation: 'Break below pullback low.', invalidation: 'Lower high breaks upward.' },
  { name: 'Death Cross Momentum', setup: 'Fast moving average crosses below slow average.', confirmation: 'Price remains under both averages.', invalidation: 'Cross fails and trend reclaims MAs.' },
  { name: 'Overbought Reversal Fade', setup: 'Sharp rally into overbought condition.', confirmation: 'Bearish engulfing near local top.', invalidation: 'Strong close above top structure.' },
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

function CandlePatternsPanel({
  patternCoinMatches,
  loading,
  error,
}: {
  patternCoinMatches: PatternCoinMatches;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/70 bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Famous Candlestick Patterns</h3>
        <p className="text-xs text-gray-400 mt-1">
          Use these as contextual indicators, not standalone signals. Always confirm with volume, structure, and risk limits.
        </p>
        <p className="text-xs text-cyan-300/90 mt-2">
          {loading ? 'Scanning Binance for live pattern candidates…' : 'Live Binance coin candidates are listed under each pattern.'}
        </p>
        {error && <p className="text-xs text-yellow-300/90 mt-1">Using fallback matches: {error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {CANDLE_PATTERNS.map((pattern) => {
          return (
            <PatternLearningCard
              key={pattern.name}
              pattern={pattern}
              coinNames={patternCoinMatches[pattern.name] ?? []}
            />
          );
        })}
      </div>
    </div>
  );
}

function PatternLearningCard({ pattern, coinNames }: { pattern: CandlePattern; coinNames: string[] }) {
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
        <p className="text-[11px] text-cyan-300/90 mt-1">
          Binance coins currently matching: {coinNames.length > 0 ? coinNames.join(', ') : 'No clear match right now'}
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



function scoreBandTone(band: SignalBand): string {
  if (band === 'STRONG') return 'text-green-300 border-green-700/40 bg-green-900/20';
  if (band === 'GOOD') return 'text-cyan-300 border-cyan-700/40 bg-cyan-900/20';
  if (band === 'RISKY') return 'text-yellow-300 border-yellow-700/40 bg-yellow-900/20';
  return 'text-red-300 border-red-700/40 bg-red-900/20';
}

function strengthBadge(strength: SignalStrength): string {
  if (strength === 'STRONG') return '🔥 Strong';
  if (strength === 'MEDIUM') return '⚡ Medium';
  return '⚠️ Weak';
}

function SignalPanel({
  title,
  rows,
  accentClass,
  onNotify,
  notifiedSymbols,
}: {
  title: string;
  rows: SignalOpportunityRow[];
  accentClass: string;
  onNotify: (symbol: string) => void;
  notifiedSymbols: Set<string>;
}) {
  return (
    <section className={`rounded-xl border p-3 ${accentClass} overflow-x-auto`}>
      <h3 className="text-[16px] font-semibold mb-2">{title}</h3>
      <table className="w-full min-w-[980px] text-[13px]">
        <thead>
          <tr className="text-[12px] text-gray-500 border-b border-gray-800">
            <th className="text-left py-2 px-2">Coin</th>
            <th className="text-right py-2 px-2">Price</th>
            <th className="text-right py-2 px-2">Signal Strength</th>
            <th className="text-right py-2 px-2">Entry</th>
            <th className="text-right py-2 px-2">SL</th>
            <th className="text-right py-2 px-2">TP</th>
            <th className="text-right py-2 px-2">Confidence</th>
            <th className="text-right py-2 px-2">Bias</th>
            <th className="text-right py-2 px-2">Score</th>
            <th className="text-right py-2 px-2">Alert</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 50).map((row) => (
            <tr key={`${title}-${row.symbol}`} className="border-b border-gray-800/40">
              <td className="py-2 px-2 text-gray-100">{row.symbol.replace('USDT', '')}</td>
              <td className="py-2 px-2 text-right text-gray-200">{formatPrice(row.price)}</td>
              <td className="py-2 px-2 text-right text-gray-200">{strengthBadge(row.signalStrength)}</td>
              <td className="py-2 px-2 text-right text-cyan-200">{formatPrice(row.entry)}</td>
              <td className="py-2 px-2 text-right text-red-300">{formatPrice(row.stopLoss)}</td>
              <td className="py-2 px-2 text-right text-green-300">{formatPrice(row.takeProfit)}</td>
              <td className="py-2 px-2 text-right text-gray-200">{row.confidence}%</td>
              <td className={`py-2 px-2 text-right font-semibold ${row.bias === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                {row.bias === 'LONG' ? '🟢 Long' : '🔴 Short'}
              </td>
              <td className="py-2 px-2 text-right">
                <span className={`text-[11px] px-2 py-0.5 rounded border ${scoreBandTone(row.scoreBand)}`}>{row.scoreBand}</span>
              </td>
              <td className="py-2 px-2 text-right">
                <button
                  onClick={() => onNotify(row.symbol)}
                  className={`text-[11px] px-2 py-1 rounded border ${notifiedSymbols.has(row.symbol) ? 'text-cyan-300 border-cyan-600/40 bg-cyan-900/20' : 'text-gray-300 border-gray-700 bg-gray-900/50 hover:border-gray-500'}`}
                >
                  {notifiedSymbols.has(row.symbol) ? '🔔 Notified' : 'Notify me'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
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
  const [activeTab, setActiveTab] = useState<DashboardTab>('dashboard');
  const [patternCoinMatches, setPatternCoinMatches] = useState<PatternCoinMatches>(() => buildPatternCoinMatches(coins));
  const [patternMatchesLoading, setPatternMatchesLoading] = useState(false);
  const [patternMatchesError, setPatternMatchesError] = useState<string | null>(null);
  const selectedExchangeLabels = selectedExchanges.map((exchange) => EXCHANGE_LABELS[exchange]).join(', ');

  const suggestionData = useMemo(() => {
    const ranked = [...coins].sort((a, b) => b.score - a.score);
    const longCandidates = ranked.filter((coin) => coin.signal !== 'SELL');
    const shortCandidates = ranked.filter((coin) => coin.signal !== 'BUY');
    const fallbackPool = ranked.length > 0 ? ranked : [];

    const longSuggestions: TradeSuggestion[] = LONG_SUGGESTION_TEMPLATES.map((template, index) => {
      const coin = longCandidates[index] ?? fallbackPool[index % Math.max(fallbackPool.length, 1)];
      const entryPrice = coin?.price ?? 0;
      const defaultStopLoss = entryPrice > 0 ? entryPrice * DEFAULT_LONG_STOP_LOSS_FACTOR : 0;
      const defaultTargetPrice = entryPrice > 0 ? entryPrice * DEFAULT_LONG_TARGET_FACTOR : 0;
      const stopLoss =
        entryPrice > 0 && coin && coin.risk.stopLoss > 0 && coin.risk.stopLoss < entryPrice
          ? coin.risk.stopLoss
          : defaultStopLoss;
      const targetPrice =
        entryPrice > 0 && coin && coin.risk.targetPrice > entryPrice
          ? coin.risk.targetPrice
          : defaultTargetPrice;
      const risk = entryPrice > stopLoss ? entryPrice - stopLoss : 0;
      const reward = targetPrice > entryPrice ? targetPrice - entryPrice : 0;

      return {
        patternName: template.name,
        symbol: coin?.symbol ?? 'N/A',
        bias: 'LONG',
        entryPrice,
        stopLoss,
        targetPrice,
        riskRewardRatio: risk > 0 && reward > 0 ? reward / risk : 0,
        confidence: coin?.tradeSignal.confidence ?? 0,
        setup: template.setup,
        confirmation: template.confirmation,
        invalidation: template.invalidation,
        expectedProfitPercent: entryPrice > 0 && targetPrice >= entryPrice ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0,
        expectedLossPercent: entryPrice > 0 && stopLoss > 0 ? ((entryPrice - stopLoss) / entryPrice) * 100 : 0,
      };
    });

    const shortSuggestions: TradeSuggestion[] = SHORT_SUGGESTION_TEMPLATES.map((template, index) => {
      const coin = shortCandidates[index] ?? fallbackPool[index % Math.max(fallbackPool.length, 1)];
      const entryPrice = coin?.price ?? 0;
      const baseMove = Math.max(
        entryPrice * DEFAULT_SHORT_BASE_MOVE_FACTOR,
        Math.abs((coin?.priceChangePercent ?? 0) / 100) * entryPrice
      );
      const stopLoss = entryPrice + baseMove;
      const targetPrice = Math.max(entryPrice - baseMove * DEFAULT_SHORT_TARGET_MULTIPLIER, 0);
      const risk = stopLoss > entryPrice ? stopLoss - entryPrice : 0;
      const reward = entryPrice > targetPrice ? entryPrice - targetPrice : 0;

      return {
        patternName: template.name,
        symbol: coin?.symbol ?? 'N/A',
        bias: 'SHORT',
        entryPrice,
        stopLoss,
        targetPrice,
        riskRewardRatio: risk > 0 && reward > 0 ? reward / risk : 0,
        confidence: coin?.tradeSignal.confidence ?? 0,
        setup: template.setup,
        confirmation: template.confirmation,
        invalidation: template.invalidation,
        expectedProfitPercent: entryPrice > 0 && targetPrice > 0 && targetPrice <= entryPrice ? ((entryPrice - targetPrice) / entryPrice) * 100 : 0,
        expectedLossPercent: entryPrice > 0 && stopLoss > 0 ? ((stopLoss - entryPrice) / entryPrice) * 100 : 0,
      };
    });

    return { longSuggestions, shortSuggestions };
  }, [coins]);

  const watchlistMoveNotifications = useMemo(() => {
    const alerts = items
      .map((item) => {
        const liveCoin = coins.find((coin) => coin.symbol === item.symbol);
        if (!liveCoin) return null;
        const movePercent = ((liveCoin.price - item.entryPrice) / item.entryPrice) * 100;
        const targetHit = liveCoin.price >= item.targetPrice;
        const stopHit = liveCoin.price <= item.stopLoss;

        if (!targetHit && !stopHit && Math.abs(movePercent) < MIN_NOTIFICATION_MOVE_PERCENT) return null;

        return {
          symbol: item.symbol,
          movePercent,
          livePrice: liveCoin.price,
          status: targetHit ? 'TARGET HIT' : stopHit ? 'STOP LOSS HIT' : movePercent > 0 ? 'UPTREND MOMENTUM' : 'DOWNTREND MOMENTUM',
          guidance: targetHit
            ? 'Target reached — keep entry fixed and close per plan.'
            : stopHit
            ? 'Stop loss breached — close position to protect capital.'
            : `Price moved ${movePercent.toFixed(2)}% from entry. Keep entry fixed until TP/SL trigger.`,
        };
      })
      .filter((alert): alert is NonNullable<typeof alert> => Boolean(alert))
      .sort((a, b) => Math.abs(b.movePercent) - Math.abs(a.movePercent))
      .slice(0, MAX_WATCHLIST_NOTIFICATIONS);

    return alerts;
  }, [items, coins]);

  // Sync tab from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab') as DashboardTab | null;
    if (tab && ['dashboard', 'signals', 'predictions', 'marketdata', 'journal'].includes(tab)) {
      setActiveTab(tab as DashboardTab);
    }
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    params.delete('page');
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
  const scannerCoins = useMemo(() => displayCoins.slice(0, 500), [displayCoins]);

  const volumeSurgeCoins = useMemo(
    () =>
      [...coins]
        .filter((coin) => (coin.indicators.volume?.volumeRatio ?? 0) >= 1.8)
        .sort((a, b) => (b.indicators.volume?.volumeRatio ?? 0) - (a.indicators.volume?.volumeRatio ?? 0))
        .slice(0, 20),
    [coins]
  );

  const whaleActivity = useMemo<WhaleActivityItem[]>(
    () =>
      volumeSurgeCoins.slice(0, 10).map((coin) => {
        const estimatedUsd = (coin.indicators.volume?.currentVolume ?? 0) * coin.price;
        const confidence = Math.min(99, Math.round((coin.indicators.volume?.volumeRatio ?? 0) * VOLUME_RATIO_TO_CONFIDENCE_FACTOR));
        return {
          symbol: coin.symbol,
          side: coin.signal === 'SELL' ? 'SELL' : 'BUY',
          estimatedUsd,
          confidence,
        };
      }),
    [volumeSurgeCoins]
  );

  const warningNews = useMemo<NewsRiskItem[]>(
    () =>
      [...coins]
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 12)
        .map((coin, index) => {
          const sentimentScore = Math.max(-100, Math.min(100, Math.round((coin.signal === 'SELL' ? -1 : coin.signal === 'BUY' ? 1 : 0) * coin.score)));
          const twitterTrendScore = Math.min(
            100,
            Math.round(
              Math.abs(coin.priceChangePercent) * SENTIMENT_PRICE_CHANGE_WEIGHT +
                (coin.indicators.volume?.volumeRatio ?? 0) * SENTIMENT_VOLUME_RATIO_WEIGHT
            )
          );
          const newsImpactScore = Math.min(
            100,
            Math.round(
              Math.abs(coin.priceChangePercent) * NEWS_IMPACT_PRICE_WEIGHT +
                (coin.indicators.volume?.volumeRatio ?? 0) * NEWS_IMPACT_VOLUME_WEIGHT +
                Math.abs(sentimentScore) * NEWS_IMPACT_SENTIMENT_WEIGHT
            )
          );
          const sources: NewsRiskItem['source'][] = ['Crypto News', 'X (Twitter)', 'Market Wire'];
          const riskLevel: NewsRiskItem['riskLevel'] = sentimentScore <= -30 || newsImpactScore >= 80 ? 'High' : 'Medium';
          return {
            symbol: coin.symbol,
            source: sources[index % sources.length],
            headline:
              riskLevel === 'High'
                ? `${coin.symbol.replace('USDT', '')} flagged for fast move risk - protect capital with strict stops`
                : `${coin.symbol.replace('USDT', '')} attracting elevated attention - monitor confirmation before entry`,
            sentimentScore,
            twitterTrendScore,
            newsImpactScore,
            riskLevel,
          };
        }),
    [coins]
  );

  const liquidationHeatmap = useMemo<LiquidationHeatItem[]>(
    () =>
      [...coins]
        .slice(0, 60)
        .map((coin) => {
          const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
          const volatility = Math.abs(coin.priceChangePercent);
          const longLiquidationPressureRaw = volatility * (coin.signal === 'SELL' ? LIQUIDATION_PRESSURE_HIGH_MULTIPLIER : LIQUIDATION_PRESSURE_LOW_MULTIPLIER);
          const shortLiquidationPressureRaw = volatility * (coin.signal === 'BUY' ? LIQUIDATION_PRESSURE_HIGH_MULTIPLIER : LIQUIDATION_PRESSURE_LOW_MULTIPLIER);
          const longLiquidationPressure = Math.max(0, Math.round(longLiquidationPressureRaw * 100) / 100);
          const shortLiquidationPressure = Math.max(0, Math.round(shortLiquidationPressureRaw * 100) / 100);
          const imbalance = Math.round((shortLiquidationPressure - longLiquidationPressure) * 100) / 100;
          const intensity = Math.min(
            100,
            Math.round((volumeRatio * LIQUIDATION_INTENSITY_VOLUME_WEIGHT + volatility * LIQUIDATION_INTENSITY_VOLATILITY_WEIGHT) * 100) / 100
          );
          return {
            symbol: coin.symbol,
            longLiquidationPressure,
            shortLiquidationPressure,
            imbalance,
            intensity,
          };
        })
        .sort((a, b) => b.intensity - a.intensity),
    [coins]
  );

  const smartWatchlist = useMemo(
    () =>
      [...coins]
        .slice(0, 25)
        .map((coin) => {
          const volatilityScore = Math.min(100, Math.abs(coin.priceChangePercent) * SMART_WATCHLIST_VOLATILITY_MULTIPLIER);
          const liquidityScore = Math.min(100, (coin.indicators.volume?.volumeRatio ?? 0) * SMART_WATCHLIST_LIQUIDITY_MULTIPLIER);
          const sentimentProxy = Math.max(0, Math.min(100, coin.signal === 'SELL' ? 100 - coin.score : coin.score));
          const aiScore = Math.round(
            volatilityScore * SMART_WATCHLIST_VOLATILITY_WEIGHT +
              liquidityScore * SMART_WATCHLIST_LIQUIDITY_WEIGHT +
              sentimentProxy * SMART_WATCHLIST_SENTIMENT_WEIGHT
          );
          return {
            coin,
            aiScore,
            volatilityScore: Math.round(volatilityScore),
            liquidityScore: Math.round(liquidityScore),
            sentimentScore: Math.round(sentimentProxy),
          };
        })
        .sort((a, b) => b.aiScore - a.aiScore),
    [coins]
  );


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



  const [signalTimeframe, setSignalTimeframe] = useState<'5m' | '15m' | '1h' | '4h'>('15m');
  const [minConfidence70Only, setMinConfidence70Only] = useState(false);
  const [highVolumeOnly, setHighVolumeOnly] = useState(false);
  const [signalSortBy, setSignalSortBy] = useState<'confidence' | 'volume' | 'move'>('confidence');
  const [notifiedSymbols, setNotifiedSymbols] = useState<Set<string>>(new Set());
  const [lastSignalBiasBySymbol, setLastSignalBiasBySymbol] = useState<Record<string, 'LONG' | 'SHORT' | 'HOLD'>>({});

  const scoreBandFromConfidence = (confidence: number): SignalBand => {
    if (confidence >= 85) return 'STRONG';
    if (confidence >= 70) return 'GOOD';
    if (confidence >= 50) return 'RISKY';
    return 'AVOID';
  };

  const strengthFromConfidence = (confidence: number): SignalStrength => {
    if (confidence >= 85) return 'STRONG';
    if (confidence >= 70) return 'MEDIUM';
    return 'WEAK';
  };

  const shortTermSignals = useMemo<SignalOpportunityRow[]>(() => {
    return coins.map((coin) => {
      const longBias = coin.tradeSignal.prediction === 'UP' || (coin.indicators.rsi.value < 30 && coin.indicators.ma.trend !== 'bearish');
      const shortBias = coin.tradeSignal.prediction === 'DOWN' || (coin.indicators.rsi.value > 70 && coin.indicators.ma.trend !== 'bullish');
      const bias: 'LONG' | 'SHORT' = shortBias && !longBias ? 'SHORT' : 'LONG';
      const entry = coin.risk.entryPrice;
      const stopLoss = bias === 'LONG' ? Math.min(coin.risk.stopLoss, entry * 0.985) : Math.max(coin.risk.stopLoss, entry * 1.015);
      const takeProfit = bias === 'LONG' ? Math.max(coin.risk.targetPrice, entry * 1.02) : Math.min(coin.risk.targetPrice, entry * 0.98);
      const indicatorScore = Math.round((
        coin.indicators.rsi.score * 0.3 +
        coin.indicators.volume.score * 0.25 +
        coin.indicators.ma.score * 0.25 +
        coin.indicators.macd.score * 0.2
      ) * 100) / 100;
      const confidence = Math.round(Math.max(0, Math.min(99, (coin.tradeSignal.confidence * 0.65) + (indicatorScore * 0.35))));

      return {
        symbol: coin.symbol,
        price: coin.price,
        signalStrength: strengthFromConfidence(confidence),
        scoreBand: scoreBandFromConfidence(confidence),
        entry,
        stopLoss,
        takeProfit,
        confidence,
        bias,
        volumeRatio: coin.indicators.volume?.volumeRatio ?? 0,
        priceChangePercent: coin.priceChangePercent,
        indicatorScore,
      };
    });
  }, [coins]);

  const filteredSignals = useMemo(() => {
    const minVolByTimeframe: Record<'5m' | '15m' | '1h' | '4h', number> = { '5m': 1.05, '15m': 1.15, '1h': 1.3, '4h': 1.5 };
    const minVol = minVolByTimeframe[signalTimeframe];
    let rows = shortTermSignals.filter((row) => row.volumeRatio >= minVol);
    if (minConfidence70Only) rows = rows.filter((row) => row.confidence >= 70);
    if (highVolumeOnly) rows = rows.filter((row) => row.volumeRatio >= 1.8);

    const sorted = [...rows].sort((a, b) => {
      if (signalSortBy === 'volume') return b.volumeRatio - a.volumeRatio;
      if (signalSortBy === 'move') return Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent);
      return b.confidence - a.confidence;
    });
    return sorted;
  }, [shortTermSignals, signalTimeframe, minConfidence70Only, highVolumeOnly, signalSortBy]);

  const longOpportunities = useMemo(() => filteredSignals.filter((r) => r.bias === 'LONG'), [filteredSignals]);
  const shortOpportunities = useMemo(() => filteredSignals.filter((r) => r.bias === 'SHORT'), [filteredSignals]);

  const signalFlips = useMemo(() => {
    const flips: Array<{ symbol: string; from: 'LONG' | 'SHORT'; to: 'LONG' | 'SHORT' }> = [];
    for (const row of filteredSignals) {
      const prev = lastSignalBiasBySymbol[row.symbol];
      if (prev && prev !== 'HOLD' && prev !== row.bias) {
        flips.push({ symbol: row.symbol, from: prev as 'LONG' | 'SHORT', to: row.bias });
      }
    }
    return flips.slice(0, 8);
  }, [filteredSignals, lastSignalBiasBySymbol]);

  useEffect(() => {
    setLastSignalBiasBySymbol((prev) => {
      const next = { ...prev };
      for (const row of filteredSignals) next[row.symbol] = row.bias;
      return next;
    });
  }, [filteredSignals]);

  const topSignalInsights = useMemo(() => {
    const top5 = filteredSignals.slice(0, 5);
    const avgConfidence = top5.length ? Math.round(top5.reduce((acc, s) => acc + s.confidence, 0) / top5.length) : 0;
    return {
      top5,
      avgConfidence,
      strongCount: filteredSignals.filter((s) => s.signalStrength === 'STRONG').length,
      goodCount: filteredSignals.filter((s) => s.scoreBand === 'GOOD' || s.scoreBand === 'STRONG').length,
    };
  }, [filteredSignals]);

  const [journalData, setJournalData] = useState<{ entries: Array<{ id: string; symbol: string; signal: string; confidence: number; netRR: number; outcome: string; createdAt: number }>; stats?: { totalSignals: number; buySignals: number; sellSignals: number; winRate: number; pendingOutcomes: number } } | null>(null);
  const [journalLoading, setJournalLoading] = useState(false);

  useEffect(() => {
    if (activeTab !== 'journal') return;
    let cancelled = false;
    const load = async () => {
      setJournalLoading(true);
      try {
        const res = await fetch('/api/trade-journal', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) setJournalData(data);
      } catch {
        if (!cancelled) setJournalData(null);
      } finally {
        if (!cancelled) setJournalLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab]);
  const TABS: { id: DashboardTab; label: string }[] = [
    { id: 'dashboard', label: '📊 Dashboard' },
    { id: 'signals', label: '📈 Signals' },
    { id: 'predictions', label: '🧠 AI Predictions' },
    { id: 'marketdata', label: '📉 Market Data' },
    { id: 'journal', label: '📒 Trade Journal' },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Crypto Trading Dashboard
            </h1>
            <span className="text-[12px] text-gray-500 hidden sm:inline">
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
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <ExchangeSelector
          selectedExchanges={selectedExchanges}
          onSelectedExchangesChange={setSelectedExchanges}
        />

        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[18px] font-bold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                Dashboard
              </h2>
              <span className="text-[12px] text-gray-400">Top 5 insights first</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {topSignalInsights.top5.map((row) => (
                <div key={row.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                  <p className="text-[12px] text-gray-500">{row.symbol.replace('USDT', '')}</p>
                  <p className="text-[16px] font-semibold text-white">{formatPrice(row.price)}</p>
                  <p className={`text-[13px] font-medium ${row.bias === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>
                    {row.bias === 'LONG' ? '🟢 Long' : '🔴 Short'} · {row.confidence}%
                  </p>
                </div>
              ))}
            </div>

            <MarketOverviewPanel selectedExchanges={selectedExchanges} />
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-[18px] font-bold flex items-center gap-2">🔥 Short-Term Trade Signals</h2>
                <p className="text-[12px] text-gray-400 mt-1">Quick Trade Opportunities with confidence scoring and bias auto-classification.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[12px]">
                <select
                  value={signalTimeframe}
                  onChange={(e) => setSignalTimeframe(e.target.value as '5m' | '15m' | '1h' | '4h')}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5"
                >
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                  <option value="4h">4h</option>
                </select>
                <select
                  value={signalSortBy}
                  onChange={(e) => setSignalSortBy(e.target.value as 'confidence' | 'volume' | 'move')}
                  className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5"
                >
                  <option value="confidence">Highest confidence</option>
                  <option value="volume">Highest volume</option>
                  <option value="move">Biggest move</option>
                </select>
                <label className="inline-flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded px-2 py-1.5">
                  <input type="checkbox" checked={minConfidence70Only} onChange={(e) => setMinConfidence70Only(e.target.checked)} /> 70+ only
                </label>
                <label className="inline-flex items-center gap-1.5 bg-gray-900 border border-gray-700 rounded px-2 py-1.5">
                  <input type="checkbox" checked={highVolumeOnly} onChange={(e) => setHighVolumeOnly(e.target.checked)} /> High volume only
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                <p className="text-[11px] text-gray-500">Avg confidence</p>
                <p className="text-[18px] font-semibold text-cyan-300">{topSignalInsights.avgConfidence}%</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                <p className="text-[11px] text-gray-500">Strong trades</p>
                <p className="text-[18px] font-semibold text-green-300">{topSignalInsights.strongCount}</p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                <p className="text-[11px] text-gray-500">Good+ trades</p>
                <p className="text-[18px] font-semibold text-yellow-300">{topSignalInsights.goodCount}</p>
              </div>
            </div>

            {signalFlips.length > 0 && (
              <div className="rounded-lg border border-indigo-700/40 bg-indigo-900/10 p-3">
                <h3 className="text-[16px] font-semibold text-indigo-200 mb-2">Signal Change Detector</h3>
                <div className="flex flex-wrap gap-2">
                  {signalFlips.map((flip) => (
                    <span key={`${flip.symbol}-${flip.from}-${flip.to}`} className="text-[12px] px-2 py-1 rounded border border-indigo-700/40 bg-gray-900/60">
                      {flip.symbol.replace('USDT', '')}: {flip.from} → {flip.to}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <SignalPanel
              title="🟢 LONG Opportunities"
              rows={longOpportunities}
              accentClass="border-green-700/40 bg-green-900/10"
              onNotify={(symbol) => setNotifiedSymbols((prev) => new Set(prev).add(symbol))}
              notifiedSymbols={notifiedSymbols}
            />
            <SignalPanel
              title="🔴 SHORT Opportunities"
              rows={shortOpportunities}
              accentClass="border-red-700/40 bg-red-900/10"
              onNotify={(symbol) => setNotifiedSymbols((prev) => new Set(prev).add(symbol))}
              notifiedSymbols={notifiedSymbols}
            />
          </div>
        )}

        {activeTab === 'predictions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold">🧠 AI Predictions</h2>
              <span className="text-[12px] text-gray-400">Top 5 first, then details</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {filteredSignals.slice(0, 5).map((row) => (
                <div key={`pred-${row.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                  <p className="text-[12px] text-gray-500">{row.symbol.replace('USDT', '')}</p>
                  <p className="text-[16px] font-semibold text-white">{row.confidence}%</p>
                  <p className="text-[12px] text-cyan-300">Trade Score: {Math.round(row.indicatorScore)}</p>
                  <p className={`text-[12px] ${row.scoreBand === 'STRONG' ? 'text-green-300' : row.scoreBand === 'GOOD' ? 'text-cyan-300' : row.scoreBand === 'RISKY' ? 'text-yellow-300' : 'text-red-300'}`}>
                    {row.scoreBand}
                  </p>
                </div>
              ))}
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-x-auto">
              <table className="w-full min-w-[860px] text-[13px]">
                <thead>
                  <tr className="text-[12px] text-gray-500 border-b border-gray-800">
                    <th className="text-left py-2 px-3">Coin</th>
                    <th className="text-right py-2 px-3">Bias</th>
                    <th className="text-right py-2 px-3">Confidence</th>
                    <th className="text-right py-2 px-3">Score Band</th>
                    <th className="text-right py-2 px-3">Vol Ratio</th>
                    <th className="text-right py-2 px-3">Move</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSignals.slice(0, 50).map((row) => (
                    <tr key={`ai-${row.symbol}`} className="border-b border-gray-800/50">
                      <td className="py-2 px-3 text-gray-200">{row.symbol.replace('USDT', '')}</td>
                      <td className={`py-2 px-3 text-right font-semibold ${row.bias === 'LONG' ? 'text-green-400' : 'text-red-400'}`}>{row.bias}</td>
                      <td className="py-2 px-3 text-right text-gray-200">{row.confidence}%</td>
                      <td className="py-2 px-3 text-right text-cyan-200">{row.scoreBand}</td>
                      <td className="py-2 px-3 text-right text-gray-300">{row.volumeRatio.toFixed(2)}x</td>
                      <td className={`py-2 px-3 text-right ${row.priceChangePercent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {row.priceChangePercent >= 0 ? '+' : ''}{row.priceChangePercent.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'marketdata' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold">📉 Market Data</h2>
              <span className="text-[12px] text-gray-400">Heatmap + scanner + top movers</span>
            </div>
            <div>
              <h3 className="text-[16px] font-semibold mb-2">Top 5 Market Insights</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {[...coins]
                  .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
                  .slice(0, 5)
                  .map((coin) => (
                    <div key={`mk-${coin.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                      <p className="text-[12px] text-gray-500">{coin.symbol.replace('USDT', '')}</p>
                      <p className="text-[14px] font-semibold text-white">{formatPrice(coin.price)}</p>
                      <p className={`text-[12px] ${coin.priceChangePercent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {coin.priceChangePercent >= 0 ? '+' : ''}{coin.priceChangePercent.toFixed(2)}%
                      </p>
                    </div>
                  ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <h3 className="text-[16px] font-semibold mb-2">Market Heatmap</h3>
              <CoinHeatmap
                coins={coins}
                loading={loading}
                onAddToWatchlist={addCoin}
                isWatching={isWatching}
              />
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-3">
              <h3 className="text-[16px] font-semibold mb-2">Scanner</h3>
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
              <div className="mt-3">
                <MarketScanner
                  coins={scannerCoins}
                  loading={loading}
                  onAddToWatchlist={addCoin}
                  isWatching={isWatching}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'journal' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[18px] font-bold">📒 Trade Journal</h2>
              <span className="text-[12px] text-gray-400">Auto-logged signals & performance stats</span>
            </div>

            {journalLoading ? (
              <div className="text-[14px] text-gray-400">Loading trade journal…</div>
            ) : !journalData ? (
              <div className="text-[14px] text-gray-400">No journal data available.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                  <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <p className="text-[11px] text-gray-500">Total Signals</p>
                    <p className="text-[18px] font-semibold text-white">{journalData.stats?.totalSignals ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <p className="text-[11px] text-gray-500">Buy Signals</p>
                    <p className="text-[18px] font-semibold text-green-300">{journalData.stats?.buySignals ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <p className="text-[11px] text-gray-500">Sell Signals</p>
                    <p className="text-[18px] font-semibold text-red-300">{journalData.stats?.sellSignals ?? 0}</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <p className="text-[11px] text-gray-500">Win Rate</p>
                    <p className="text-[18px] font-semibold text-cyan-300">{Math.round(journalData.stats?.winRate ?? 0)}%</p>
                  </div>
                  <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                    <p className="text-[11px] text-gray-500">Pending</p>
                    <p className="text-[18px] font-semibold text-yellow-300">{journalData.stats?.pendingOutcomes ?? 0}</p>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-800 bg-gray-900/60 overflow-x-auto">
                  <table className="w-full min-w-[860px] text-[13px]">
                    <thead>
                      <tr className="text-[12px] text-gray-500 border-b border-gray-800">
                        <th className="text-left py-2 px-3">Coin</th>
                        <th className="text-right py-2 px-3">Signal</th>
                        <th className="text-right py-2 px-3">Confidence</th>
                        <th className="text-right py-2 px-3">Net RR</th>
                        <th className="text-right py-2 px-3">Outcome</th>
                        <th className="text-right py-2 px-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(journalData.entries ?? []).slice().reverse().slice(0, 100).map((entry) => (
                        <tr key={entry.id} className="border-b border-gray-800/50">
                          <td className="py-2 px-3 text-gray-200">{entry.symbol.replace('USDT', '')}</td>
                          <td className={`py-2 px-3 text-right font-semibold ${entry.signal === 'BUY' ? 'text-green-400' : entry.signal === 'SELL' ? 'text-red-400' : 'text-yellow-400'}`}>
                            {entry.signal}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-200">{Math.round(entry.confidence)}%</td>
                          <td className="py-2 px-3 text-right text-cyan-200">{entry.netRR.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-gray-300">{entry.outcome}</td>
                          <td className="py-2 px-3 text-right text-gray-400">{new Date(entry.createdAt).toLocaleTimeString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
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
