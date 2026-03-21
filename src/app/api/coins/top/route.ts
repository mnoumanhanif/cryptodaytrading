// ============================================================
// Top coins API – paginated ticker data for up to 500 USDT pairs
// GET /api/coins/top?page=1&limit=25&sort=volume&total=500
// ============================================================

import { NextResponse } from 'next/server';
import { getTopUSDTPairsByExchange, isSupportedExchange, SupportedExchange } from '@/lib/exchangeMarket';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export interface TopCoin {
  symbol: string;
  price: number;
  priceChange: number;
  priceChangePercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  rank: number;
}

interface TopCoinsResponse {
  coins: TopCoin[];
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  timestamp: number;
}

type CacheEntry = {
  coins: TopCoin[];
  lastFetchTime: number;
};
const cacheByExchange = new Map<string, CacheEntry>();
const CACHE_TTL = 60_000; // 1 minute

const EXCHANGE_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
  mexc: 'MEXC',
};

function parseRequestedExchanges(searchParams: URLSearchParams): SupportedExchange[] {
  const exchangesParam = searchParams.get('exchanges');
  if (exchangesParam) {
    const parsed = exchangesParam
      .split(',')
      .map((exchange) => exchange.trim().toLowerCase())
      .filter(isSupportedExchange);
    if (parsed.length > 0) return [...new Set(parsed)];
  }

  const exchangeParam = searchParams.get('exchange')?.toLowerCase();
  if (isSupportedExchange(exchangeParam)) return [exchangeParam];
  return ['binance'];
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const pageParam = parseInt(searchParams.get('page') ?? '1', 10);
    const page = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;
    const limitParam = parseInt(searchParams.get('limit') ?? '25', 10);
    const limit = isNaN(limitParam) ? 25 : Math.min(Math.max(limitParam, 1), 100);
    const sort = searchParams.get('sort') ?? 'volume';
    const totalParam = parseInt(searchParams.get('total') ?? '500', 10);
    const total = isNaN(totalParam) ? 500 : Math.min(Math.max(totalParam, 1), 500);
    const exchanges = parseRequestedExchanges(searchParams);
    const cacheKey = exchanges.join(',');

    const now = Date.now();
    const cached = cacheByExchange.get(cacheKey);
    if (!cached || now - cached.lastFetchTime > CACHE_TTL) {
      const tickerResults = await Promise.allSettled(
        exchanges.map(async (exchange) => ({
          exchange,
          tickers: await getTopUSDTPairsByExchange(exchange, 500),
        }))
      );
      const successful = tickerResults
        .filter(
          (result): result is PromiseFulfilledResult<{ exchange: SupportedExchange; tickers: Awaited<ReturnType<typeof getTopUSDTPairsByExchange>> }> =>
            result.status === 'fulfilled'
        )
        .map((result) => result.value);

      if (successful.length === 0) {
        const emptyResponse: TopCoinsResponse & { warnings: string[] } = {
          coins: [],
          page: 1,
          totalPages: 1,
          total: 0,
          limit,
          timestamp: now,
          warnings: [
            `No live market data was returned for ${exchanges
              .map((exchange) => EXCHANGE_NAMES[exchange])
              .join(', ')}`,
          ],
        };
        return NextResponse.json(emptyResponse);
      }

      const bySymbol = new Map<string, TopCoin>();
      successful
        .flatMap((item) => item.tickers)
        .filter(
          (t) => t.symbol.endsWith('USDT') && !t.symbol.includes('DOWN') && !t.symbol.includes('UP')
        )
        .forEach((t) => {
          const row: TopCoin = {
            symbol: t.symbol,
            price: parseFloat(t.lastPrice),
            priceChange: parseFloat(t.priceChange),
            priceChangePercent: parseFloat(t.priceChangePercent),
            volume24h: parseFloat(t.quoteVolume),
            high24h: parseFloat(t.highPrice),
            low24h: parseFloat(t.lowPrice),
            rank: 0,
          };
          const existing = bySymbol.get(row.symbol);
          if (!existing || row.volume24h > existing.volume24h) {
            bySymbol.set(row.symbol, row);
          }
        });

      const computedCoins = Array.from(bySymbol.values())
        .sort((a, b) => b.volume24h - a.volume24h)
        .slice(0, 500)
        .map((coin, idx) => ({ ...coin, rank: idx + 1 }));
      cacheByExchange.set(cacheKey, {
        coins: computedCoins,
        lastFetchTime: now,
      });
    }

    // Apply sort
    const topCoins = cacheByExchange.get(cacheKey)?.coins ?? [];
    const sorted = [...topCoins].slice(0, total);
    switch (sort) {
      case 'change':
        sorted.sort((a, b) => b.priceChangePercent - a.priceChangePercent);
        break;
      case 'change_asc':
        sorted.sort((a, b) => a.priceChangePercent - b.priceChangePercent);
        break;
      case 'price':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'volume':
      default:
        // already sorted by volume from cache
        break;
    }

    const totalPages = Math.ceil(sorted.length / limit);
    const safePageNum = Math.min(page, totalPages);
    const start = (safePageNum - 1) * limit;
    const pageCoins = sorted.slice(start, start + limit);

    const response: TopCoinsResponse = {
      coins: pageCoins,
      page: safePageNum,
      totalPages,
      total: sorted.length,
      limit,
      timestamp: now,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Top coins error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top coins', details: String(error) },
      { status: 500 }
    );
  }
}
