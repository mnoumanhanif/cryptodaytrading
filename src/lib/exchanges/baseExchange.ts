// ============================================================
// Shared exchange client abstractions
// ============================================================

export interface ExchangeTicker {
  exchange: 'binance' | 'bybit';
  symbol: string;
  lastPrice: number;
  priceChangePercent: number;
  quoteVolume: number;
  highPrice: number;
  lowPrice: number;
}

const FETCH_TIMEOUT_MS = 8_000;

export abstract class BaseExchange {
  private readonly baseUrls: readonly string[];

  constructor(
    protected readonly exchange: 'binance' | 'bybit',
    baseUrl: string | readonly string[]
  ) {
    this.baseUrls = Array.isArray(baseUrl) ? baseUrl : [baseUrl];
  }

  protected async fetchJson<T>(endpoint: string): Promise<T> {
    let lastError: Error | null = null;

    for (const baseUrl of this.baseUrls) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          cache: 'no-store',
          signal: controller.signal,
        });
        if (!res.ok) {
          throw new Error(`${this.exchange} API error: ${res.status} ${res.statusText}`);
        }
        return (await res.json()) as T;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (lastError) {
      throw new Error(
        `${this.exchange} API request failed across ${this.baseUrls.length} endpoint(s): ${lastError.message}`
      );
    }

    throw new Error(`${this.exchange} API request failed`);
  }

  abstract fetch24hTickers(): Promise<ExchangeTicker[]>;
}
