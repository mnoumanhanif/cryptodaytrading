'use client';

// ============================================================
// Professional candlestick (OHLC) chart rendered with SVG
// Supports chart-type toggle, timeframe controls, and overlays
// ============================================================

import { useState, useEffect, useRef, useMemo } from 'react';
import { Candle } from '@/lib/types';
import { formatPriceRaw } from '@/lib/utils';
import { calculateRSI, calculateMACD, calculateBollinger, calculateMA, calculateVolume } from '@/lib/indicators';
import { calculateIchimoku } from '@/lib/indicators/ichimoku';
import { calculateStochasticRSI } from '@/lib/indicators/stochasticRSI';
import { calculateADX } from '@/lib/indicators/adx';
import { calculateFibonacci } from '@/lib/indicators/fibonacci';
import { buildTimeframeCandidates, mergeLevels, Level } from '@/lib/chartLevels';

interface Props {
  symbol: string;
}

const TIMEFRAMES = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
type TF = (typeof TIMEFRAMES)[number];
type ChartType = 'candles' | 'area';
type Zoom = 'full' | 'half';

type OverlayKey =
  | 'levels'
  | 'ma'
  | 'bollinger'
  | 'volume'
  | 'ichimoku'
  | 'stochRSI'
  | 'adx'
  | 'fibonacci'
  | 'rsi'
  | 'macd';

const OVERLAY_OPTIONS: { key: OverlayKey; label: string }[] = [
  { key: 'levels', label: 'S/R' },
  { key: 'ma', label: 'MA' },
  { key: 'bollinger', label: 'Bollinger' },
  { key: 'volume', label: 'Volume' },
  { key: 'ichimoku', label: 'Ichimoku' },
  { key: 'stochRSI', label: 'StochRSI' },
  { key: 'adx', label: 'ADX' },
  { key: 'fibonacci', label: 'Fibonacci' },
  { key: 'rsi', label: 'RSI' },
  { key: 'macd', label: 'MACD' },
];

const TIMEFRAME_LIMITS: Record<TF, number> = {
  '1m': 60,
  '5m': 240,
  '15m': 96,
  '1h': 100,
  '4h': 100,
  '1d': 60,
};

const LEVEL_TIMEFRAMES: TF[] = ['1m', '15m', '1h', '4h', '1d'];
const MIN_ZOOM_CANDLES = 30;

const SESSION_KEY = 'candlestick_timeframe';
const MARGIN = { top: 10, right: 8, bottom: 40, left: 72 };
const VOL_HEIGHT_RATIO = 0.18;

