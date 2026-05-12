// ============================================================
// Coin search API – search any USDT pair beyond the default scanner universe
// GET /api/coins/search?q=SOL&limit=50
// ============================================================

import { NextResponse } from 'next/server';
import { analyzeCoin } from '@/lib/analyzer';
import { BinanceTicker, CoinAnalysis } from '@/lib/types';
import {
  SupportedExchange,
  fetchKlinesByExchange,
  getTickerBySymbolByExchange,
  getTopUSDTPairsByExchange,
  isSupportedExchange,
} from '@/lib/exchangeMarket';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const coinsSearchQuerySchema = z.object({
  q: z.string().min(1).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
  symbol: z.string().min(1).max(20).regex(/^[A-Za-z0-9]+$/).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
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
  return ['binance'];
}

export async function GET(request: Request) {
  try {
    const contextOrResponse = await requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const parsed = coinsSearchQuerySchema.safeParse({
      q: searchParams.get('q') ?? undefined,
      symbol: searchParams.get('symbol') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const exchanges = parseRequestedExchanges(searchParams);
    const query = parsed.data.q?.toUpperCase() ?? '';
    const exactSymbol = parsed.data.symbol?.toUpperCase();
    const limit = parsed.data.limit ?? 50;

    // If an exact symbol is requested (e.g. SOLUSDT), analyze just that pair
    if (exactSymbol) {
      // Validate the raw symbol contains only alphanumeric characters
      if (!/^[A-Z0-9]+$/.test(exactSymbol)) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
      }
      const symbol = exactSymbol.endsWith('USDT') ? exactSymbol : `${exactSymbol}USDT`;
      const found = await Promise.allSettled(
        exchanges.map(async (exchange) => {
          const ticker = await getTickerBySymbolByExchange(exchange, symbol);
          if (!ticker) return null;
          const candles = await fetchKlinesByExchange(exchange, symbol, 100);
          return analyzeCoin(ticker, candles);
        })
      );
      const coins = found
        .filter((item): item is PromiseFulfilledResult<CoinAnalysis | null> => item.status === 'fulfilled')
        .map((item) => item.value)
        .filter((item): item is CoinAnalysis => item != null);
      if (!coins.length) {
        return NextResponse.json(
          { error: `Symbol not found on exchanges: ${exchanges.join(', ')}` },
          { status: 404 }
        );
      }
      coins.sort((a, b) => b.score - a.score);
      return NextResponse.json({ coins, totalScanned: coins.length });
    }

    // Search all USDT pairs that match the query
    if (!query) {
      return NextResponse.json({ error: 'Provide q or symbol param' }, { status: 400 });
    }

    const tickerResults = await Promise.allSettled(
      exchanges.map(async (exchange) => ({
        exchange,
        tickers: await getTopUSDTPairsByExchange(exchange, 500),
      }))
    );
    const successful = tickerResults
      .filter(
        (result): result is PromiseFulfilledResult<{ exchange: SupportedExchange; tickers: BinanceTicker[] }> =>
          result.status === 'fulfilled'
      )
      .map((result) => result.value);
    const matched = successful
      .flatMap(({ exchange, tickers }) =>
        tickers
          .filter(
            (t) =>
              t.symbol.endsWith('USDT') &&
              !t.symbol.includes('DOWN') &&
              !t.symbol.includes('UP') &&
              t.symbol.includes(query)
          )
          .map((ticker) => ({ exchange, ticker }))
      )
      .sort((a, b) => parseFloat(b.ticker.quoteVolume) - parseFloat(a.ticker.quoteVolume))
      .slice(0, limit);

    if (!matched.length) {
      return NextResponse.json({ coins: [], totalScanned: 0 });
    }

    const coins: CoinAnalysis[] = [];
    const results = await Promise.allSettled(
      matched.map(async ({ exchange, ticker }) => {
        const candles = await fetchKlinesByExchange(exchange, ticker.symbol, 100);
        return analyzeCoin(ticker, candles);
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') coins.push(r.value);
    }
    coins.sort((a, b) => b.score - a.score);

    return NextResponse.json({ coins, totalScanned: matched.length });
  } catch (error) {
    console.error('Coin search error:', error);
    return NextResponse.json(
      { error: 'Search failed', details: String(error) },
      { status: 500 }
    );
  }
}
