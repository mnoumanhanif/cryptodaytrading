'use client';

// ============================================================
// Main dashboard layout with tabbed navigation:
//   Heatmap | Scanner | Top 500 | Watchlist
// ============================================================

import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { useWatchList } from '@/hooks/useWatchList';
import { useCustomMarketPairs } from '@/hooks/useCustomMarketPairs';
import { filterCoins, SignalFilter, SortField } from '@/hooks/useCoinSearch';
import { formatPrice, formatVolume } from '@/lib/utils';
import MarketScanner from './MarketScanner';
import WatchList from './WatchList';
import CoinFilter from './CoinFilter';
import CoinHeatmap from './CoinHeatmap';
import CoinPagination from './CoinPagination';
import MarketOverviewPanel from './MarketOverviewPanel';
import LiveSignalMarquee from './LiveSignalMarquee';
import PortfolioNotifications from './PortfolioNotifications';
import AddMarketPairModal from './AddMarketPairModal';
import { usePortfolioNotifications } from '@/hooks/usePortfolioNotifications';
import { SupportedExchange } from '@/lib/exchangeMarket';
import { CoinAnalysis } from '@/lib/types';

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
type DashboardTab =
  | 'overview'
  | 'heatmap'
  | 'scanner'
  | 'top500'
  | 'patterns'
  | 'suggestions'
  | 'liquidations'
  | 'quicksignals'
  | 'liquidationintel'
  | 'warnings'
  | 'volumewhales'
  | 'smartwatchlist'
  | 'watchlist';
type PrimaryNavGroup = {
  id: 'markets' | 'signals' | 'intelligence' | 'analysis' | 'portfolio';
  label: string;
  tabIds: DashboardTab[];
};
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
const LIQUIDATION_SIGNAL_THRESHOLD = 0.3;
const HIGH_VOLUME_RATIO_THRESHOLD = 1.8;
const HIGH_LIQUIDATION_INTENSITY_THRESHOLD = 50;
const ENTRY_REACHED_THRESHOLD_PERCENT = 0.3;
const MAX_GENERATED_NOTIFICATIONS_PER_UPDATE = 12;
const LIQUIDATION_CONFIDENCE_IMBALANCE_WEIGHT = 120;
const LIQUIDATION_CONFIDENCE_INTENSITY_WEIGHT = 0.25;
const MIN_PATTERN_WIN_PROBABILITY = 40;
const MAX_PATTERN_WIN_PROBABILITY = 92;
const PATTERN_BASE_WEIGHT = 0.65;
const PATTERN_CONFIDENCE_WEIGHT = 0.35;
const PATTERN_BULLISH_STOP_LOSS_FACTOR = 0.98;
const PATTERN_BEARISH_STOP_LOSS_FACTOR = 1.02;
const PATTERN_BULLISH_TAKE_PROFIT_FACTOR = 1.048;
const PATTERN_BEARISH_TAKE_PROFIT_FACTOR = 0.952;
const PATTERN_RSI_OVERBOUGHT_THRESHOLD = 65;
const PATTERN_RSI_OVERSOLD_THRESHOLD = 40;
const PATTERN_VOLUME_SPIKE_THRESHOLD = 1.6;
const PATTERN_STRUCTURE_STRENGTH_THRESHOLD = 1.5;
const SCANNER_PAGE_SIZE = 200;
const DEFAULT_TOTAL_SCANNED = 1000;
const TOP500_PAGE_SIZE = 500;

const UI_HEADING_CLASS = 'text-[20px] font-bold';
const UI_SECTION_TITLE_CLASS = 'text-[17px] font-semibold';
const UI_DATA_TEXT_CLASS = 'text-sm';
const UI_SMALL_LABEL_CLASS = 'text-[11px]';
const PRIMARY_NAV_GROUPS: PrimaryNavGroup[] = [
  {
    id: 'markets',
    label: 'Markets',
    tabIds: ['top500', 'heatmap', 'scanner'],
  },
  {
    id: 'signals',
    label: 'Signals',
    tabIds: ['quicksignals', 'suggestions'],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    tabIds: ['liquidations', 'liquidationintel', 'volumewhales'],
  },
  {
    id: 'analysis',
    label: 'Analysis',
    tabIds: ['patterns', 'warnings'],
  },
  {
    id: 'portfolio',
    label: 'Portfolio',
    tabIds: ['watchlist'],
  },
];

type CandlePattern = {
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Reversal';
  idea: string;
  confirmation: string;
  riskHint: string;
  candles: { open: number; high: number; low: number; close: number }[];
};

type PatternCoinMatches = Record<string, string[]>;
type PatternStatus = 'Forming' | 'Confirmed' | 'Invalidated';
type PatternPriority = 'High Opportunity' | 'Medium' | 'Low Quality';
type PatternTimeframe = '5m' | '15m' | '1h';
type PatternBiasFilter = 'all' | 'Bullish' | 'Bearish';
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

type QuickSignalBias = 'Long' | 'Short';
type SignalStrength = 'Strong' | 'Medium' | 'Weak';
type TradeConfidenceBand = 'Avoid' | 'Risky' | 'Good' | 'Strong trade';
type QuickSignalSort = 'confidence' | 'volume' | 'move';
type QuickSignalTimeframe = '5m' | '15m' | '1h' | '4h';
type SignalChangeDirection = 'LONG_TO_SHORT' | 'SHORT_TO_LONG';

type QuickSignalItem = {
  symbol: string;
  price: number;
  bias: QuickSignalBias;
  signalStrength: SignalStrength;
  confidence: number;
  confidenceBand: TradeConfidenceBand;
  entry: number;
  stopLoss: number;
  target: number;
  referenceEntry: number;
  volumeRatio: number;
  biggestMove: number;
};

type QuickSignalAlertType = 'SIGNAL_APPEARED' | 'CONFIDENCE_INCREASED' | 'ENTRY_REACHED';

type QuickSignalAlert = {
  symbol: string;
  type: QuickSignalAlertType;
  message: string;
  confidence: number;
  bias: QuickSignalBias;
};

type PatternDecisionCard = {
  pattern: CandlePattern;
  status: PatternStatus;
  priority: PatternPriority;
  timeframe: PatternTimeframe;
  confidence: number;
  winProbability: number;
  trendContext: string;
  volumeContext: string;
  locationContext: string;
  confluence: Array<{ label: string; pass: boolean }>;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  liveCoins: string[];
  aiInsight: string;
  liquidationInsight: string;
  actionLine: string;
};

function getSignalStrength(confidence: number): SignalStrength {
  if (confidence >= 85) return 'Strong';
  if (confidence >= 70) return 'Medium';
  return 'Weak';
}

function getConfidenceBand(confidence: number): TradeConfidenceBand {
  if (confidence < 50) return 'Avoid';
  if (confidence < 70) return 'Risky';
  if (confidence < 85) return 'Good';
  return 'Strong trade';
}

function inferBiasFromLiquidation(imbalance: number): QuickSignalBias {
  return imbalance >= 0 ? 'Long' : 'Short';
}

function pressureLabel(imbalance: number): string {
  if (imbalance > LIQUIDATION_SIGNAL_THRESHOLD) return `🟢 Bullish Pressure (+${imbalance.toFixed(2)})`;
  if (imbalance < -LIQUIDATION_SIGNAL_THRESHOLD) return `🔴 Bearish Pressure (${imbalance.toFixed(2)})`;
  return `🟡 Neutral Pressure (${imbalance.toFixed(2)})`;
}

function signalLabelFromImbalance(imbalance: number): 'LONG' | 'SHORT' | 'WAIT' {
  if (imbalance > LIQUIDATION_SIGNAL_THRESHOLD) return 'LONG';
  if (imbalance < -LIQUIDATION_SIGNAL_THRESHOLD) return 'SHORT';
  return 'WAIT';
}

function pressureColorFromImbalance(imbalance: number): string {
  if (imbalance > LIQUIDATION_SIGNAL_THRESHOLD) return 'text-green-300';
  if (imbalance < -LIQUIDATION_SIGNAL_THRESHOLD) return 'text-red-300';
  return 'text-yellow-300';
}

function biasBadgeClass(bias: QuickSignalBias): string {
  return bias === 'Long'
    ? 'text-green-300 border-green-600/50 bg-green-900/30'
    : 'text-red-300 border-red-600/50 bg-red-900/30';
}

function strengthBadgeClass(strength: SignalStrength): string {
  if (strength === 'Strong') return 'text-green-200 border-green-500/40 bg-green-500/15';
  if (strength === 'Medium') return 'text-yellow-200 border-yellow-500/40 bg-yellow-500/15';
  return 'text-orange-200 border-orange-500/40 bg-orange-500/15';
}

function liquidationVisualBar(value: number, maxValue: number): string {
  const BAR_STEPS = 12;
  const ratio = maxValue > 0 ? Math.min(1, Math.max(0, value / maxValue)) : 0;
  const filled = Math.round(ratio * BAR_STEPS);
  return `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, BAR_STEPS - filled))}`;
}

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

const PATTERN_BASE_WIN_PROBABILITY: Record<string, number> = {
  Hammer: 76,
  'Bullish Engulfing': 82,
  'Shooting Star': 74,
  'Doji (Indecision)': 52,
  'Morning Star': 84,
  'Evening Star': 73,
  'Bearish Engulfing': 79,
  'Inverted Hammer': 75,
  'Three White Soldiers': 80,
  'Three Black Crows': 78,
};