function formatTime(ts: number, tf: TF): string {
  const d = new Date(ts);
  if (tf === '1d') return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  if (tf === '1h' || tf === '4h') {
    return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`;
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false });
}

export default function CandlestickChart({ symbol }: Props) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<ChartType>('candles');
  const [zoom, setZoom] = useState<Zoom>('full');
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    levels: true,
    ma: true,
    bollinger: true,
    volume: true,
    ichimoku: false,
    stochRSI: false,
    adx: false,
    fibonacci: true,
    rsi: true,
    macd: true,
  });
  const [levels, setLevels] = useState<{ supports: Level[]; resistances: Level[] } | null>(null);
  const [timeframe, setTimeframe] = useState<TF>(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(SESSION_KEY);
      if (saved && TIMEFRAMES.includes(saved as TF)) return saved as TF;
    }
    return '1h';
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 600, height: 320 });

  const handleTimeframeChange = (tf: TF) => {
    try {
      sessionStorage.setItem(SESSION_KEY, tf);
    } catch {
      // sessionStorage may be unavailable
    }
    setTimeframe(tf);
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect;
      setDims({ width: Math.max(width, 300), height: Math.max(width * 0.5, 240) });
    });
    obs.observe(el);
    setDims({ width: el.clientWidth || 600, height: Math.max((el.clientWidth || 600) * 0.5, 240) });
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const limit = TIMEFRAME_LIMITS[timeframe];
    fetch(`/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}&limit=${limit}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled && j) setCandles(j.candles ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, timeframe]);

  useEffect(() => {
    let cancelled = false;
    const loadLevels = async () => {
      try {
        const responses = await Promise.all(
          LEVEL_TIMEFRAMES.map(async (interval) => {
            const res = await fetch(
              `/api/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=120`
            );
            if (!res.ok) return null;
            const data = (await res.json()) as { candles?: Candle[] };
            if (!data.candles?.length) return null;
            const currentPrice = data.candles[data.candles.length - 1].close;
            const candidate = buildTimeframeCandidates(data.candles, currentPrice);
            return { timeframe: interval, ...candidate, currentPrice };
          })
        );

        const valid = responses.filter((r): r is NonNullable<typeof r> => Boolean(r));
        if (!valid.length || cancelled) return;
        const currentPrice =
          valid.find((v) => v.timeframe === '1m')?.currentPrice ??
          valid.find((v) => v.timeframe === '15m')?.currentPrice ??
          valid[0].currentPrice;
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
  }, [symbol, timeframe]);

  const visibleCandles = useMemo(
    () => (zoom === 'half' ? candles.slice(-Math.max(MIN_ZOOM_CANDLES, Math.floor(candles.length / 2))) : candles),
    [candles, zoom]
  );
  const n = visibleCandles.length;

  const indicatorSnapshot = useMemo(() => {
    if (!visibleCandles.length) return null;
    return {
      rsi: calculateRSI(visibleCandles),
      macd: calculateMACD(visibleCandles),
      bollinger: calculateBollinger(visibleCandles),
      volume: calculateVolume(visibleCandles),
      ma: calculateMA(visibleCandles),
      ichimoku: calculateIchimoku(visibleCandles),
      stochRSI: calculateStochasticRSI(visibleCandles),
      adx: calculateADX(visibleCandles),
      fibonacci: calculateFibonacci(visibleCandles),
    };
  }, [visibleCandles]);

  if (loading) {
    return (
      <div className="h-64 w-full bg-gray-800/50 animate-pulse rounded-lg flex items-center justify-center text-gray-600 text-sm">
        Loading chart…
      </div>
    );
  }

  if (!visibleCandles.length) {
    return (
      <div className="h-64 w-full rounded-lg bg-gray-800/50 flex items-center justify-center text-gray-600 text-sm">
        No data
      </div>
    );
  }

  const { width, height } = dims;
  const chartW = width - MARGIN.left - MARGIN.right;
  const chartH = height - MARGIN.top - MARGIN.bottom;
  const showVolume = overlays.volume;
  const volH = showVolume ? chartH * VOL_HEIGHT_RATIO : 0;
  const priceH = chartH - volH - (showVolume ? 4 : 0);

  const candleW = Math.max(1, chartW / n);
  const bodyW = Math.max(1, candleW * 0.6);
  const halfBody = bodyW / 2;

  const highs = visibleCandles.map((c) => c.high);
  const lows = visibleCandles.map((c) => c.low);
  const priceMin = Math.min(...lows) * 0.998;
  const priceMax = Math.max(...highs) * 1.002;
  const priceRange = priceMax - priceMin || 1;

  const vols = visibleCandles.map((c) => c.volume);
  const volMax = Math.max(...vols) || 1;

  const py = (price: number) => MARGIN.top + priceH - ((price - priceMin) / priceRange) * priceH;
  const cx = (i: number) => MARGIN.left + (i + 0.5) * candleW;

  const GRID_LINES = 5;
  const gridPrices = Array.from({ length: GRID_LINES }, (_, i) => priceMin + (priceRange / (GRID_LINES - 1)) * i);
  const timeStep = Math.max(1, Math.floor(n / 6));
  const timeLabels = visibleCandles.map((c, i) => ({ i, ts: c.closeTime })).filter(({ i }) => i % timeStep === 0);
  const areaPath = visibleCandles.map((c, i) => `${i === 0 ? 'M' : 'L'} ${cx(i)} ${py(c.close)}`).join(' ');

  return (
    <div ref={containerRef} className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-1">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            onClick={() => handleTimeframeChange(tf)}
            className={`px-2 py-0.5 text-xs rounded font-medium transition-colors ${
              tf === timeframe
                ? 'bg-blue-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
            }`}
          >
            {tf.toUpperCase()}
          </button>
        ))}
        <button
          onClick={() => setChartType((prev) => (prev === 'candles' ? 'area' : 'candles'))}
          className="px-2 py-0.5 text-xs rounded font-medium bg-indigo-600/80 text-white hover:bg-indigo-500"
        >
          {chartType === 'candles' ? 'Candles' : 'Area'}
        </button>
        <button
          onClick={() => setZoom((prev) => (prev === 'full' ? 'half' : 'full'))}
          className="px-2 py-0.5 text-xs rounded font-medium bg-gray-700 text-gray-300 hover:bg-gray-600"
        >
          Zoom {zoom === 'full' ? '1x' : '2x'}
        </button>
        <span className="ml-auto text-xs text-gray-500">{n} candles</span>
      </div>

      <div className="flex flex-wrap gap-1">
        {OVERLAY_OPTIONS.map((option) => (
          <button
            key={option.key}
            onClick={() => setOverlays((prev) => ({ ...prev, [option.key]: !prev[option.key] }))}
            className={`px-2 py-0.5 text-[11px] rounded border ${
              overlays[option.key]
                ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                : 'border-gray-700 bg-gray-800/40 text-gray-500'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <svg width={width} height={height} className="overflow-visible" aria-label={`Candlestick chart for ${symbol}`}>
        <defs>
          <linearGradient id={`area-gradient-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.45} />
            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
          </linearGradient>
        </defs>

        {gridPrices.map((p, i) => {
          const y = py(p);
          return (
            <g key={i}>
              <line x1={MARGIN.left} y1={y} x2={MARGIN.left + chartW} y2={y} stroke="#374151" strokeWidth={0.5} strokeDasharray="4 4" />
              <text x={MARGIN.left - 4} y={y + 4} textAnchor="end" fontSize={9} fill="#9CA3AF">
                {formatPriceRaw(p)}
              </text>
            </g>
          );
        })}

        {chartType === 'area' ? (
          <>
            <path d={`${areaPath} L ${cx(n - 1)} ${MARGIN.top + priceH} L ${cx(0)} ${MARGIN.top + priceH} Z`} fill={`url(#area-gradient-${symbol})`} opacity={0.8} />
            <path d={areaPath} fill="none" stroke="#38bdf8" strokeWidth={1.5} />
          </>
        ) : (
          visibleCandles.map((c, i) => {
            const isGreen = c.close >= c.open;
            const color = isGreen ? '#22c55e' : '#ef4444';
            const bodyTop = py(Math.max(c.open, c.close));
            const bodyBot = py(Math.min(c.open, c.close));
            const bodyHeight = Math.max(1, bodyBot - bodyTop);
            const wickTop = py(c.high);
            const wickBot = py(c.low);
            const xc = cx(i);

            return (
              <g key={c.openTime}>
                <line x1={xc} y1={wickTop} x2={xc} y2={wickBot} stroke={color} strokeWidth={Math.max(0.5, candleW * 0.08)} />
                <rect x={xc - halfBody} y={bodyTop} width={bodyW} height={bodyHeight} fill={color} stroke={color} strokeWidth={0.5} opacity={isGreen ? 0.9 : 0.8} />
              </g>
            );
          })
        )}

        {overlays.ma && indicatorSnapshot && (
          <>
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.ma.ema9)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.ma.ema9)} stroke="#60a5fa" strokeWidth={1} strokeDasharray="2 2" />
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.ma.ema21)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.ma.ema21)} stroke="#f59e0b" strokeWidth={1} strokeDasharray="2 2" />
          </>
        )}

        {overlays.bollinger && indicatorSnapshot && (
          <>
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.bollinger.upper)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.bollinger.upper)} stroke="#a78bfa" strokeWidth={0.8} strokeDasharray="3 3" />
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.bollinger.lower)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.bollinger.lower)} stroke="#a78bfa" strokeWidth={0.8} strokeDasharray="3 3" />
          </>
        )}

        {overlays.ichimoku && indicatorSnapshot && (
          <>
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.ichimoku.senkouA)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.ichimoku.senkouA)} stroke="#10b981" strokeWidth={0.9} />
            <line x1={MARGIN.left} y1={py(indicatorSnapshot.ichimoku.senkouB)} x2={MARGIN.left + chartW} y2={py(indicatorSnapshot.ichimoku.senkouB)} stroke="#ef4444" strokeWidth={0.9} />
          </>
        )}

        {overlays.fibonacci && indicatorSnapshot && (
          <>
            {[indicatorSnapshot.fibonacci.levels.r236, indicatorSnapshot.fibonacci.levels.r382, indicatorSnapshot.fibonacci.levels.r500, indicatorSnapshot.fibonacci.levels.r618].map((fib) => (
              <line key={fib} x1={MARGIN.left} y1={py(fib)} x2={MARGIN.left + chartW} y2={py(fib)} stroke="#eab308" strokeWidth={0.6} strokeDasharray="2 2" />
            ))}
          </>
        )}

        {overlays.levels &&
          levels?.supports.map((s, idx) => (
            <line key={`sup-${idx}`} x1={MARGIN.left} y1={py(s.price)} x2={MARGIN.left + chartW} y2={py(s.price)} stroke="#22c55e" strokeWidth={1} strokeDasharray="6 3" opacity={0.75} />
          ))}
        {overlays.levels &&
          levels?.resistances.map((r, idx) => (
            <line key={`res-${idx}`} x1={MARGIN.left} y1={py(r.price)} x2={MARGIN.left + chartW} y2={py(r.price)} stroke="#ef4444" strokeWidth={1} strokeDasharray="6 3" opacity={0.75} />
          ))}

        {showVolume &&
          visibleCandles.map((c, i) => {
            const isGreen = c.close >= c.open;
            const barH = (c.volume / volMax) * volH;
            const barY = MARGIN.top + priceH + 4 + (volH - barH);
            return (
              <rect
                key={`vol-${c.openTime}`}
                x={cx(i) - halfBody}
                y={barY}
                width={bodyW}
                height={Math.max(1, barH)}
                fill={isGreen ? '#22c55e' : '#ef4444'}
                opacity={0.35}
              />
            );
          })}

        {timeLabels.map(({ i, ts }) => (
          <text key={ts} x={cx(i)} y={height - 4} textAnchor="middle" fontSize={9} fill="#6B7280">
            {formatTime(ts, timeframe)}
          </text>
        ))}

        <line x1={MARGIN.left} y1={MARGIN.top} x2={MARGIN.left} y2={MARGIN.top + priceH + volH + (showVolume ? 4 : 0)} stroke="#4B5563" strokeWidth={1} />
        {showVolume && (
          <>
            <line x1={MARGIN.left} y1={MARGIN.top + priceH + 4} x2={MARGIN.left + chartW} y2={MARGIN.top + priceH + 4} stroke="#374151" strokeWidth={0.5} />
            <text x={MARGIN.left + 2} y={MARGIN.top + priceH + 13} fontSize={8} fill="#6B7280">
              VOL
            </text>
          </>
        )}
      </svg>

      {indicatorSnapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-gray-400">
          {overlays.rsi && <div>RSI <span className="text-white">{indicatorSnapshot.rsi.value}</span></div>}
          {overlays.macd && <div>MACD Hist <span className="text-white">{indicatorSnapshot.macd.histogram}</span></div>}
          {overlays.stochRSI && <div>StochRSI K <span className="text-white">{indicatorSnapshot.stochRSI.k}</span></div>}
          {overlays.adx && <div>ADX <span className="text-white">{indicatorSnapshot.adx.adx}</span></div>}
          {overlays.fibonacci && (
            <div className="col-span-2 sm:col-span-4 text-yellow-400/80">
              Fib S/R: ${formatPriceRaw(indicatorSnapshot.fibonacci.nearestSupport)} / ${formatPriceRaw(indicatorSnapshot.fibonacci.nearestResistance)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
