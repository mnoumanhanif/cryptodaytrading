import { BaseExchange, ExchangeTicker } from '../baseExchange';
import { BYBIT_TICKER_24HR_ENDPOINT } from './endpoints';

interface BybitTicker24h {
  symbol: string;
  lastPrice: string;
  price24hPcnt: string;
  turnover24h: string;
  highPrice24h: string;
  lowPrice24h: string;
}

interface BybitTickerResponse {
  result?: {
    list?: BybitTicker24h[];
  };
}

export class BybitExchangeClient extends BaseExchange {
  constructor() {
    super('bybit', 'https://api.bybit.com');
  }

  async fetch24hTickers(): Promise<ExchangeTicker[]> {
    const data = await this.fetchJson<BybitTickerResponse>(BYBIT_TICKER_24HR_ENDPOINT);
    const list = data.result?.list ?? [];

    return list
      .filter((ticker) => ticker.symbol.endsWith('USDT'))
      .map((ticker) => ({
        exchange: 'bybit',
        symbol: ticker.symbol,
        lastPrice: parseFloat(ticker.lastPrice),
        // Bybit returns price24hPcnt as a decimal ratio (e.g. 0.0123 = 1.23%).
        priceChangePercent: parseFloat(ticker.price24hPcnt) * 100,
        quoteVolume: parseFloat(ticker.turnover24h),
        highPrice: parseFloat(ticker.highPrice24h),
        lowPrice: parseFloat(ticker.lowPrice24h),
      }));
  }
}
