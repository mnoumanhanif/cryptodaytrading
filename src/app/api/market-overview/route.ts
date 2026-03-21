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

type ExchangeTickerBatch = {
  exchange: SupportedExchange;
  tickers: Awaited<ReturnType<typeof getTopUSDTPairsByExchange>>;
};

type AnalyzedCoin = {
  key: string;
  exchange: SupportedExchange;
  coin: EnhancedCoinAnalysis;
};

const TREND_LIST_LIMIT = 100;
const UNIVERSE_SIZE = 1000;
const BATCH_SIZE = 10;
const EXCHANGE_NAMES: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
};

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
    const { searchParams } = new URL(request.url);
    const exchanges = parseRequestedExchanges(searchParams);
    const symbolParam = searchParams.get('symbol')?.toUpperCase().trim();
    if (symbolParam) {
      if (!/^[A-Z0-9]+$/.test(symbolParam)) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
      }
      const symbol = symbolParam.endsWith('USDT') ? symbolParam : `${symbolParam}USDT`;
      let source: SupportedExchange | null = null;
      let ticker = null;
      for (const exchange of exchanges) {
        const found = await getTickerBySymbolByExchange(exchange, symbol);
        if (found) {
          source = exchange;
          ticker = found;
          break;
        }
      }
      if (!ticker || !source) {
        const exchangeList = exchanges.map((exchange) => EXCHANGE_NAMES[exchange]).join(', ');
        return NextResponse.json({ error: `Symbol not found on ${exchangeList}` }, { status: 404 });
      }
      const candles = await fetchKlinesByExchange(source, symbol, 120);
      const coin = analyzeEnhanced(ticker, candles);
      return NextResponse.json({
        timestamp: Date.now(),
        source,
        sources: [source],
        coin: toOverviewRow(coin, source),
      });
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
