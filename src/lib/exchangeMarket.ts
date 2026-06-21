import { BinanceTicker, Candle } from './types';

export type SupportedExchange = 'binance' | 'bitget' | 'mexc';

export const SUPPORTED_EXCHANGES: SupportedExchange[] = ['binance', 'bitget', 'mexc'];

const FETCH_TIMEOUT_MS = 8_000;
const HOUR_IN_MS = 60 * 60 * 1000;
const MEXC_KEY = process.env.MEXC_API_KEY?.trim();
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

type MexcKline = [
  number, // 0: openTime
  string, // 1: open
  string, // 2: high
  string, // 3: low
  string, // 4: close
  string, // 5: volume
  number, // 6: closeTime
  string, // 7: quoteVolume
  number, // 8: trades
  string, // 9: buyAssetVolume
  string, // 10: buyQuoteVolume
  string  // 11: ignore
];

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

async function fetchMexcTopUSDTPairs(topN: number): Promise<BinanceTicker[]> {
  const headers: Record<string, string> = {};
  if (MEXC_KEY) headers['X-MEXC-APIKEY'] = MEXC_KEY;

  const data = await fetchJson<BinanceTicker[]>(
    'https://api.mexc.com/api/v3/ticker/24hr',
    headers
  );

  return data
    .filter((t) => t.symbol.endsWith('USDT') && !t.symbol.includes('DOWN') && !t.symbol.includes('UP'))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, topN);
}

async function fetchMexcKlines(symbol: string, limit: number): Promise<Candle[]> {
  const headers: Record<string, string> = {};
  if (MEXC_KEY) headers['X-MEXC-APIKEY'] = MEXC_KEY;

  const cappedLimit = Math.min(Math.max(limit, 1), 1000);
  const data = await fetchJson<MexcKline[]>(
    `https://api.mexc.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=60m&limit=${cappedLimit}`,
    headers
  );

  return data
    .map((k) => ({
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    }))
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
    case 'mexc':
      return fetchMexcTopUSDTPairs(topN);
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
    case 'mexc': {
      try {
        const headers: Record<string, string> = {};
        if (MEXC_KEY) headers['X-MEXC-APIKEY'] = MEXC_KEY;
        const data = await fetchJson<BinanceTicker>(
          `https://api.mexc.com/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`,
          headers
        );
        return data || null;
      } catch {
        return null;
      }
    }
    case 'bitget': {
      try {
        const data = await fetchJson<{
          code?: string;
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
      } catch {
        return null;
      }
    }
    case 'binance':
    default: {
      try {
        const { fetch24hTickers } = await import('./binance');
        const tickers = await fetch24hTickers(symbol);
        return tickers[0] ?? null;
      } catch {
        return null;
      }
    }
  }
}

export async function fetchKlinesByExchange(
  exchange: SupportedExchange,
  symbol: string,
  limit = 100
): Promise<Candle[]> {
  switch (exchange) {
    case 'mexc':
      return fetchMexcKlines(symbol, limit);
    case 'bitget':
      return fetchBitgetKlines(symbol, limit);
    case 'binance':
    default: {
      const { fetchKlines } = await import('./binance');
      return fetchKlines(symbol, '1h', limit);
    }
  }
}
