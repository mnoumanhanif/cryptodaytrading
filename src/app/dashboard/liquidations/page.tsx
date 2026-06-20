'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';

export default function LiquidationsPage() {
  const { liquidationHeatmap } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          Binance Liquidation Heatmap
        </h2>
        <span className="text-xs text-gray-500">Estimated long vs short liquidation pressure</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {liquidationHeatmap.slice(0, 50).map((item) => {
          const positiveImbalance = item.imbalance >= 0;
          const intensity = Math.min(95, Math.max(15, item.intensity));
          return (
            <div
              key={item.symbol}
              className={`rounded-lg border p-3 ${
                positiveImbalance ? 'border-green-600/40' : 'border-red-600/40'
              }`}
              style={{
                background: positiveImbalance
                  ? `linear-gradient(135deg, rgba(6, 78, 59, ${intensity / 120}) 0%, rgba(17, 24, 39, 0.9) 100%)`
                  : `linear-gradient(135deg, rgba(127, 29, 29, ${intensity / 120}) 0%, rgba(17, 24, 39, 0.9) 100%)`,
              }}
            >
              <p className="text-xs text-white font-semibold">{item.symbol.replace('USDT', '')}</p>
              <p className="text-[11px] text-gray-300 mt-1">Long liq: {item.longLiquidationPressure.toFixed(2)}</p>
              <p className="text-[11px] text-gray-300">Short liq: {item.shortLiquidationPressure.toFixed(2)}</p>
              <p className={`text-[11px] mt-1 ${positiveImbalance ? 'text-green-300' : 'text-red-300'}`}>
                Imbalance: {item.imbalance >= 0 ? '+' : ''}{item.imbalance.toFixed(2)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
