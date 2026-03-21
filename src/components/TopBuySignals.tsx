'use client';

// ============================================================
// Top Buy Signals – displays the top 10 buy-signal coins
// for short-term (1-2 hour) day trading with entry/exit targets
// ============================================================

import { useState, useEffect, useCallback } from 'react';
import { BuySignalResult, MarketAnalysisResponse } from '@/lib/types';
import { formatPrice, formatVolume } from '@/lib/utils';

const isStaticExport = process.env.NEXT_PUBLIC_STATIC_EXPORT === 'true';
const REFRESH_INTERVAL = 30_000; // 30 seconds

type SortKey = 'rank' | 'confidence' | 'profit' | 'volume' | 'rsi';

export default function TopBuySignals() {
  const [signals, setSignals] = useState<BuySignalResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('rank');
  const [totalAnalyzed, setTotalAnalyzed] = useState(0);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(0);

  const fetchSignals = useCallback(async () => {
    try {
      setError(null);
      if (isStaticExport) {
        // Static export: call Binance directly
        const { getTopUSDTPairs, fetchKlines } = await import('@/lib/binance');
        const { analyzeCoin } = await import('@/lib/analyzer');
        const { calculateShortTermRisk } = await import('@/lib/risk');

        const tickers = await getTopUSDTPairs(100);
        const results: BuySignalResult[] = [];

        for (const ticker of tickers.slice(0, 30)) {
          try {
            const candles = await fetchKlines(ticker.symbol, '1h', 100);
            const coin = analyzeCoin(ticker, candles);
            if (
              coin.score >= 65 &&
              coin.priceChangePercent >= 0.5 &&
              coin.tradeSignal.confidence >= 70 &&
              coin.tradeSignal.probability >= 0.6 &&
              coin.tradeSignal.market_regime === 'TRENDING'
            ) {
              const risk = calculateShortTermRisk(coin.price, candles);
              const keySignals: string[] = [];
              if (coin.indicators.rsi.signal === 'oversold') keySignals.push('RSI Oversold ✓');
              if (coin.indicators.macd.crossover === 'bullish') keySignals.push('MACD Bullish ✓');
              if (coin.indicators.volume.spike) keySignals.push('Vol Spike ✓');
              if (coin.indicators.ma.goldenCross) keySignals.push('EMA Golden Cross ✓');
              const riskRewardRatio = risk.riskRewardRatio;
              if (riskRewardRatio < 1.5) continue;
              results.push({
                rank: 0,
                symbol: coin.symbol,
                prediction: coin.tradeSignal.prediction,
                probability: coin.tradeSignal.probability,
                confidence: coin.tradeSignal.confidence,
                market_regime: coin.tradeSignal.market_regime,
                key_factors: coin.tradeSignal.key_factors,
                risk_flags: coin.tradeSignal.risk_flags,
                currentPrice: coin.price,
                entryZoneLow: coin.tradeSignal.entryZoneLow,
                entryZoneHigh: coin.tradeSignal.entryZoneHigh,
                stopLoss: risk.stopLoss,
                takeProfit1: risk.takeProfit1,
                takeProfit2: risk.takeProfit2,
                takeProfit3: risk.takeProfit3,
                confidenceScore: coin.tradeSignal.confidence,
                keySignals,
                profitPotential: risk.takeProfit3Percent,
                timeFrame: coin.score >= 80 ? '1H' : '1-2H',
                priceChangePercent: coin.priceChangePercent,
                volume24h: coin.volume24h,
                volumeRatio: coin.indicators.volume.volumeRatio,
                rsiValue: coin.indicators.rsi.value,
                macdHistogram: coin.indicators.macd.histogram,
                bollingerPercentB: coin.indicators.bollinger.percentB,
                riskRewardRatio: risk.riskRewardRatio,
              });
            }
          } catch { /* skip failed coins */ }
        }

        results.sort((a, b) => b.confidenceScore - a.confidenceScore);
        results.forEach((r, i) => (r.rank = i + 1));
        setSignals(results.slice(0, 10));
        setTotalAnalyzed(30);
        setTotalCandidates(results.length);
        setLastUpdated(Date.now());
      } else {
        const res = await fetch('/api/market-analysis/top-500');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: MarketAnalysisResponse = await res.json();
        setSignals(data.topBuySignals);
        setTotalAnalyzed(data.totalAnalyzed);
        setTotalCandidates(data.totalCandidates);
        setLastUpdated(data.timestamp);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch signals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSignals();
    const interval = setInterval(fetchSignals, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchSignals]);

  const sorted = [...signals].sort((a, b) => {
    switch (sortKey) {
      case 'confidence': return b.confidenceScore - a.confidenceScore;
      case 'profit': return b.profitPotential - a.profitPotential;
      case 'volume': return b.volume24h - a.volume24h;
      case 'rsi': return a.rsiValue - b.rsiValue; // lower RSI first (more oversold)
      case 'rank':
      default: return a.rank - b.rank;
    }
  });

  const SORTS: { key: SortKey; label: string }[] = [
    { key: 'rank', label: 'Rank' },
    { key: 'confidence', label: 'Confidence' },
    { key: 'profit', label: 'Profit %' },
    { key: 'volume', label: 'Volume' },
    { key: 'rsi', label: 'RSI' },
  ];

  // ── Loading skeleton ─────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 bg-gray-800/60 rounded animate-pulse" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-gray-800/40 rounded-xl p-4 animate-pulse space-y-3">
            <div className="h-5 w-40 bg-gray-700/50 rounded" />
            <div className="h-4 w-full bg-gray-700/30 rounded" />
            <div className="h-4 w-3/4 bg-gray-700/30 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            🏆 TOP {sorted.length} BUY SIGNALS
            <span className="text-xs font-normal text-gray-400">
              Profit Potential (1-2 Hour Trading)
            </span>
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {totalAnalyzed} coins analyzed · {totalCandidates} candidates filtered
            {lastUpdated > 0 && (
              <span> · Updated {new Date(lastUpdated).toLocaleTimeString()}</span>
            )}
          </p>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-gray-400">Sort:</span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={`px-2 py-1 rounded transition-colors ${
                sortKey === s.key
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-400'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
          ⚠ {error}
        </div>
      )}

      {/* No signals */}
      {!error && sorted.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-4xl mb-3">📊</p>
          <p className="text-sm">No strong buy signals found at the moment.</p>
          <p className="text-xs mt-1 text-gray-600">
            Market conditions may not favor short-term trades right now. Check back soon.
          </p>
        </div>
      )}

      {/* Signal cards */}
      <div className="space-y-3">
        {sorted.map((sig) => (
          <SignalCard key={sig.symbol} signal={sig} />
        ))}
      </div>

      {/* Refresh button */}
      <div className="flex justify-center pt-2">
        <button
          onClick={fetchSignals}
          className="text-xs px-4 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 transition-colors"
        >
          🔄 Refresh Signals
        </button>
      </div>
    </div>
  );
}