const PATTERN_DEFAULT_TIMEFRAME: Record<string, PatternTimeframe> = {
  Hammer: '15m',
  'Bullish Engulfing': '15m',
  'Shooting Star': '15m',
  'Doji (Indecision)': '5m',
  'Morning Star': '1h',
  'Evening Star': '1h',
  'Bearish Engulfing': '15m',
  'Inverted Hammer': '15m',
  'Three White Soldiers': '1h',
  'Three Black Crows': '1h',
};

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
  customPairs,
  customCoins,
  onOpenAddMarketPair,
}: {
  selectedExchanges: SupportedExchange[];
  isWatching: (symbol: string) => boolean;
  customPairs: string[];
  customCoins: CoinAnalysis[];
  onOpenAddMarketPair: () => void;
}) {
  const [coins, setCoins] = useState<TopCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(500);
  const [sort, setSort] = useState<Top500SortField>('volume');
  const [search, setSearch] = useState('');

  const LIMIT = TOP500_PAGE_SIZE;

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

  // Client-side search filter + custom pair prioritization
  const displayCoins = useMemo(() => {
    let filtered = [...coins];
    if (search.trim()) {
      const q = search.trim().toUpperCase().replace('USDT', '');
      filtered = filtered.filter((c) => c.symbol.replace('USDT', '').includes(q));
    }
    if (customPairs.length > 0) {
      const customSet = new Set(customPairs);
      const customRowsFromTop = filtered.filter((coin) => customSet.has(coin.symbol));
      const missingCustomRows: TopCoin[] = customCoins
        .filter((coin) => customSet.has(coin.symbol))
        .filter((coin) => !customRowsFromTop.some((row) => row.symbol === coin.symbol))
        .map((coin) => ({
          symbol: coin.symbol,
          price: coin.price,
          priceChange: coin.priceChange24h,
          priceChangePercent: coin.priceChangePercent,
          volume24h: coin.volume24h,
          high24h: coin.high24h,
          low24h: coin.low24h,
          rank: 0,
        }));
      const regularRows = filtered.filter((coin) => !customSet.has(coin.symbol));
      filtered = [...customRowsFromTop, ...missingCustomRows, ...regularRows];
    }
    return filtered;
  }, [coins, search, customCoins, customPairs]);

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
            placeholder="Search by symbol (e.g., BTC, ETH, SOL)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500 focus:shadow-[0_0_0_1px_#22c55e]"
          />
        </div>

        <button
          type="button"
          onClick={onOpenAddMarketPair}
          className="px-3 py-2 rounded-lg border border-cyan-600/50 bg-cyan-900/20 hover:bg-cyan-900/40 text-cyan-300 text-xs font-medium transition-colors"
        >
          ➕ Add Market Pair
        </button>

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
          Showing {displayCoins.length} of {total} coins{customPairs.length > 0 ? ` (+${customPairs.length} custom)` : ''}
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
              ? Array.from({ length: 25 }).map((_, i) => (
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
                      <td className="py-2.5 pl-2 text-xs text-gray-600">{coin.rank > 0 ? coin.rank : '★'}</td>
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

    </div>
  );
}

function CandlePatternsPanel({
  patternCards,
  learningMode,
  loading,
  error,
}: {
  patternCards: PatternDecisionCard[];
  learningMode: boolean;
  loading: boolean;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-700/70 bg-gradient-to-r from-gray-900 via-gray-900 to-indigo-950/40 p-4">
        <h3 className="text-sm font-semibold text-white">Professional Pattern Decision Grid</h3>
        <p className="text-xs text-gray-400 mt-1">
          Pattern cards are ranked by trade quality and include status, confluence, and action guidance.
        </p>
        <p className="text-xs text-cyan-300/90 mt-2">
          {loading ? 'Scanning Binance for live pattern opportunities…' : 'Live Binance coin candidates are attached to each decision card.'}
        </p>
        {error && <p className="text-xs text-yellow-300/90 mt-1">Using fallback matches: {error}</p>}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {patternCards.map((card) => {
          return (
            <PatternLearningCard
              key={card.pattern.name}
              card={card}
              learningMode={learningMode}
            />
          );
        })}
      </div>
    </div>
  );
}

function PatternLearningCard({ card, learningMode }: { card: PatternDecisionCard; learningMode: boolean }) {
  const [visibleCandles, setVisibleCandles] = useState(1);
  const [autoPlay, setAutoPlay] = useState(false);
  const { pattern } = card;
  const totalCandles = pattern.candles.length;
  const tone =
    pattern.bias === 'Bullish'
      ? 'text-green-300 border-green-500/30 bg-green-500/10'
      : pattern.bias === 'Bearish'
      ? 'text-red-300 border-red-500/30 bg-red-500/10'
      : 'text-yellow-300 border-yellow-500/30 bg-yellow-500/10';
  const statusTone =
    card.status === 'Confirmed'
      ? 'text-emerald-200 border-emerald-500/40 bg-emerald-500/15'
      : card.status === 'Forming'
      ? 'text-yellow-200 border-yellow-500/40 bg-yellow-500/15'
      : 'text-rose-200 border-rose-500/40 bg-rose-500/15';
  const statusLabel = card.status === 'Confirmed' ? '✅ Confirmed' : card.status === 'Forming' ? '🆕 Forming' : '❌ Invalidated';
  const priorityTone =
    card.priority === 'High Opportunity'
      ? 'text-orange-100 border-orange-400/50 bg-orange-500/20'
      : card.priority === 'Medium'
      ? 'text-sky-100 border-sky-400/50 bg-sky-500/20'
      : 'text-yellow-100 border-yellow-400/50 bg-yellow-500/20';
  const priorityLabel = card.priority === 'High Opportunity' ? '🔥 High Opportunity' : card.priority === 'Medium' ? '⚡ Medium' : '⚠️ Low Quality';
  const confidenceGlow =
    card.winProbability >= 80
      ? 'shadow-[0_0_0_1px_rgba(16,185,129,0.55),0_0_24px_rgba(16,185,129,0.25)]'
      : card.winProbability >= 60
      ? 'shadow-[0_0_0_1px_rgba(234,179,8,0.55),0_0_24px_rgba(234,179,8,0.2)]'
      : 'shadow-[0_0_0_1px_rgba(239,68,68,0.55),0_0_24px_rgba(239,68,68,0.2)]';

  useEffect(() => {
    if (!learningMode || !autoPlay) return;

    if (visibleCandles >= totalCandles) {
      setAutoPlay(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCandles((current) => Math.min(totalCandles, current + 1));
    }, AUTO_PLAY_INTERVAL_MS);

    return () => window.clearTimeout(timer);
  }, [autoPlay, learningMode, totalCandles, visibleCandles]);

  useEffect(() => {
    if (!learningMode) {
      setAutoPlay(false);
      setVisibleCandles(totalCandles);
    } else {
      setVisibleCandles(1);
    }
  }, [learningMode, totalCandles]);

  const simulationState =
    visibleCandles === 1
      ? 'Setup candle'
      : visibleCandles === totalCandles
      ? 'Pattern confirmed'
      : 'Pattern forming';

  return (
    <div className={`rounded-xl border border-gray-600/70 bg-gray-800/95 p-4 space-y-3 ${confidenceGlow}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-gray-100">{pattern.name}</h4>
          <p className="text-[11px] text-gray-400 mt-0.5">Win Probability: {card.winProbability}%</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-1">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${tone}`}>{pattern.bias}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${statusTone}`}>{statusLabel}</span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${priorityTone}`}>{priorityLabel}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded border border-gray-700 bg-gray-900/70 px-2.5 py-2">
          <p className="text-gray-500">📊 Signal Status</p>
          <p className="text-gray-100 font-semibold mt-0.5">{statusLabel}</p>
        </div>
        <div className="rounded border border-gray-700 bg-gray-900/70 px-2.5 py-2">
          <p className="text-gray-500">📡 Timeframe</p>
          <p className="text-gray-100 font-semibold mt-0.5">{card.timeframe}</p>
        </div>
      </div>

      <PatternMiniChart candles={pattern.candles.slice(0, learningMode ? visibleCandles : totalCandles)} patternName={pattern.name} />

      {learningMode && (
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-2.5 py-2">
          <p className="text-[11px] text-cyan-200">
            Learning Mode: Candle {visibleCandles} / {totalCandles} · {simulationState}
          </p>
          <div className="flex items-center gap-2 mt-2">
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
        </div>
      )}

      <div className="rounded-lg border border-gray-700 bg-gray-900/80 px-2.5 py-2 text-[11px] space-y-1">
        <p className="text-cyan-200 font-semibold">💡 Market Context:</p>
        <p className="text-gray-300">• Trend: {card.trendContext}</p>
        <p className="text-gray-300">• Volume: {card.volumeContext}</p>
        <p className="text-gray-300">• Location: {card.locationContext}</p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/80 px-2.5 py-2 text-[11px]">
        <p className="text-cyan-200 font-semibold mb-1">🧠 Confluence:</p>
        <div className="grid grid-cols-2 gap-y-1 gap-x-2">
          {card.confluence.map((item) => (
            <p key={`${pattern.name}-${item.label}`} className={item.pass ? 'text-emerald-200' : 'text-yellow-200'}>
              {item.pass ? '✔' : '✖'} {item.label}
            </p>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/80 px-2.5 py-2 text-[11px]">
        <p className="text-cyan-200 font-semibold mb-1">🎯 Trade Setup:</p>
        <div className="grid grid-cols-3 gap-2">
          <p className="text-gray-200">Entry: <span className="font-mono">{formatPrice(card.entry)}</span></p>
          <p className="text-rose-300">SL: <span className="font-mono">{formatPrice(card.stopLoss)}</span></p>
          <p className="text-emerald-300">TP: <span className="font-mono">{formatPrice(card.takeProfit)}</span></p>
        </div>
        <p className="text-cyan-100 mt-1">R:R = 1 : {card.riskReward.toFixed(1)}</p>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-900/80 px-2.5 py-2 text-[11px] space-y-1">
        <p className="text-gray-400">📈 Live Coins:</p>
        <p className="text-gray-200">{card.liveCoins.length > 0 ? card.liveCoins.join(', ') : 'No clear match right now'}</p>
      </div>

      <div className="rounded-lg border border-violet-600/30 bg-violet-900/15 px-2.5 py-2 text-[11px]">
        <p className="text-violet-200 font-semibold">🤖 AI Insight:</p>
        <p className="text-gray-200 mt-0.5">{card.aiInsight}</p>
      </div>

      <div className="rounded-lg border border-orange-600/30 bg-orange-900/15 px-2.5 py-2 text-[11px]">
        <p className="text-orange-200 font-semibold">💣 Liquidation Insight:</p>
        <p className="text-gray-200 mt-0.5">{card.liquidationInsight}</p>
      </div>

      <div className="rounded-lg border border-cyan-600/40 bg-cyan-900/15 px-2.5 py-2 text-[11px]">
        <p className="text-cyan-100 font-semibold">👉 Action: {card.actionLine}</p>
      </div>
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
  const customMarketPairs = useCustomMarketPairs();
  const [addMarketPairOpen, setAddMarketPairOpen] = useState(false);

  const [query, setQuery] = useState('');
  const [signalFilter, setSignalFilter] = useState<SignalFilter>('ALL');
  const [sortBy, setSortBy] = useState<SortField>('score');
  const [scannerPage, setScannerPage] = useState(1);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [openPrimaryNav, setOpenPrimaryNav] = useState<PrimaryNavGroup['id'] | null>(null);
  const [quickSignalTimeframe, setQuickSignalTimeframe] = useState<QuickSignalTimeframe>('15m');
  const [quickSignalSort, setQuickSignalSort] = useState<QuickSignalSort>('confidence');
  const [quickSignalConfidenceOnly70, setQuickSignalConfidenceOnly70] = useState(true);
  const [quickSignalVolumeHighOnly, setQuickSignalVolumeHighOnly] = useState(false);
  const [liquidationTimeframe, setLiquidationTimeframe] = useState<'5m' | '15m' | '1h'>('15m');
  const [liquidationMinImbalance, setLiquidationMinImbalance] = useState(0.3);
  const [liquidationHighOnly, setLiquidationHighOnly] = useState(false);
  const [patternCoinMatches, setPatternCoinMatches] = useState<PatternCoinMatches>(() => buildPatternCoinMatches(coins));
  const [patternMatchesLoading, setPatternMatchesLoading] = useState(false);
  const [patternMatchesError, setPatternMatchesError] = useState<string | null>(null);
  const [patternBiasFilter, setPatternBiasFilter] = useState<PatternBiasFilter>('all');
  const [patternMinConfidence, setPatternMinConfidence] = useState(70);
  const [patternTimeframeFilter, setPatternTimeframeFilter] = useState<'all' | PatternTimeframe>('all');
  const [patternConfirmedOnly, setPatternConfirmedOnly] = useState(true);
  const [patternLearningMode, setPatternLearningMode] = useState(false);
  const [notifySymbols, setNotifySymbols] = useState<Record<string, boolean>>({});
  const [signalAlerts, setSignalAlerts] = useState<QuickSignalAlert[]>([]);
  const [signalChanges, setSignalChanges] = useState<Array<{ symbol: string; change: SignalChangeDirection; confidence: number }>>([]);
  const previousSignalStateRef = useRef<Record<string, { bias: QuickSignalBias; confidence: number }>>({});
  const marqueeSignalSeenRef = useRef<Record<string, number>>({});
  const portfolioSignalStateRef = useRef<Record<string, { bias: QuickSignalBias; confidence: number }>>({});
  const portfolioRiskStateRef = useRef<Record<string, boolean>>({});
  const portfolioSqueezeStateRef = useRef<Record<string, string>>({});
  const { notifications, unreadCount, pushNotifications, markAsRead, markAllAsRead } = usePortfolioNotifications();
  const primaryNavRef = useRef<HTMLDivElement | null>(null);
  const selectedExchangeLabels = selectedExchanges.map((exchange) => EXCHANGE_LABELS[exchange]).join(', ');
  const trackedCustomSymbols = useMemo(
    () => Array.from(new Set([...customMarketPairs.scannerSymbols, ...customMarketPairs.signalsSymbols])),
    [customMarketPairs.scannerSymbols, customMarketPairs.signalsSymbols]
  );

  const handleAddMarketPair = useCallback(
    (coin: CoinAnalysis, targets: { scanner: boolean; watchlist: boolean; signals: boolean }) => {
      const alreadyTracked = customMarketPairs.hasPair(coin.symbol);
      customMarketPairs.addPair(coin.symbol, targets);
      if (targets.watchlist) {
        addCoin(coin);
      }

      if (!alreadyTracked && (targets.scanner || targets.signals)) {
        const requestSymbols = Array.from(
          new Set([
            ...trackedCustomSymbols,
            ...(targets.scanner || targets.signals ? [coin.symbol] : []),
          ])
        );
        void refetch(requestSymbols);
      }
    },
    [addCoin, customMarketPairs, refetch, trackedCustomSymbols]
  );

  useEffect(() => {
    void refetch(trackedCustomSymbols);
  }, [refetch, trackedCustomSymbols]);
  const getTabLabel = useCallback(
    (tabId: DashboardTab) => {
      if (tabId === 'watchlist') return `Watchlist${items.length > 0 ? ` (${items.length})` : ''}`;
      if (tabId === 'top500') return 'Top 500';
      if (tabId === 'quicksignals') return 'Quick Signals';
      if (tabId === 'liquidationintel') return 'Liquidation Intel';
      if (tabId === 'volumewhales') return 'Volume & Whales';
      if (tabId === 'liquidations') return 'Liquidations';
      if (tabId === 'suggestions') return 'Suggestions';
      if (tabId === 'heatmap') return 'Heatmap';
      if (tabId === 'scanner') return 'Scanner';
      if (tabId === 'patterns') return 'Patterns';
      if (tabId === 'warnings') return 'Warnings';
      return tabId;
    },
    [items.length]
  );

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
    if (
      tab &&
      ['overview', 'heatmap', 'scanner', 'top500', 'patterns', 'suggestions', 'liquidations', 'quicksignals', 'liquidationintel', 'warnings', 'volumewhales', 'smartwatchlist', 'watchlist'].includes(tab)
    ) {
      setActiveTab(tab);
    }
  }, []);

  const handleTabChange = (tab: DashboardTab) => {
    setActiveTab(tab);
    setOpenPrimaryNav(null);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', tab);
    if (tab !== 'top500') params.delete('page');
    window.history.pushState({}, '', `?${params.toString()}`);
  };

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!primaryNavRef.current) return;
      if (!primaryNavRef.current.contains(event.target as Node)) {
        setOpenPrimaryNav(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenPrimaryNav(null);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const displayCoins = useMemo(() => {
    return filterCoins(coins, query, signalFilter, sortBy);
  }, [coins, query, signalFilter, sortBy]);
  const scannerTotalPages = useMemo(
    () => Math.max(1, Math.ceil(displayCoins.length / SCANNER_PAGE_SIZE)),
    [displayCoins.length]
  );
  const scannerCoins = useMemo(() => {
    const start = (scannerPage - 1) * SCANNER_PAGE_SIZE;
    return displayCoins.slice(start, start + SCANNER_PAGE_SIZE);
  }, [displayCoins, scannerPage]);
  useEffect(() => {
    setScannerPage(1);
  }, [query, signalFilter, sortBy, selectedExchanges, coins.length]);
  useEffect(() => {
    if (scannerPage > scannerTotalPages) {
      setScannerPage(scannerTotalPages);
    }
  }, [scannerPage, scannerTotalPages]);

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

  const quickTradeSignals = useMemo<QuickSignalItem[]>(() => {
    const timeframeMultiplier: Record<QuickSignalTimeframe, number> = {
      '5m': 0.9,
      '15m': 1,
      '1h': 1.08,
      '4h': 1.15,
    };

    const multiplier = timeframeMultiplier[quickSignalTimeframe];

    const scored = coins.map((coin) => {
      const rsi = coin.indicators.rsi.value;
      const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
      const support = coin.indicators.fibonacci?.nearestSupport ?? coin.risk.stopLoss;
      const resistance = coin.indicators.fibonacci?.nearestResistance ?? coin.risk.targetPrice;
      const supportDistancePct = support > 0 ? Math.abs((coin.price - support) / support) * 100 : 100;
      const resistanceDistancePct = resistance > 0 ? Math.abs((resistance - coin.price) / resistance) * 100 : 100;
      const trendScore = coin.indicators.ma.trend === 'bullish' ? 100 : coin.indicators.ma.trend === 'bearish' ? 0 : 50;
      const bullishCandleProxy = coin.signal === 'BUY' ? 100 : coin.signal === 'HOLD' ? 45 : 20;
      const bearishCandleProxy = coin.signal === 'SELL' ? 100 : coin.signal === 'HOLD' ? 45 : 20;
      const volumeWeight = Math.min(100, volumeRatio * 50);
      const longRsiWeight = rsi < 30 ? 100 : rsi < 40 ? 70 : 25;
      const shortRsiWeight = rsi > 70 ? 100 : rsi > 60 ? 70 : 25;
      const longSupportWeight = supportDistancePct <= 1.2 ? 100 : supportDistancePct <= 2 ? 75 : 35;
      const shortResistanceWeight = resistanceDistancePct <= 1.2 ? 100 : resistanceDistancePct <= 2 ? 75 : 35;
      const longTrendWeight = trendScore;
      const shortTrendWeight = 100 - trendScore;

      const longScoreRaw = longRsiWeight * 0.32 + volumeWeight * 0.24 + longTrendWeight * 0.22 + longSupportWeight * 0.22;
      const shortScoreRaw = shortRsiWeight * 0.32 + volumeWeight * 0.24 + shortTrendWeight * 0.22 + shortResistanceWeight * 0.22;

      const longConfidence = Math.round(Math.min(99, longScoreRaw * multiplier * (bullishCandleProxy >= 80 ? 1.06 : 0.98)));
      const shortConfidence = Math.round(Math.min(99, shortScoreRaw * multiplier * (bearishCandleProxy >= 80 ? 1.06 : 0.98)));
      const bias: QuickSignalBias = longConfidence >= shortConfidence ? 'Long' : 'Short';
      const confidence = Math.max(longConfidence, shortConfidence);
      const signalStrength = getSignalStrength(confidence);
      const confidenceBand = getConfidenceBand(confidence);
      const entry = coin.price;
      const referenceEntry = coin.risk.entryPrice > 0 ? coin.risk.entryPrice : entry;
      const stopLoss = bias === 'Long'
        ? Math.min(entry * 0.985, coin.risk.stopLoss > 0 ? coin.risk.stopLoss : entry * 0.985)
        : Math.max(entry * 1.015, coin.risk.stopLoss > 0 ? coin.risk.stopLoss : entry * 1.015);
      const target = bias === 'Long'
        ? Math.max(entry * 1.03, coin.risk.targetPrice > 0 ? coin.risk.targetPrice : entry * 1.03)
        : Math.max(0, Math.min(entry * 0.97, coin.risk.targetPrice > 0 ? coin.risk.targetPrice : entry * 0.97));

      return {
        symbol: coin.symbol,
        price: coin.price,
        bias,
        signalStrength,
        confidence,
        confidenceBand,
        entry,
        referenceEntry,
        stopLoss,
        target,
        volumeRatio,
        biggestMove: Math.abs(coin.priceChangePercent),
      };
    });

    const filtered = scored.filter((item) => {
      if (quickSignalConfidenceOnly70 && item.confidence < 70) return false;
      if (quickSignalVolumeHighOnly && item.volumeRatio < HIGH_VOLUME_RATIO_THRESHOLD) return false;
      return true;
    });

    const sorter: Record<QuickSignalSort, (a: (typeof filtered)[number], b: (typeof filtered)[number]) => number> = {
      confidence: (a, b) => b.confidence - a.confidence,
      volume: (a, b) => b.volumeRatio - a.volumeRatio,
      move: (a, b) => b.biggestMove - a.biggestMove,
    };

    return filtered.sort(sorter[quickSignalSort]).slice(0, 30);
  }, [coins, quickSignalConfidenceOnly70, quickSignalSort, quickSignalTimeframe, quickSignalVolumeHighOnly]);

  const longQuickSignals = useMemo(() => quickTradeSignals.filter((item) => item.bias === 'Long'), [quickTradeSignals]);
  const shortQuickSignals = useMemo(() => quickTradeSignals.filter((item) => item.bias === 'Short'), [quickTradeSignals]);

  const marqueeSignals = useMemo(() => {
    const now = Date.now();
    const seen = marqueeSignalSeenRef.current;
    const isNewWindowMs = 5 * 60 * 1000;

    for (const signal of quickTradeSignals) {
      if (!seen[signal.symbol]) {
        seen[signal.symbol] = now;
      }
    }

    const topLong = [...longQuickSignals]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map((signal) => ({
        symbol: signal.symbol,
        confidence: signal.confidence,
        bias: signal.bias,
        isNew: now - (seen[signal.symbol] ?? now) <= isNewWindowMs,
      }));

    const topShort = [...shortQuickSignals]
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 10)
      .map((signal) => ({
        symbol: signal.symbol,
        confidence: signal.confidence,
        bias: signal.bias,
        isNew: now - (seen[signal.symbol] ?? now) <= isNewWindowMs,
      }));

    return { topLong, topShort };
  }, [longQuickSignals, quickTradeSignals, shortQuickSignals]);

  const patternDecisionCards = useMemo<PatternDecisionCard[]>(() => {
    const coinBySymbol = new Map(coins.map((coin) => [coin.symbol, coin]));

    return CANDLE_PATTERNS.map((pattern) => {
      const liveCoins = patternCoinMatches[pattern.name] ?? [];
      const rawSymbol = liveCoins[0] ? `${liveCoins[0]}USDT` : null;
      const leadCoin = rawSymbol ? coinBySymbol.get(rawSymbol) : undefined;
      const leadConfidence = Math.round(leadCoin?.tradeSignal.confidence ?? 58);
      const status: PatternStatus =
        leadConfidence >= 70 ? 'Confirmed' : leadConfidence >= 55 ? 'Forming' : 'Invalidated';
      const priority: PatternPriority =
        leadConfidence >= 80 ? 'High Opportunity' : leadConfidence >= 65 ? 'Medium' : 'Low Quality';
      const baseWin = PATTERN_BASE_WIN_PROBABILITY[pattern.name] ?? 70;
      const winProbability = Math.max(
        MIN_PATTERN_WIN_PROBABILITY,
        Math.min(
          MAX_PATTERN_WIN_PROBABILITY,
          Math.round(baseWin * PATTERN_BASE_WEIGHT + leadConfidence * PATTERN_CONFIDENCE_WEIGHT)
        )
      );
      const entry = leadCoin?.price ?? pattern.candles[pattern.candles.length - 1].close;
      const stopLoss = pattern.bias === 'Bearish' ? entry * PATTERN_BEARISH_STOP_LOSS_FACTOR : entry * PATTERN_BULLISH_STOP_LOSS_FACTOR;
      const takeProfit = pattern.bias === 'Bearish' ? entry * PATTERN_BEARISH_TAKE_PROFIT_FACTOR : entry * PATTERN_BULLISH_TAKE_PROFIT_FACTOR;
      const risk = Math.abs(entry - stopLoss);
      const reward = Math.abs(takeProfit - entry);
      const riskReward = risk > 0 ? reward / risk : 0;
      const trendContext =
        pattern.bias === 'Bullish'
          ? 'Downtrend → Reversal'
          : pattern.bias === 'Bearish'
          ? 'Uptrend → Reversal'
          : 'Range → Expansion setup';
      const volumeRatio = leadCoin?.indicators.volume?.volumeRatio ?? 1;
      const volumeContext = volumeRatio >= 1.8 ? 'Increasing (strong participation)' : volumeRatio >= 1.2 ? 'Stable to rising' : 'Weak participation';
      const locationContext =
        pattern.bias === 'Bullish'
          ? 'Support Zone'
          : pattern.bias === 'Bearish'
          ? 'Resistance Zone'
          : 'Key decision zone';
      const rsi = leadCoin?.indicators.rsi.value ?? 50;
      const confluence = [
        {
          label: pattern.bias === 'Bearish' ? 'RSI Overbought' : 'RSI Oversold',
          pass: pattern.bias === 'Bearish' ? rsi >= PATTERN_RSI_OVERBOUGHT_THRESHOLD : rsi <= PATTERN_RSI_OVERSOLD_THRESHOLD,
        },
        { label: 'Volume Spike', pass: volumeRatio >= PATTERN_VOLUME_SPIKE_THRESHOLD },
        { label: 'Structure Strength', pass: Math.abs(leadCoin?.priceChangePercent ?? 0) >= PATTERN_STRUCTURE_STRENGTH_THRESHOLD },
        {
          label: 'Trend Alignment',
          pass:
            pattern.bias === 'Reversal'
              ? leadCoin?.indicators.ma.trend !== 'neutral'
              : leadCoin?.indicators.ma.trend === (pattern.bias === 'Bearish' ? 'bearish' : 'bullish'),
        },
      ];
      const isBullishBias = pattern.bias === 'Bullish' || pattern.bias === 'Reversal';
      const actionLine =
        status === 'Confirmed'
          ? isBullishBias
            ? 'Wait for pullback → Enter LONG'
            : 'Wait for bounce into resistance → Enter SHORT'
          : status === 'Forming'
          ? 'Wait — confirmation candle required'
          : 'Avoid — weak confirmation';
      const liquidationInsight =
        isBullishBias
          ? 'Shorts getting liquidated → supports bullish move.'
          : 'Longs getting liquidated → supports bearish continuation.';
      const aiInsight =
        status === 'Confirmed'
          ? `Strong ${pattern.bias.toLowerCase()} structure with improving momentum and tradable risk profile.`
          : status === 'Forming'
          ? 'Setup is forming; let volume and close confirmation complete before entry.'
          : 'Pattern quality is weak right now; protect capital and wait for cleaner structure.';

      return {
        pattern,
        status,
        priority,
        timeframe: PATTERN_DEFAULT_TIMEFRAME[pattern.name] ?? '15m',
        confidence: leadConfidence,
        winProbability,
        trendContext,
        volumeContext,
        locationContext,
        confluence,
        entry,
        stopLoss,
        takeProfit,
        riskReward,
        liveCoins,
        aiInsight,
        liquidationInsight,
        actionLine,
      };
    });
  }, [coins, patternCoinMatches]);

  const filteredPatternCards = useMemo(() => {
    return patternDecisionCards
      .filter((card) => (patternBiasFilter === 'all' ? true : card.pattern.bias === patternBiasFilter))
      .filter((card) => card.confidence >= patternMinConfidence)
      .filter((card) => (patternTimeframeFilter === 'all' ? true : card.timeframe === patternTimeframeFilter))
      .filter((card) => (!patternConfirmedOnly ? true : card.status === 'Confirmed'))
      .sort((a, b) => b.winProbability - a.winProbability);
  }, [patternBiasFilter, patternConfirmedOnly, patternDecisionCards, patternMinConfidence, patternTimeframeFilter]);

  const patternOverviewStats = useMemo(() => {
    const aggregate = patternDecisionCards.reduce(
      (acc, card) => {
        if (card.pattern.bias === 'Bullish') acc.bullish += 1;
        if (card.pattern.bias === 'Bearish') acc.bearish += 1;
        acc.totalRiskReward += card.riskReward;
        acc.totalWinProbability += card.winProbability;
        if (!acc.best || card.winProbability > acc.best.winProbability) acc.best = card;
        if (!acc.weakest || card.winProbability < acc.weakest.winProbability) acc.weakest = card;
        return acc;
      },
      {
        bullish: 0,
        bearish: 0,
        totalRiskReward: 0,
        totalWinProbability: 0,
        best: undefined as PatternDecisionCard | undefined,
        weakest: undefined as PatternDecisionCard | undefined,
      }
    );
    const avgRR = patternDecisionCards.length > 0 ? aggregate.totalRiskReward / patternDecisionCards.length : 0;
    const winRateLive = patternDecisionCards.length > 0 ? aggregate.totalWinProbability / patternDecisionCards.length : 0;
    const marketBias = aggregate.bullish >= aggregate.bearish ? 'Bullish' : 'Bearish';
    const marketQuality = winRateLive >= 75 ? 'HIGH' : winRateLive >= 65 ? 'MEDIUM' : 'LOW';

    return {
      bullish: aggregate.bullish,
      bearish: aggregate.bearish,
      activePatterns: patternDecisionCards.length,
      best: aggregate.best,
      weakest: aggregate.weakest,
      avgRR,
      winRateLive,
      marketBias,
      marketQuality,
    };
  }, [patternDecisionCards]);

  const liquidationIntelRows = useMemo(() => {
    const timeframeFactor = liquidationTimeframe === '5m' ? 0.85 : liquidationTimeframe === '1h' ? 1.15 : 1;
    return liquidationHeatmap
      .map((item) => {
        const normalizedImbalance = Math.round(item.imbalance * timeframeFactor * 100) / 100;
        const signal = signalLabelFromImbalance(normalizedImbalance);
        const pressure = normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD
          ? 'Bullish'
          : normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD
          ? 'Bearish'
          : 'Neutral';
        const action = signal === 'LONG' ? 'Buy dip' : signal === 'SHORT' ? 'Sell rally' : 'Wait';
        const strength = getSignalStrength(Math.round(Math.min(99, Math.abs(normalizedImbalance) * 100)));
        const confidence = Math.round(
          Math.min(
            99,
            Math.abs(normalizedImbalance) * LIQUIDATION_CONFIDENCE_IMBALANCE_WEIGHT +
              item.intensity * LIQUIDATION_CONFIDENCE_INTENSITY_WEIGHT
          )
        );
        return {
          ...item,
          normalizedImbalance,
          signal,
          pressure,
          action,
          strength,
          confidence,
          trap: normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD ? 'SHORTS' : normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD ? 'LONGS' : 'NONE',
          squeezeType:
            item.shortLiquidationPressure > item.longLiquidationPressure * 1.2
              ? 'Short Squeeze'
              : item.longLiquidationPressure > item.shortLiquidationPressure * 1.2
              ? 'Long Squeeze'
              : 'None',
        };
      })
      .filter((item) => Math.abs(item.normalizedImbalance) >= liquidationMinImbalance)
      .filter((item) => !liquidationHighOnly || item.intensity >= HIGH_LIQUIDATION_INTENSITY_THRESHOLD)
      .sort((a, b) => Math.abs(b.normalizedImbalance) - Math.abs(a.normalizedImbalance))
      .slice(0, 30);
  }, [liquidationHeatmap, liquidationHighOnly, liquidationMinImbalance, liquidationTimeframe]);

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

  const toggleNotify = (symbol: string) => {
    setNotifySymbols((prev) => ({ ...prev, [symbol]: !prev[symbol] }));
  };

  useEffect(() => {
    const previous = previousSignalStateRef.current;
    const next: Record<string, { bias: QuickSignalBias; confidence: number }> = {};
    const newAlerts: QuickSignalAlert[] = [];
    const changes: Array<{ symbol: string; change: SignalChangeDirection; confidence: number }> = [];

    for (const signal of quickTradeSignals) {
      next[signal.symbol] = { bias: signal.bias, confidence: signal.confidence };
      const prev = previous[signal.symbol];

      if (!notifySymbols[signal.symbol]) continue;

      if (!prev) {
        newAlerts.push({
          symbol: signal.symbol,
          type: 'SIGNAL_APPEARED',
          message: `${signal.symbol.replace('USDT', '')} signal appeared`,
          confidence: signal.confidence,
          bias: signal.bias,
        });
        continue;
      }

      if (prev.bias !== signal.bias) {
        changes.push({
          symbol: signal.symbol,
          change: prev.bias === 'Long' ? 'LONG_TO_SHORT' : 'SHORT_TO_LONG',
          confidence: signal.confidence,
        });
      }

      if (signal.confidence - prev.confidence >= 4) {
        newAlerts.push({
          symbol: signal.symbol,
          type: 'CONFIDENCE_INCREASED',
          message: `${signal.symbol.replace('USDT', '')} confidence increased`,
          confidence: signal.confidence,
          bias: signal.bias,
        });
      }

      const entryDistancePct =
        signal.referenceEntry > 0 ? Math.abs((signal.price - signal.referenceEntry) / signal.referenceEntry) * 100 : 100;
      if (entryDistancePct <= ENTRY_REACHED_THRESHOLD_PERCENT) {
        newAlerts.push({
          symbol: signal.symbol,
          type: 'ENTRY_REACHED',
          message: `${signal.symbol.replace('USDT', '')} entry price reached`,
          confidence: signal.confidence,
          bias: signal.bias,
        });
      }
    }

    previousSignalStateRef.current = next;
    if (newAlerts.length > 0) {
      setSignalAlerts((prev) => [...newAlerts, ...prev].slice(0, 20));
    }
    if (changes.length > 0) {
      setSignalChanges((prev) => [...changes, ...prev].slice(0, 12));
    }
  }, [notifySymbols, quickTradeSignals]);

  useEffect(() => {
    const now = Date.now();
    const previousSignals = portfolioSignalStateRef.current;
    const previousRisks = portfolioRiskStateRef.current;
    const previousSqueezes = portfolioSqueezeStateRef.current;

    const nextSignals: Record<string, { bias: QuickSignalBias; confidence: number }> = {};
    const nextRisks: Record<string, boolean> = {};
    const nextSqueezes: Record<string, string> = {};
    const generated: Array<{
      id: string;
      symbol: string;
      type: 'LONG' | 'SHORT' | 'RISK' | 'SQUEEZE';
      priority: 'HIGH' | 'MEDIUM';
      confidence?: number;
      message: string;
      reason: string;
      createdAt: number;
      read: boolean;
    }> = [];

    for (const signal of quickTradeSignals) {
      const previous = previousSignals[signal.symbol];
      const signalType = signal.bias === 'Long' ? 'LONG' : 'SHORT';
      const confidence = signal.confidence;
      nextSignals[signal.symbol] = { bias: signal.bias, confidence };
      const isQualified = confidence > 75;
      if (!isQualified) continue;

      if (!previous) {
        generated.push({
          id: `${signal.symbol}-new-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: confidence >= 85 ? 'HIGH' : 'MEDIUM',
          confidence,
          message: `${signal.bias} signal appeared with high confidence.`,
          reason: 'New signal detected and confidence is above 75%.',
          createdAt: now,
          read: false,
        });
        continue;
      }

      if (previous.bias !== signal.bias) {
        generated.push({
          id: `${signal.symbol}-flip-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: 'HIGH',
          confidence,
          message: `Signal flipped from ${previous.bias} to ${signal.bias}.`,
          reason: 'Signal direction changed, indicating a potential trend reversal.',
          createdAt: now,
          read: false,
        });
      } else if (confidence > previous.confidence) {
        generated.push({
          id: `${signal.symbol}-confidence-${now}`,
          symbol: signal.symbol,
          type: signalType,
          priority: confidence >= 85 ? 'HIGH' : 'MEDIUM',
          confidence,
          message: `${signal.bias} confidence increased from ${previous.confidence}% to ${confidence}%.`,
          reason: 'Confidence increased versus previous update.',
          createdAt: now,
          read: false,
        });
      }
    }

    for (const coin of coins) {
      const extremeRisk = coin.indicators.rsi.value > 80 || coin.indicators.rsi.value < 20;
      nextRisks[coin.symbol] = extremeRisk;
      if (extremeRisk && !previousRisks[coin.symbol]) {
        generated.push({
          id: `${coin.symbol}-risk-${now}`,
          symbol: coin.symbol,
          type: 'RISK',
          priority: 'HIGH',
          confidence: Math.round(coin.tradeSignal.confidence),
          message: `RSI at ${coin.indicators.rsi.value.toFixed(1)} indicates extreme market condition.`,
          reason:
            coin.indicators.rsi.value > 80
              ? 'Overbought risk: possible reversal.'
              : 'Oversold risk: possible sharp counter move.',
          createdAt: now,
          read: false,
        });
      }
    }

    for (const card of liquidationIntelRows.slice(0, 15)) {
      if (card.squeezeType === 'None') continue;
      nextSqueezes[card.symbol] = card.squeezeType;
      if (previousSqueezes[card.symbol] !== card.squeezeType) {
        generated.push({
          id: `${card.symbol}-squeeze-${now}`,
          symbol: card.symbol,
          type: 'SQUEEZE',
          priority: card.confidence >= 80 ? 'HIGH' : 'MEDIUM',
          confidence: card.confidence,
          message: `${card.squeezeType} conditions detected (${card.pressure} pressure).`,
          reason:
            card.squeezeType === 'Short Squeeze'
              ? 'Short squeeze can force upside continuation.'
              : card.squeezeType === 'Long Squeeze'
              ? 'Long squeeze can force downside continuation.'
              : 'Squeeze pressure changed.',
          createdAt: now,
          read: false,
        });
      }
    }

    portfolioSignalStateRef.current = nextSignals;
    portfolioRiskStateRef.current = nextRisks;
    portfolioSqueezeStateRef.current = nextSqueezes;

    if (generated.length > 0) {
      pushNotifications(generated.slice(0, MAX_GENERATED_NOTIFICATIONS_PER_UPDATE));
    }
  }, [coins, liquidationIntelRows, pushNotifications, quickTradeSignals]);

  useEffect(() => {
    if (activeTab !== 'patterns') return;
    let cancelled = false;
    setPatternMatchesLoading(true);
    setPatternMatchesError(null);
    fetchBinancePatternMatches()
      .then((matches) => {
        if (!cancelled) {
          setPatternCoinMatches(matches);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setPatternMatchesError(err instanceof Error ? err.message : 'Failed to fetch Binance pattern matches');
          setPatternCoinMatches(buildPatternCoinMatches(coins));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setPatternMatchesLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, coins]);

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

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Top bar */}
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              Crypto Trading Dashboard
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
              onClick={() => void refetch(trackedCustomSymbols)}
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

      <LiveSignalMarquee longSignals={marqueeSignals.topLong} shortSignals={marqueeSignals.topShort} />

      {/* Error banner */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 mt-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
            ⚠ {error}. Data may be stale. Auto-retrying...
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div ref={primaryNavRef} className="max-w-7xl mx-auto px-4 pt-5">
        <div className="flex gap-2 border-b border-gray-800 flex-wrap items-end">
          <button
            onClick={() => handleTabChange('overview')}
            className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800 -mb-px'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
            }`}
          >
            Overview
          </button>

          {PRIMARY_NAV_GROUPS.map((group) => {
            const isGroupActive = group.tabIds.some((tabId) => tabId === activeTab);
            const isOpen = openPrimaryNav === group.id;
            return (
              <div key={group.id} className="relative">
                <button
                  type="button"
                  aria-label={`Open ${group.label} menu`}
                  aria-haspopup="menu"
                  aria-expanded={isOpen}
                  aria-controls={`nav-menu-${group.id}`}
                  onClick={() => setOpenPrimaryNav((current) => (current === group.id ? null : group.id))}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setOpenPrimaryNav(null);
                  }}
                  className={`list-none px-3 sm:px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap cursor-pointer select-none flex items-center gap-1 ${
                    isGroupActive
                      ? 'bg-gray-800 text-white border border-gray-700 border-b-gray-800 -mb-px'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                  }`}
                >
                  <span>{group.label}</span>
                  <span className="text-xs">▼</span>
                </button>
                <div
                  id={`nav-menu-${group.id}`}
                  role="menu"
                  aria-hidden={!isOpen}
                  className={`absolute left-0 top-full mt-1 min-w-[180px] rounded-lg border border-gray-800 bg-gray-900 shadow-xl z-30 p-1 ${
                    isOpen ? 'block' : 'hidden'
                  }`}
                >
                  {group.tabIds.map((tabId) => (
                    <button
                      key={tabId}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        handleTabChange(tabId);
                      }}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        activeTab === tabId
                          ? 'bg-gray-800 text-white'
                          : 'text-gray-300 hover:bg-gray-800/70 hover:text-white'
                      }`}
                    >
                      {getTabLabel(tabId)}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
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
                </h2>
                <span className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
                  Page {scannerPage} / {scannerTotalPages}
                </span>
              </div>
              <p className="text-xs text-gray-500 -mt-1">{selectedExchangeLabels} live scanner feed</p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
                  <p className="text-[11px] text-gray-500">Results</p>
                  <p className="text-sm font-semibold text-white">
                    Showing {scannerCoins.length} of {Math.max(totalScanned, coins.length, DEFAULT_TOTAL_SCANNED)}
                  </p>
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
              />

                <MarketScanner
                  coins={scannerCoins}
                  loading={loading}
                  onAddToWatchlist={addCoin}
                  isWatching={isWatching}
                  summaryLabel={
                    query.trim()
                      ? `Showing ${displayCoins.length} of ${Math.max(totalScanned, coins.length, DEFAULT_TOTAL_SCANNED)} coins (filtered)`
                      : `Showing ${scannerCoins.length} of ${Math.max(totalScanned, coins.length, DEFAULT_TOTAL_SCANNED)} coins`
                  }
                />
              {!loading && scannerTotalPages > 1 && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => setScannerPage((prev) => Math.max(1, prev - 1))}
                    disabled={scannerPage === 1}
                    className="px-3 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    ◀ Prev
                  </button>
                  <span className="text-xs text-gray-400">
                    Page {scannerPage} / {scannerTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setScannerPage((prev) => Math.min(scannerTotalPages, prev + 1))}
                    disabled={scannerPage === scannerTotalPages}
                    className="px-3 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next ▶
                  </button>
                </div>
              )}
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
              <span className="text-xs text-gray-500">{selectedExchangeLabels} · {TOP500_PAGE_SIZE} coins per page</span>
            </div>
            <Top500Panel
              selectedExchanges={selectedExchanges}
              isWatching={isWatching}
              customPairs={customMarketPairs.pairs.map((pair) => pair.symbol)}
              customCoins={coins}
              onOpenAddMarketPair={() => setAddMarketPairOpen(true)}
            />
          </div>
        )}

        <AddMarketPairModal
          isOpen={addMarketPairOpen}
          selectedExchanges={selectedExchanges}
          isFull={customMarketPairs.isFull}
          onClose={() => setAddMarketPairOpen(false)}
          onAddCoin={handleAddMarketPair}
        />

        {/* Candlestick patterns tab */}
        {activeTab === 'patterns' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                🚀 Pattern Market Overview
              </h2>
              <span className="text-xs text-gray-500">Decision Engine · Binance Context</span>
            </div>
            <div className="rounded-xl border border-cyan-700/40 bg-cyan-900/10 p-3">
              <p className="text-sm font-semibold text-cyan-100">📊 Pattern Market Bias: {patternOverviewStats.marketBias === 'Bullish' ? '🟢 Bullish' : '🔴 Bearish'}</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
                  <p className="text-gray-500">Active Patterns</p>
                  <p className="text-white font-semibold">{patternOverviewStats.activePatterns}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
                  <p className="text-gray-500">🟢 Bullish</p>
                  <p className="text-green-300 font-semibold">{patternOverviewStats.bullish}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
                  <p className="text-gray-500">🔴 Bearish</p>
                  <p className="text-red-300 font-semibold">{patternOverviewStats.bearish}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
                  <p className="text-gray-500">🔥 Best Opportunity</p>
                  <p className="text-cyan-200 font-semibold">
                    {patternOverviewStats.best ? `${patternOverviewStats.best.pattern.name} — ${patternOverviewStats.best.winProbability}%` : 'No signal'}
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-yellow-200 mt-2">
                ⚠️ Weak Pattern: {patternOverviewStats.weakest ? `${patternOverviewStats.weakest.pattern.name} (${patternOverviewStats.weakest.winProbability}%)` : 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-gray-700/70 bg-gray-900/70 p-3">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="text-gray-400">Pattern Type:</span>
                <button onClick={() => setPatternBiasFilter('all')} className={`px-2 py-1 rounded border ${patternBiasFilter === 'all' ? 'border-cyan-500 text-cyan-200 bg-cyan-500/15' : 'border-gray-700 text-gray-300'}`}>All</button>
                <button onClick={() => setPatternBiasFilter('Bullish')} className={`px-2 py-1 rounded border ${patternBiasFilter === 'Bullish' ? 'border-green-500 text-green-200 bg-green-500/15' : 'border-gray-700 text-gray-300'}`}>🟢 Bullish</button>
                <button onClick={() => setPatternBiasFilter('Bearish')} className={`px-2 py-1 rounded border ${patternBiasFilter === 'Bearish' ? 'border-red-500 text-red-200 bg-red-500/15' : 'border-gray-700 text-gray-300'}`}>🔴 Bearish</button>
                <span className="text-gray-400 ml-2">Confidence: {patternMinConfidence}%</span>
                <input
                  type="range"
                  min={40}
                  max={90}
                  step={5}
                  value={patternMinConfidence}
                  onChange={(event) => setPatternMinConfidence(Number(event.target.value))}
                  className="w-24 accent-cyan-400"
                />
                <span className="text-gray-400 ml-2">Timeframe:</span>
                <select
                  value={patternTimeframeFilter}
                  onChange={(event) => setPatternTimeframeFilter(event.target.value as 'all' | PatternTimeframe)}
                  className="rounded border border-gray-700 bg-gray-800 text-gray-200 px-2 py-1"
                >
                  <option value="all">All</option>
                  <option value="5m">5m</option>
                  <option value="15m">15m</option>
                  <option value="1h">1h</option>
                </select>
                <label className="ml-2 flex items-center gap-1 text-gray-300">
                  <input
                    type="checkbox"
                    checked={patternConfirmedOnly}
                    onChange={(event) => setPatternConfirmedOnly(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Status: Confirmed only
                </label>
                <label className="ml-2 flex items-center gap-1 text-cyan-200">
                  <input
                    type="checkbox"
                    checked={patternLearningMode}
                    onChange={(event) => setPatternLearningMode(event.target.checked)}
                    className="h-3.5 w-3.5 rounded border-cyan-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500"
                  />
                  Learning Mode
                </label>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/10 p-3">
              <h3 className="text-sm font-semibold text-indigo-200">📈 Pattern Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2 text-[11px]">
                <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                  <p className="text-gray-500">Win Rate (Live)</p>
                  <p className="text-cyan-200 font-semibold">{patternOverviewStats.winRateLive.toFixed(0)}%</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                  <p className="text-gray-500">Avg R:R</p>
                  <p className="text-green-300 font-semibold">1 : {patternOverviewStats.avgRR.toFixed(1)}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                  <p className="text-gray-500">Best Pattern</p>
                  <p className="text-emerald-300 font-semibold">{patternOverviewStats.best ? `${patternOverviewStats.best.pattern.name} (${patternOverviewStats.best.winProbability}%)` : 'N/A'}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                  <p className="text-gray-500">Worst Pattern</p>
                  <p className="text-yellow-300 font-semibold">{patternOverviewStats.weakest ? `${patternOverviewStats.weakest.pattern.name} (${patternOverviewStats.weakest.winProbability}%)` : 'N/A'}</p>
                </div>
                <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
                  <p className="text-gray-500">Market Quality</p>
                  <p className="text-cyan-100 font-semibold">{patternOverviewStats.marketQuality}</p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-violet-700/40 bg-violet-900/10 px-3 py-2 text-xs text-violet-100">
              <p className="font-semibold">🤖 AI Market Insight:</p>
              <p className="mt-1">
                Market shows a {patternOverviewStats.marketBias.toLowerCase()} pattern mix with {patternOverviewStats.marketQuality.toLowerCase()} quality setup flow.
                Best opportunities are in active names with stronger volume participation. Avoid low-conviction patterns with weak confluence.
              </p>
            </div>

            <CandlePatternsPanel
              patternCards={filteredPatternCards}
              learningMode={patternLearningMode}
              loading={patternMatchesLoading}
              error={patternMatchesError}
            />
          </div>
        )}

        {/* Suggestions tab */}
        {activeTab === 'suggestions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Professional Trade Suggestions
              </h2>
              <span className="text-xs text-gray-500">Entry price stays fixed until target or Stop Loss is hit</span>
            </div>

            <div className="rounded-lg border border-cyan-700/40 bg-cyan-900/10 px-3 py-2 text-xs text-cyan-100">
              Professional Rule: Execute only at the listed entry price. Do not move the entry after opening. Hold the plan until the listed target or stop loss is triggered.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <p className="text-[11px] text-gray-500">Avg expected profit</p>
                <p className="text-sm font-semibold text-green-300">
                  {(() => {
                    const all = [...suggestionData.longSuggestions, ...suggestionData.shortSuggestions];
                    if (all.length === 0) return '0.00%';
                    const avg = all.reduce((acc, item) => acc + item.expectedProfitPercent, 0) / all.length;
                    return `${avg.toFixed(2)}%`;
                  })()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <p className="text-[11px] text-gray-500">Avg expected loss</p>
                <p className="text-sm font-semibold text-red-300">
                  {(() => {
                    const all = [...suggestionData.longSuggestions, ...suggestionData.shortSuggestions];
                    if (all.length === 0) return '0.00%';
                    const avg = all.reduce((acc, item) => acc + item.expectedLossPercent, 0) / all.length;
                    return `${avg.toFixed(2)}%`;
                  })()}
                </p>
              </div>
              <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <p className="text-[11px] text-gray-500">High confidence ideas</p>
                <p className="text-sm font-semibold text-cyan-300">
                  {[...suggestionData.longSuggestions, ...suggestionData.shortSuggestions].filter((item) => item.confidence >= 70).length}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-green-700/40 bg-green-900/10 p-3">
                <h3 className="text-sm font-semibold text-green-300 mb-2">Top 10 Trending LONG Patterns</h3>
                <div className="space-y-2">
                  {suggestionData.longSuggestions.map((item) => (
                    <div key={`${item.bias}-${item.patternName}-${item.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{item.patternName} · {item.symbol.replace('USDT', '')}</p>
                        <span className="text-[11px] text-green-300">Conf {Math.round(item.confidence)}%</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{item.setup}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                        <p className="text-gray-200">Entry: <span className="font-mono">{formatPrice(item.entryPrice)}</span></p>
                        <p className="text-red-300">SL: <span className="font-mono">{formatPrice(item.stopLoss)}</span></p>
                        <p className="text-green-300">TP: <span className="font-mono">{formatPrice(item.targetPrice)}</span></p>
                      </div>
                      <p className="text-[11px] text-cyan-200 mt-1">R:R {item.riskRewardRatio.toFixed(2)} · Confirm: {item.confirmation}</p>
                      <p className="text-[11px] text-green-200 mt-0.5">
                        Expected +{item.expectedProfitPercent.toFixed(2)}% · Max loss {item.expectedLossPercent.toFixed(2)}%
                      </p>
                      <p className="text-[11px] text-yellow-200 mt-0.5">Invalidation: {item.invalidation}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-xl border border-rose-700/40 bg-rose-900/10 p-3">
                <h3 className="text-sm font-semibold text-rose-300 mb-2">Top 10 Trending SHORT Patterns</h3>
                <div className="space-y-2">
                  {suggestionData.shortSuggestions.map((item) => (
                    <div key={`${item.bias}-${item.patternName}-${item.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-white">{item.patternName} · {item.symbol.replace('USDT', '')}</p>
                        <span className="text-[11px] text-rose-300">Conf {Math.round(item.confidence)}%</span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-1">{item.setup}</p>
                      <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                        <p className="text-gray-200">Entry: <span className="font-mono">{formatPrice(item.entryPrice)}</span></p>
                        <p className="text-red-300">SL: <span className="font-mono">{formatPrice(item.stopLoss)}</span></p>
                        <p className="text-green-300">TP: <span className="font-mono">{formatPrice(item.targetPrice)}</span></p>
                      </div>
                      <p className="text-[11px] text-cyan-200 mt-1">R:R {item.riskRewardRatio.toFixed(2)} · Confirm: {item.confirmation}</p>
                      <p className="text-[11px] text-green-200 mt-0.5">
                        Expected +{item.expectedProfitPercent.toFixed(2)}% · Max loss {item.expectedLossPercent.toFixed(2)}%
                      </p>
                      <p className="text-[11px] text-yellow-200 mt-0.5">Invalidation: {item.invalidation}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/10 p-3">
              <h3 className="text-sm font-semibold text-indigo-300 mb-2">Selected Coin Move Notifications</h3>
              {watchlistMoveNotifications.length === 0 ? (
                <p className="text-xs text-gray-400">No alert-level moves on your selected coins yet. Add coins to watchlist to activate professional notifications.</p>
              ) : (
                <div className="space-y-2">
                  {watchlistMoveNotifications.map((alert) => (
                    <div key={alert.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-white">{alert.symbol.replace('USDT', '')}</p>
                        <span className={`text-[11px] ${alert.status === 'TARGET HIT' ? 'text-green-300' : alert.status === 'STOP LOSS HIT' ? 'text-red-300' : 'text-cyan-300'}`}>
                          {alert.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-300 mt-1">Live: <span className="font-mono">{formatPrice(alert.livePrice)}</span> · Move: {alert.movePercent >= 0 ? '+' : ''}{alert.movePercent.toFixed(2)}%</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">{alert.guidance}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'liquidations' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Binance Liquidation Heatmap
              </h2>
              <span className="text-xs text-gray-500">Estimated long vs short liquidation pressure</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {liquidationHeatmap.slice(0, 50).map((item) => {
                const positiveImbalance = item.imbalance >= 0;
                const intensity = Math.min(95, Math.max(15, item.intensity));
                return (
                  <div
                    key={item.symbol}
                    className={`rounded-lg border p-3 ${
                      positiveImbalance ? 'border-green-600/40' : 'border-red-600/40'
                    }`}
                    style={{
                      background: positiveImbalance
                        ? `linear-gradient(135deg, rgba(6, 78, 59, ${intensity / 120}) 0%, rgba(17, 24, 39, 0.9) 100%)`
                        : `linear-gradient(135deg, rgba(127, 29, 29, ${intensity / 120}) 0%, rgba(17, 24, 39, 0.9) 100%)`,
                    }}
                  >
                    <p className="text-xs text-white font-semibold">{item.symbol.replace('USDT', '')}</p>
                    <p className="text-[11px] text-gray-300 mt-1">Long liq: {item.longLiquidationPressure.toFixed(2)}</p>
                    <p className="text-[11px] text-gray-300">Short liq: {item.shortLiquidationPressure.toFixed(2)}</p>
                    <p className={`text-[11px] mt-1 ${positiveImbalance ? 'text-green-300' : 'text-red-300'}`}>
                      Imbalance: {item.imbalance >= 0 ? '+' : ''}{item.imbalance.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === 'quicksignals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className={`${UI_HEADING_CLASS} flex items-center gap-2`}>
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Short-Term Trade Signals
              </h2>
              <p className={`${UI_SMALL_LABEL_CLASS} text-gray-400`}>Quick Trade Opportunities</p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Timeframe</span>
                  <select
                    value={quickSignalTimeframe}
                    onChange={(event) => setQuickSignalTimeframe(event.target.value as QuickSignalTimeframe)}
                    className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white`}
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                    <option value="4h">4h</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Sort</span>
                  <select
                    value={quickSignalSort}
                    onChange={(event) => setQuickSignalSort(event.target.value as QuickSignalSort)}
                    className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white`}
                  >
                    <option value="confidence">Highest confidence</option>
                    <option value="volume">Highest volume</option>
                    <option value="move">Biggest move</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 mt-5 md:mt-0">
                  <input
                    type="checkbox"
                    checked={quickSignalConfidenceOnly70}
                    onChange={(event) => setQuickSignalConfidenceOnly70(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                  />
                  <span className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>Confidence 70+ only</span>
                </label>
                <label className="flex items-center gap-2 mt-5 md:mt-0">
                  <input
                    type="checkbox"
                    checked={quickSignalVolumeHighOnly}
                    onChange={(event) => setQuickSignalVolumeHighOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                  />
                  <span className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>Volume high only</span>
                </label>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <section className="rounded-xl border border-green-700/40 bg-green-900/10 p-3 overflow-x-auto">
                <h3 className={`${UI_SECTION_TITLE_CLASS} text-green-300 mb-2`}>🟢 LONG Opportunities</h3>
                <table className={`w-full min-w-[900px] ${UI_DATA_TEXT_CLASS}`}>
                  <thead>
                    <tr className={`${UI_SMALL_LABEL_CLASS} text-gray-400 border-b border-gray-800`}>
                      <th className="text-left py-1.5">Coin</th>
                      <th className="text-right py-1.5">Price</th>
                      <th className="text-right py-1.5">Signal Strength</th>
                      <th className="text-right py-1.5">Entry</th>
                      <th className="text-right py-1.5">SL</th>
                      <th className="text-right py-1.5">TP</th>
                      <th className="text-right py-1.5">Confidence</th>
                      <th className="text-right py-1.5">Bias</th>
                      <th className="text-right py-1.5">Notify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {longQuickSignals.map((item) => (
                      <tr key={`long-${item.symbol}`} className="border-b border-gray-800/60">
                        <td className="py-1.5 text-gray-100">{item.symbol.replace('USDT', '')}</td>
                        <td className="py-1.5 text-right text-gray-200">{formatPrice(item.price)}</td>
                        <td className="py-1.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${UI_SMALL_LABEL_CLASS} ${strengthBadgeClass(item.signalStrength)}`}>
                            {item.signalStrength === 'Strong' ? '🔥' : item.signalStrength === 'Medium' ? '⚡' : '⚠️'} {item.signalStrength}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-gray-200">{formatPrice(item.entry)}</td>
                        <td className="py-1.5 text-right text-red-300">{formatPrice(item.stopLoss)}</td>
                        <td className="py-1.5 text-right text-green-300">{formatPrice(item.target)}</td>
                        <td className="py-1.5 text-right text-cyan-200">{item.confidence}%</td>
                        <td className="py-1.5 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded border ${UI_SMALL_LABEL_CLASS} ${biasBadgeClass(item.bias)}`}>🟢 Long</span>
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => toggleNotify(item.symbol)}
                            className={`${UI_SMALL_LABEL_CLASS} px-2 py-0.5 rounded border ${notifySymbols[item.symbol] ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}
                          >
                            {notifySymbols[item.symbol] ? 'Notifying' : 'Notify me'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <section className="rounded-xl border border-rose-700/40 bg-rose-900/10 p-3 overflow-x-auto">
                <h3 className={`${UI_SECTION_TITLE_CLASS} text-rose-300 mb-2`}>🔴 SHORT Opportunities</h3>
                <table className={`w-full min-w-[900px] ${UI_DATA_TEXT_CLASS}`}>
                  <thead>
                    <tr className={`${UI_SMALL_LABEL_CLASS} text-gray-400 border-b border-gray-800`}>
                      <th className="text-left py-1.5">Coin</th>
                      <th className="text-right py-1.5">Price</th>
                      <th className="text-right py-1.5">Signal Strength</th>
                      <th className="text-right py-1.5">Entry</th>
                      <th className="text-right py-1.5">SL</th>
                      <th className="text-right py-1.5">TP</th>
                      <th className="text-right py-1.5">Confidence</th>
                      <th className="text-right py-1.5">Bias</th>
                      <th className="text-right py-1.5">Notify</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shortQuickSignals.map((item) => (
                      <tr key={`short-${item.symbol}`} className="border-b border-gray-800/60">
                        <td className="py-1.5 text-gray-100">{item.symbol.replace('USDT', '')}</td>
                        <td className="py-1.5 text-right text-gray-200">{formatPrice(item.price)}</td>
                        <td className="py-1.5 text-right">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${UI_SMALL_LABEL_CLASS} ${strengthBadgeClass(item.signalStrength)}`}>
                            {item.signalStrength === 'Strong' ? '🔥' : item.signalStrength === 'Medium' ? '⚡' : '⚠️'} {item.signalStrength}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-gray-200">{formatPrice(item.entry)}</td>
                        <td className="py-1.5 text-right text-red-300">{formatPrice(item.stopLoss)}</td>
                        <td className="py-1.5 text-right text-green-300">{formatPrice(item.target)}</td>
                        <td className="py-1.5 text-right text-cyan-200">{item.confidence}%</td>
                        <td className="py-1.5 text-right">
                          <span className={`inline-flex px-2 py-0.5 rounded border ${UI_SMALL_LABEL_CLASS} ${biasBadgeClass(item.bias)}`}>🔴 Short</span>
                        </td>
                        <td className="py-1.5 text-right">
                          <button
                            onClick={() => toggleNotify(item.symbol)}
                            className={`${UI_SMALL_LABEL_CLASS} px-2 py-0.5 rounded border ${notifySymbols[item.symbol] ? 'border-cyan-500 text-cyan-200 bg-cyan-900/30' : 'border-gray-700 text-gray-300 hover:border-gray-500'}`}
                          >
                            {notifySymbols[item.symbol] ? 'Notifying' : 'Notify me'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/10 p-3">
                <h3 className={`${UI_SECTION_TITLE_CLASS} text-indigo-200 mb-2`}>Trade Confidence Score</h3>
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                  0–50 Avoid · 50–70 Risky · 70–85 Good · 85+ Strong trade
                </p>
                <p className={`${UI_SMALL_LABEL_CLASS} text-gray-400 mt-1`}>
                  Score = RSI weight + Volume weight + Trend weight + Support/Resistance proximity
                </p>
              </div>
              <div className="rounded-xl border border-cyan-700/40 bg-cyan-900/10 p-3">
                <h3 className={`${UI_SECTION_TITLE_CLASS} text-cyan-200 mb-2`}>Signal Change Detector</h3>
                {signalChanges.length === 0 ? (
                  <p className={`${UI_DATA_TEXT_CLASS} text-gray-400`}>No LONG/SHORT flips detected yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {signalChanges.slice(0, 8).map((change) => (
                      <p key={`${change.symbol}-${change.change}`} className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                        {change.symbol.replace('USDT', '')}: {change.change === 'LONG_TO_SHORT' ? 'LONG → SHORT' : 'SHORT → LONG'} · {change.confidence}%
                      </p>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-3">
              <h3 className={`${UI_SECTION_TITLE_CLASS} text-gray-100 mb-2`}>Alerts</h3>
              {signalAlerts.length === 0 ? (
                <p className={`${UI_DATA_TEXT_CLASS} text-gray-400`}>Enable “Notify me” on coins to get signal alerts.</p>
              ) : (
                <div className="space-y-1.5">
                  {signalAlerts.slice(0, 10).map((alert, index) => (
                    <p key={`${alert.symbol}-${alert.type}-${index}`} className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                      {alert.bias === 'Long' ? '🟢' : '🔴'} {alert.message} · {alert.confidence}%
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'liquidationintel' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className={`${UI_HEADING_CLASS} flex items-center gap-2`}>
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Liquidation Intelligence
              </h2>
              <p className={`${UI_SMALL_LABEL_CLASS} text-gray-400`}>Clear pressure, signal, and action</p>
            </div>

            <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="flex flex-col gap-1">
                  <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Timeframe</span>
                  <select
                    value={liquidationTimeframe}
                    onChange={(event) => setLiquidationTimeframe(event.target.value as '5m' | '15m' | '1h')}
                    className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white`}
                  >
                    <option value="5m">5m</option>
                    <option value="15m">15m</option>
                    <option value="1h">1h</option>
                  </select>
                </label>
                <label className="flex flex-col gap-1">
                  <span className={`${UI_SMALL_LABEL_CLASS} text-gray-500`}>Imbalance threshold</span>
                  <select
                    value={liquidationMinImbalance}
                    onChange={(event) => setLiquidationMinImbalance(Number(event.target.value))}
                    className={`${UI_DATA_TEXT_CLASS} bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-white`}
                  >
                    <option value={0.3}>0.3+ only</option>
                    <option value={0.5}>0.5+ only</option>
                    <option value={0.8}>0.8+ only</option>
                  </select>
                </label>
                <label className="flex items-center gap-2 mt-5 md:mt-0">
                  <input
                    type="checkbox"
                    checked={liquidationHighOnly}
                    onChange={(event) => setLiquidationHighOnly(event.target.checked)}
                    className="h-4 w-4 rounded border-gray-600 bg-gray-800 text-cyan-500"
                  />
                  <span className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>High liquidation size only</span>
                </label>
              </div>
            </div>

            {liquidationIntelRows.length > 0 && (
              <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                {(() => {
                  const top = liquidationIntelRows[0];
                  const topSignal = top.signal;
                  const isBullish = top.normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD;
                  const maxLiq = Math.max(top.longLiquidationPressure, top.shortLiquidationPressure, 1);
                  const longBar = liquidationVisualBar(top.longLiquidationPressure, maxLiq);
                  const shortBar = liquidationVisualBar(top.shortLiquidationPressure, maxLiq);
                  return (
                    <div className="space-y-2">
                      <h3 className={`${UI_SECTION_TITLE_CLASS} text-white`}>🧠 Liquidation Overview Card · {top.symbol.replace('USDT', '')}</h3>
                      <p className={`${UI_DATA_TEXT_CLASS} ${pressureColorFromImbalance(top.normalizedImbalance)}`}>
                        Market Pressure: {top.pressure} · {top.squeezeType === 'Short Squeeze' ? '🔥 Short Squeeze Detected' : top.squeezeType === 'Long Squeeze' ? '💣 Long Squeeze Detected' : '🟡 No squeeze'}
                      </p>
                      <p className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                        Short Liquidations: {top.shortLiquidationPressure.toFixed(2)} · Long Liquidations: {top.longLiquidationPressure.toFixed(2)}
                      </p>
                      <p className={`${UI_DATA_TEXT_CLASS} ${pressureColorFromImbalance(top.normalizedImbalance)}`}>{pressureLabel(top.normalizedImbalance)}</p>
                      <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                        💡 Insight: {isBullish ? 'More short traders are getting liquidated → price moving up strongly' : 'More long traders are getting liquidated → downside pressure is dominant'}
                      </p>
                      <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                        📈 Bias: {isBullish ? 'Bullish (Short-term)' : 'Bearish (Short-term)'}
                      </p>
                      <p className={`${UI_DATA_TEXT_CLASS} text-gray-300`}>
                        ⚠️ Strategy: {isBullish ? 'Look for LONG opportunities on pullbacks' : 'Look for SHORT opportunities on relief rallies'}
                      </p>
                      <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
                        <p className={`${UI_SECTION_TITLE_CLASS} text-cyan-200 mb-1`}>🚀 Trade Signal</p>
                        <p className={`${UI_DATA_TEXT_CLASS} text-gray-200`}>
                          Type: {topSignal === 'LONG' ? '🟢 LONG' : topSignal === 'SHORT' ? '🔴 SHORT' : '🟡 WAIT'} · Strength: {top.strength} · Confidence: {top.confidence}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-gray-800 bg-gray-950/60 p-2">
                        <p className={`${UI_DATA_TEXT_CLASS} text-gray-200 font-mono`}>Long Liq&nbsp;&nbsp;&nbsp;{longBar} ({top.longLiquidationPressure.toFixed(2)})</p>
                        <p className={`${UI_DATA_TEXT_CLASS} text-gray-200 font-mono`}>Short Liq&nbsp;&nbsp;{shortBar} ({top.shortLiquidationPressure.toFixed(2)})</p>
                      </div>
                      <p className={`${UI_DATA_TEXT_CLASS} text-yellow-200`}>
                        {top.trap === 'SHORTS'
                          ? '⚠️ Traders Trapped: SHORTS · Market likely to continue upward'
                          : top.trap === 'LONGS'
                          ? '⚠️ Traders Trapped: LONGS · Market likely to drop further'
                          : '⚠️ No strong trap detected'}
                      </p>
                    </div>
                  );
                })()}
              </div>
            )}

            <section className="rounded-xl border border-gray-800 bg-gray-900/70 p-3 overflow-x-auto">
              <h3 className={`${UI_SECTION_TITLE_CLASS} text-white mb-2`}>🧾 Multi-Coin Liquidation Scan</h3>
              <table className={`w-full min-w-[920px] ${UI_DATA_TEXT_CLASS}`}>
                <thead>
                  <tr className={`${UI_SMALL_LABEL_CLASS} text-gray-400 border-b border-gray-800`}>
                    <th className="text-left py-1.5">Coin</th>
                    <th className="text-left py-1.5">Pressure</th>
                    <th className="text-left py-1.5">Signal</th>
                    <th className="text-right py-1.5">Imbalance</th>
                    <th className="text-left py-1.5">Action</th>
                    <th className="text-left py-1.5">Alert Type</th>
                    <th className="text-left py-1.5">Trap Detection</th>
                  </tr>
                </thead>
                <tbody>
                  {liquidationIntelRows.map((item) => (
                    <tr key={`intel-${item.symbol}`} className="border-b border-gray-800/60">
                      <td className="py-1.5 text-gray-100">{item.symbol.replace('USDT', '')}</td>
                      <td className={`py-1.5 ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                        {item.normalizedImbalance > LIQUIDATION_SIGNAL_THRESHOLD ? '🟢 Bullish' : item.normalizedImbalance < -LIQUIDATION_SIGNAL_THRESHOLD ? '🔴 Bearish' : '🟡 Neutral'}
                      </td>
                      <td className={`py-1.5 ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                        {item.signal === 'LONG' ? 'LONG' : item.signal === 'SHORT' ? 'SHORT' : 'WAIT'}
                      </td>
                      <td className={`py-1.5 text-right ${pressureColorFromImbalance(item.normalizedImbalance)}`}>
                        {item.normalizedImbalance >= 0 ? '+' : ''}{item.normalizedImbalance.toFixed(2)}
                      </td>
                      <td className="py-1.5 text-gray-200">{item.action}</td>
                      <td className="py-1.5 text-gray-200">
                        {item.squeezeType === 'Short Squeeze' ? '🔥 Short Squeeze' : item.squeezeType === 'Long Squeeze' ? '💣 Long Squeeze' : '—'}
                      </td>
                      <td className="py-1.5 text-yellow-200">
                        {item.trap === 'SHORTS' ? 'SHORTS trapped' : item.trap === 'LONGS' ? 'LONGS trapped' : 'No trap'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {activeTab === 'warnings' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
                Warning & News Intelligence
              </h2>
              <span className="text-xs text-gray-500">Risky coin news, sentiment, and trend pressure</span>
            </div>
            <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-100">
              Sentiment & News Intelligence includes internally generated risk headlines, bullish/bearish score, X (Twitter) trend tracking proxy, and News Impact Score (historical sensitivity proxy).
            </div>
            <div className="space-y-2">
              {warningNews.map((item) => (
                <div key={`${item.symbol}-${item.headline}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">
                      {item.symbol.replace('USDT', '')} · {item.source}
                    </p>
                    <span className={`text-[11px] px-2 py-0.5 rounded border ${item.riskLevel === 'High' ? 'text-red-300 border-red-600/40 bg-red-900/20' : 'text-yellow-300 border-yellow-600/40 bg-yellow-900/20'}`}>
                      {item.riskLevel} Risk
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 mt-1">{item.headline}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-[11px]">
                    <p className="text-cyan-200">Sentiment: {item.sentimentScore > 0 ? '+' : ''}{item.sentimentScore}</p>
                    <p className="text-purple-200">X Trend: {item.twitterTrendScore}/100</p>
                    <p className="text-orange-200">News Impact Score: {item.newsImpactScore}/100</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'volumewhales' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
                Volume Surge Detection & Whale Activity
              </h2>
              <span className="text-xs text-gray-500">Sudden spikes can indicate smart money entry</span>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <div className="rounded-xl border border-fuchsia-700/40 bg-fuchsia-900/10 p-3">
                <h3 className="text-sm font-semibold text-fuchsia-200 mb-2">Volume Surge Detection</h3>
                <div className="space-y-2">
                  {volumeSurgeCoins.length === 0 ? (
                    <p className="text-xs text-gray-400">No significant surge detected right now.</p>
                  ) : (
                    volumeSurgeCoins.map((coin) => (
                      <div key={coin.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-white">{coin.symbol.replace('USDT', '')}</p>
                          <span className="text-[11px] text-fuchsia-300">
                            x{(coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 mt-1">
                          Current Vol: {formatVolume(coin.indicators.volume?.currentVolume ?? 0)} · Avg Vol: {formatVolume(coin.indicators.volume?.averageVolume ?? 0)}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-cyan-700/40 bg-cyan-900/10 p-3">
                <h3 className="text-sm font-semibold text-cyan-200 mb-2">Whale Activity Tracking</h3>
                <div className="space-y-2">
                  {whaleActivity.length === 0 ? (
                    <p className="text-xs text-gray-400">No whale transaction signals yet.</p>
                  ) : (
                    whaleActivity.map((whale) => (
                      <div key={`${whale.symbol}-${whale.side}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-semibold text-white">{whale.symbol.replace('USDT', '')}</p>
                          <span className={`text-[11px] ${whale.side === 'BUY' ? 'text-green-300' : 'text-red-300'}`}>{whale.side}</span>
                        </div>
                        <p className="text-[11px] text-gray-300 mt-1">Estimated size: {formatVolume(whale.estimatedUsd)}</p>
                        <p className="text-[11px] text-gray-400">Confidence: {whale.confidence}%</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'smartwatchlist' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Smart AI Watchlist
              </h2>
              <span className="text-xs text-gray-500">Suggestions based on volatility, liquidity, and news sentiment proxy</span>
            </div>
            <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-3 py-2 text-xs text-emerald-100">
              This scoring model ranks coins using volatility, liquidity flow, and sentiment-aligned market behavior to highlight high-opportunity setups with controlled downside.
            </div>
            <div className="space-y-2">
              {smartWatchlist.map((item) => (
                <div key={item.coin.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{item.coin.symbol.replace('USDT', '')}</p>
                    <span className={`text-xs font-semibold ${item.aiScore >= 70 ? 'text-green-300' : item.aiScore >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
                      AI Score {item.aiScore}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
                    <p className="text-gray-300">Volatility: <span className="text-cyan-200">{item.volatilityScore}</span></p>
                    <p className="text-gray-300">Liquidity: <span className="text-cyan-200">{item.liquidityScore}</span></p>
                    <p className="text-gray-300">Sentiment: <span className="text-cyan-200">{item.sentimentScore}</span></p>
                    <p className="text-gray-300">Signal: <span className={item.coin.signal === 'BUY' ? 'text-green-300' : item.coin.signal === 'SELL' ? 'text-red-300' : 'text-yellow-300'}>{item.coin.signal}</span></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Watchlist tab */}
        {activeTab === 'watchlist' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Watchlist
              {items.length > 0 && (
                <span className="text-xs text-gray-500 font-normal">({items.length} coins)</span>
              )}
              {unreadCount > 0 && (
                <span className="text-xs text-cyan-300 font-normal">• {unreadCount} unread notifications</span>
              )}
            </h2>
            <div className="max-w-2xl">
              <WatchList items={items} coins={coins} onRemove={removeCoin} />
            </div>
            <PortfolioNotifications
              notifications={notifications}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
            />
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
