'use client';

// ============================================================
// Mini price chart using Recharts with multi-timeframe overlays
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, YAxis, ReferenceLine } from 'recharts';
import { calculateRSI, calculateMACD, calculateBollinger } from '@/lib/indicators';
import { Candle } from '@/lib/types';
import { buildTimeframeCandidates, mergeLevels, Level } from '@/lib/chartLevels';

interface PricePoint {
  time: number;
  price: number;
}

const CHART_INTERVALS = ['15m', '1h', '4h'] as const;
type ChartInterval = (typeof CHART_INTERVALS)[number];
const LEVEL_TIMEFRAMES = ['1m', '15m', '1h', '4h', '1d'] as const;
const INTERVAL_LIMITS: Record<ChartInterval, number> = {
  '15m': 48,
  '1h': 48,
  '4h': 48,
};

export default function PriceChart({ symbol }: { symbol: string }) {
  const [data, setData] = useState<PricePoint[]>([]);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [interval, setInterval] = useState<ChartInterval>('1h');
  const [levels, setLevels] = useState<{ supports: Level[]; resistances: Level[] } | null>(null);
  const [showRSI, setShowRSI] = useState(true);
  const [showMACD, setShowMACD] = useState(true);
  const [showBollinger, setShowBollinger] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchChart() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${INTERVAL_LIMITS[interval]}`
        );
        if (!res.ok) return;
        const json = (await res.json()) as { candles: Candle[] };
        if (cancelled) return;
        setCandles(json.candles ?? []);
        setData(
          (json.candles ?? []).map((c) => ({
            time: c.closeTime,
            price: c.close,
          }))
        );
      } catch {
        // silently fail for chart
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchChart();
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  useEffect(() => {
    let cancelled = false;
    const loadLevels = async () => {
      try {
        const responses = await Promise.all(
          LEVEL_TIMEFRAMES.map(async (tf) => {
            const res = await fetch(
              `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${tf}&limit=120`
            );
            if (!res.ok) return null;
            const data = (await res.json()) as { candles?: Candle[] };
            if (!data.candles?.length) return null;
            const currentPrice = data.candles[data.candles.length - 1].close;
            return { timeframe: tf, ...buildTimeframeCandidates(data.candles, currentPrice), currentPrice };
          })
        );
        const valid = responses.filter((v): v is NonNullable<typeof v> => Boolean(v));
        if (!valid.length || cancelled) return;
        const currentPrice = valid[0].currentPrice;
        setLevels({
          supports: mergeLevels(valid.map((v) => ({ price: v.support, timeframe: v.timeframe })), currentPrice, 'support'),
          resistances: mergeLevels(valid.map((v) => ({ price: v.resistance, timeframe: v.timeframe })), currentPrice, 'resistance'),
        });
      } catch {
        if (!cancelled) setLevels(null);
      }
    };
    loadLevels();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const indicatorSummary = useMemo(() => {
    if (!candles.length) return null;
    return {
      rsi: calculateRSI(candles),
      macd: calculateMACD(candles),
      bollinger: calculateBollinger(candles),
    };
  }, [candles]);

  if (loading) {
    return <div className="h-24 w-full bg-gray-800/50 animate-pulse rounded" />;
  }

  if (data.length === 0) return null;

  const isPositive = data[data.length - 1].price >= data[0].price;
  const color = isPositive ? '#22c55e' : '#ef4444';

  return (
    <div className="h-24 w-full space-y-1">
      <div className="flex flex-wrap items-center gap-1 text-[10px]">
        {CHART_INTERVALS.map((tf) => (
          <button
            key={tf}
            onClick={() => setInterval(tf)}
            className={`px-1.5 py-0.5 rounded ${interval === tf ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-400'}`}
          >
            {tf}
          </button>
        ))}
        <button onClick={() => setShowRSI((v) => !v)} className={`px-1.5 py-0.5 rounded ${showRSI ? 'bg-cyan-600/40 text-cyan-300' : 'bg-gray-700 text-gray-500'}`}>RSI</button>
        <button onClick={() => setShowMACD((v) => !v)} className={`px-1.5 py-0.5 rounded ${showMACD ? 'bg-cyan-600/40 text-cyan-300' : 'bg-gray-700 text-gray-500'}`}>MACD</button>
        <button onClick={() => setShowBollinger((v) => !v)} className={`px-1.5 py-0.5 rounded ${showBollinger ? 'bg-cyan-600/40 text-cyan-300' : 'bg-gray-700 text-gray-500'}`}>Boll</button>
      </div>

      <ResponsiveContainer width="100%" height="70%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id={`gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          {levels?.supports.map((s, idx) => (
            <ReferenceLine key={`s-${idx}`} y={s.price} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.6} />
          ))}
          {levels?.resistances.map((r, idx) => (
            <ReferenceLine key={`r-${idx}`} y={r.price} stroke="#ef4444" strokeDasharray="4 4" strokeOpacity={0.6} />
          ))}
          {showBollinger && indicatorSummary && (
            <>
              <ReferenceLine y={indicatorSummary.bollinger.upper} stroke="#a78bfa" strokeDasharray="2 2" strokeOpacity={0.7} />
              <ReferenceLine y={indicatorSummary.bollinger.lower} stroke="#a78bfa" strokeDasharray="2 2" strokeOpacity={0.7} />
            </>
          )}
          <Area type="monotone" dataKey="price" stroke={color} fill={`url(#gradient-${symbol})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>

      {indicatorSummary && (
        <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
          {showRSI && <span>RSI {indicatorSummary.rsi.value}</span>}
          {showMACD && <span>MACD {indicatorSummary.macd.histogram}</span>}
          {showBollinger && <span>%B {indicatorSummary.bollinger.percentB}</span>}
        </div>
      )}
    </div>
  );
}
