'use client';

import React from 'react';
import { useDashboard } from '@/contexts/DashboardContext';
import { CandlePatternsPanel } from '@/components/dashboard-pages/dashboardHelpers';

export default function PatternsPage() {
  const {
    patternOverviewStats,
    patternBiasFilter,
    setPatternBiasFilter,
    patternMinConfidence,
    setPatternMinConfidence,
    patternTimeframeFilter,
    setPatternTimeframeFilter,
    patternConfirmedOnly,
    setPatternConfirmedOnly,
    patternLearningMode,
    setPatternLearningMode,
    patternCoinFilter,
    setPatternCoinFilter,
    warningCoinOptions,
    filteredPatternCards,
    patternMatchesLoading,
    patternMatchesError,
  } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          🚀 Pattern Market Overview
        </h2>
        <span className="text-xs text-gray-500">Decision Engine · Binance Context</span>
      </div>

      <div className="rounded-xl border border-cyan-700/40 bg-cyan-900/10 p-3">
        <p className="text-sm font-semibold text-cyan-100">
          📊 Pattern Market Bias: {patternOverviewStats.marketBias === 'Bullish' ? '🟢 Bullish' : '🔴 Bearish'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mt-2 text-[11px]">
          <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
            <p className="text-gray-500">Active Patterns</p>
            <p className="text-white font-semibold">{patternOverviewStats.activePatterns}</p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
            <p className="text-gray-500">🟢 Bullish</p>
            <p className="text-green-300 font-semibold">{patternOverviewStats.bullish}</p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
            <p className="text-gray-500">🔴 Bearish</p>
            <p className="text-red-300 font-semibold">{patternOverviewStats.bearish}</p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/75 px-2.5 py-2">
            <p className="text-gray-500">🔥 Best Opportunity</p>
            <p className="text-cyan-200 font-semibold">
              {patternOverviewStats.best ? `${patternOverviewStats.best.pattern.name} — ${patternOverviewStats.best.winProbability}%` : 'No signal'}
            </p>
          </div>
        </div>
        <p className="text-[11px] text-yellow-200 mt-2">
          ⚠️ Weak Pattern: {patternOverviewStats.weakest ? `${patternOverviewStats.weakest.pattern.name} (${patternOverviewStats.weakest.winProbability}%)` : 'N/A'}
        </p>
      </div>

      <div className="rounded-xl border border-gray-700/70 bg-gray-900/70 p-3">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-gray-400">Pattern Type:</span>
          <button
            onClick={() => setPatternBiasFilter('all')}
            className={`px-2 py-1 rounded border cursor-pointer ${patternBiasFilter === 'all' ? 'border-cyan-500 text-cyan-200 bg-cyan-500/15' : 'border-gray-700 text-gray-300'}`}
          >
            All
          </button>
          <button
            onClick={() => setPatternBiasFilter('Bullish')}
            className={`px-2 py-1 rounded border cursor-pointer ${patternBiasFilter === 'Bullish' ? 'border-green-500 text-green-200 bg-green-500/15' : 'border-gray-700 text-gray-300'}`}
          >
            🟢 Bullish
          </button>
          <button
            onClick={() => setPatternBiasFilter('Bearish')}
            className={`px-2 py-1 rounded border cursor-pointer ${patternBiasFilter === 'Bearish' ? 'border-red-500 text-red-200 bg-red-500/15' : 'border-gray-700 text-gray-300'}`}
          >
            🔴 Bearish
          </button>
          
          <span className="text-gray-400 ml-2">Confidence: {patternMinConfidence}%</span>
          <input
            type="range"
            min={40}
            max={90}
            step={5}
            value={patternMinConfidence}
            onChange={(event) => setPatternMinConfidence(Number(event.target.value))}
            className="w-24 accent-cyan-400 cursor-pointer"
          />

          <span className="text-gray-400 ml-2">Timeframe:</span>
          <select
            value={patternTimeframeFilter}
            onChange={(event) => setPatternTimeframeFilter(event.target.value as 'all' | any)}
            className="rounded border border-gray-700 bg-gray-800 text-gray-200 px-2 py-1 cursor-pointer"
          >
            <option value="all">All</option>
            <option value="5m">5m</option>
            <option value="15m">15m</option>
            <option value="1h">1h</option>
          </select>

          <label className="ml-2 flex items-center gap-1 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              checked={patternConfirmedOnly}
              onChange={(event) => setPatternConfirmedOnly(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-gray-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            Status: Confirmed only
          </label>

          <label className="ml-2 flex items-center gap-1 text-cyan-200 cursor-pointer">
            <input
              type="checkbox"
              checked={patternLearningMode}
              onChange={(event) => setPatternLearningMode(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-cyan-600 bg-gray-800 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            Learning Mode
          </label>

          <span className="text-gray-400 ml-2">Coin:</span>
          <select
            value={patternCoinFilter}
            onChange={(event) => setPatternCoinFilter(event.target.value as 'all' | string)}
            className="rounded border border-gray-700 bg-gray-800 text-gray-200 px-2 py-1 cursor-pointer"
          >
            <option value="all">All</option>
            {warningCoinOptions.map((symbol) => (
              <option key={`pattern-coin-${symbol}`} value={symbol}>
                {symbol.replace('USDT', '')}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-700/40 bg-indigo-900/10 p-3">
        <h3 className="text-sm font-semibold text-indigo-200">📈 Pattern Performance</h3>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 mt-2 text-[11px]">
          <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
            <p className="text-gray-500">Win Rate (Live)</p>
            <p className="text-cyan-200 font-semibold">{patternOverviewStats.winRateLive.toFixed(0)}%</p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
            <p className="text-gray-500">Avg R:R</p>
            <p className="text-green-300 font-semibold">1 : {patternOverviewStats.avgRR.toFixed(1)}</p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
            <p className="text-gray-500">Best Pattern</p>
            <p className="text-emerald-300 font-semibold">
              {patternOverviewStats.best ? `${patternOverviewStats.best.pattern.name} (${patternOverviewStats.best.winProbability}%)` : 'N/A'}
            </p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
            <p className="text-gray-500">Worst Pattern</p>
            <p className="text-yellow-300 font-semibold">
              {patternOverviewStats.weakest ? `${patternOverviewStats.weakest.pattern.name} (${patternOverviewStats.weakest.winProbability}%)` : 'N/A'}
            </p>
          </div>
          <div className="rounded border border-gray-800 bg-gray-900/70 px-2.5 py-2">
            <p className="text-gray-500">Market Quality</p>
            <p className="text-cyan-100 font-semibold">{patternOverviewStats.marketQuality}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-violet-700/40 bg-violet-900/10 px-3 py-2 text-xs text-violet-100">
        <p className="font-semibold">🤖 AI Market Insight:</p>
        <p className="mt-1">
          Market shows a {patternOverviewStats.marketBias.toLowerCase()} pattern mix with {patternOverviewStats.marketQuality.toLowerCase()} quality setup flow.
          Best opportunities are in active names with stronger volume participation. Avoid low-conviction patterns with weak confluence.
        </p>
      </div>

      <CandlePatternsPanel
        patternCards={filteredPatternCards}
        learningMode={patternLearningMode}
        loading={patternMatchesLoading}
        error={patternMatchesError}
      />
    </div>
  );
}
