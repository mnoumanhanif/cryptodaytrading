'use client';

import React, { useState, useEffect } from 'react';
import { SupportedExchange } from '@/lib/exchangeMarket';
import { CoinAnalysis } from '@/lib/types';
import { formatPrice } from '@/lib/utils';

export const AUTO_PLAY_INTERVAL_MS = 900;
export const DEFAULT_LONG_STOP_LOSS_FACTOR = 0.985;
export const DEFAULT_LONG_TARGET_FACTOR = 1.03;
export const DEFAULT_SHORT_BASE_MOVE_FACTOR = 0.015;
export const DEFAULT_SHORT_TARGET_MULTIPLIER = 1.8;
export const MIN_NOTIFICATION_MOVE_PERCENT = 1.5;
export const MAX_WATCHLIST_NOTIFICATIONS = 6;
export const VOLUME_RATIO_TO_CONFIDENCE_FACTOR = 30;
export const SENTIMENT_PRICE_CHANGE_WEIGHT = 8;
export const SENTIMENT_VOLUME_RATIO_WEIGHT = 20;
export const NEWS_IMPACT_PRICE_WEIGHT = 10;
export const NEWS_IMPACT_VOLUME_WEIGHT = 25;
export const NEWS_IMPACT_SENTIMENT_WEIGHT = 0.35;
export const SMART_WATCHLIST_VOLATILITY_WEIGHT = 0.35;
export const SMART_WATCHLIST_LIQUIDITY_WEIGHT = 0.35;
export const SMART_WATCHLIST_SENTIMENT_WEIGHT = 0.3;
export const LIQUIDATION_PRESSURE_HIGH_MULTIPLIER = 1.35;
export const LIQUIDATION_PRESSURE_LOW_MULTIPLIER = 0.85;
export const LIQUIDATION_INTENSITY_VOLUME_WEIGHT = 25;
export const LIQUIDATION_INTENSITY_VOLATILITY_WEIGHT = 3;
export const SMART_WATCHLIST_VOLATILITY_MULTIPLIER = 8;
export const SMART_WATCHLIST_LIQUIDITY_MULTIPLIER = 35;
export const LIQUIDATION_SIGNAL_THRESHOLD = 0.3;
export const HIGH_VOLUME_RATIO_THRESHOLD = 1.8;
export const HIGH_LIQUIDATION_INTENSITY_THRESHOLD = 50;
export const ENTRY_REACHED_THRESHOLD_PERCENT = 0.3;
export const MAX_GENERATED_NOTIFICATIONS_PER_UPDATE = 12;
export const LIQUIDATION_CONFIDENCE_IMBALANCE_WEIGHT = 120;
export const LIQUIDATION_CONFIDENCE_INTENSITY_WEIGHT = 0.25;
export const MIN_PATTERN_WIN_PROBABILITY = 40;
export const MAX_PATTERN_WIN_PROBABILITY = 92;
export const PATTERN_BASE_WEIGHT = 0.65;
export const PATTERN_CONFIDENCE_WEIGHT = 0.35;
export const PATTERN_BULLISH_STOP_LOSS_FACTOR = 0.98;
export const PATTERN_BEARISH_STOP_LOSS_FACTOR = 1.02;
export const PATTERN_BULLISH_TAKE_PROFIT_FACTOR = 1.048;
export const PATTERN_BEARISH_TAKE_PROFIT_FACTOR = 0.952;
export const PATTERN_RSI_OVERBOUGHT_THRESHOLD = 65;
export const PATTERN_RSI_OVERSOLD_THRESHOLD = 40;
export const PATTERN_VOLUME_SPIKE_THRESHOLD = 1.6;
export const PATTERN_STRUCTURE_STRENGTH_THRESHOLD = 1.5;
export const SCANNER_PAGE_SIZE = 200;
export const DEFAULT_TOTAL_SCANNED = 1000;
export const CUSTOM_PAIR_RANK = 0;
export const DEFAULT_EXCHANGE: SupportedExchange = 'binance';

