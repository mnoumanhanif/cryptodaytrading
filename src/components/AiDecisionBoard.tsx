'use client';

import { useMemo, useState } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { clampScore, formatPrice, formatVolume } from '@/lib/utils';
import { CoinAnalysis } from '@/lib/types';

const MAX_DECISIONS = 12;
const MIN_CONFIDENCE = 60;
const MIN_VOLUME_RATIO = 1.2;
const RANK_CONFIDENCE_WEIGHT = 0.28;
const RANK_SCORE_WEIGHT = 0.22;
const RANK_VOLUME_WEIGHT = 0.15;
const RANK_MOVE_WEIGHT = 0.1;
const RANK_PROFIT_WEIGHT = 0.1;
const RANK_RR_WEIGHT = 0.05;
const RANK_WHALE_WEIGHT = 0.05;
const RANK_SOCIAL_WEIGHT = 0.05;
const VOLUME_RATIO_TO_SCORE = 30;
const MOVE_PERCENT_TO_SCORE = 8;
const PROFIT_PERCENT_TO_SCORE = 10;
const RR_TO_SCORE = 25;
const SCORE_CAP = 100;
const WHALE_PICKUP_THRESHOLD = 72;
const SOCIAL_TREND_THRESHOLD = 68;

type DecisionSort = 'rank' | 'confidence' | 'score' | 'profit' | 'whale' | 'social';
type BiasFilter = 'ALL' | 'LONG' | 'SHORT';
type FocusFilter = 'ALL' | 'WHALE_SOCIAL' | 'HIGH_CONVICTION' | 'ASYMMETRIC';
type DecisionBias = 'LONG' | 'SHORT';

type DecisionItem = {
  symbol: string;
  bias: DecisionBias;
  confidence: number;
  score: number;
  volume24h: number;
  volumeRatio: number;
  priceChangePercent: number;
  entry: number;
  stopLoss: number;
  target: number;
  support: number;
  resistance: number;
  expectedProfitPercent: number;
  expectedLossPercent: number;
  riskRewardRatio: number;
  whaleConfidence: number;
  whaleEstimatedUsd: number;
  socialTrendScore: number;
  attentionScore: number;
  rankScore: number;
  marketRegime: CoinAnalysis['tradeSignal']['market_regime'];
  keyFactors: string[];
  riskFlags: string[];
  isWhalePickup: boolean;
  isSocialTrend: boolean;
};

function getMoveDirection(coin: CoinAnalysis): 'UP' | 'DOWN' {
  const trend = coin.indicators.ma.trend;
  const momentum = coin.priceChangePercent;

  if (trend === 'bearish' || coin.signal === 'SELL') return 'DOWN';
  if (trend === 'bullish' || coin.signal === 'BUY') return 'UP';
  return momentum >= 0 ? 'UP' : 'DOWN';
}

function getSupport(coin: CoinAnalysis): number {
  return coin.indicators.fibonacci?.nearestSupport ?? coin.low24h ?? coin.risk.stopLoss;
}

function getResistance(coin: CoinAnalysis): number {
  return coin.indicators.fibonacci?.nearestResistance ?? coin.high24h ?? coin.risk.targetPrice;
}

function getEntry(coin: CoinAnalysis): number {
  if (coin.risk.entryPrice > 0) {
    const entryDeviationPercent = coin.price > 0 ? Math.abs(((coin.risk.entryPrice - coin.price) / coin.price) * 100) : 0;
    if (entryDeviationPercent <= 15) return coin.risk.entryPrice;
  }

  const { entryZoneLow, entryZoneHigh } = coin.tradeSignal;
  if (entryZoneLow > 0 && entryZoneHigh > 0) return (entryZoneLow + entryZoneHigh) / 2;
  return coin.price;
}

function normalizeTradeLevels(
  entry: number,
  rawTarget: number,
  rawStopLoss: number,
  moveDirection: 'UP' | 'DOWN',
  support: number,
  resistance: number
): { target: number; stopLoss: number } {
  if (moveDirection === 'UP') {
    const target = Math.max(rawTarget, entry * 1.01);
    const stopLoss = Math.min(rawStopLoss, support > 0 ? support : entry * 0.99);
    return {
      target,
      stopLoss: stopLoss < entry ? stopLoss : entry * 0.99,
    };
  }

  const targetCandidates = [rawTarget, support, entry * 0.99].filter((value) => Number.isFinite(value) && value > 0 && value < entry);
  const stopCandidates = [rawStopLoss, resistance, entry * 1.01].filter((value) => Number.isFinite(value) && value > entry);
  return {
    target: targetCandidates.length > 0 ? Math.min(...targetCandidates) : entry * 0.99,
    stopLoss: stopCandidates.length > 0 ? Math.max(...stopCandidates) : entry * 1.01,
  };
}

