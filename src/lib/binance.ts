// ============================================================
// Binance market API client
// ============================================================

import { BinanceTicker, Candle } from './types';
import { memCache } from './cache';

const BASE_URLS = [
  'https://data-api.binance.vision',
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
] as const;
const TICKER_CACHE_TTL = 30_000; // 30 seconds
const MAX_RETRIES = 2; // retries full endpoint pass across BASE_URLS
const FETCH_TIMEOUT_MS = 8_000; // 8s — fits comfortably within Vercel's function limit

const BINANCE_KEY = process.env.BINANCE_API_KEY?.trim();
type BinanceKline = [
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

/** Fetch with exponential backoff retry logic.
 *  Only network-level failures (thrown errors) are retried;
 *  HTTP error responses (4xx/5xx) are returned as-is to callers. */
async function fetchWithRetry(endpoint: string, attempt = 0): Promise<Response> {
  let lastError: Error | null = null;
  let lastHttpResponse: Response | null = null;

  for (const baseUrl of BASE_URLS) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const headers: Record<string, string> = {};
      if (BINANCE_KEY) headers['X-MBX-APIKEY'] = BINANCE_KEY;

      const res = await fetch(`${baseUrl}${endpoint}`, {
        cache: 'no-store',
        signal: controller.signal,
        headers,
      });
      if (res.ok) {
        return res;
      }
      lastHttpResponse = res;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    } finally {
      clearTimeout(timeoutId);
    }
  }

  if (lastHttpResponse) {
    return lastHttpResponse;
  }

  if (attempt < MAX_RETRIES - 1) {
    const delay = Math.min(1000 * 2 ** attempt, 8000);
    await new Promise((r) => setTimeout(r, delay));
    return fetchWithRetry(endpoint, attempt + 1);
  }

  throw lastError ?? new Error('Binance API request failed');
}

/** Fetch 24h ticker data for all USDT pairs or a specific symbol.
 *  Bulk responses are cached in-memory to avoid Next.js 2MB cache limit. */
export async function fetch24hTickers(symbol?: string): Promise<BinanceTicker[]> {
  if (symbol) {
    const endpoint = `/api/v3/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetchWithRetry(endpoint);
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as BinanceTicker;
    return [data];
  }

  const cacheKey = 'all_tickers';
  const cached = memCache.get<BinanceTicker[]>(cacheKey);
  if (cached) return cached;

  const endpoint = '/api/v3/ticker/24hr';
  const res = await fetchWithRetry(endpoint);
  if (!res.ok) {
    return [];
  }

  const tickers = (await res.json()) as BinanceTicker[];
  memCache.set(cacheKey, tickers, TICKER_CACHE_TTL);
  return tickers;
}

/** Get top USDT trading pairs by quote volume (default top 100) */
export async function getTopUSDTPairs(topN = 100): Promise<BinanceTicker[]> {
  const allTickers = await fetch24hTickers();
  const usdtPairs = allTickers
    .filter((t) => t.symbol.endsWith('USDT'))
    .filter((t) => !t.symbol.includes('DOWN') && !t.symbol.includes('UP'))
    .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
    .slice(0, topN);
  return usdtPairs;
}

/** Fetch candlestick/kline data */
export async function fetchKlines(
  symbol: string,
  interval: string = '1h',
  limit: number = 100
): Promise<Candle[]> {
  const cappedLimit = Math.min(Math.max(limit, 1), 1000);
  const endpoint = `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${encodeURIComponent(interval)}&limit=${cappedLimit}`;
  const res = await fetchWithRetry(endpoint);
  if (!res.ok) {
    throw new Error(`Binance klines error: ${res.status} ${res.statusText}`);
  }

  const raw = (await res.json()) as BinanceKline[];
  return raw.map((k) => {
    return {
      openTime: k[0],
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
      closeTime: k[6],
    };
  });
}

/** Fetch current price for a symbol */
export async function fetchPrice(symbol: string): Promise<number> {
  const endpoint = `/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`;
  const res = await fetchWithRetry(endpoint);
  if (!res.ok) {
    throw new Error(`Binance price error: ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as { price?: string };
  if (!data.price) {
    throw new Error(`Binance symbol not found: ${symbol}`);
  }
  return parseFloat(data.price);
}
