'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';

export default function WarningsPage() {
  const {
    warningCoinFilter,
    setWarningCoinFilter,
    warningCoinOptions,
    warningNews,
  } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
          Warning & News Intelligence
        </h2>
        <span className="text-xs text-gray-500">Risky coin news, sentiment, and trend pressure</span>
      </div>

      <div className="rounded-lg border border-yellow-700/40 bg-yellow-900/10 px-3 py-2 text-xs text-yellow-100">
        Sentiment & News Intelligence includes internally generated risk headlines, bullish/bearish score, X (Twitter) trend tracking proxy, and News Impact Score (historical sensitivity proxy).
      </div>

      <div className="space-y-2">
        <div className="rounded-lg border border-gray-800 bg-gray-900/60 p-3">
          <label className="text-xs text-gray-300 flex flex-wrap items-center gap-2 cursor-pointer">
            <span>Coin:</span>
            <select
              value={warningCoinFilter}
              onChange={(event) => setWarningCoinFilter(event.target.value as 'all' | string)}
              className="rounded border border-gray-700 bg-gray-800 text-gray-200 px-2 py-1 cursor-pointer"
            >
              <option value="all">All</option>
              {warningCoinOptions.map((symbol) => (
                <option key={`warning-coin-${symbol}`} value={symbol}>
                  {symbol.replace('USDT', '')}
                </option>
              ))}
            </select>
          </label>
        </div>

        {warningNews.length === 0 ? (
          <div className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
            <p className="text-sm text-gray-400">No warning/news details found for the selected coin.</p>
          </div>
        ) : (
          warningNews.map((item) => (
            <div key={`${item.symbol}-${item.headline}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">
                  {item.symbol.replace('USDT', '')} · {item.source}
                </p>
                <span className={`text-[11px] px-2 py-0.5 rounded border ${item.riskLevel === 'High' ? 'text-red-300 border-red-600/40 bg-red-900/20' : 'text-yellow-300 border-yellow-600/40 bg-yellow-900/20'}`}>
                  {item.riskLevel} Risk
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">{item.headline}</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2 text-[11px]">
                <p className="text-cyan-200">Sentiment: {item.sentimentScore > 0 ? '+' : ''}{item.sentimentScore}</p>
                <p className="text-purple-200">X Trend: {item.twitterTrendScore}/100</p>
                <p className="text-orange-200">News Impact Score: {item.newsImpactScore}/100</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