export const UI_HEADING_CLASS = 'text-[20px] font-bold';
export const UI_SECTION_TITLE_CLASS = 'text-[17px] font-semibold';
export const UI_DATA_TEXT_CLASS = 'text-sm';
export const UI_SMALL_LABEL_CLASS = 'text-[11px]';

export const EXCHANGE_LABELS: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bitget: 'Bitget',
  mexc: 'MEXC',
};

export type DashboardTab =
  | 'overview'
  | 'scanner'
  | 'patterns'
  | 'suggestions'
  | 'liquidations'
  | 'liquidationintel'
  | 'warnings'
  | 'volumewhales'
  | 'smartwatchlist'
  | 'watchlist';

export type PrimaryNavGroup = {
  id: 'markets' | 'intelligence' | 'analysis' | 'portfolio';
  label: string;
  tabIds: DashboardTab[];
};

export const PRIMARY_NAV_GROUPS: PrimaryNavGroup[] = [
  {
    id: 'markets',
    label: 'Markets',
    tabIds: ['scanner', 'suggestions'],
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

export const ALL_DASHBOARD_TABS: DashboardTab[] = [
  'overview',
  'scanner',
  'patterns',
  'suggestions',
  'liquidations',
  'liquidationintel',
  'warnings',
  'volumewhales',
  'smartwatchlist',
  'watchlist',
];

export type CandlePattern = {
  name: string;
  bias: 'Bullish' | 'Bearish' | 'Reversal';
  idea: string;
  confirmation: string;
  riskHint: string;
  candles: { open: number; high: number; low: number; close: number }[];
};

export type PatternCoinMatches = Record<string, string[]>;
export type PatternStatus = 'Forming' | 'Confirmed' | 'Invalidated';
export type PatternPriority = 'High Opportunity' | 'Medium' | 'Low Quality';
export type PatternTimeframe = '5m' | '15m' | '1h';
export type PatternBiasFilter = 'all' | 'Bullish' | 'Bearish';
export type SuggestionBias = 'LONG' | 'SHORT';
export type SuggestionTemplate = {
  name: string;
  setup: string;
  confirmation: string;
  invalidation: string;
};
export type TradeSuggestion = {
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

export type NewsRiskItem = {
  symbol: string;
  source: 'Crypto News' | 'X (Twitter)' | 'Market Wire';
  headline: string;
  sentimentScore: number;
  twitterTrendScore: number;
  newsImpactScore: number;
  riskLevel: 'High' | 'Medium';
};

export type LiquidationHeatItem = {
  symbol: string;
  longLiquidationPressure: number;
  shortLiquidationPressure: number;
  imbalance: number;
  intensity: number;
};

export type WhaleActivityItem = {
  symbol: string;
  side: 'BUY' | 'SELL';
  estimatedUsd: number;
  confidence: number;
};

export type QuickSignalBias = 'Long' | 'Short';
export type SignalStrength = 'Strong' | 'Medium' | 'Weak';
export type TradeConfidenceBand = 'Avoid' | 'Risky' | 'Good' | 'Strong trade';

export type QuickSignalItem = {
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
  riskRewardRatio: number;
  isVolumeHigh: boolean;
  marketRegime: CoinAnalysis['tradeSignal']['market_regime'];
  trend: CoinAnalysis['indicators']['ma']['trend'];
  riskFlags: string[];
};

export type PatternDecisionCard = {
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

export function getSignalStrength(confidence: number): SignalStrength {
  if (confidence >= 85) return 'Strong';
  if (confidence >= 70) return 'Medium';
  return 'Weak';
}

export function getConfidenceBand(confidence: number): TradeConfidenceBand {
  if (confidence >= 85) return 'Strong trade';
  if (confidence >= 70) return 'Good';
  if (confidence >= 55) return 'Risky';
  return 'Avoid';
}

export function pressureLabel(imbalance: number): string {
  if (imbalance >= 0.6) return 'Extreme Upside Pressure';
  if (imbalance >= LIQUIDATION_SIGNAL_THRESHOLD) return 'Moderate Upside Pressure';
  if (imbalance <= -0.6) return 'Extreme Downside Pressure';
  if (imbalance <= -LIQUIDATION_SIGNAL_THRESHOLD) return 'Moderate Downside Pressure';
  return 'Ranging Momentum / Balance';
}

export function signalLabelFromImbalance(imbalance: number): 'LONG' | 'SHORT' | 'WAIT' {
  if (imbalance >= LIQUIDATION_SIGNAL_THRESHOLD) return 'LONG';
  if (imbalance <= -LIQUIDATION_SIGNAL_THRESHOLD) return 'SHORT';
  return 'WAIT';
}

export function pressureColorFromImbalance(imbalance: number): string {
  if (imbalance >= LIQUIDATION_SIGNAL_THRESHOLD) return 'text-green-400';
  if (imbalance <= -LIQUIDATION_SIGNAL_THRESHOLD) return 'text-red-400';
  return 'text-yellow-400';
}

export function liquidationVisualBar(value: number, maxValue: number): string {
  const chars = 15;
  const filled = Math.min(Math.round((value / maxValue) * chars), chars);
  const empty = chars - filled;
  return '█'.repeat(filled) + '░'.repeat(empty);
}

export function matchesPattern(
  coin: { signal: 'BUY' | 'SELL' | 'HOLD'; score: number; priceChangePercent: number },
  pattern: CandlePattern
): boolean {
  if (pattern.bias === 'Bullish' && coin.signal === 'BUY') {
    return coin.score >= 50;
  }
  if (pattern.bias === 'Bearish' && coin.signal === 'SELL') {
    return coin.score >= 50;
  }
  if (pattern.bias === 'Reversal') {
    return Math.abs(coin.priceChangePercent) >= 2.5;
  }
  return false;
}

export function buildPatternCoinMatches(
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

export const PATTERN_BASE_WIN_PROBABILITY: Record<string, number> = {
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

export const PATTERN_DEFAULT_TIMEFRAME: Record<string, PatternTimeframe> = {
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

export async function fetchBinancePatternMatches(): Promise<PatternCoinMatches> {
  const response = await fetch('/api/scanner?exchanges=binance&limit=120', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const data = (await response.json()) as {
    coins?: Array<{ symbol: string; signal: 'BUY' | 'SELL' | 'HOLD'; score: number; priceChangePercent: number }>;
  };
  return buildPatternCoinMatches(data.coins ?? []);
}

export const CANDLE_PATTERNS: CandlePattern[] = [
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

export const LONG_SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
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

export const SHORT_SUGGESTION_TEMPLATES: SuggestionTemplate[] = [
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

export function PatternMiniChart({
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

export function PatternLearningCard({ card, learningMode }: { card: PatternDecisionCard; learningMode: boolean }) {
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

export function CandlePatternsPanel({
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
        {patternCards.length === 0 ? (
          <div className="md:col-span-2 xl:col-span-3 rounded-lg border border-gray-700 bg-gray-900/75 p-4">
            <p className="text-sm text-gray-300">No pattern details found for the selected filters/coin.</p>
          </div>
        ) : (
          patternCards.map((card) => {
            return (
              <PatternLearningCard
                key={card.pattern.name}
                card={card}
                learningMode={learningMode}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export function ExchangeSelector({
  selectedExchanges,
  onSelectedExchangeChange,
}: {
  selectedExchanges: SupportedExchange[];
  onSelectedExchangeChange: (exchange: SupportedExchange) => void;
}) {
  const selectedOption: SupportedExchange = selectedExchanges[0] ?? DEFAULT_EXCHANGE;

  return (
    <div className="flex items-center gap-2 mb-4 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 w-fit">
      <span className="text-xs text-gray-400 font-medium">Exchange:</span>
      <select
        value={selectedOption}
        onChange={(e) => onSelectedExchangeChange(e.target.value as SupportedExchange)}
        className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
      >
        <option value="binance" className="bg-gray-900">Binance</option>
        <option value="bitget" className="bg-gray-900">Bitget</option>
      </select>
    </div>
  );
}
