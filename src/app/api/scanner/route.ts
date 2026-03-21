// ============================================================
// Market Scanner API – scans top USDT pairs
// GET /api/scanner?signal=BUY&sort=score&limit=100
// ============================================================

import { NextResponse } from 'next/server';
import { fetchKlinesByExchange, getTopUSDTPairsByExchange, isSupportedExchange, SupportedExchange } from '@/lib/exchangeMarket';
import { analyzeEnhanced } from '@/lib/analyzer';
import { EnhancedCoinAnalysis, EnhancedScannerResponse } from '@/lib/types';
import { getPortfolioRiskSummary } from '@/lib/portfolioRisk';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds (requires Vercel Pro for > 10s)

type CacheEntry = {
  result: EnhancedScannerResponse;
  lastFetchTime: number;
};
const cacheByExchange = new Map<string, CacheEntry>();
const CACHE_TTL = 30_000; // 30 seconds
const DEFAULT_SCAN_COUNT = 100; // scan top 100 by default for richer scanner/heatmap data
const BATCH_SIZE = 10;
const DEADLINE_MS = 55_000; // stop processing before Vercel timeout
const EXCHANGE_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
};

function parseRequestedExchanges(searchParams: URLSearchParams): SupportedExchange[] {
  const exchangesParam = searchParams.get('exchanges');
  if (exchangesParam) {
    const parsed = exchangesParam
      .split(',')
      .map((exchange) => exchange.trim().toLowerCase())
      .filter(isSupportedExchange);
    if (parsed.length > 0) {
      return [...new Set(parsed)];
    }
  }

  const exchangeParam = searchParams.get('exchange')?.toLowerCase();
  if (isSupportedExchange(exchangeParam)) return [exchangeParam];
  return ['binance'];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const exchanges = parseRequestedExchanges(searchParams);
    const cacheKey = exchanges.join(',');
    const signalFilter = searchParams.get('signal')?.toUpperCase();
    const sortBy = searchParams.get('sort') ?? 'score';
    const limitParam = parseInt(searchParams.get('limit') ?? '100', 10);
    const limit = isNaN(limitParam) ? 100 : Math.min(Math.max(limitParam, 1), 500);

    const now = Date.now();
    const cached = cacheByExchange.get(cacheKey);
    if (cached && now - cached.lastFetchTime < CACHE_TTL) {
      let coins = cached.result.coins;
      if (signalFilter) coins = coins.filter((c) => c.signal === signalFilter);
      coins = sortCoins(coins, sortBy).slice(0, limit);
      return NextResponse.json({ ...cached.result, coins });
    }

    const tickerResults = await Promise.allSettled(
      exchanges.map(async (exchange) => ({
        exchange,
        tickers: await getTopUSDTPairsByExchange(exchange, DEFAULT_SCAN_COUNT),
      }))
    );
    const successful = tickerResults
      .filter(
        (result): result is PromiseFulfilledResult<{ exchange: SupportedExchange; tickers: Awaited<ReturnType<typeof getTopUSDTPairsByExchange>> }> =>
          result.status === 'fulfilled'
      )
      .map((result) => result.value);
    const failed: string[] = [];
    tickerResults.forEach((result, index) => {
      if (result.status === 'rejected') {
        const exchange = exchanges[index];
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        failed.push(`${EXCHANGE_NAMES[exchange]}: ${reason}`);
      }
    });

    if (successful.length === 0) {
      return NextResponse.json({
        coins: [],
        timestamp: now,
        totalScanned: 0,
        portfolioRisk: getPortfolioRiskSummary(),
        warnings: [
          `No live market data was returned for ${exchanges
            .map((exchange) => EXCHANGE_NAMES[exchange])
            .join(', ')}`,
          ...(failed.length > 0 ? failed : []),
        ],
      });
    }

    const tickers = successful.flatMap(({ exchange, tickers }) =>
      tickers.map((ticker) => ({ exchange, ticker }))
    );
    const coins: EnhancedCoinAnalysis[] = [];
    const startTime = Date.now();

    // Process in batches with deadline awareness
    for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
      // Stop processing if we're approaching the function timeout
      if (Date.now() - startTime > DEADLINE_MS) break;

      const batch = tickers.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ exchange, ticker }) => {
          const candles = await fetchKlinesByExchange(exchange, ticker.symbol, 100);
          return analyzeEnhanced(ticker, candles);
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          coins.push(result.value);
        }
      }
    }

    coins.sort((a, b) => b.score - a.score);

    const endTime = Date.now();
    const response: EnhancedScannerResponse = {
      coins,
      timestamp: endTime,
      totalScanned: successful.reduce((acc, item) => acc + item.tickers.length, 0),
      portfolioRisk: getPortfolioRiskSummary(),
    };

    cacheByExchange.set(cacheKey, {
      result: response,
      lastFetchTime: endTime,
    });

    let filteredCoins = coins;
    if (signalFilter) filteredCoins = filteredCoins.filter((c) => c.signal === signalFilter);
    filteredCoins = sortCoins(filteredCoins, sortBy).slice(0, limit);

    return NextResponse.json({ ...response, coins: filteredCoins });
  } catch (error) {
    console.error('Scanner error:', error);

    // Return stale cache if available instead of a hard 500
    const cached = cacheByExchange.get(parseRequestedExchanges(new URL(request.url).searchParams).join(','));
    if (cached) {
      return NextResponse.json({
        ...cached.result,
        stale: true,
      });
    }

    return NextResponse.json(
      { error: 'Failed to scan market', details: String(error) },
      { status: 500 }
    );
  }
}

function sortCoins(coins: EnhancedCoinAnalysis[], sortBy: string): EnhancedCoinAnalysis[] {
  switch (sortBy) {
    case 'change':
      return [...coins].sort((a, b) => b.priceChangePercent - a.priceChangePercent);
    case 'volume':
      return [...coins].sort((a, b) => b.volume24h - a.volume24h);
    case 'score':
    default:
      return [...coins].sort((a, b) => b.score - a.score);
  }
}
