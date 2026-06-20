'use client';

import { useMemo, useState, useEffect } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { CoinAnalysis } from '@/lib/types';
import { formatPrice, formatPriceRaw, formatVolume } from '@/lib/utils';
import { SupportedExchange } from '@/lib/exchangeMarket';

type NewsPulseItem = {
  coin: CoinAnalysis;
  symbol: string;
  headline: string;
  sentiment: number;
  trendScore: number;
};

type ProfitItem = {
  coin: CoinAnalysis;
  opportunityScore: number;
};

const VOLUME_RATIO_CONFIDENCE_MULTIPLIER = 30;
const OPPORTUNITY_MOVE_MULTIPLIER = 7;
const OPPORTUNITY_VOLUME_MULTIPLIER = 30;
const INTEREST_VOLUME_MULTIPLIER = 35;
const SOCIAL_TREND_PRICE_MULTIPLIER = 8;
const SOCIAL_TREND_VOLUME_MULTIPLIER = 20;
const OPPORTUNITY_WEIGHTS = {
  confidence: 0.35,
  move: 0.2,
  volume: 0.2,
  trend: 0.15,
  riskReward: 0.1,
};
const TREND_SCORE = {
  bullish: 100,
  neutral: 55,
  bearish: 20,
};

function symbolName(symbol: string): string {
  return symbol.replace('USDT', '');
}

function signalSentimentMultiplier(signal: CoinAnalysis['signal']): number {
  if (signal === 'BUY') return 1;
  if (signal === 'SELL') return -1;
  return 0;
}

function moveBadgeClass(value: number): string {
  if (value >= 10) return 'text-green-200 bg-green-600/30 border-green-500/40';
  if (value >= 5) return 'text-emerald-200 bg-emerald-600/20 border-emerald-500/30';
  return 'text-yellow-200 bg-yellow-600/20 border-yellow-500/30';
}

const selectableCoinButtonClass =
  'w-full text-left rounded-lg border border-gray-800 bg-gray-900/70 p-2.5 hover:border-blue-500/50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/70';
const selectionHint = 'Click for entry, stop loss, take profit, and indicators';

