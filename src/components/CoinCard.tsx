'use client';

// ============================================================
// Expandable coin analysis card with indicators, candlestick chart,
// trade signal board, risk management panel, and advanced indicators
// ============================================================

import { useState, memo } from 'react';
import { CoinAnalysis } from '@/lib/types';
import { formatVolume, formatPriceRaw } from '@/lib/utils';
import { BUY_THRESHOLD, SELL_THRESHOLD } from '@/lib/scoring';
import SignalBadge from './SignalBadge';
import CandlestickChart from './CandlestickChart';
import PriceChart from './PriceChart';
import TradeSignalBoard from './TradeSignalBoard';
import RiskManagementPanel from './RiskManagementPanel';
import AdvancedIndicators from './AdvancedIndicators';

const ScoreBar = memo(function ScoreBar({ score, label }: { score: number; label: string }) {
  const color =
    score >= 70 ? 'bg-red-500' : score >= 40 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 text-gray-400">{label}</span>
      <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${score}%` }} />
      </div>
      <span className="w-8 text-right text-gray-300">{Math.round(score)}</span>
    </div>
  );
});

type Tab = 'chart' | 'signal' | 'risk' | 'advanced';

const TABS: { id: Tab; label: string }[] = [
  { id: 'chart', label: '📈 Chart' },
  { id: 'signal', label: '🎯 Signal' },
  { id: 'risk', label: '🛡 Risk' },
  { id: 'advanced', label: '🔬 Advanced' },
];

interface CoinCardProps {
  coin: CoinAnalysis;
  onAdd?: () => void;
  isWatching?: boolean;
}

export default function CoinCard({ coin, onAdd, isWatching }: CoinCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('chart');
  const changeColor = coin.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400';

  return (
    <div className="bg-gray-800/60 border border-gray-700/50 rounded-lg hover:border-gray-600/50 transition-colors">
      {/* Summary row */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{coin.symbol.replace('USDT', '')}</span>
            <span className="text-gray-500 text-xs">/ USDT</span>
            <SignalBadge signal={coin.signal} />
          </div>
          <div className="flex items-center gap-3 mt-1 text-sm">
            <span className="text-white font-mono">${formatPriceRaw(coin.price)}</span>
            <span className={`${changeColor} font-mono`}>
              {coin.priceChangePercent >= 0 ? '+' : ''}
              {coin.priceChangePercent.toFixed(2)}%
            </span>
          </div>
        </div>

        {/* Confidence / score */}
        <div className="text-right text-sm">
          <div className="text-gray-400 text-xs">Confidence</div>
          <div
            className={`font-bold text-lg ${
              coin.score >= 70
                ? 'text-red-400'
                : coin.score >= 40
                ? 'text-yellow-400'
                : 'text-green-400'
            }`}
          >
            {Math.round(coin.score)}%
          </div>
        </div>

        <div className="text-right text-sm hidden sm:block">
          <div className="text-gray-400 text-xs">Volume</div>
          <div className="text-gray-300">{formatVolume(coin.volume24h)}</div>
        </div>

        {/* TP1 quick preview */}
        <div className="text-right text-sm hidden md:block">
          <div className="text-gray-400 text-xs">TP1</div>
          <div className="text-green-400 font-mono text-xs">
            ${formatPriceRaw(coin.risk.takeProfit1)}
          </div>
        </div>

        {onAdd && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
            disabled={isWatching}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              isWatching
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {isWatching ? '✓ Watching' : '+ Watch'}
          </button>
        )}

        <svg
          className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-700/50">
          {/* Tab bar */}
          <div className="flex border-b border-gray-700/50 px-4">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-2 text-xs font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-white'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {/* Chart tab */}
            {activeTab === 'chart' && (
              <div className="space-y-4">
                <PriceChart symbol={coin.symbol} />
                <CandlestickChart symbol={coin.symbol} />

                {/* Quick indicator scores */}
                <div className="space-y-2">
                  <h4 className="text-xs text-gray-400 uppercase">Indicator Scores</h4>
                  <div className="text-[11px] text-gray-500">
                    Composite = avg(RSI, MACD, Bollinger, Volume, MA, Ichimoku). BUY &lt; {BUY_THRESHOLD}, HOLD {BUY_THRESHOLD}–{SELL_THRESHOLD}, SELL &gt; {SELL_THRESHOLD}.
                  </div>
                  <ScoreBar score={coin.indicators.rsi.score} label="RSI" />
                  <ScoreBar score={coin.indicators.macd.score} label="MACD" />
                  <ScoreBar score={coin.indicators.bollinger.score} label="Bollinger" />
                  <ScoreBar score={coin.indicators.volume.score} label="Volume" />
                  <ScoreBar score={coin.indicators.ma.score} label="MA" />
                  {coin.indicators.ichimoku && (
                    <ScoreBar score={coin.indicators.ichimoku.score} label="Ichimoku" />
                  )}
                  {coin.indicators.stochRSI && (
                    <ScoreBar score={coin.indicators.stochRSI.score} label="StochRSI" />
                  )}
                  {coin.indicators.adx && (
                    <ScoreBar score={coin.indicators.adx.score} label="ADX" />
                  )}
                </div>

                {/* Indicator values */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-400">
                  <div>
                    RSI: <span className="text-white">{coin.indicators.rsi.value}</span>{' '}
                    <span className={coin.indicators.rsi.signal === 'oversold' ? 'text-green-400' : coin.indicators.rsi.signal === 'overbought' ? 'text-red-400' : ''}>
                      ({coin.indicators.rsi.signal})
                    </span>
                  </div>
                  <div>
                    MACD:{' '}
                    <span className={coin.indicators.macd.crossover === 'bullish' ? 'text-green-400' : coin.indicators.macd.crossover === 'bearish' ? 'text-red-400' : 'text-white'}>
                      {coin.indicators.macd.crossover}
                    </span>
                  </div>
                  <div>
                    BB %B: <span className="text-white">{coin.indicators.bollinger.percentB}</span>
                  </div>
                  <div>
                    Trend:{' '}
                    <span className={coin.indicators.ma.trend === 'bullish' ? 'text-green-400' : coin.indicators.ma.trend === 'bearish' ? 'text-red-400' : 'text-white'}>
                      {coin.indicators.ma.trend}
                    </span>
                    {coin.indicators.ma.goldenCross && <span className="text-yellow-400"> ★</span>}
                  </div>
                </div>
              </div>
            )}

            {/* Signal tab */}
            {activeTab === 'signal' && <TradeSignalBoard coin={coin} />}

            {/* Risk tab */}
            {activeTab === 'risk' && <RiskManagementPanel coin={coin} />}

            {/* Advanced tab */}
            {activeTab === 'advanced' && <AdvancedIndicators indicators={coin.indicators} />}
          </div>
        </div>
      )}
    </div>
  );
}
