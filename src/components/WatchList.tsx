'use client';

// ============================================================
// Watchlist – selected coins with live P&L tracking
// ============================================================

import { WatchListItem, CoinAnalysis } from '@/lib/types';
import { formatPriceRaw } from '@/lib/utils';
import ProgressTracker from './ProgressTracker';

interface WatchListProps {
  items: WatchListItem[];
  coins: CoinAnalysis[];
  onRemove: (symbol: string) => void;
}

export default function WatchList({ items, coins, onRemove }: WatchListProps) {
  if (items.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <p className="text-sm">No coins in watchlist</p>
        <p className="text-xs mt-1">Add coins from the scanner to track them</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const coinData = coins.find((c) => c.symbol === item.symbol);
        const currentPrice = coinData?.price ?? item.entryPrice;

        return (
          <div
            key={item.symbol}
            className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="font-bold text-white text-sm">
                  {item.symbol.replace('USDT', '')}
                </span>
                <span className="text-gray-500 text-xs ml-1">/ USDT</span>
              </div>
              <button
                onClick={() => onRemove(item.symbol)}
                className="text-gray-500 hover:text-red-400 transition-colors text-xs"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs mb-2">
              <div>
                <span className="text-gray-400">Entry: </span>
                <span className="text-white font-mono">${formatPriceRaw(item.entryPrice)}</span>
              </div>
              <div>
                <span className="text-gray-400">Current: </span>
                <span className="text-white font-mono">${formatPriceRaw(currentPrice)}</span>
              </div>
            </div>

            <ProgressTracker
              entryPrice={item.entryPrice}
              currentPrice={currentPrice}
              targetPrice={item.targetPrice}
              stopLoss={item.stopLoss}
            />
          </div>
        );
      })}
    </div>
  );
}
