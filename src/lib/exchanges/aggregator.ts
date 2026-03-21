import { ExchangeTicker } from './baseExchange';
import { BinanceExchangeClient } from './binance/client';
import { BybitExchangeClient } from './bybit/client';

export interface MarketOverview {
  timestamp: number;
  totalPairs: number;
  topGainers: ExchangeTicker[];
  topLosers: ExchangeTicker[];
  exchangeVolumeShare: Array<{
    exchange: 'binance' | 'bybit';
    volume: number;
    percentage: number;
  }>;
}

const binance = new BinanceExchangeClient();
const bybit = new BybitExchangeClient();

export async function fetchUnifiedTickers(limit = 200): Promise<ExchangeTicker[]> {
  const [binanceResult, bybitResult] = await Promise.allSettled([
    binance.fetch24hTickers(),
    bybit.fetch24hTickers(),
  ]);

  const allTickers: ExchangeTicker[] = [];
  if (binanceResult.status === 'fulfilled') {
    allTickers.push(
      ...binanceResult.value.sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, limit)
    );
  }
  if (bybitResult.status === 'fulfilled') {
    allTickers.push(...bybitResult.value.sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, limit));
  }

  return allTickers.sort((a, b) => b.quoteVolume - a.quoteVolume).slice(0, limit);
}

export async function getMarketOverview(limit = 200): Promise<MarketOverview> {
  const unified = await fetchUnifiedTickers(limit);
  const totalVolume = unified.reduce((sum, ticker) => sum + ticker.quoteVolume, 0);
  const binanceVolume = unified
    .filter((ticker) => ticker.exchange === 'binance')
    .reduce((sum, ticker) => sum + ticker.quoteVolume, 0);
  const bybitVolume = unified
    .filter((ticker) => ticker.exchange === 'bybit')
    .reduce((sum, ticker) => sum + ticker.quoteVolume, 0);

  return {
    timestamp: Date.now(),
    totalPairs: unified.length,
    topGainers: [...unified]
      .filter((ticker) => Number.isFinite(ticker.priceChangePercent))
      .sort((a, b) => b.priceChangePercent - a.priceChangePercent)
      .slice(0, 5),
    topLosers: [...unified]
      .filter((ticker) => Number.isFinite(ticker.priceChangePercent))
      .sort((a, b) => a.priceChangePercent - b.priceChangePercent)
      .slice(0, 5),
    exchangeVolumeShare: [
      {
        exchange: 'binance',
        volume: binanceVolume,
        percentage: totalVolume > 0 ? (binanceVolume / totalVolume) * 100 : 0,
      },
      {
        exchange: 'bybit',
        volume: bybitVolume,
        percentage: totalVolume > 0 ? (bybitVolume / totalVolume) * 100 : 0,
      },
    ],
  };
}
