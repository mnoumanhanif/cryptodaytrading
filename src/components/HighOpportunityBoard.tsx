'use client';

import { useMemo } from 'react';
import { useMarketData } from '@/hooks/useMarketData';
import { CoinAnalysis } from '@/lib/types';
import { formatPrice, formatVolume } from '@/lib/utils';

type NewsPulseItem = {
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

export default function HighOpportunityBoard() {
  const { coins, loading, error, lastUpdated, totalScanned, refetch } = useMarketData(['binance']);

  const highlyMovedCoins = useMemo(
    () =>
      [...coins]
        .filter((coin) => Math.abs(coin.priceChangePercent) >= 5)
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 20),
    [coins]
  );

  const highInterestCoins = useMemo(
    () =>
      [...coins]
        .map((coin) => ({
          coin,
          interestScore: Math.round(
            Math.min(
              100,
              coin.score * 0.45 +
                Math.min(100, (coin.indicators.volume?.volumeRatio ?? 0) * 35) * 0.35 +
                coin.tradeSignal.confidence * 0.2
            )
          ),
        }))
        .sort((a, b) => b.interestScore - a.interestScore)
        .slice(0, 12),
    [coins]
  );

  const whaleEntries = useMemo(
    () =>
      [...coins]
        .filter((coin) => (coin.indicators.volume?.volumeRatio ?? 0) >= 1.8 && coin.signal === 'BUY')
        .map((coin) => {
          const estimatedUsd = (coin.indicators.volume?.currentVolume ?? 0) * coin.price;
          const confidence = Math.min(100, Math.round((coin.indicators.volume?.volumeRatio ?? 0) * VOLUME_RATIO_CONFIDENCE_MULTIPLIER));
          return { coin, estimatedUsd, confidence };
        })
        .sort((a, b) => b.estimatedUsd - a.estimatedUsd)
        .slice(0, 10),
    [coins]
  );

  const socialNewsPulse = useMemo<NewsPulseItem[]>(
    () =>
      [...coins]
        .sort((a, b) => Math.abs(b.priceChangePercent) - Math.abs(a.priceChangePercent))
        .slice(0, 12)
        .map((coin) => {
          const sentiment = Math.max(
            -100,
            Math.min(100, Math.round(signalSentimentMultiplier(coin.signal) * coin.score))
          );
          const trendScore = Math.min(
            100,
            Math.round(Math.abs(coin.priceChangePercent) * 8 + (coin.indicators.volume?.volumeRatio ?? 0) * 20)
          );
          const momentumWord = coin.priceChangePercent >= 0 ? 'bullish' : 'bearish';

          return {
            symbol: coin.symbol,
            headline: `${symbolName(coin.symbol)} social/news attention rising with ${momentumWord} momentum`,
            sentiment,
            trendScore,
          };
        }),
    [coins]
  );

  const maxProfitCandidates = useMemo<ProfitItem[]>(
    () =>
      [...coins]
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
    [coins]
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
            <a
              href="/"
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
        <div className="text-xs text-gray-500">
          {totalScanned > 0 && `${totalScanned} pairs scanned`}
          {lastUpdated > 0 && <span className="ml-2">Updated {new Date(lastUpdated).toLocaleTimeString()}</span>}
          {error && <span className="ml-2 text-red-400">⚠ {error}</span>}
        </div>

        <section className="rounded-xl border border-green-700/35 bg-green-900/10 p-3">
          <h2 className="text-sm font-semibold text-green-200 mb-2">🚀 Highly Moved Coins (24h)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
            {highlyMovedCoins.length === 0 ? (
              <p className="text-xs text-gray-400">No strong movers right now.</p>
            ) : (
              highlyMovedCoins.map((coin) => (
                <div key={`move-${coin.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                  <p className="text-sm font-semibold text-white">{symbolName(coin.symbol)}</p>
                  <p className="text-xs text-gray-300 mt-1">Price: {formatPrice(coin.price)}</p>
                  <span className={`inline-flex mt-1 text-[11px] px-2 py-0.5 rounded border ${moveBadgeClass(Math.abs(coin.priceChangePercent))}`}>
                    {coin.priceChangePercent >= 0 ? '+' : ''}{coin.priceChangePercent.toFixed(2)}%
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-cyan-700/35 bg-cyan-900/10 p-3">
          <h2 className="text-sm font-semibold text-cyan-200 mb-2">📈 Highly Interested Coins</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {highInterestCoins.map(({ coin, interestScore }) => (
              <div key={`interest-${coin.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{symbolName(coin.symbol)}</p>
                  <span className="text-[11px] text-cyan-200">Score {interestScore}</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1">
                  Vol Ratio {(coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)}x · Signal {coin.signal}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-fuchsia-700/35 bg-fuchsia-900/10 p-3">
          <h2 className="text-sm font-semibold text-fuchsia-200 mb-2">🐋 Whale Entry Detected (BUY bias)</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
            {whaleEntries.length === 0 ? (
              <p className="text-xs text-gray-400">No whale-style entries detected now.</p>
            ) : (
              whaleEntries.map((item) => (
                <div key={`whale-${item.coin.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-white">{symbolName(item.coin.symbol)}</p>
                    <span className="text-[11px] text-green-300">Confidence {item.confidence}%</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-1">Estimated Size: {formatVolume(item.estimatedUsd)}</p>
                  <p className="text-[11px] text-gray-400">Volume Ratio: {(item.coin.indicators.volume?.volumeRatio ?? 0).toFixed(2)}x</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-yellow-700/35 bg-yellow-900/10 p-3">
          <h2 className="text-sm font-semibold text-yellow-200 mb-2">📰 Social Media / News Pulse</h2>
          <div className="space-y-2">
            {socialNewsPulse.map((item) => (
              <div key={`news-${item.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-white">{symbolName(item.symbol)}</p>
                  <span className="text-[11px] text-purple-200">Trend {item.trendScore}/100</span>
                </div>
                <p className="text-[11px] text-gray-300 mt-1">{item.headline}</p>
                <p className="text-[11px] text-cyan-200 mt-1">Sentiment: {item.sentiment > 0 ? '+' : ''}{item.sentiment}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-emerald-700/35 bg-emerald-900/10 p-3">
          <h2 className="text-sm font-semibold text-emerald-200 mb-2">💰 Maximum Profit Candidates</h2>
          <div className="space-y-2">
            {maxProfitCandidates.map((item, idx) => (
              <div key={`profit-${item.coin.symbol}`} className="rounded-lg border border-gray-800 bg-gray-900/70 p-2.5">
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
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
