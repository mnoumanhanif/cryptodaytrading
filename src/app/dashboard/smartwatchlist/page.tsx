'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';

export default function SmartWatchlistPage() {
  const { smartWatchlist } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Smart AI Watchlist
        </h2>
        <span className="text-xs text-gray-500">Suggestions based on volatility, liquidity, and news sentiment proxy</span>
      </div>
      
      <div className="rounded-lg border border-emerald-700/40 bg-emerald-900/10 px-3 py-2 text-xs text-emerald-100">
        This scoring model ranks coins using volatility, liquidity flow, and sentiment-aligned market behavior to highlight high-opportunity setups with controlled downside.
      </div>

      <div className="space-y-2">
        {smartWatchlist.map((item) => (
          <div key={item.coin.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{item.coin.symbol.replace('USDT', '')}</p>
              <span className={`text-xs font-semibold ${item.aiScore >= 70 ? 'text-green-300' : item.aiScore >= 50 ? 'text-yellow-300' : 'text-red-300'}`}>
                AI Score {item.aiScore}
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
              <p className="text-gray-300">Volatility: <span className="text-cyan-200">{item.volatilityScore}</span></p>
              <p className="text-gray-300">Liquidity: <span className="text-cyan-200">{item.liquidityScore}</span></p>
              <p className="text-gray-300">Sentiment: <span className="text-cyan-200">{item.sentimentScore}</span></p>
              <p className="text-gray-300">Signal: <span className={item.coin.signal === 'BUY' ? 'text-green-300' : item.coin.signal === 'SELL' ? 'text-red-300' : 'text-yellow-300'}>{item.coin.signal}</span></p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