function calculateMoveToTargetPercent(entry: number, target: number, moveDirection: 'UP' | 'DOWN'): number {
  if (entry <= 0) return 0;
  const raw = moveDirection === 'UP' ? ((target - entry) / entry) * 100 : ((entry - target) / entry) * 100;
  return Math.max(0, raw);
}

function calculateRiskToStopPercent(entry: number, stopLoss: number, moveDirection: 'UP' | 'DOWN'): number {
  if (entry <= 0) return 0;
  const raw = moveDirection === 'UP' ? ((entry - stopLoss) / entry) * 100 : ((stopLoss - entry) / entry) * 100;
  return Math.max(0, raw);
}

function getBias(coin: CoinAnalysis): DecisionBias {
  return getMoveDirection(coin) === 'UP' ? 'LONG' : 'SHORT';
}

function getWhaleEstimatedUsd(coin: CoinAnalysis): number {
  return (coin.indicators.volume?.currentVolume ?? 0) * coin.price;
}

function getWhaleConfidence(coin: CoinAnalysis): number {
  const raw =
    (coin.indicators.volume?.volumeRatio ?? 0) * 28 +
    Math.abs(coin.priceChangePercent) * 3 +
    (coin.indicators.volume?.spike ? 12 : 0) +
    coin.tradeSignal.confidence * 0.18;
  return clampScore(Math.round(raw));
}

function getSocialTrendScore(coin: CoinAnalysis): number {
  const raw =
    Math.abs(coin.priceChangePercent) * 8 +
    (coin.indicators.volume?.volumeRatio ?? 0) * 18 +
    coin.tradeSignal.confidence * 0.25 +
    (coin.signal === 'HOLD' ? 0 : 6);
  return clampScore(Math.round(raw));
}

function getDecisionRank(item: Pick<DecisionItem, 'confidence' | 'score' | 'volumeRatio' | 'priceChangePercent' | 'expectedProfitPercent' | 'riskRewardRatio' | 'whaleConfidence' | 'socialTrendScore'>): number {
  return (
    item.confidence * RANK_CONFIDENCE_WEIGHT +
    item.score * RANK_SCORE_WEIGHT +
    Math.min(item.volumeRatio * VOLUME_RATIO_TO_SCORE, SCORE_CAP) * RANK_VOLUME_WEIGHT +
    Math.min(Math.abs(item.priceChangePercent) * MOVE_PERCENT_TO_SCORE, SCORE_CAP) * RANK_MOVE_WEIGHT +
    Math.min(item.expectedProfitPercent * PROFIT_PERCENT_TO_SCORE, SCORE_CAP) * RANK_PROFIT_WEIGHT +
    Math.min(item.riskRewardRatio * RR_TO_SCORE, SCORE_CAP) * RANK_RR_WEIGHT +
    item.whaleConfidence * RANK_WHALE_WEIGHT +
    item.socialTrendScore * RANK_SOCIAL_WEIGHT
  );
}

function selectSortValue(item: DecisionItem, sortBy: DecisionSort): number {
  switch (sortBy) {
    case 'confidence':
      return item.confidence;
    case 'score':
      return item.score;
    case 'profit':
      return item.expectedProfitPercent;
    case 'whale':
      return item.whaleConfidence;
    case 'social':
      return item.socialTrendScore;
    case 'rank':
    default:
      return item.rankScore;
  }
}

function getBiasToneClass(bias: DecisionBias): string {
  return bias === 'LONG'
    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
    : 'border-rose-500/30 bg-rose-500/10 text-rose-300';
}

function getMeterToneClass(value: number): string {
  if (value >= 80) return 'bg-emerald-400';
  if (value >= 65) return 'bg-cyan-400';
  if (value >= 50) return 'bg-amber-400';
  return 'bg-gray-500';
}

