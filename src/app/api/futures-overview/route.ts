import { NextResponse } from 'next/server';
import { analyzeEnhanced } from '@/lib/analyzer';
import { BinanceTicker, Candle, EnhancedCoinAnalysis } from '@/lib/types';
import { fetch24hTickers, fetchKlines } from '@/lib/binance';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface FuturesTicker24h {
  symbol: string;
  lastPrice: string;
  priceChange: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

interface FuturesTradeRow {
  symbol: string;
  price: number;
  priceChangePercent: number;
  volume24h: number;
  confidence: number;
  direction: 'LONG' | 'SHORT' | 'HOLD';
  entry: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  support: number | null;
  resistance: number | null;
}

const BASE_URLS = [
  'https://fapi.binance.com',
  'https://fapi1.binance.com',
  'https://fapi2.binance.com',
  'https://fapi3.binance.com',
] as const;
const FETCH_TIMEOUT_MS = 8_000;
const BATCH_SIZE = 10;
const TREND_LIST_LIMIT = 80;
const UNIVERSE_SIZE = 260;
const API_KEY = process.env.BINANCE_FUTURES_API_KEY?.trim() || process.env.BINANCE_API_KEY?.trim();

type BinanceFuturesKline = [
  number,
  string,
  string,
  string,
  string,
  string,
  number,
  string,
  number,
  string,
  string,
  string
];

function toOverviewRow(coin: EnhancedCoinAnalysis): FuturesTradeRow {
  const direction: 'LONG' | 'SHORT' | 'HOLD' =
    coin.risk.targetPrice < coin.risk.entryPrice
      ? 'SHORT'
      : coin.risk.targetPrice > coin.risk.entryPrice
        ? 'LONG'
        : 'HOLD';

  return {
    symbol: coin.symbol,
    price: coin.price,
    priceChangePercent: coin.priceChangePercent,
    volume24h: coin.volume24h,
    confidence: coin.tradeSignal.confidence,
    direction,
    entry: coin.risk.entryPrice,
    target1: coin.risk.takeProfit1,
    target2: coin.risk.takeProfit2,
    target3: coin.risk.takeProfit3,
    stopLoss: coin.risk.stopLoss,
    support: coin.indicators.fibonacci?.nearestSupport ?? null,
    resistance: coin.indicators.fibonacci?.nearestResistance ?? null,
  };
}

async function fetchFuturesWithRetry(endpoint: string): Promise<Response> {
  let lastError: Error | null = null;
  let lastHttpResponse: Response | null = null;

  for (const baseUrl of BASE_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      if (API_KEY) headers['X-MBX-APIKEY'] = API_KEY;

      const res = await fetch(`${baseUrl}${endpoint}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers,
      });

      if (res.ok) return res;
      lastHttpResponse = res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastHttpResponse) return lastHttpResponse;
  throw lastError ?? new Error('Binance futures API request failed');
}

async function fetchFuturesTickers(symbol?: string): Promise<BinanceTicker[]> {
  try {
    const endpoint = symbol
      ? `/fapi/v1/ticker/24hr?symbol=${encodeURIComponent(symbol)}`
      : '/fapi/v1/ticker/24hr';
    const res = await fetchFuturesWithRetry(endpoint);
    if (!res.ok) return [];

    const payload = (await res.json()) as FuturesTicker24h | FuturesTicker24h[];
    const tickers = Array.isArray(payload) ? payload : [payload];

    return tickers.map((ticker) => ({
      symbol: ticker.symbol,
      priceChange: ticker.priceChange,
      priceChangePercent: ticker.priceChangePercent,
      weightedAvgPrice: ticker.lastPrice,
      lastPrice: ticker.lastPrice,
      volume: ticker.quoteVolume,
      quoteVolume: ticker.quoteVolume,
      openPrice: String(parseFloat(ticker.lastPrice) - parseFloat(ticker.priceChange)),
      highPrice: ticker.highPrice,
      lowPrice: ticker.lowPrice,
      count: 0,
    }));
  } catch {
    try {
      return await fetch24hTickers(symbol);
    } catch {
      return [];
    }
  }
}

async function fetchFuturesKlines(symbol: string, limit = 120): Promise<Candle[]> {
  try {
    const cappedLimit = Math.min(Math.max(limit, 1), 1000);
    const res = await fetchFuturesWithRetry(
      `/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=1h&limit=${cappedLimit}`
    );
    if (!res.ok) {
      throw new Error(`Binance futures klines error: ${res.status} ${res.statusText}`);
    }

    const raw = (await res.json()) as BinanceFuturesKline[];
    return raw.map((k) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }));
  } catch {
    try {
      return await fetchKlines(symbol, '1h', limit);
    } catch {
      throw new Error(`Unable to fetch kline data for ${symbol}`);
    }
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbolParam = searchParams.get('symbol')?.toUpperCase().trim();

    if (symbolParam) {
      if (!/^[A-Z0-9]+$/.test(symbolParam)) {
        return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
      }
      const symbol = symbolParam.endsWith('USDT') ? symbolParam : `${symbolParam}USDT`;
      const ticker = (await fetchFuturesTickers(symbol))[0];
      if (!ticker) {
        return NextResponse.json({ error: 'Futures symbol not found on Binance' }, { status: 404 });
      }

      const candles = await fetchFuturesKlines(symbol, 120);
      const coin = analyzeEnhanced(ticker, candles);

      return NextResponse.json({
        timestamp: Date.now(),
        source: 'binance-futures',
        coin: toOverviewRow(coin),
      });
    }

    const allTickers = await fetchFuturesTickers();
    const futuresUniverse = allTickers
      .filter((ticker) => ticker.symbol.endsWith('USDT'))
      .filter((ticker) => !ticker.symbol.includes('_'))
      .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
      .slice(0, UNIVERSE_SIZE);

    const topLongCandidates = [...futuresUniverse]
      .filter((item) => parseFloat(item.priceChangePercent) >= 0)
      .sort((a, b) => parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent))
      .slice(0, TREND_LIST_LIMIT);
    const topShortCandidates = [...futuresUniverse]
      .filter((item) => parseFloat(item.priceChangePercent) < 0)
      .sort((a, b) => parseFloat(a.priceChangePercent) - parseFloat(b.priceChangePercent))
      .slice(0, TREND_LIST_LIMIT);

    const selected = [...topLongCandidates, ...topShortCandidates];
    const analyzed = new Map<string, EnhancedCoinAnalysis>();
    for (let i = 0; i < selected.length; i += BATCH_SIZE) {
      const batch = selected.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const candles = await fetchFuturesKlines(ticker.symbol, 120);
          const coin = analyzeEnhanced(ticker, candles);
          return { key: ticker.symbol, coin };
        })
      );
      for (const result of results) {
        if (result.status === 'fulfilled') analyzed.set(result.value.key, result.value.coin);
      }
    }

    const topLongs = topLongCandidates
      .map((ticker) => analyzed.get(ticker.symbol))
      .filter((coin): coin is EnhancedCoinAnalysis => Boolean(coin))
      .map(toOverviewRow);
    const topShorts = topShortCandidates
      .map((ticker) => analyzed.get(ticker.symbol))
      .filter((coin): coin is EnhancedCoinAnalysis => Boolean(coin))
      .map(toOverviewRow);

    return NextResponse.json({
      timestamp: Date.now(),
      source: 'binance-futures',
      ...(API_KEY ? {} : { warnings: ['BINANCE_FUTURES_API_KEY is not set, using public futures market data endpoints'] }),
      topLongs,
      topShorts,
      scannedUniverse: futuresUniverse.length,
    });
  } catch (error) {
    console.error('Futures overview error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Binance futures overview', details: String(error) },
      { status: 500 }
    );
  }
}
