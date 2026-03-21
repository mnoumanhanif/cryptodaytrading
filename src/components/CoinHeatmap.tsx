'use client';

// ============================================================
// Coin Heatmap – visual grid of top 100 coins colored by 24h % change
// ============================================================

import { useState } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { formatPrice, formatVolume } from '@/lib/utils';
import CoinCard from './CoinCard';

interface CoinHeatmapProps {
  coins: CoinAnalysis[];
  loading: boolean;
  onAddToWatchlist: (coin: CoinAnalysis) => void;
  isWatching: (symbol: string) => boolean;
}

/** Returns a CSS rgb() color based on the 24h price change percentage */
function getHeatmapColor(changePercent: number): string {
  const intensity = Math.min(Math.abs(changePercent), 10) / 10; // 0 → 1
  if (changePercent > 0) {
    // neutral gray → vivid green
    const g = Math.round(70 + intensity * 115); // 70 → 185
    const r = Math.round(20 - intensity * 10);  // 20 → 10
    const b = Math.round(30 - intensity * 15);  // 30 → 15
    return `rgb(${r}, ${g}, ${b})`;
  }
  if (changePercent < 0) {
    // neutral gray → vivid red
    const r = Math.round(70 + intensity * 115);
    const g = Math.round(20 - intensity * 10);
    const b = Math.round(30 - intensity * 15);
    return `rgb(${r}, ${g}, ${b})`;
  }
  return 'rgb(45, 50, 62)'; // neutral gray
}

function formatSymbol(symbol: string): string {
  return symbol.replace('USDT', '');
}

export default function CoinHeatmap({
  coins,
  loading,
  onAddToWatchlist,
  isWatching,
}: CoinHeatmapProps) {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<CoinAnalysis | null>(null);

  const top100 = coins.slice(0, 100);

  if (loading && !coins.length) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-48 bg-gray-800/60 rounded animate-pulse" />
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-1.5">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md bg-gray-800/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!top100.length) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-sm">No coin data available yet.</p>
        <p className="text-xs mt-1 text-gray-600">Data loads automatically every 30 seconds.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Legend row */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 text-xs text-gray-400">
        <span>
          Top {top100.length} coins · Box color = 24h % change
          {loading && (
            <span className="ml-2 inline-flex items-center gap-1 text-blue-400">
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refreshing…
            </span>
          )}
        </span>
        <div className="flex items-center gap-3">
          {[
            { label: '−10%+', change: -10 },
            { label: '−5%', change: -5 },
            { label: '0%', change: 0 },
            { label: '+5%', change: 5 },
            { label: '+10%+', change: 10 },
          ].map(({ label, change }) => (
            <span key={label} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: getHeatmapColor(change) }}
              />
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Heatmap grid */}
      <div className="heatmap-grid grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-1.5">
        {top100.map((coin) => {
          const sym = formatSymbol(coin.symbol);
          const isHovered = hoveredSymbol === coin.symbol;
          const isSelected = selectedCoin?.symbol === coin.symbol;
          const bg = getHeatmapColor(coin.priceChangePercent);

          return (
            <div
              key={coin.symbol}
              className={`heatmap-cell relative aspect-square rounded-md cursor-pointer select-none
                transition-transform duration-150 hover:scale-105 hover:z-10
                ${isSelected ? 'ring-2 ring-white/60' : ''}`}
              style={{ backgroundColor: bg }}
              onMouseEnter={() => setHoveredSymbol(coin.symbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
              onClick={() =>
                setSelectedCoin(isSelected ? null : coin)
              }
            >
              <div className="absolute inset-0 flex flex-col items-center justify-center p-0.5">
                <span className="text-white font-bold text-[10px] sm:text-xs leading-tight truncate w-full text-center">
                  {sym.length > 6 ? sym.slice(0, 5) + '…' : sym}
                </span>
                <span
                  className={`text-[9px] sm:text-[11px] font-semibold leading-tight ${
                    coin.priceChangePercent >= 0 ? 'text-green-100' : 'text-red-100'
                  }`}
                >
                  {coin.priceChangePercent >= 0 ? '+' : ''}
                  {coin.priceChangePercent.toFixed(1)}%
                </span>
              </div>

              {/* Tooltip */}
              {isHovered && (
                <div
                  className="heatmap-tooltip absolute bottom-full left-1/2 mb-1.5 z-30 pointer-events-none
                             bg-gray-900/95 border border-gray-600 rounded-lg p-2.5 shadow-2xl
                             text-xs whitespace-nowrap"
                  style={{ transform: 'translateX(-50%)' }}
                >
                  <div className="font-bold text-white mb-1">{coin.symbol}</div>
                  <div className="text-gray-200">{formatPrice(coin.price)}</div>
                  <div
                    className={
                      coin.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                    }
                  >
                    {coin.priceChangePercent >= 0 ? '▲' : '▼'}{' '}
                    {Math.abs(coin.priceChangePercent).toFixed(2)}%
                  </div>
                  <div className="text-gray-400 mt-0.5">Vol: {formatVolume(coin.volume24h)}</div>
                  <div className="text-gray-400 border-t border-gray-700 mt-1 pt-1">
                    Signal:{' '}
                    <span
                      className={
                        coin.signal === 'BUY'
                          ? 'text-green-400'
                          : coin.signal === 'SELL'
                          ? 'text-red-400'
                          : 'text-yellow-400'
                      }
                    >
                      {coin.signal}
                    </span>{' '}
                    · Score: {Math.round(coin.score)}
                  </div>
                  <div className="text-gray-500 text-[10px] mt-0.5">Click to expand</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expanded coin detail */}
      {selectedCoin && (
        <div className="mt-5 border border-gray-700 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-800/60 border-b border-gray-700">
            <span className="text-sm font-semibold text-gray-200">
              {formatSymbol(selectedCoin.symbol)} — Full Analysis
            </span>
            <button
              onClick={() => setSelectedCoin(null)}
              className="text-xs text-gray-500 hover:text-gray-200 transition-colors p-1"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
          <div className="p-4">
            <CoinCard
              coin={selectedCoin}
              onAdd={() => onAddToWatchlist(selectedCoin)}
              isWatching={isWatching(selectedCoin.symbol)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
