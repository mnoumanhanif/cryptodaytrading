// ============================================================
// Market Scanner API – scans top USDT pairs
// GET /api/scanner?signal=BUY&sort=score&limit=1000
// ============================================================

import { NextResponse } from 'next/server';
import { fetchKlinesByExchange, getTopUSDTPairsByExchange, isSupportedExchange, SupportedExchange } from '@/lib/exchangeMarket';
import { analyzeEnhanced } from '@/lib/analyzer';
import { EnhancedCoinAnalysis, EnhancedScannerResponse } from '@/lib/types';
import { getPortfolioRiskSummary } from '@/lib/portfolioRisk';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // seconds (requires Vercel Pro for > 10s)

type CacheEntry = {
  result: EnhancedScannerResponse;
  lastFetchTime: number;
};
const globalForScannerCache = global as unknown as {
  cacheByExchange?: Map<string, CacheEntry>;
};

const cacheByExchange = globalForScannerCache.cacheByExchange ?? new Map<string, CacheEntry>();
if (process.env.NODE_ENV !== 'production') {
  globalForScannerCache.cacheByExchange = cacheByExchange;
}

const CACHE_TTL = process.env.NODE_ENV === 'development' ? 10 * 60 * 1000 : 30_000; // 10 minutes in dev, 30 seconds in prod
const DEFAULT_SCAN_COUNT = 1000; // scan top 1000 by default for richer scanner/heatmap data
const BATCH_SIZE = 15;
const DEADLINE_MS = 55_000; // stop processing before Vercel timeout
const EXCHANGE_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bitget: 'Bitget',
  mexc: 'MEXC',
};

const scannerQuerySchema = z.object({
  signal: z.enum(['BUY', 'SELL', 'HOLD']).optional(),
  sort: z.enum(['score', 'change', 'volume']).optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

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
    const contextOrResponse = await requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';
    const parsed = scannerQuerySchema.safeParse({
      signal: searchParams.get('signal')?.toUpperCase() ?? undefined,
      sort: searchParams.get('sort') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const exchanges = parseRequestedExchanges(searchParams);
    const cacheKey = exchanges.join(',');
    const signalFilter = parsed.data.signal;
    const sortBy = parsed.data.sort ?? 'score';
    const limit = parsed.data.limit ?? 1000;

    const now = Date.now();
    const cached = cacheByExchange.get(cacheKey);
    if (!forceRefresh && cached && now - cached.lastFetchTime < CACHE_TTL) {
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
    // Select candidates to analyze to search all the market efficiently and avoid timeouts:
    // 1. Top 120 volume leaders (20 in dev)
    // 2. Top 30 gainers (5 in dev)
    // 3. Top 30 decliners (5 in dev)
    const isDev = process.env.NODE_ENV === 'development';
    const volumeSorted = [...tickers]; // already sorted by volume desc
    const topVolume = volumeSorted.slice(0, isDev ? 20 : 120);

    const changeSortedDesc = [...tickers].sort(
      (a, b) => parseFloat(b.ticker.priceChangePercent) - parseFloat(a.ticker.priceChangePercent)
    );
    const topGainers = changeSortedDesc.slice(0, isDev ? 5 : 30);

    const changeSortedAsc = [...tickers].sort(
      (a, b) => parseFloat(a.ticker.priceChangePercent) - parseFloat(b.ticker.priceChangePercent)
    );
    const topDecliners = changeSortedAsc.slice(0, isDev ? 5 : 30);

    const seenKeys = new Set<string>();
    const candidates: typeof tickers = [];

    const addCandidate = (item: typeof tickers[number]) => {
      const key = `${item.exchange}:${item.ticker.symbol}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        candidates.push(item);
      }
    };

    topVolume.forEach(addCandidate);
    topGainers.forEach(addCandidate);
    topDecliners.forEach(addCandidate);
    const coins: EnhancedCoinAnalysis[] = [];
    const startTime = Date.now();

    // Process in batches with deadline awareness
    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      // Stop processing if we're approaching the function timeout
      if (Date.now() - startTime > DEADLINE_MS) break;

      const batch = candidates.slice(i, i + BATCH_SIZE);
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

    const qualityFilteredCoins = coins.filter((coin) => {
      // Do not filter out low liquidity coins from the general scanner/heatmap
      const hasManipulationRisk = coin.tradeSignal.risk_flags.includes('Abnormal price spikes detected');
      return !hasManipulationRisk;
    });
    qualityFilteredCoins.sort((a, b) => b.score - a.score);

    const endTime = Date.now();
    const response: EnhancedScannerResponse = {
      coins: qualityFilteredCoins,
      timestamp: endTime,
      totalScanned: successful.reduce((acc, item) => acc + item.tickers.length, 0),
      portfolioRisk: getPortfolioRiskSummary(),
    };

    cacheByExchange.set(cacheKey, {
      result: response,
      lastFetchTime: endTime,
    });

    let filteredCoins = qualityFilteredCoins;
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
