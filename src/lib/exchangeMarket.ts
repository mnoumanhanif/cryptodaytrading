import { BinanceTicker, Candle } from './types';

export type SupportedExchange = 'binance' | 'bybit' | 'bitget';

export const SUPPORTED_EXCHANGES: SupportedExchange[] = ['binance', 'bybit', 'bitget'];

const FETCH_TIMEOUT_MS = 8_000;
const HOUR_IN_MS = 60 * 60 * 1000;
const BYBIT_KEY = process.env.BYBIT_API_KEY?.trim();
const BITGET_KEY = process.env.BITGET_API_KEY?.trim();
const COINGECKO_KEY = process.env.COINGECKO_API_KEY?.trim();
const COINGECKO_KEY_HEADER =
  process.env.COINGECKO_API_KEY_HEADER?.trim()?.toLowerCase() === 'pro'
    ? 'x-cg-pro-api-key'
    : 'x-cg-demo-api-key';

function normalizePercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function calculatePriceChangeFromPercent(lastPrice: number, percent: number): number {
  if (!Number.isFinite(lastPrice) || !Number.isFinite(percent)) return 0;
  const ratio = 1 + percent / 100;
  if (ratio === 0) return 0;
  const openPrice = lastPrice / ratio;
  return lastPrice - openPrice;
}

function calculateOpenPriceFromPercent(lastPrice: number, percent: number): number {
  if (!Number.isFinite(lastPrice) || !Number.isFinite(percent)) return lastPrice;
  const ratio = 1 + percent / 100;
  if (ratio === 0) return lastPrice;
  return lastPrice / ratio;
}

async function fetchJson<T>(url: string, headers?: Record<string, string>): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const requestHeaders: Record<string, string> = { ...(headers ?? {}) };
    if (url.startsWith('https://api.coingecko.com/api/v3') && COINGECKO_KEY) {
      requestHeaders[COINGECKO_KEY_HEADER] = COINGECKO_KEY;
    }
    const res = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: requestHeaders,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

interface BybitTickerResponse {
  result?: {
    list?: Array<{
      symbol: string;
      lastPrice: string;
      price24hPcnt: string;
      turnover24h: string;
      highPrice24h: string;
      lowPrice24h: string;
    }>;
  };
}

interface BybitKlineResponse {
  result?: {
    list?: string[][];
  };
}

interface BitgetTickerResponse {
  data?: Array<{
    symbol: string;
    lastPr: string;
    change24h: string;
    usdtVol?: string;
    quoteVol?: string;
    high24h: string;
    low24h: string;
  }>;
}

interface BitgetKlineResponse {
  data?: string[][];
}

export function isSupportedExchange(value: string | null | undefined): value is SupportedExchange {
  return value != null && SUPPORTED_EXCHANGES.includes(value as SupportedExchange);
}

async function fetchBybitTopUSDTPairs(topN: number): Promise<BinanceTicker[]> {
  const data = await fetchJson<BybitTickerResponse>(
    'https://api.bybit.com/v5/market/tickers?category=linear',
    BYBIT_KEY ? { 'X-BAPI-API-KEY': BYBIT_KEY } : undefined
  );
  const list = data.result?.list ?? [];

  return list
    .filter((t) => t.symbol.endsWith('USDT'))
    .map((ticker) => {
      const lastPrice = parseFloat(ticker.lastPrice);
      const pctRatio = parseFloat(ticker.price24hPcnt);
      const pct = normalizePercent(pctRatio);
      const priceChange = calculatePriceChangeFromPercent(lastPrice, pct);
      const openPrice = calculateOpenPriceFromPercent(lastPrice, pct);
      return {
        symbol: ticker.symbol,
        priceChange: String(priceChange),
        priceChangePercent: String(pct),
        weightedAvgPrice: ticker.lastPrice,
        lastPrice: ticker.lastPrice,
        volume: ticker.turnover24h,
        quoteVolume: ticker.turnover24h,
        openPrice: String(openPrice),
        highPrice: ticker.highPrice24h,
        lowPrice: ticker.lowPrice24h,
        count: 0,
      };
    })
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, topN);
}

async function fetchBybitKlines(symbol: string, limit: number): Promise<Candle[]> {
  const data = await fetchJson<BybitKlineResponse>(
    `https://api.bybit.com/v5/market/kline?category=linear&symbol=${encodeURIComponent(symbol)}&interval=60&limit=${Math.min(Math.max(limit, 1), 1000)}`,
    BYBIT_KEY ? { 'X-BAPI-API-KEY': BYBIT_KEY } : undefined
  );
  const list = data.result?.list ?? [];

  return list
    .map((k) => {
      const openTime = Number(k[0]);
      return {
        openTime,
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: openTime + HOUR_IN_MS - 1,
      };
    })
    .sort((a, b) => a.openTime - b.openTime);
}

