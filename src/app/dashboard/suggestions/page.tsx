'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { formatPrice } from '@/lib/utils';

export default function SuggestionsPage() {
  const { suggestionData, watchlistMoveNotifications } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Professional Trade Suggestions
        </h2>
        <span className="text-xs text-gray-500">Entry price stays fixed until target or Stop Loss is hit</span>
      </div>

      <div className="rounded-lg border border-cyan-700/40 bg-cyan-900/10 px-3 py-2 text-xs text-cyan-100">
        Professional Rule: Execute only at the listed entry price. Do not move the entry after opening. Hold the plan until the listed target or stop loss is triggered.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
          <p className="text-[11px] text-gray-500">Avg expected profit</p>
          <p className="text-sm font-semibold text-green-300">
            {(() => {
              const all = [...suggestionData.longSuggestions, ...suggestionData.shortSuggestions];
              if (all.length === 0) return '0.00%';
              const avg = all.reduce((acc, item) => acc + item.expectedProfitPercent, 0) / all.length;
              return `${avg.toFixed(2)}%`;
            })()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
          <p className="text-[11px] text-gray-500">Avg expected loss</p>
          <p className="text-sm font-semibold text-red-300">
            {(() => {
              const all = [...suggestionData.longSuggestions, ...suggestionData.shortSuggestions];
              if (all.length === 0) return '0.00%';
              const avg = all.reduce((acc, item) => acc + item.expectedLossPercent, 0) / all.length;
              return `${avg.toFixed(2)}%`;
            })()}
          </p>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
          <p className="text-[11px] text-gray-500">High confidence ideas</p>
          <p className="text-sm font-semibold text-cyan-300">
            {[...suggestionData.longSuggestions, ...suggestionData.shortSuggestions].filter((item) => item.confidence >= 70).length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-700/40 bg-green-900/10 p-3">
          <h3 className="text-sm font-semibold text-green-300 mb-2">Top 10 Trending LONG Patterns</h3>
          <div className="space-y-2">
            {suggestionData.longSuggestions.map((item) => (
              <div key={`${item.bias}-${item.patternName}-${item.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{item.patternName} · {item.symbol.replace('USDT', '')}</p>
                  <span className="text-[11px] text-green-300">Conf {Math.round(item.confidence)}%</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{item.setup}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                  <p className="text-gray-200">Entry: <span className="font-mono">{formatPrice(item.entryPrice)}</span></p>
                  <p className="text-red-300">SL: <span className="font-mono">{formatPrice(item.stopLoss)}</span></p>
                  <p className="text-green-300">TP: <span className="font-mono">{formatPrice(item.targetPrice)}</span></p>
                </div>
                <p className="text-[11px] text-cyan-200 mt-1">R:R {item.riskRewardRatio.toFixed(2)} · Confirm: {item.confirmation}</p>
                <p className="text-[11px] text-green-200 mt-0.5">
                  Expected +{item.expectedProfitPercent.toFixed(2)}% · Max loss {item.expectedLossPercent.toFixed(2)}%
                </p>
                <p className="text-[11px] text-yellow-200 mt-0.5">Invalidation: {item.invalidation}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-rose-700/40 bg-rose-900/10 p-3">
          <h3 className="text-sm font-semibold text-rose-300 mb-2">Top 10 Trending SHORT Patterns</h3>
          <div className="space-y-2">
            {suggestionData.shortSuggestions.map((item) => (
              <div key={`${item.bias}-${item.patternName}-${item.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{item.patternName} · {item.symbol.replace('USDT', '')}</p>
                  <span className="text-[11px] text-rose-300">Conf {Math.round(item.confidence)}%</span>
                </div>
                <p className="text-[11px] text-gray-400 mt-1">{item.setup}</p>
                <div className="grid grid-cols-3 gap-2 mt-2 text-[11px]">
                  <p className="text-gray-200">Entry: <span className="font-mono">{formatPrice(item.entryPrice)}</span></p>
                  <p className="text-red-300">SL: <span className="font-mono">{formatPrice(item.stopLoss)}</span></p>
                  <p className="text-green-300">TP: <span className="font-mono">{formatPrice(item.targetPrice)}</span></p>
                </div>
                <p className="text-[11px] text-cyan-200 mt-1">R:R {item.riskRewardRatio.toFixed(2)} · Confirm: {item.confirmation}</p>
                <p className="text-[11px] text-green-200 mt-0.5">
                  Expected +{item.expectedProfitPercent.toFixed(2)}% · Max loss {item.expectedLossPercent.toFixed(2)}%
                </p>
                <p className="text-[11px] text-yellow-200 mt-0.5">Invalidation: {item.invalidation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/10 p-3">
        <h3 className="text-sm font-semibold text-indigo-300 mb-2">Selected Coin Move Notifications</h3>
        {watchlistMoveNotifications.length === 0 ? (
          <p className="text-xs text-gray-400">No alert-level moves on your selected coins yet. Add coins to watchlist to activate professional notifications.</p>
        ) : (
          <div className="space-y-2">
            {watchlistMoveNotifications.map((alert) => (
              <div key={alert.symbol} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-white">{alert.symbol.replace('USDT', '')}</p>
                  <span className={`text-[11px] ${alert.status === 'TARGET HIT' ? 'text-green-300' : alert.status === 'STOP LOSS HIT' ? 'text-red-300' : 'text-cyan-300'}`}>
                    {alert.status}
                  </span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1">Live: <span className="font-mono">{formatPrice(alert.livePrice)}</span> · Move: {alert.movePercent >= 0 ? '+' : ''}{alert.movePercent.toFixed(2)}%</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{alert.guidance}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