export default function AiDecisionBoard() {
  const { coins, loading, error, lastUpdated, totalScanned, refetch } = useMarketData(['binance']);
  const [sortBy, setSortBy] = useState<DecisionSort>('rank');
  const [biasFilter, setBiasFilter] = useState<BiasFilter>('ALL');
  const [focusFilter, setFocusFilter] = useState<FocusFilter>('ALL');

  const allDecisions = useMemo<DecisionItem[]>(() => {
    return [...coins]
      .filter((coin) => {
        const confidence = coin.tradeSignal.confidence;
        const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
        return confidence >= MIN_CONFIDENCE && volumeRatio >= MIN_VOLUME_RATIO;
      })
      .map((coin) => {
        const entry = getEntry(coin);
        const support = getSupport(coin);
        const resistance = getResistance(coin);
        const moveDirection = getMoveDirection(coin);
        const { target, stopLoss } = normalizeTradeLevels(entry, coin.risk.targetPrice, coin.risk.stopLoss, moveDirection, support, resistance);
        const expectedProfitPercent = calculateMoveToTargetPercent(entry, target, moveDirection);
        const expectedLossPercent = calculateRiskToStopPercent(entry, stopLoss, moveDirection);
        const whaleConfidence = getWhaleConfidence(coin);
        const socialTrendScore = getSocialTrendScore(coin);
        const item: DecisionItem = {
          symbol: coin.symbol,
          bias: getBias(coin),
          confidence: coin.tradeSignal.confidence,
          score: coin.score,
          volume24h: coin.volume24h,
          volumeRatio: coin.indicators.volume?.volumeRatio ?? 0,
          priceChangePercent: coin.priceChangePercent,
          entry,
          stopLoss,
          target,
          support,
          resistance,
          expectedProfitPercent,
          expectedLossPercent,
          riskRewardRatio: coin.risk.riskRewardRatio,
          whaleConfidence,
          whaleEstimatedUsd: getWhaleEstimatedUsd(coin),
          socialTrendScore,
          attentionScore: Math.round(whaleConfidence * 0.55 + socialTrendScore * 0.45),
          marketRegime: coin.tradeSignal.market_regime,
          keyFactors: coin.tradeSignal.key_factors,
          riskFlags: coin.tradeSignal.risk_flags,
          isWhalePickup: whaleConfidence >= WHALE_PICKUP_THRESHOLD,
          isSocialTrend: socialTrendScore >= SOCIAL_TREND_THRESHOLD,
          rankScore: 0,
        };

        return { ...item, rankScore: getDecisionRank(item) };
      });
  }, [coins]);

  const filteredDecisions = useMemo(() => {
    return allDecisions
      .filter((item) => {
        if (biasFilter !== 'ALL' && item.bias !== biasFilter) return false;
        if (focusFilter === 'WHALE_SOCIAL') return item.isWhalePickup && item.isSocialTrend;
        if (focusFilter === 'HIGH_CONVICTION') return item.confidence >= 75 && item.score >= 65;
        if (focusFilter === 'ASYMMETRIC') return item.expectedProfitPercent >= 3 && item.riskRewardRatio >= 1.8;
        return true;
      })
      .sort((a, b) => {
        const primary = selectSortValue(b, sortBy) - selectSortValue(a, sortBy);
        if (primary !== 0) return primary;
        return b.rankScore - a.rankScore;
      });
  }, [allDecisions, biasFilter, focusFilter, sortBy]);

  const decisions = useMemo(() => filteredDecisions.slice(0, MAX_DECISIONS), [filteredDecisions]);

  const whaleRadar = useMemo(
    () =>
      [...allDecisions]
        .filter((item) => item.isWhalePickup && item.isSocialTrend)
        .sort((a, b) => b.attentionScore - a.attentionScore)
        .slice(0, 4),
    [allDecisions]
  );

  const averageConfidence = useMemo(() => {
    if (decisions.length === 0) return 0;
    return decisions.reduce((sum, item) => sum + item.confidence, 0) / decisions.length;
  }, [decisions]);

  const longCount = useMemo(() => decisions.filter((item) => item.bias === 'LONG').length, [decisions]);
  const shortCount = decisions.length - longCount;
  const bestLong = useMemo(() => decisions.find((item) => item.bias === 'LONG'), [decisions]);
  const bestShort = useMemo(() => decisions.find((item) => item.bias === 'SHORT'), [decisions]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-gray-950/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300/80">Professional decision workspace</p>
            <h1 className="bg-gradient-to-r from-cyan-300 via-white to-emerald-300 bg-clip-text text-2xl font-bold text-transparent">
              AI Trade Decisions
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Sort high-conviction setups by confidence, score, profit potential, whale flow, or social momentum proxies.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-gray-200 transition hover:bg-white/10"
            >
              Dashboard
            </a>
            <button
              onClick={() => void refetch()}
              disabled={loading}
              className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-medium text-gray-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6">
        {error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            ⚠ {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-cyan-500/10 to-gray-900 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Universe scanned</p>
            <p className="mt-3 text-3xl font-semibold text-white">{totalScanned}</p>
            <p className="mt-2 text-sm text-gray-400">Live candidates evaluated from the latest scanner refresh.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-gray-900 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Decision mix</p>
            <p className="mt-3 text-3xl font-semibold text-white">{decisions.length}</p>
            <p className="mt-2 text-sm text-gray-400">
              {longCount} long / {shortCount} short setups after your current filters.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-violet-500/10 to-gray-900 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Avg confidence</p>
            <p className="mt-3 text-3xl font-semibold text-white">{averageConfidence.toFixed(0)}%</p>
            <p className="mt-2 text-sm text-gray-400">Only high-volume, high-confidence opportunities are included.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-amber-500/10 to-gray-900 p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-gray-400">Whale + social radar</p>
            <p className="mt-3 text-3xl font-semibold text-white">{whaleRadar.length}</p>
            <p className="mt-2 text-sm text-gray-400">
              Coins where volume-led whale flow and social-buzz proxies align.
            </p>
          </div>
        </section>

        <section className="grid gap-3 xl:grid-cols-[1.3fr_1fr]">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Decision controls</p>
                <p className="text-xs text-gray-400">Tune the board for conviction, direction, and special opportunity focus.</p>
              </div>
              <p className="text-xs text-gray-500">
                Updated {lastUpdated > 0 ? new Date(lastUpdated).toLocaleTimeString() : 'Loading...'}
              </p>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <label className="space-y-1 text-sm">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Sort by</span>
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as DecisionSort)}
                  className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="rank">AI rank</option>
                  <option value="confidence">Confidence</option>
                  <option value="score">Score</option>
                  <option value="profit">Profit potential</option>
                  <option value="whale">Whale flow</option>
                  <option value="social">Social trend</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Bias</span>
                <select
                  value={biasFilter}
                  onChange={(event) => setBiasFilter(event.target.value as BiasFilter)}
                  className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="ALL">All decisions</option>
                  <option value="LONG">Long only</option>
                  <option value="SHORT">Short only</option>
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Focus</span>
                <select
                  value={focusFilter}
                  onChange={(event) => setFocusFilter(event.target.value as FocusFilter)}
                  className="w-full rounded-xl border border-white/10 bg-gray-900 px-3 py-2 text-sm text-white outline-none transition focus:border-cyan-400"
                >
                  <option value="ALL">Balanced</option>
                  <option value="WHALE_SOCIAL">Whale + social overlap</option>
                  <option value="HIGH_CONVICTION">High conviction</option>
                  <option value="ASYMMETRIC">Asymmetric reward</option>
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <p className="text-sm font-semibold text-white">Signal notes</p>
            <p className="mt-2 text-sm leading-6 text-gray-300">
              Whale flow and social trend are professional market-attention proxies generated from live volume surges, price expansion,
              and signal confidence. They highlight likely institutional pickup and crowd attention without claiming direct third-party
              social API coverage.
            </p>
          </div>
        </section>

        <section className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-emerald-300">Best long setup</p>
            {bestLong ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">{bestLong.symbol}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getBiasToneClass(bestLong.bias)}`}>
                    {bestLong.bias}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {bestLong.confidence}% confidence · {bestLong.expectedProfitPercent.toFixed(2)}% target move · 1:
                  {bestLong.riskRewardRatio.toFixed(2)} R:R
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">No long setup matches the current filters.</p>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Best short setup</p>
            {bestShort ? (
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">{bestShort.symbol}</h2>
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getBiasToneClass(bestShort.bias)}`}>
                    {bestShort.bias}
                  </span>
                </div>
                <p className="text-sm text-gray-400">
                  {bestShort.confidence}% confidence · {bestShort.expectedProfitPercent.toFixed(2)}% target move · 1:
                  {bestShort.riskRewardRatio.toFixed(2)} R:R
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">No short setup matches the current filters.</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Whale + social radar</h2>
              <p className="text-sm text-gray-400">The strongest overlap between unusual flow and fast-rising market attention.</p>
            </div>
          </div>

          {whaleRadar.length === 0 ? (
            <p className="mt-4 text-sm text-gray-400">No overlap candidates yet. Wait for stronger volume expansion and trend confirmation.</p>
          ) : (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {whaleRadar.map((item) => (
                <div key={item.symbol} className="rounded-2xl border border-white/10 bg-gray-900/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-base font-semibold text-white">{item.symbol}</h3>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getBiasToneClass(item.bias)}`}>
                      {item.bias}
                    </span>
                  </div>
                  <div className="mt-3 space-y-2 text-sm text-gray-300">
                    <p>Attention score: <span className="font-medium text-white">{item.attentionScore}/100</span></p>
                    <p>Whale flow: <span className="font-medium text-cyan-300">{item.whaleConfidence}/100</span></p>
                    <p>Social trend: <span className="font-medium text-violet-300">{item.socialTrendScore}/100</span></p>
                    <p>Estimated whale size: <span className="font-medium text-white">{formatVolume(item.whaleEstimatedUsd)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {loading && decisions.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">Loading market decisions...</div>
        ) : (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Execution-ready decision board</h2>
                <p className="text-sm text-gray-400">Professional trade cards ranked for conviction, opportunity quality, and attention flow.</p>
              </div>
              <p className="text-xs uppercase tracking-[0.2em] text-gray-500">
                Showing {decisions.length} of {filteredDecisions.length}
              </p>
            </div>

            {decisions.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-sm text-gray-300">
                No decision matches the current filters. Try switching the bias or focus controls.
              </div>
            ) : (
              decisions.map((item) => (
                <article key={item.symbol} className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-gray-900/80 p-5 shadow-2xl shadow-black/20">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-xl font-semibold text-white">{item.symbol}</h3>
                        <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${getBiasToneClass(item.bias)}`}>
                          {item.bias}
                        </span>
                        {item.isWhalePickup && (
                          <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
                            Whale pickup
                          </span>
                        )}
                        {item.isSocialTrend && (
                          <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-xs font-medium text-violet-200">
                            Social trend
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                        <p>Rank <span className="font-medium text-white">{item.rankScore.toFixed(1)}</span></p>
                        <p>Score <span className="font-medium text-emerald-300">{item.score.toFixed(1)}</span></p>
                        <p>Confidence <span className="font-medium text-cyan-300">{item.confidence}%</span></p>
                        <p>24h move <span className={item.priceChangePercent >= 0 ? 'font-medium text-emerald-300' : 'font-medium text-rose-300'}>{item.priceChangePercent >= 0 ? '+' : ''}{item.priceChangePercent.toFixed(2)}%</span></p>
                        <p>Regime <span className="font-medium text-white">{item.marketRegime}</span></p>
                      </div>
                    </div>

                    <div className="min-w-[240px] space-y-3 rounded-2xl border border-white/10 bg-gray-950/70 p-4">
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Whale flow</span>
                          <span>{item.whaleConfidence}/100</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${getMeterToneClass(item.whaleConfidence)}`} style={{ width: `${item.whaleConfidence}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <span>Social trend</span>
                          <span>{item.socialTrendScore}/100</span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full rounded-full ${getMeterToneClass(item.socialTrendScore)}`} style={{ width: `${item.socialTrendScore}%` }} />
                        </div>
                      </div>
                      <p className="text-sm text-gray-300">
                        Estimated whale size <span className="font-medium text-white">{formatVolume(item.whaleEstimatedUsd)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Entry</p>
                      <p className="mt-2 font-mono text-white">{formatPrice(item.entry)}</p>
                    </div>
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Target</p>
                      <p className="mt-2 font-mono text-emerald-300">{formatPrice(item.target)}</p>
                    </div>
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Stop loss</p>
                      <p className="mt-2 font-mono text-rose-300">{formatPrice(item.stopLoss)}</p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Profit / loss</p>
                      <p className="mt-2 font-mono text-white">
                        {item.expectedProfitPercent.toFixed(2)}% / {item.expectedLossPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Support / resistance</p>
                      <p className="mt-2 font-mono text-white">
                        {formatPrice(item.support)} / {formatPrice(item.resistance)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Liquidity / R:R</p>
                      <p className="mt-2 font-mono text-white">
                        {item.volumeRatio.toFixed(2)}x / 1:{item.riskRewardRatio.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Why it stands out</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.keyFactors.map((factor) => (
                          <span key={factor} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-gray-300">
                            {factor}
                          </span>
                        ))}
                        {item.keyFactors.length === 0 && (
                          <span className="text-sm text-gray-500">No key factors available.</span>
                        )}
                      </div>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Risk flags</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.riskFlags.length > 0 ? (
                          item.riskFlags.map((flag) => (
                            <span key={flag} className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-100">
                              {flag}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-gray-500">No immediate risk flags.</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4 text-sm text-gray-400">
                    <p>24h volume <span className="font-medium text-white">{formatVolume(item.volume24h)}</span></p>
                    <p>Attention score <span className="font-medium text-white">{item.attentionScore}/100</span></p>
                  </div>
                </article>
              ))
            )}
          </section>
        )}
      </main>
    </div>
  );
}
