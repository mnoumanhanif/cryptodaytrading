'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { formatVolume } from '@/lib/utils';

export default function VolumeWhalesPage() {
  const { volumeSurgeCoins, whaleActivity } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-fuchsia-500 animate-pulse" />
          Volume Surge Detection & Whale Activity
        </h2>
        <span className="text-xs text-gray-500">Sudden spikes can indicate smart money entry</span>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        
        {/* Left: Volume Surge Coins */}
        <div className="rounded-xl border border-fuchsia-700/40 bg-fuchsia-900/10 p-3">
          <h3 className="text-sm font-semibold text-fuchsia-200 mb-2">Volume Surge Detection</h3>
          <div className="space-y-2">
            {volumeSurgeCoins.length === 0 ? (
              <p className="text-xs text-gray-400">No significant surge detected right now.</p>
            ) : (
              volumeSurgeCoins.map((coin) => (
                <div key={coin.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{coin.symbol.replace('USDT', '')}</p>
                    <span className="text-[11px] text-fuchsia-300">
                      x{(coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)} ratio
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2 text-[11px] text-gray-300">
                    <p>Current: {formatVolume(coin.indicators.volume?.currentVolume ?? 0)}</p>
                    <p>Average (24h): {formatVolume(coin.indicators.volume?.averageVolume ?? 0)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Whale Transactions */}
        <div className="rounded-xl border border-violet-700/40 bg-violet-900/10 p-3">
          <h3 className="text-sm font-semibold text-violet-200 mb-2">Live Whale Activity Indicator</h3>
          <div className="space-y-2">
            {whaleActivity.length === 0 ? (
              <p className="text-xs text-gray-400">No whale transaction signals yet.</p>
            ) : (
              whaleActivity.map((whale) => (
                <div key={`${whale.symbol}-${whale.side}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{whale.symbol.replace('USDT', '')}</p>
                    <span className={`text-[11px] font-semibold ${whale.side === 'BUY' ? 'text-green-300' : 'text-red-300'}`}>
                      {whale.side}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">Estimated size: {formatVolume(whale.estimatedUsd)}</p>
                  <p className="text-[11px] text-gray-400">Confidence: {whale.confidence}%</p>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
