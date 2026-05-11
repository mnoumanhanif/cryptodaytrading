import { NextResponse } from 'next/server';
import { analyzeEnhanced } from '@/lib/analyzer';
import {
  fetchKlinesByExchange,
  getTickerBySymbolByExchange,
  getTopUSDTPairsByExchange,
  isSupportedExchange,
  SupportedExchange,
} from '@/lib/exchangeMarket';
import { EnhancedCoinAnalysis } from '@/lib/types';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface OverviewTradeRow {
  exchange: SupportedExchange;
  symbol: string;
  price: number;
  priceChangePercent: number;
  volume24h: number;
  confidence: number;
  direction: 'LONG' | 'SHORT' | 'HOLD';
  entry: number;
  target: number;
  stopLoss: number;
  support: number | null;
  resistance: number | null;
  tradeDecision: EnhancedCoinAnalysis['enhancedTradeSignal']['tradeDecision'];
}

interface OverviewResponse {
  timestamp: number;
  source: SupportedExchange;
  sources: SupportedExchange[];
  warnings?: string[];
  uptrend: OverviewTradeRow[];
  downtrend: OverviewTradeRow[];
  scannedUniverse: number;
}

interface CoinSearchResponse {
  timestamp: number;
  source: SupportedExchange;
  sources: SupportedExchange[];
  searchedExchanges: SupportedExchange[];
  missingExchanges: SupportedExchange[];
  coin?: OverviewTradeRow;
  coins?: OverviewTradeRow[];
  error?: string;
}

type ExchangeTickerBatch = {
  exchange: SupportedExchange;
  tickers: Awaited<ReturnType<typeof getTopUSDTPairsByExchange>>;
};

type AnalyzedCoin = {
  key: string;
  exchange: SupportedExchange;
  coin: EnhancedCoinAnalysis;
};

type FulfilledTickerLookup = {
  exchange: SupportedExchange;
  ticker: Awaited<ReturnType<typeof getTickerBySymbolByExchange>>;
};

const TREND_LIST_LIMIT = 500;
const UNIVERSE_SIZE = 1000;
const BATCH_SIZE = 10;
const EXCHANGE_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
};

const marketOverviewQuerySchema = z.object({
  symbol: z.string().regex(/^[A-Za-z0-9]+$/).optional(),
});