// ── Metric color helpers ────────────────────────────────
function rsiColor(value: number): string {
  if (value < 30) return 'text-green-400';
  if (value > 70) return 'text-red-400';
  return 'text-gray-300';
}

function positiveColor(value: number): string {
  return value > 0 ? 'text-green-400' : 'text-red-400';
}

function thresholdColor(value: number, threshold: number): string {
  return value > threshold ? 'text-green-400' : 'text-gray-300';
}

// ── Individual signal card ──────────────────────────────
function SignalCard({ signal: sig }: { signal: BuySignalResult }) {
  const sym = sig.symbol.replace('USDT', '');
  const confColor =
    sig.confidenceScore >= 80
      ? 'text-green-400'
      : sig.confidenceScore >= 70
        ? 'text-emerald-400'
        : 'text-yellow-400';
  const confBg =
    sig.confidenceScore >= 80
      ? 'bg-green-500/10 border-green-500/30'
      : sig.confidenceScore >= 70
        ? 'bg-emerald-500/10 border-emerald-500/30'
        : 'bg-yellow-500/10 border-yellow-500/30';

  return (
    <div
      className={`rounded-xl border p-4 transition-all hover:border-green-500/40 ${confBg}`}
    >
      {/* Row 1: Symbol, price, confidence */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 font-mono w-5">{sig.rank}.</span>
          <span className="text-lg font-bold text-white">✅ {sym}/USDT</span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              sig.priceChangePercent >= 5
                ? 'bg-green-500/20 text-green-300'
                : sig.priceChangePercent >= 2
                  ? 'bg-green-500/10 text-green-400'
                  : 'bg-gray-700 text-gray-300'
            }`}
          >
            +{sig.priceChangePercent.toFixed(2)}%
          </span>
          <span className="text-[10px] text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {sig.timeFrame}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className={`text-right ${confColor}`}>
            <div className="text-xl font-bold">{sig.confidenceScore}</div>
            <div className="text-[10px] text-gray-500">/100</div>
          </div>
          <div className="text-right">
            <div className="text-sm font-semibold text-green-400">
              +{sig.profitPotential}%
            </div>
            <div className="text-[10px] text-gray-500">potential</div>
          </div>
        </div>
      </div>

      {/* Row 2: Price details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
        <div>
          <span className="text-gray-500">💰 Current</span>
          <div className="font-mono text-gray-200 mt-0.5">{formatPrice(sig.currentPrice)}</div>
        </div>
        <div>
          <span className="text-gray-500">📍 Entry</span>
          <div className="font-mono text-gray-200 mt-0.5">
            {formatPrice(sig.entryZoneLow)} – {formatPrice(sig.entryZoneHigh)}
          </div>
        </div>
        <div>
          <span className="text-gray-500">🛑 Stop Loss</span>
          <div className="font-mono text-red-400 mt-0.5">{formatPrice(sig.stopLoss)}</div>
        </div>
        <div>
          <span className="text-gray-500">📊 R:R</span>
          <div className="font-mono text-gray-200 mt-0.5">1:{sig.riskRewardRatio}</div>
        </div>
      </div>

      {/* Row 3: Take-profit targets */}
      <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
        <div className="bg-green-500/5 rounded-lg px-2 py-1.5">
          <span className="text-gray-500">🎯 TP1 (1R)</span>
          <div className="font-mono text-green-400 mt-0.5">{formatPrice(sig.takeProfit1)}</div>
        </div>
        <div className="bg-green-500/5 rounded-lg px-2 py-1.5">
          <span className="text-gray-500">🎯 TP2 (2R)</span>
          <div className="font-mono text-green-400 mt-0.5">{formatPrice(sig.takeProfit2)}</div>
        </div>
        <div className="bg-green-500/5 rounded-lg px-2 py-1.5">
          <span className="text-gray-500">🎯 TP3 (3R)</span>
          <div className="font-mono text-green-400 mt-0.5">{formatPrice(sig.takeProfit3)}</div>
        </div>
      </div>

      {/* Row 4: Key signals + metrics */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] text-gray-500">📈 Signals:</span>
        {sig.keySignals.map((s) => (
          <span
            key={s}
            className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-green-400 border border-green-500/20"
          >
            {s}
          </span>
        ))}
      </div>

      {/* Row 5: Detailed metrics */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-gray-500">
        <span>RSI: <span className={rsiColor(sig.rsiValue)}>{sig.rsiValue}</span></span>
        <span>MACD Hist: <span className={positiveColor(sig.macdHistogram)}>{sig.macdHistogram.toFixed(6)}</span></span>
        <span>BB%: <span className="text-gray-300">{(sig.bollingerPercentB * 100).toFixed(0)}%</span></span>
        <span>Vol Ratio: <span className={thresholdColor(sig.volumeRatio, 1.5)}>{sig.volumeRatio}x</span></span>
        <span>Vol: <span className="text-gray-300">{formatVolume(sig.volume24h)}</span></span>
      </div>
    </div>
  );
}
