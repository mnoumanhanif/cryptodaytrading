'use client';

// ============================================================
// Trade Signal Board – entry/exit signals with confidence
// ============================================================

import { useEffect, useMemo, useState } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { formatPriceRaw } from '@/lib/utils';
import { buildTimeframeCandidates, mergeLevels, Level } from '@/lib/chartLevels';
import { COMPOSITE_KEYS } from '@/lib/scoring';

interface Props {
  coin: CoinAnalysis;
}

interface CandleLike {
  high: number;
  low: number;
}

const LEVEL_TIMEFRAMES = ['1m', '15m', '1h', '4h', '1d'] as const;
function formatLevelOutput(levels: Level[] | undefined, labelPrefix: 'S' | 'R') {
  return [0, 1, 2]
    .map((idx) => {
      const lvl = levels?.[idx];
      if (!lvl) return `${labelPrefix}${idx + 1} N/A`;
      return `${labelPrefix}${idx + 1} $${formatPriceRaw(lvl.price)} (${lvl.timeframes.join('/')}${lvl.timeframes.length > 1 ? ' confluence' : ''})`;
    })
    .join(' · ');
}

export default function TradeSignalBoard({ coin }: Props) {
  const { tradeSignal, risk } = coin;
  const isLong = risk.entryPrice < risk.targetPrice;
  const isShort = risk.entryPrice > risk.targetPrice;
  const direction = isLong ? 'LONG' : isShort ? 'SHORT' : 'NEUTRAL';
  const [levels, setLevels] = useState<{ supports: Level[]; resistances: Level[] } | null>(null);

  const signalColor =
    tradeSignal.type === 'BUY'
      ? 'text-green-400 border-green-500/40 bg-green-500/10'
      : tradeSignal.type === 'SELL'
      ? 'text-red-400 border-red-500/40 bg-red-500/10'
      : 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10';

  const confidenceColor =
    tradeSignal.confidence >= 70
      ? 'bg-red-500'
      : tradeSignal.confidence >= 40
      ? 'bg-yellow-500'
      : 'bg-green-500';

  useEffect(() => {
    let cancelled = false;

    const loadLevels = async () => {
      try {
        const responses = await Promise.all(
          LEVEL_TIMEFRAMES.map(async (interval) => {
            const res = await fetch(`/api/klines?symbol=${encodeURIComponent(coin.symbol)}&interval=${interval}&limit=120`);
            if (!res.ok) return null;
            const data = await res.json() as { candles?: CandleLike[] };
            if (!data.candles || data.candles.length === 0) return null;
            const candidate = buildTimeframeCandidates(data.candles, coin.price);
            return { timeframe: interval, ...candidate };
          })
        );

        const valid = responses.filter((r): r is NonNullable<typeof r> => Boolean(r));
        if (valid.length === 0 || cancelled) return;

        const supports = mergeLevels(
          valid.map((v) => ({ price: v.support, timeframe: v.timeframe })),
          coin.price,
          'support'
        );
        const resistances = mergeLevels(
          valid.map((v) => ({ price: v.resistance, timeframe: v.timeframe })),
          coin.price,
          'resistance'
        );

        setLevels({ supports, resistances });
      } catch {
        if (!cancelled) setLevels(null);
      }
    };

    loadLevels();
    return () => {
      cancelled = true;
    };
  }, [coin.price, coin.symbol]);

  const signalRationale = useMemo(() => {
    const rsiLine = `RSI ${coin.indicators.rsi.value} (${coin.indicators.rsi.signal})`;
    const macdLine =
      coin.indicators.macd.crossover === 'bullish'
        ? 'MACD bullish crossover supports upside continuation'
        : coin.indicators.macd.crossover === 'bearish'
          ? 'MACD bearish crossover warns of downside pressure'
          : `MACD histogram ${coin.indicators.macd.histogram.toFixed(6)} shows neutral momentum`;

    const nearestSupport = levels?.supports[0]?.price;
    const nearestResistance = levels?.resistances[0]?.price;
    const srLine = nearestSupport && nearestResistance
      ? coin.price <= nearestSupport * 1.01
        ? 'Price is rebounding near key support zone'
        : coin.price >= nearestResistance * 0.99
          ? 'Price is rejecting near key resistance zone'
          : 'Price is trading between support/resistance levels'
      : 'Support/resistance levels are loading from multi-timeframe data';

    const scoreByKey: Record<(typeof COMPOSITE_KEYS)[number], number> = {
      rsi: coin.indicators.rsi.score,
      macd: coin.indicators.macd.score,
      bollinger: coin.indicators.bollinger.score,
      volume: coin.indicators.volume.score,
      ma: coin.indicators.ma.score,
      ichimoku: coin.indicators.ichimoku?.score ?? 50,
    };
    const labelByKey: Record<(typeof COMPOSITE_KEYS)[number], string> = {
      rsi: 'RSI',
      macd: 'MACD',
      bollinger: 'Bollinger',
      volume: 'Volume',
      ma: 'MA',
      ichimoku: 'Ichimoku',
    };
    const scoreBreakdown = COMPOSITE_KEYS.map((key) => `${labelByKey[key]} ${Math.round(scoreByKey[key])}`).join(' + ');
    const indicatorScoreLine = `Composite ${Math.round(coin.score)} = (${scoreBreakdown}) / ${COMPOSITE_KEYS.length}`;

    return [indicatorScoreLine, rsiLine, macdLine, srLine];
  }, [coin.indicators.bollinger.score, coin.indicators.ichimoku?.score, coin.indicators.ma.score, coin.indicators.macd.crossover, coin.indicators.macd.histogram, coin.indicators.macd.score, coin.indicators.rsi.score, coin.indicators.rsi.signal, coin.indicators.rsi.value, coin.indicators.volume.score, coin.price, coin.score, levels]);

  return (
    <div className="rounded-lg border border-gray-700/50 bg-gray-900/40 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          Trade Signal
        </h3>
        <span className={`text-xs font-bold px-2 py-0.5 rounded border ${signalColor}`}>
          {tradeSignal.type}
        </span>
      </div>

      {/* Confidence meter */}
      <div>
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>Confidence</span>
          <span className="font-mono font-bold text-white">{tradeSignal.confidence}%</span>
        </div>
        <div className="h-2 w-full bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${confidenceColor}`}
            style={{ width: `${tradeSignal.confidence}%` }}
          />
        </div>
      </div>

      {/* Signal setup */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Direction</div>
          <div className="text-sm font-semibold text-white">{direction}</div>
        </div>
        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Entry Zone</div>
          <div className="text-xs font-mono text-blue-300">
            ${formatPriceRaw(tradeSignal.entryZoneLow)}
          </div>
          <div className="text-xs font-mono text-blue-300">
            – ${formatPriceRaw(tradeSignal.entryZoneHigh)}
          </div>
        </div>

        <div className="bg-gray-800/60 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">Invalidation (Stop Loss)</div>
          <div className="text-sm font-mono text-red-400 font-semibold">
            ${formatPriceRaw(risk.stopLoss)}
          </div>
          <div className="text-xs text-red-400/60">
            {isShort ? '+' : '−'}
            {risk.stopLossPercent}%
          </div>
        </div>
      </div>

      {/* Multi-level take-profit */}
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">
          Target (Take Profit)
        </div>
        <div className="space-y-2">
          {[
            { label: 'TP1 (1R)', price: risk.takeProfit1, pct: risk.takeProfit1Percent },
            { label: 'TP2 (2R)', price: risk.takeProfit2, pct: risk.takeProfit2Percent },
            { label: 'TP3 (3R)', price: risk.takeProfit3, pct: risk.takeProfit3Percent },
          ].map(({ label, price, pct }) => (
            <div
              key={label}
              className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-1.5"
            >
              <span className="text-xs text-gray-400">{label}</span>
              <div className="text-right">
                <span className="text-xs font-mono text-green-400 font-semibold">
                  ${formatPriceRaw(price)}
                </span>
                <span className="text-xs text-green-400/60 ml-1">
                  {isShort ? '−' : '+'}
                  {pct}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk/Reward */}
      <div className="flex items-center justify-between bg-blue-500/10 border border-blue-500/30 rounded-lg px-3 py-2">
        <span className="text-xs text-gray-400">Risk : Reward</span>
        <span className="text-sm font-bold text-blue-400 font-mono">
          1 : {risk.riskRewardRatio}
        </span>
      </div>

      {/* Multi-timeframe key levels */}
      <div className="rounded-lg border border-gray-700/50 bg-gray-800/30 p-3 space-y-2">
        <div className="text-xs text-gray-400 uppercase tracking-wide">Price Action & Key Levels</div>
        <div className="text-xs text-gray-300">
          <span className="text-green-400 font-semibold">Support (S1, S2, S3): </span>
          {levels
            ? formatLevelOutput(levels.supports, 'S')
            : 'Loading 1m/15m/1h/4h/1d levels...'}
        </div>
        <div className="text-xs text-gray-300">
          <span className="text-red-400 font-semibold">Resistance (R1, R2, R3): </span>
          {levels
            ? formatLevelOutput(levels.resistances, 'R')
            : 'Loading 1m/15m/1h/4h/1d levels...'}
        </div>
      </div>

      {/* Rationale */}
      <div>
        <div className="text-xs text-gray-400 uppercase tracking-wide mb-1">Signal Rationale</div>
        <ul className="space-y-1">
          {signalRationale.map((r, i) => (
            <li key={i} className="text-xs text-gray-300 flex items-start gap-1.5">
              <span className="text-blue-500 mt-0.5">•</span>
              {r}
            </li>
          ))}
        </ul>
      </div>

      {/* Daily portfolio risk constraints */}
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
        <div className="text-xs text-amber-300 uppercase tracking-wide mb-1">Daily Constraints (portfolioRisk)</div>
        <ul className="space-y-1 text-xs text-amber-100/90">
          <li>• Max daily loss cap is enforced.</li>
          <li>• Never exceed max open positions.</li>
          <li>• Stop trading if consecutive loss limits are hit.</li>
        </ul>
      </div>
    </div>
  );
}