export default function HighOpportunityBoard() {
  const [selectedExchange, setSelectedExchange] = useState<SupportedExchange>('binance');
  const selectedExchangesArray = useMemo(() => [selectedExchange], [selectedExchange]);
  const { coins, loading, error, lastUpdated, totalScanned, refetch } = useMarketData(selectedExchangesArray);
  const [selectedCoin, setSelectedCoin] = useState<CoinAnalysis | null>(null);
  const [signalFilter, setSignalFilter] = useState<'all' | 'long' | 'short'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCoin(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelectCoin = (coin: CoinAnalysis) => {
    setSelectedCoin(coin);
  };

  const handleExchangeChange = (exchange: SupportedExchange) => {
    setSelectedExchange(exchange);
    setSelectedCoin(null);
  };

  const highlyMovedCoins = useMemo(
    () =>
      [...coins]
        .filter((coin) => {
          if (signalFilter === 'long') return coin.signal === 'BUY';
          if (signalFilter === 'short') return coin.signal === 'SELL';
          return true;
        })
        .filter((coin) => Math.abs(coin.priceChangePercent) >= 5)
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 20),
    [coins, signalFilter]
  );

  const highInterestCoins = useMemo(
    () =>
      [...coins]
        .filter((coin) => {
          if (signalFilter === 'long') return coin.signal === 'BUY';
          if (signalFilter === 'short') return coin.signal === 'SELL';
          return true;
        })
        .map((coin) => ({
          coin,
          interestScore: Math.round(
            Math.min(
              100,
              coin.score * 0.45 +
                Math.min(100, (coin.indicators.volume?.volumeRatio ?? 0) * INTEREST_VOLUME_MULTIPLIER) * 0.35 +
                coin.tradeSignal.confidence * 0.2
            )
          ),
        }))
        .sort((a, b) => b.interestScore - a.interestScore)
        .slice(0, 12),
    [coins, signalFilter]
  );

  const whaleEntries = useMemo(
    () =>
      [...coins]
        .filter((coin) => (coin.indicators.volume?.volumeRatio ?? 0) >= 1.8 && coin.signal === 'BUY')
        .filter((coin) => {
          if (signalFilter === 'long') return coin.signal === 'BUY';
          if (signalFilter === 'short') return coin.signal === 'SELL';
          return true;
        })
        .map((coin) => {
          const estimatedUsd = (coin.indicators.volume?.currentVolume ?? 0) * coin.price;
          const confidence = Math.min(100, Math.round((coin.indicators.volume?.volumeRatio ?? 0) * VOLUME_RATIO_CONFIDENCE_MULTIPLIER));
          return { coin, estimatedUsd, confidence };
        })
        .sort((a, b) => b.estimatedUsd - a.estimatedUsd)
        .slice(0, 10),
    [coins, signalFilter]
  );

  const socialNewsPulse = useMemo<NewsPulseItem[]>(
    () =>
      [...coins]
        .filter((coin) => {
          if (signalFilter === 'long') return coin.signal === 'BUY';
          if (signalFilter === 'short') return coin.signal === 'SELL';
          return true;
        })
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 12)
        .map((coin) => {
          const sentiment = Math.max(
            -100,
            Math.min(100, Math.round(signalSentimentMultiplier(coin.signal) * coin.score))
          );
          const trendScore = Math.min(
            100,
            Math.round(
                Math.abs(coin.priceChangePercent) * SOCIAL_TREND_PRICE_MULTIPLIER +
                  (coin.indicators.volume?.volumeRatio ?? 0) * SOCIAL_TREND_VOLUME_MULTIPLIER
              )
          );
          const momentumWord = coin.priceChangePercent >= 0 ? 'bullish' : 'bearish';

          return {
            coin,
            symbol: coin.symbol,
            headline: `${symbolName(coin.symbol)} social/news attention rising with ${momentumWord} momentum`,
            sentiment,
            trendScore,
          };
        }),
    [coins, signalFilter]
  );

  const maxProfitCandidates = useMemo<ProfitItem[]>(
    () =>
      [...coins]
        .filter((coin) => {
          if (signalFilter === 'long') return coin.signal === 'BUY';
          if (signalFilter === 'short') return coin.signal === 'SELL';
          return true;
        })
        .map((coin) => {
          const moveScore = Math.min(100, Math.abs(coin.priceChangePercent) * OPPORTUNITY_MOVE_MULTIPLIER);
          const volumeScore = Math.min(100, (coin.indicators.volume?.volumeRatio ?? 0) * OPPORTUNITY_VOLUME_MULTIPLIER);
          const trendScore =
            coin.indicators.ma.trend === 'bullish'
              ? TREND_SCORE.bullish
              : coin.indicators.ma.trend === 'neutral'
                ? TREND_SCORE.neutral
                : TREND_SCORE.bearish;
          const rrScore = Math.min(100, coin.risk.riskRewardRatio * 20);
          const opportunityScore = Math.round(
            coin.tradeSignal.confidence * OPPORTUNITY_WEIGHTS.confidence +
                moveScore * OPPORTUNITY_WEIGHTS.move +
                volumeScore * OPPORTUNITY_WEIGHTS.volume +
                trendScore * OPPORTUNITY_WEIGHTS.trend +
                rrScore * OPPORTUNITY_WEIGHTS.riskReward
          );

          return {
            coin,
            opportunityScore,
          };
        })
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 10),
    [coins, signalFilter]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              High Opportunity Radar
            </h1>
            <p className="text-xs text-gray-400">
              Highly moved · highly interested · whale entries · social/news pulse
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={selectedExchange}
              onChange={(e) => handleExchangeChange(e.target.value as SupportedExchange)}
              className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white transition-colors text-xs font-medium focus:outline-none focus:ring-2 focus:ring-cyan-500/50 cursor-pointer"
            >
              <option value="binance" className="bg-gray-900">Binance</option>
              <option value="bitget" className="bg-gray-900">Bitget</option>
              <option value="mexc" className="bg-gray-900">MEXC</option>
            </select>
            <a
              href="/dashboard"
              className="px-2.5 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition-colors text-xs font-medium"
            >
              Dashboard
            </a>
            <button
              onClick={() => void refetch()}
              disabled={loading}
              className="px-2.5 py-1.5 rounded bg-cyan-600/90 hover:bg-cyan-500 disabled:opacity-50 transition-colors text-xs font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <div>
            {totalScanned > 0 && `${totalScanned} pairs scanned`}
            {lastUpdated > 0 && <span className="ml-2">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
            {error && <span className="ml-2 text-red-400">⚠ {error}</span>}
          </div>

          <div className="flex items-center gap-1 bg-gray-900/60 border border-gray-800 p-0.5 rounded-lg w-fit self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setSignalFilter('all')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all ${
                signalFilter === 'all'
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All Signals
            </button>
            <button
              type="button"
              onClick={() => setSignalFilter('long')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                signalFilter === 'long'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-emerald-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Long Only
            </button>
            <button
              type="button"
              onClick={() => setSignalFilter('short')}
              className={`px-3 py-1 rounded-md text-[11px] font-semibold transition-all flex items-center gap-1 ${
                signalFilter === 'short'
                  ? 'bg-rose-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-rose-400'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
              Short Only
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-3 bg-cyan-950/30 border border-cyan-900/40 rounded-xl p-4 text-xs sm:text-sm text-cyan-200 animate-pulse shadow-sm">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
            </span>
            <p className="font-medium">
              {selectedExchange.charAt(0).toUpperCase() + selectedExchange.slice(1)} is working to gather information...
            </p>
          </div>
        )}

        <section className="rounded-xl border border-green-700/35 bg-green-900/10 p-3">
          <h2 className="text-sm font-semibold text-green-200 mb-2">🚀 Highly Moved Coins (24h)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {loading && highlyMovedCoins.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 animate-pulse space-y-2">
                  <div className="h-4 bg-gray-800 rounded w-1/3" />
                  <div className="h-3 bg-gray-850 rounded w-1/2" />
                  <div className="h-3.5 bg-gray-800 rounded w-1/4" />
                </div>
              ))
            ) : highlyMovedCoins.length === 0 ? (
              <p className="text-xs text-gray-400">No strong movers right now.</p>
            ) : (
              highlyMovedCoins.map((coin) => (
                <button
                  type="button"
                  key={`move-${coin.symbol}`}
                  onClick={() => handleSelectCoin(coin)}
                  aria-label={`View trade guidance for ${symbolName(coin.symbol)}`}
                  className={selectableCoinButtonClass}
                >
                  <p className="text-sm font-semibold text-white">{symbolName(coin.symbol)}</p>
                  <p className="text-xs text-gray-300 mt-1">Price: {formatPrice(coin.price)}</p>
                  <span className={`inline-flex mt-1 text-[11px] px-2 py-0.5 rounded border ${moveBadgeClass(Math.abs(coin.priceChangePercent))}`}>
                    {coin.priceChangePercent >= 0 ? '+' : ''}{coin.priceChangePercent.toFixed(2)}%
                  </span>
                  <p className="text-[10px] text-blue-300 mt-1">{selectionHint}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-cyan-700/35 bg-cyan-900/10 p-3">
          <h2 className="text-sm font-semibold text-cyan-200 mb-2">📈 Highly Interested Coins</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {loading && highInterestCoins.length === 0 ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3.5 bg-gray-800 rounded w-1/4" />
                  </div>
                  <div className="h-3 bg-gray-850 rounded w-3/4" />
                </div>
              ))
            ) : highInterestCoins.length === 0 ? (
              <p className="text-xs text-gray-400">No highly interested coins detected now.</p>
            ) : (
              highInterestCoins.map(({ coin, interestScore }) => (
                <button
                  type="button"
                  key={`interest-${coin.symbol}`}
                  onClick={() => handleSelectCoin(coin)}
                  aria-label={`View trade guidance for ${symbolName(coin.symbol)}`}
                  className={selectableCoinButtonClass}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{symbolName(coin.symbol)}</p>
                    <span className="text-[11px] text-cyan-200">Score {interestScore}</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">
                    Vol Ratio {(coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)}x · Signal {coin.signal}
                  </p>
                  <p className="text-[10px] text-blue-300 mt-1">{selectionHint}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-fuchsia-700/35 bg-fuchsia-900/10 p-3">
          <h2 className="text-sm font-semibold text-fuchsia-200 mb-2">🐋 Whale Entry Detected (BUY bias)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {loading && whaleEntries.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3.5 bg-gray-800 rounded w-1/4" />
                  </div>
                  <div className="h-3 bg-gray-850 rounded w-1/2" />
                  <div className="h-3 bg-gray-850 rounded w-2/3" />
                </div>
              ))
            ) : whaleEntries.length === 0 ? (
              <p className="text-xs text-gray-400">No whale-style entries detected now.</p>
            ) : (
              whaleEntries.map((item) => (
                <button
                  type="button"
                  key={`whale-${item.coin.symbol}`}
                  onClick={() => handleSelectCoin(item.coin)}
                  aria-label={`View trade guidance for ${symbolName(item.coin.symbol)}`}
                  className={selectableCoinButtonClass}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{symbolName(item.coin.symbol)}</p>
                    <span className="text-[11px] text-green-300">Confidence {item.confidence}%</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">Estimated Size: {formatVolume(item.estimatedUsd)}</p>
                  <p className="text-[11px] text-gray-405 font-medium">Volume Ratio: {(item.coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)}x</p>
                  <p className="text-[10px] text-blue-300 mt-1">{selectionHint}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-yellow-700/35 bg-yellow-900/10 p-3">
          <h2 className="text-sm font-semibold text-yellow-200 mb-2">📰 Social Media / News Pulse</h2>
          <div className="space-y-2">
            {loading && socialNewsPulse.length === 0 ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-800 rounded w-1/4" />
                    <div className="h-3.5 bg-gray-800 rounded w-1/6" />
                  </div>
                  <div className="h-3 bg-gray-850 rounded w-5/6" />
                  <div className="h-3 bg-gray-850 rounded w-1/3" />
                </div>
              ))
            ) : socialNewsPulse.length === 0 ? (
              <p className="text-xs text-gray-400">No active social or news attention detected now.</p>
            ) : (
              socialNewsPulse.map((item) => (
                <button
                  type="button"
                  key={`news-${item.symbol}`}
                  onClick={() => handleSelectCoin(item.coin)}
                  aria-label={`View trade guidance for ${symbolName(item.symbol)}`}
                  className={selectableCoinButtonClass}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-white">{symbolName(item.symbol)}</p>
                    <span className="text-[11px] text-purple-200">Trend {item.trendScore}/100</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">{item.headline}</p>
                  <p className="text-[11px] text-cyan-200 mt-1">Sentiment: {item.sentiment > 0 ? '+' : ''}{item.sentiment}</p>
                  <p className="text-[10px] text-blue-300 mt-1">{selectionHint}</p>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-700/35 bg-emerald-900/10 p-3">
          <h2 className="text-sm font-semibold text-emerald-200 mb-2">💰 Maximum Profit Candidates</h2>
          <div className="space-y-2">
            {loading && maxProfitCandidates.length === 0 ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-lg border border-gray-800 bg-gray-900/40 p-3 animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="h-4 bg-gray-800 rounded w-1/3" />
                    <div className="h-3.5 bg-gray-800 rounded w-1/4" />
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                    <div className="h-3 bg-gray-850 rounded" />
                    <div className="h-3 bg-gray-850 rounded" />
                    <div className="h-3 bg-gray-850 rounded" />
                    <div className="h-3 bg-gray-850 rounded" />
                  </div>
                </div>
              ))
            ) : maxProfitCandidates.length === 0 ? (
              <p className="text-xs text-gray-400">No maximum profit candidates right now.</p>
            ) : (
              maxProfitCandidates.map((item, idx) => (
                <button
                  type="button"
                  key={`profit-${item.coin.symbol}`}
                  onClick={() => handleSelectCoin(item.coin)}
                  aria-label={`View trade guidance for ${symbolName(item.coin.symbol)}`}
                  className={selectableCoinButtonClass}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">#{idx + 1} {symbolName(item.coin.symbol)}</p>
                    <span className="text-[11px] text-emerald-200">Opportunity {item.opportunityScore}/100</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1 text-[11px] text-gray-300">
                    <p>Move: {item.coin.priceChangePercent >= 0 ? '+' : ''}{item.coin.priceChangePercent.toFixed(2)}%</p>
                    <p>Price: {formatPrice(item.coin.price)}</p>
                    <p>R:R: 1:{item.coin.risk.riskRewardRatio.toFixed(2)}</p>
                    <p>Volume: {formatVolume(item.coin.volume24h)}</p>
                  </div>
                  <p className="text-[10px] text-blue-300 mt-1">{selectionHint}</p>
                </button>
              ))
            )}
          </div>
        </section>

        {selectedCoin && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-300 cursor-pointer"
            onClick={() => setSelectedCoin(null)}
          >
            <div
              className={`relative w-full max-w-lg rounded-2xl border bg-gray-900/95 shadow-2xl overflow-hidden transition-all transform duration-300 cursor-default ${
                selectedCoin.signal === 'BUY'
                  ? 'border-emerald-500/40 shadow-emerald-500/10'
                  : selectedCoin.signal === 'SELL'
                  ? 'border-rose-500/40 shadow-rose-500/10'
                  : 'border-gray-800 shadow-black'
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`px-5 py-4 border-b flex items-center justify-between ${
                selectedCoin.signal === 'BUY'
                  ? 'bg-emerald-950/30 border-emerald-900/30'
                  : selectedCoin.signal === 'SELL'
                  ? 'bg-rose-950/30 border-rose-900/30'
                  : 'bg-gray-800/40 border-gray-800'
              }`}>
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      selectedCoin.signal === 'BUY'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35'
                        : selectedCoin.signal === 'SELL'
                        ? 'bg-rose-500/20 text-rose-400 border border-rose-500/35'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {selectedCoin.signal === 'BUY' ? 'LONG Opportunity' : selectedCoin.signal === 'SELL' ? 'SHORT Opportunity' : 'Neutral'}
                    </span>
                    <span className="text-xs text-gray-400 font-mono">
                      {selectedExchange.toUpperCase()}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white mt-1">
                    {symbolName(selectedCoin.symbol)} Trade Setup
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCoin(null)}
                  className="text-gray-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-gray-850"
                  aria-label="Close modal"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex items-center justify-between bg-gray-950/40 border border-gray-850/60 rounded-xl p-3">
                  <div>
                    <p className="text-[11px] text-gray-400 font-medium">Current Price</p>
                    <p className="text-lg font-bold font-mono text-white mt-0.5">
                      ${formatPriceRaw(selectedCoin.price)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-gray-400 font-medium">24h Change</p>
                    <span className={`inline-flex items-center mt-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${moveBadgeClass(Math.abs(selectedCoin.priceChangePercent))}`}>
                      {selectedCoin.priceChangePercent >= 0 ? '+' : ''}{selectedCoin.priceChangePercent.toFixed(2)}%
                    </span>
                  </div>
                </div>

                <div className="bg-gray-950/40 border border-gray-850/60 rounded-xl p-3">
                  <div className="flex justify-between text-xs text-gray-400 mb-1.5">
                    <span className="font-medium">Confidence Score</span>
                    <span className={`font-mono font-bold ${
                      selectedCoin.tradeSignal.confidence >= 70
                        ? 'text-emerald-400'
                        : selectedCoin.tradeSignal.confidence >= 40
                        ? 'text-yellow-500'
                        : 'text-rose-500'
                    }`}>
                      {selectedCoin.tradeSignal.confidence}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedCoin.signal === 'BUY'
                          ? 'bg-emerald-500'
                          : selectedCoin.signal === 'SELL'
                          ? 'bg-rose-500'
                          : 'bg-gray-500'
                      }`}
                      style={{ width: `${selectedCoin.tradeSignal.confidence}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-950/40 border border-gray-850/60 rounded-xl p-3">
                    <p className="text-[11px] text-gray-400 font-medium mb-1">Entry Zone</p>
                    <p className="text-xs font-mono text-cyan-300">
                      ${formatPriceRaw(selectedCoin.tradeSignal.entryZoneLow)}
                    </p>
                    <p className="text-[10px] text-gray-500 my-0.5">to</p>
                    <p className="text-xs font-mono text-cyan-300">
                      ${formatPriceRaw(selectedCoin.tradeSignal.entryZoneHigh)}
                    </p>
                  </div>

                  <div className={`border rounded-xl p-3 ${
                    selectedCoin.signal === 'BUY'
                      ? 'bg-rose-500/5 border-rose-500/20'
                      : 'bg-emerald-500/5 border-emerald-500/20'
                  }`}>
                    <p className="text-[11px] text-gray-400 font-medium mb-1">Stop Loss (Invalidation)</p>
                    <p className={`text-xs font-mono font-bold ${
                      selectedCoin.signal === 'BUY' ? 'text-rose-400' : 'text-emerald-400'
                    }`}>
                      ${formatPriceRaw(selectedCoin.risk.stopLoss)}
                    </p>
                    <p className={`text-[10px] mt-2 font-mono ${
                      selectedCoin.signal === 'BUY' ? 'text-rose-400/60' : 'text-emerald-400/60'
                    }`}>
                      {selectedCoin.signal === 'BUY' ? '−' : '+'}{selectedCoin.risk.stopLossPercent}%
                    </p>
                  </div>
                </div>

                <div className={`flex items-center justify-between border rounded-xl px-4 py-2.5 ${
                  selectedCoin.signal === 'BUY'
                    ? 'bg-emerald-500/5 border-emerald-500/20'
                    : selectedCoin.signal === 'SELL'
                    ? 'bg-rose-500/5 border-rose-500/20'
                    : 'bg-gray-850/40 border-gray-850'
                }`}>
                  <span className="text-xs text-gray-400 font-medium font-sans">Risk : Reward Ratio</span>
                  <span className={`text-sm font-bold font-mono ${
                    selectedCoin.signal === 'BUY' ? 'text-emerald-400' : selectedCoin.signal === 'SELL' ? 'text-rose-400' : 'text-gray-300'
                  }`}>
                    1 : {selectedCoin.risk.riskRewardRatio}
                  </span>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    Take Profit Targets
                  </p>
                  <div className="space-y-1.5">
                    {[
                      { label: 'TP1 (1R Target)', price: selectedCoin.risk.takeProfit1, pct: selectedCoin.risk.takeProfit1Percent },
                      { label: 'TP2 (2R Target)', price: selectedCoin.risk.takeProfit2, pct: selectedCoin.risk.takeProfit2Percent },
                      { label: 'TP3 (3R Target)', price: selectedCoin.risk.takeProfit3, pct: selectedCoin.risk.takeProfit3Percent },
                    ].map(({ label, price, pct }) => (
                      <div
                        key={label}
                        className="flex items-center justify-between bg-gray-950/40 border border-gray-850/60 rounded-xl px-4 py-2"
                      >
                        <span className="text-xs text-gray-400 font-medium">{label}</span>
                        <div className="text-right">
                          <span className="text-xs font-mono text-emerald-400 font-bold">
                            ${formatPriceRaw(price)}
                          </span>
                          <span className="text-[10px] text-emerald-500/70 ml-2 font-mono">
                            {selectedCoin.signal === 'SELL' ? '−' : '+'}{pct}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