async function fetchBitgetTopUSDTPairs(topN: number): Promise<BinanceTicker[]> {
  const data = await fetchJson<BitgetTickerResponse>(
    'https://api.bitget.com/api/v2/spot/market/tickers',
    BITGET_KEY ? { 'ACCESS-KEY': BITGET_KEY } : undefined
  );
  const list = data.data ?? [];

  return list
    .filter((t) => t.symbol.endsWith('USDT'))
    .map((ticker) => {
      const rawPercent = parseFloat(ticker.change24h);
      const pct = normalizePercent(rawPercent);
      const lastPrice = parseFloat(ticker.lastPr);
      const priceChange = calculatePriceChangeFromPercent(lastPrice, pct);
      const openPrice = calculateOpenPriceFromPercent(lastPrice, pct);
      const quoteVolume = ticker.usdtVol ?? ticker.quoteVol ?? '0';
      return {
        symbol: ticker.symbol,
        priceChange: String(priceChange),
        priceChangePercent: String(pct),
        weightedAvgPrice: ticker.lastPr,
        lastPrice: ticker.lastPr,
        volume: quoteVolume,
        quoteVolume,
        openPrice: String(openPrice),
        highPrice: ticker.high24h,
        lowPrice: ticker.low24h,
        count: 0,
      };
    })
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, topN);
}

async function fetchBitgetKlines(symbol: string, limit: number): Promise<Candle[]> {
  const data = await fetchJson<BitgetKlineResponse>(
    `https://api.bitget.com/api/v2/spot/market/candles?symbol=${encodeURIComponent(symbol)}&granularity=1h&limit=${Math.min(Math.max(limit, 1), 1000)}`,
    BITGET_KEY ? { 'ACCESS-KEY': BITGET_KEY } : undefined
  );
  const list = data.data ?? [];
  return list
    .map((k) => ({
      openTime: Number(k[0]),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: Number(k[0]) + HOUR_IN_MS - 1,
    }))
    .sort((a, b) => a.openTime - b.openTime);
}

export async function getTopUSDTPairsByExchange(
  exchange: SupportedExchange,
  topN: number
): Promise<BinanceTicker[]> {
  switch (exchange) {
    case 'bybit':
      return fetchBybitTopUSDTPairs(topN);
    case 'bitget':
      return fetchBitgetTopUSDTPairs(topN);
    case 'binance':
    default: {
      const { getTopUSDTPairs } = await import('./binance');
      return getTopUSDTPairs(topN);
    }
  }
}

export async function getTickerBySymbolByExchange(
  exchange: SupportedExchange,
  symbol: string
): Promise<BinanceTicker | null> {
  switch (exchange) {
    case 'bybit': {
      const data = await fetchJson<BybitTickerResponse>(
        `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${encodeURIComponent(symbol)}`,
        BYBIT_KEY ? { 'X-BAPI-API-KEY': BYBIT_KEY } : undefined
      );
      const ticker = data.result?.list?.find((item) => item.symbol === symbol);
      if (!ticker) return null;
      const lastPrice = parseFloat(ticker.lastPrice);
      const pct = normalizePercent(parseFloat(ticker.price24hPcnt));
      const priceChange = calculatePriceChangeFromPercent(lastPrice, pct);
      const openPrice = calculateOpenPriceFromPercent(lastPrice, pct);
      return {
        symbol: ticker.symbol,
        priceChange: String(priceChange),
        priceChangePercent: String(pct),
        weightedAvgPrice: ticker.lastPrice,
        lastPrice: ticker.lastPrice,
        volume: ticker.turnover24h,
        quoteVolume: ticker.turnover24h,
        openPrice: String(openPrice),
        highPrice: ticker.highPrice24h,
        lowPrice: ticker.lowPrice24h,
        count: 0,
      };
    }
    case 'bitget': {
      const data = await fetchJson<{
        data?: {
          symbol: string;
          lastPr: string;
          change24h: string;
          usdtVol?: string;
          quoteVol?: string;
          high24h: string;
          low24h: string;
        };
      }>(
        `https://api.bitget.com/api/v2/spot/market/ticker?symbol=${encodeURIComponent(symbol)}`,
        BITGET_KEY ? { 'ACCESS-KEY': BITGET_KEY } : undefined
      );
      const ticker = data.data;
      if (!ticker || ticker.symbol !== symbol) return null;
      const pct = normalizePercent(parseFloat(ticker.change24h));
      const lastPrice = parseFloat(ticker.lastPr);
      const priceChange = calculatePriceChangeFromPercent(lastPrice, pct);
      const openPrice = calculateOpenPriceFromPercent(lastPrice, pct);
      const quoteVolume = ticker.usdtVol ?? ticker.quoteVol ?? '0';
      return {
        symbol: ticker.symbol,
        priceChange: String(priceChange),
        priceChangePercent: String(pct),
        weightedAvgPrice: ticker.lastPr,
        lastPrice: ticker.lastPr,
        volume: quoteVolume,
        quoteVolume,
        openPrice: String(openPrice),
        highPrice: ticker.high24h,
        lowPrice: ticker.low24h,
        count: 0,
      };
    }
    case 'binance':
    default: {
      const { fetch24hTickers } = await import('./binance');
      const tickers = await fetch24hTickers(symbol);
      return tickers[0] ?? null;
    }
  }
}

export async function fetchKlinesByExchange(
  exchange: SupportedExchange,
  symbol: string,
  limit = 100
): Promise<Candle[]> {
  switch (exchange) {
    case 'bybit':
      return fetchBybitKlines(symbol, limit);
    case 'bitget':
      return fetchBitgetKlines(symbol, limit);
    case 'binance':
    default: {
      const { fetchKlines } = await import('./binance');
      return fetchKlines(symbol, '1h', limit);
    }
  }
}
