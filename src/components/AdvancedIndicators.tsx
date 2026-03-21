'use client';

// ============================================================
// Advanced Indicators display panel (Ichimoku, StochRSI, ADX, Fibonacci)
// ============================================================

import { IndicatorResults } from '@/lib/types';
import { formatPriceRaw } from '@/lib/utils';

function Badge({ text, color }: { text: string; color: 'green' | 'red' | 'yellow' | 'gray' }) {
  const classes = {
    green: 'bg-green-500/20 text-green-400 border-green-500/30',
    red: 'bg-red-500/20 text-red-400 border-red-500/30',
    yellow: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    gray: 'bg-gray-700 text-gray-400 border-gray-600',
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border ${classes[color]}`}>{text}</span>
  );
}

interface Props {
  indicators: IndicatorResults;
}

export default function AdvancedIndicators({ indicators }: Props) {
  const { ichimoku, stochRSI, adx, fibonacci } = indicators;

  return (
    <div className="space-y-3">
      {/* Ichimoku Cloud */}
      {ichimoku && (
        <div className="bg-gray-800/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Ichimoku Cloud</span>
            <Badge
              text={ichimoku.signal.toUpperCase()}
              color={ichimoku.signal === 'bullish' ? 'green' : ichimoku.signal === 'bearish' ? 'red' : 'gray'}
            />
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
            <span>Tenkan: <span className="text-white font-mono">${formatPriceRaw(ichimoku.tenkan)}</span></span>
            <span>Kijun: <span className="text-white font-mono">${formatPriceRaw(ichimoku.kijun)}</span></span>
            <span>Senkou A: <span className="text-green-400 font-mono">${formatPriceRaw(ichimoku.senkouA)}</span></span>
            <span>Senkou B: <span className="text-red-400 font-mono">${formatPriceRaw(ichimoku.senkouB)}</span></span>
            <span>Cloud: <span className={ichimoku.cloudColor === 'bullish' ? 'text-green-400' : 'text-red-400'}>{ichimoku.cloudColor}</span></span>
            <span>Score: <span className="text-white">{ichimoku.score}</span></span>
          </div>
        </div>
      )}

      {/* Stochastic RSI */}
      {stochRSI && (
        <div className="bg-gray-800/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Stochastic RSI</span>
            <Badge
              text={stochRSI.signal.toUpperCase()}
              color={stochRSI.signal === 'oversold' ? 'green' : stochRSI.signal === 'overbought' ? 'red' : 'gray'}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-gray-400 mb-2">
            <span>%K: <span className="text-white font-mono">{stochRSI.k}</span></span>
            <span>%D: <span className="text-white font-mono">{stochRSI.d}</span></span>
          </div>
          {/* K line indicator */}
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full"
              style={{ width: `${stochRSI.k}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-gray-600 mt-0.5">
            <span>0</span><span>Oversold 20</span><span>Overbought 80</span><span>100</span>
          </div>
        </div>
      )}

      {/* ADX */}
      {adx && (
        <div className="bg-gray-800/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">ADX – Trend Strength</span>
            <Badge
              text={adx.adx >= 25 ? 'STRONG' : adx.adx >= 20 ? 'MODERATE' : 'WEAK'}
              color={adx.adx >= 25 ? 'green' : adx.adx >= 20 ? 'yellow' : 'gray'}
            />
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-400 mb-2">
            <span>ADX: <span className="text-white font-mono">{adx.adx}</span></span>
            <span>+DI: <span className="text-green-400 font-mono">{adx.plusDI}</span></span>
            <span>−DI: <span className="text-red-400 font-mono">{adx.minusDI}</span></span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                adx.trend === 'strong_bull'
                  ? 'bg-green-500'
                  : adx.trend === 'strong_bear'
                  ? 'bg-red-500'
                  : 'bg-yellow-500'
              }`}
              style={{ width: `${Math.min(100, adx.adx * 2)}%` }}
            />
          </div>
        </div>
      )}

      {/* Fibonacci */}
      {fibonacci && (
        <div className="bg-gray-800/40 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Fibonacci Retracements</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
            {[
              { label: '0% (High)', val: fibonacci.levels.r0 },
              { label: '23.6%', val: fibonacci.levels.r236 },
              { label: '38.2%', val: fibonacci.levels.r382 },
              { label: '50%', val: fibonacci.levels.r500 },
              { label: '61.8% (Golden)', val: fibonacci.levels.r618 },
              { label: '78.6%', val: fibonacci.levels.r786 },
            ].map(({ label, val }) => (
              <span key={label}>
                {label}: <span className="text-white font-mono">${formatPriceRaw(val)}</span>
              </span>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-gray-700 grid grid-cols-2 gap-2 text-xs">
            <div className="text-green-400">
              Support: <span className="font-mono">${formatPriceRaw(fibonacci.nearestSupport)}</span>
            </div>
            <div className="text-red-400">
              Resistance: <span className="font-mono">${formatPriceRaw(fibonacci.nearestResistance)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
