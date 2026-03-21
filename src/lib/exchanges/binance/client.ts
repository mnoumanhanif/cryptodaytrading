import { BaseExchange, ExchangeTicker } from '../baseExchange';
import { BINANCE_TICKER_24HR_ENDPOINT } from './endpoints';

interface BinanceTicker24h {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  quoteVolume: string;
  highPrice: string;
  lowPrice: string;
}

const BINANCE_PUBLIC_BASE_URLS = [
  'https://api.binance.com',
  'https://api-gcp.binance.com',
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://api4.binance.com',
] as const;

export class BinanceExchangeClient extends BaseExchange {
  constructor() {
    super('binance', BINANCE_PUBLIC_BASE_URLS);
  }

  async fetch24hTickers(): Promise<ExchangeTicker[]> {
    const data = await this.fetchJson<BinanceTicker24h[]>(BINANCE_TICKER_24HR_ENDPOINT);

    return data
      .filter((ticker) => ticker.symbol.endsWith('USDT'))
      .filter((ticker) => !ticker.symbol.includes('UP') && !ticker.symbol.includes('DOWN'))
      .map((ticker) => ({
        exchange: 'binance',
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        priceChangePercent: parseFloat(ticker.priceChangePercent),
        quoteVolume: parseFloat(ticker.quoteVolume),
        highPrice: parseFloat(ticker.highPrice),
        lowPrice: parseFloat(ticker.lowPrice),
      }));
  }
}
