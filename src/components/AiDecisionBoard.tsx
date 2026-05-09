'use client';

import { useMemo } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { formatPrice, formatVolume } from '@/lib/utils';
import { CoinAnalysis } from '@/lib/types';

const MAX_DECISIONS = 12;
const MIN_CONFIDENCE = 60;
const MIN_VOLUME_RATIO = 1.2;
const RANK_CONFIDENCE_WEIGHT = 0.4;
const RANK_SCORE_WEIGHT = 0.3;
const RANK_VOLUME_WEIGHT = 0.2;
const RANK_MOVE_WEIGHT = 0.1;
const VOLUME_RATIO_TO_SCORE = 30;
const MOVE_PERCENT_TO_SCORE = 8;
const RANK_SCORE_CAP = 100;

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
  if (entryZoneLow > 0 && entryZoneHigh > 0) {
    return (entryZoneLow + entryZoneHigh) / 2;
  }
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

function rankCoin(coin: CoinAnalysis): number {
  const confidence = coin.tradeSignal.confidence;
  const score = coin.score;
  const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
  const move = Math.abs(coin.priceChangePercent);

  return (
    confidence * RANK_CONFIDENCE_WEIGHT +
    score * RANK_SCORE_WEIGHT +
    Math.min(volumeRatio * VOLUME_RATIO_TO_SCORE, RANK_SCORE_CAP) * RANK_VOLUME_WEIGHT +
    Math.min(move * MOVE_PERCENT_TO_SCORE, RANK_SCORE_CAP) * RANK_MOVE_WEIGHT
  );
}

export default function AiDecisionBoard() {
  const { coins, loading, error, lastUpdated, totalScanned, refetch } = useMarketData(['binance']);

  const decisions = useMemo(() => {
    return [...coins]
      .filter((coin) => {
        const confidence = coin.tradeSignal.confidence;
        const volumeRatio = coin.indicators.volume?.volumeRatio ?? 0;
        return confidence >= MIN_CONFIDENCE && volumeRatio >= MIN_VOLUME_RATIO;
      })
      .sort((a, b) => rankCoin(b) - rankCoin(a))
      .slice(0, MAX_DECISIONS)
      .map((coin) => {
        const entry = getEntry(coin);
        const support = getSupport(coin);
        const resistance = getResistance(coin);
        const moveDirection = getMoveDirection(coin);
        const rawTarget = coin.risk.targetPrice;
        const rawStopLoss = coin.risk.stopLoss;
        const { target, stopLoss } = normalizeTradeLevels(entry, rawTarget, rawStopLoss, moveDirection, support, resistance);
        const moveToTargetPercent = calculateMoveToTargetPercent(entry, target, moveDirection);
        const riskToStopPercent = calculateRiskToStopPercent(entry, stopLoss, moveDirection);

        return {
          symbol: coin.symbol,
          confidence: coin.tradeSignal.confidence,
          score: coin.score,
          volume24h: coin.volume24h,
          volumeRatio: coin.indicators.volume?.volumeRatio ?? 0,
          moveDirection,
          entry,
          stopLoss,
          target,
          support,
          resistance,
          moveToTargetPercent,
          riskToStopPercent,
          riskRewardRatio: coin.risk.riskRewardRatio,
        };
      });
  }, [coins]);

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              AI Trade Decisions
            </h1>
            <p className="text-xs text-gray-400">High-volume opportunities with entry, target, stop loss, support and resistance.</p>
          </div>

          <div className="flex items-center gap-2">
            <a
              href="/"
              className="px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-200 transition-colors"
            >
              Dashboard
            </a>
            <button
              onClick={() => void refetch()}
              disabled={loading}
              className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-sm text-white disabled:opacity-60 transition-colors"
            >
              {loading ? 'Refreshing...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-300 text-sm">
            ⚠ {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <p className="text-gray-400">Coins scanned</p>
            <p className="text-white font-semibold">{totalScanned}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <p className="text-gray-400">Selected decisions</p>
            <p className="text-cyan-300 font-semibold">{decisions.length}</p>
          </div>
          <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <p className="text-gray-400">Last update</p>
            <p className="text-white font-semibold">{lastUpdated > 0 ? new Date(lastUpdated).toLocaleTimeString() : 'Loading...'}</p>
          </div>
        </div>

        {loading && decisions.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-300">Loading market decisions...</div>
        ) : (
          <div className="space-y-3">
            {decisions.map((item) => (
              <div key={item.symbol} className="rounded-xl border border-gray-800 bg-gray-900/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold text-white">{item.symbol}</h2>
                    <p className="text-xs text-gray-400">
                      Move: <span className={item.moveDirection === 'UP' ? 'text-green-400' : 'text-red-400'}>{item.moveDirection}</span> ·
                      Confidence: <span className="text-cyan-300"> {item.confidence}%</span> ·
                      Score: <span className="text-emerald-300"> {item.score.toFixed(1)}</span>
                    </p>
                  </div>
                  <div className="text-xs text-gray-400">
                    Volume: <span className="text-white">{formatVolume(item.volume24h)}</span> · Ratio:{' '}
                    <span className="text-white">{item.volumeRatio.toFixed(2)}x</span>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 text-xs">
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Entry</p><p className="text-white font-mono">{formatPrice(item.entry)}</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Target</p><p className="text-green-400 font-mono">{formatPrice(item.target)}</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Stop Loss</p><p className="text-red-400 font-mono">{formatPrice(item.stopLoss)}</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Support</p><p className="text-cyan-300 font-mono">{formatPrice(item.support)}</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Resistance</p><p className="text-yellow-300 font-mono">{formatPrice(item.resistance)}</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Target Move %</p><p className="text-emerald-300 font-mono">{item.moveToTargetPercent.toFixed(2)}%</p></div>
                  <div className="rounded bg-gray-800/60 px-2 py-1.5"><p className="text-gray-400">Risk / R:R</p><p className="text-white font-mono">{item.riskToStopPercent.toFixed(2)}% / 1:{item.riskRewardRatio.toFixed(2)}</p></div>
                </div>
              </div>
            ))}

            {decisions.length === 0 && (
              <div className="rounded-lg border border-gray-800 bg-gray-900/40 p-4 text-sm text-gray-300">
                No high-volume high-confidence opportunities right now. Wait for stronger market structure.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