function toOverviewRow(coin: EnhancedCoinAnalysis, exchange: SupportedExchange): OverviewTradeRow {
  const direction: 'LONG' | 'SHORT' | 'HOLD' =
    coin.risk.targetPrice < coin.risk.entryPrice
      ? 'SHORT'
      : coin.risk.targetPrice > coin.risk.entryPrice
        ? 'LONG'
        : 'HOLD';

  return {
    exchange,
    symbol: coin.symbol,
    price: coin.price,
    priceChangePercent: coin.priceChangePercent,
    volume24h: coin.volume24h,
    confidence: coin.tradeSignal.confidence,
    direction,
    entry: coin.risk.entryPrice,
    target: coin.risk.targetPrice,
    stopLoss: coin.risk.stopLoss,
    support: coin.indicators.fibonacci?.nearestSupport ?? null,
    resistance: coin.indicators.fibonacci?.nearestResistance ?? null,
    tradeDecision: coin.enhancedTradeSignal.tradeDecision,
  };
}

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
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const parsed = marketOverviewQuerySchema.safeParse({
      symbol: searchParams.get('symbol') ?? undefined,
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const exchanges = parseRequestedExchanges(searchParams);
    const symbolParam = parsed.data.symbol?.toUpperCase().trim();
    if (symbolParam) {
      const symbol = symbolParam.endsWith('USDT') ? symbolParam : `${symbolParam}USDT`;
      const tickerResults = await Promise.allSettled(
        exchanges.map(async (exchange) => ({
          exchange,
          ticker: await getTickerBySymbolByExchange(exchange, symbol),
        }))
      );

      const foundTickers = tickerResults
        .filter(
          (result): result is PromiseFulfilledResult<FulfilledTickerLookup> =>
            result.status === 'fulfilled' && Boolean(result.value.ticker)
        )
        .map((result) => ({
          exchange: result.value.exchange,
          ticker: result.value.ticker!,
        }));

      if (foundTickers.length === 0) {
        const exchangeList = exchanges.map((exchange) => EXCHANGE_NAMES[exchange]).join(', ');
        const response: CoinSearchResponse = {
          timestamp: Date.now(),
          source: exchanges[0],
          sources: [],
          searchedExchanges: exchanges,
          missingExchanges: exchanges,
          error: `Symbol not found on ${exchangeList}`,
        };
        return NextResponse.json(response, { status: 404 });
      }

      const analyzedResults = await Promise.allSettled(
        foundTickers.map(async ({ exchange, ticker }) => {
          const candles = await fetchKlinesByExchange(exchange, symbol, 120);
          const coin = analyzeEnhanced(ticker, candles);
          return toOverviewRow(coin, exchange);
        })
      );

      const coins = analyzedResults
        .filter((result): result is PromiseFulfilledResult<OverviewTradeRow> => result.status === 'fulfilled')
        .map((result) => result.value);

      if (coins.length === 0) {
        const response: CoinSearchResponse = {
          timestamp: Date.now(),
          source: foundTickers[0].exchange,
          sources: foundTickers.map((item) => item.exchange),
          searchedExchanges: exchanges,
          missingExchanges: exchanges,
          error: 'Coin data found, but analysis failed across selected exchanges',
        };
        return NextResponse.json(response, { status: 500 });
      }

      const sources = coins.map((item) => item.exchange);
      const sourceSet = new Set(sources);
      const response: CoinSearchResponse = {
        timestamp: Date.now(),
        source: coins[0].exchange,
        sources,
        searchedExchanges: exchanges,
        missingExchanges: exchanges.filter((exchange) => !sourceSet.has(exchange)),
        coin: coins[0],
        coins,
      };
      return NextResponse.json(response);
    }

    const limit = TREND_LIST_LIMIT;
    const tickerResults = await Promise.allSettled(
      exchanges.map(async (exchange) => ({
        exchange,
        tickers: await getTopUSDTPairsByExchange(exchange, UNIVERSE_SIZE),
      }))
    );
    const successful = tickerResults
      .filter(
        (result): result is PromiseFulfilledResult<ExchangeTickerBatch> => result.status === 'fulfilled'
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
      const requestedNames = exchanges.map((exchange) => EXCHANGE_NAMES[exchange]).join(', ');
      const response: OverviewResponse = {
        timestamp: Date.now(),
        source: exchanges[0],
        sources: [exchanges[0]],
        warnings: [
          `No live market data was returned for ${requestedNames}.`,
          ...(failed.length > 0 ? failed : []),
        ],
        uptrend: [],
        downtrend: [],
        scannedUniverse: 0,
      };
      return NextResponse.json(response);
    }

    const allTickers = successful.flatMap(({ exchange, tickers }) =>
      tickers.map((ticker) => ({ exchange, ticker }))
    );

    const upCandidates = [...allTickers]
      .filter((item) => parseFloat(item.ticker.priceChangePercent) >= 0)
      .sort((a, b) => parseFloat(b.ticker.priceChangePercent) - parseFloat(a.ticker.priceChangePercent))
      .slice(0, limit);

    const downCandidates = [...allTickers]
      .filter((item) => parseFloat(item.ticker.priceChangePercent) < 0)
      .sort((a, b) => parseFloat(a.ticker.priceChangePercent) - parseFloat(b.ticker.priceChangePercent))
      .slice(0, limit);

    const selected = [...upCandidates, ...downCandidates];
    const analyzed: AnalyzedCoin[] = [];
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async ({ exchange, ticker }) => {
          const candles = await fetchKlinesByExchange(exchange, ticker.symbol, 120);
          const coin = analyzeEnhanced(ticker, candles);
          return { key: `${exchange}:${ticker.symbol}`, exchange, coin };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') analyzed.push(result.value);
      }
    }

    const bySymbol = new Map(analyzed.map((item) => [item.key, item]));
    const uptrend = upCandidates
      .map(({ exchange, ticker }) => bySymbol.get(`${exchange}:${ticker.symbol}`))
      .filter((item): item is AnalyzedCoin => Boolean(item))
      .map(({ coin, exchange }) => toOverviewRow(coin, exchange));
    const downtrend = downCandidates
      .map(({ exchange, ticker }) => bySymbol.get(`${exchange}:${ticker.symbol}`))
      .filter((item): item is AnalyzedCoin => Boolean(item))
      .map(({ coin, exchange }) => toOverviewRow(coin, exchange));

    const response: OverviewResponse = {
      timestamp: Date.now(),
      source: successful[0].exchange,
      sources: successful.map((item) => item.exchange),
      ...(failed.length > 0 ? { warnings: failed } : {}),
      uptrend,
      downtrend,
      scannedUniverse: successful.reduce((acc, item) => acc + item.tickers.length, 0),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Market overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch market overview', details: String(error) },
      { status: 500 }
    );
  }
}
