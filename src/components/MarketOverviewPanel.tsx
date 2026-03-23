'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatPrice, formatVolume } from '@/lib/utils';
import { SupportedExchange } from '@/lib/exchangeMarket';

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

interface MarketOverviewResponse {
  timestamp: number;
  source: SupportedExchange;
  sources?: SupportedExchange[];
  warnings?: string[];
  uptrend: OverviewTradeRow[];
  downtrend: OverviewTradeRow[];
  scannedUniverse: number;
}

interface CoinSearchResponse {
  timestamp: number;
  source: SupportedExchange;
  sources?: SupportedExchange[];
  searchedExchanges?: SupportedExchange[];
  missingExchanges?: SupportedExchange[];
  coin?: OverviewTradeRow;
  coins?: OverviewTradeRow[];
  error?: string;
}

const EXCHANGE_LABELS: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
};
const SEARCH_DEBOUNCE_MS = 300;

interface MarketOverviewPanelProps {
  selectedExchanges: SupportedExchange[];
}

export default function MarketOverviewPanel({ selectedExchanges }: MarketOverviewPanelProps) {
  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResult, setSearchResult] = useState<OverviewTradeRow | null>(null);
  const [searchResults, setSearchResults] = useState<OverviewTradeRow[]>([]);
  const [searchStatus, setSearchStatus] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedExchangeParam = selectedExchanges.join(',');
  const selectedExchangeLabels = selectedExchanges.map((exchange) => EXCHANGE_LABELS[exchange]).join(', ');

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(`/api/market-overview?exchanges=${encodeURIComponent(selectedExchangeParam)}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as MarketOverviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Unable to load market overview right now');
      }
      setOverview(data);
      setSearchResult(null);
      setSearchResults([]);
      setSearchStatus(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load market overview');
    } finally {
      setLoading(false);
    }
  }, [selectedExchangeParam]);

  useEffect(() => {
    fetchOverview();
    const id = window.setInterval(fetchOverview, 30_000);
    return () => window.clearInterval(id);
  }, [fetchOverview]);

  if (loading) {
    return <div className="text-sm text-gray-400">Loading market overview…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
        ⚠ {error}
      </div>
    );
  }

  if (!overview) {
    return <div className="text-sm text-gray-400">No market overview data available.</div>;
  }

  const runSearch = useCallback(
    async (rawInput: string) => {
      const raw = rawInput.trim().toUpperCase();
      if (!raw) {
        setSearching(false);
        setSearchResult(null);
        setSearchResults([]);
        setSearchStatus(null);
        return;
      }

      setSearching(true);
      setError(null);
      const symbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
      try {
        const res = await fetch(
          `/api/market-overview?exchanges=${encodeURIComponent(selectedExchangeParam)}&symbol=${encodeURIComponent(symbol)}`,
          {
            cache: 'no-store',
          }
        );
        const data = (await res.json()) as CoinSearchResponse;
        const coins = data.coins ?? (data.coin ? [data.coin] : []);
        if (!res.ok || coins.length === 0) {
          const searched = (data.searchedExchanges ?? selectedExchanges).map((exchange) => EXCHANGE_LABELS[exchange]).join(', ');
          setSearchResult(null);
          setSearchResults([]);
          setSearchStatus(`${symbol} not found in selected exchanges (${searched}).`);
          return;
        }
        const sortedCoins = [...coins].sort((a, b) => a.exchange.localeCompare(b.exchange));
        const foundNames = sortedCoins.map((coin) => EXCHANGE_LABELS[coin.exchange]);
        const missingNames = (data.missingExchanges ?? []).map((exchange) => EXCHANGE_LABELS[exchange]);
        setSearchResults(sortedCoins);
        setSearchResult(sortedCoins[0]);
        setSearchStatus(
          missingNames.length > 0
            ? `${symbol} found on ${foundNames.join(', ')}. Not found on ${missingNames.join(', ')}.`
            : `${symbol} found on ${foundNames.join(', ')}.`
        );
      } catch (err) {
        setSearchResult(null);
        setSearchResults([]);
        setSearchStatus(null);
        setError(err instanceof Error ? err.message : 'Coin lookup failed');
      } finally {
        setSearching(false);
      }
    },
    [selectedExchangeParam, selectedExchanges]
  );

  useEffect(() => {
    const trimmed = searchSymbol.trim();
    if (!trimmed) {
      setSearching(false);
      setSearchResult(null);
      setSearchResults([]);
      setSearchStatus(null);
      return;
    }

    const timeout = window.setTimeout(() => {
      runSearch(searchSymbol);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchSymbol, runSearch]);

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch(searchSymbol);
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">{selectedExchangeLabels} Universe Scanned</p>
          <p className="text-xl font-semibold text-white">{overview.scannedUniverse}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Signals Published</p>
          <p className="text-xl font-semibold text-white">
            {overview.uptrend.length} Uptrend · {overview.downtrend.length} Downtrend
          </p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
      >
        <p className="text-xs text-gray-400 sm:w-60">Filter current market results</p>
        <input
          type="text"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          placeholder="Search by symbol (e.g., BTC, ETH, SOL)"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
        <span className="text-xs text-gray-400 sm:w-40 text-right">{searching ? 'Searching…' : 'Auto search enabled'}</span>
      </form>

      {searchStatus && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-sm text-cyan-200">{searchStatus}</div>
      )}

      {searchResult && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">
            {searchResult.symbol} Trade Plan {searchResults.length > 1 ? `(${searchResults.length} exchanges)` : ''}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-sm mb-3">
            <Metric label="Exchange" value={EXCHANGE_LABELS[searchResult.exchange]} />
            <Metric label="Price" value={formatPrice(searchResult.price)} />
            <Metric label="24h Change" value={`${searchResult.priceChangePercent >= 0 ? '+' : ''}${searchResult.priceChangePercent.toFixed(2)}%`} />
            <Metric label="24h Volume" value={formatVolume(searchResult.volume24h)} />
            <Metric label="Direction" value={searchResult.direction} />
            <Metric label="Entry" value={formatPrice(searchResult.entry)} />
            <Metric label="Target" value={formatPrice(searchResult.target)} />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <Metric label="Stop Loss" value={formatPrice(searchResult.stopLoss)} />
            <Metric label="Support" value={searchResult.support ? formatPrice(searchResult.support) : 'N/A'} />
            <Metric label="Resistance" value={searchResult.resistance ? formatPrice(searchResult.resistance) : 'N/A'} />
            <Metric label="Confidence" value={`${searchResult.confidence.toFixed(1)}%`} />
          </div>
          {searchResults.length > 1 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[420px] text-xs">
                <thead>
                  <tr className="text-gray-500 border-b border-cyan-500/30">
                    <th className="text-left py-1.5">Exchange</th>
                    <th className="text-right py-1.5">Price</th>
                    <th className="text-right py-1.5">24h</th>
                    <th className="text-right py-1.5">Direction</th>
                    <th className="text-right py-1.5">Volume</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((coin) => (
                    <tr key={`${coin.exchange}:${coin.symbol}`} className="border-b border-cyan-500/10">
                      <td className="py-1.5 text-gray-200">{EXCHANGE_LABELS[coin.exchange]}</td>
                      <td className="py-1.5 text-right text-gray-200">{formatPrice(coin.price)}</td>
                      <td className={`py-1.5 text-right ${coin.priceChangePercent >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                        {coin.priceChangePercent >= 0 ? '+' : ''}
                        {coin.priceChangePercent.toFixed(2)}%
                      </td>
                      <td className={`py-1.5 text-right ${directionTextColor(coin.direction)}`}>{coin.direction}</td>
                      <td className="py-1.5 text-right text-gray-300">{formatVolume(coin.volume24h)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TrendTable
          title="Top 500 Uptrend Coins"
          rows={overview.uptrend}
          trendColor="text-green-400"
          positive
        />
        <TrendTable
          title="Top 500 Downtrend Coins"
          rows={overview.downtrend}
          trendColor="text-red-400"
          positive={false}
        />
      </div>

      <p className="text-xs text-gray-500">
        Data source: {(overview.sources ?? [overview.source]).map((exchange) => EXCHANGE_LABELS[exchange]).join(', ')} ·
        Last updated:{' '}
        {new Date(overview.timestamp).toLocaleTimeString()}
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-950/40 border border-gray-800 rounded p-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="text-sm text-white font-medium">{value}</p>
    </div>
  );
}

function directionTextColor(direction: OverviewTradeRow['direction']): string {
  if (direction === 'SHORT') return 'text-red-400';
  if (direction === 'LONG') return 'text-green-400';
  return 'text-yellow-400';
}

function TrendTable({
  title,
  rows,
  trendColor,
  positive,
}: {
  title: string;
  rows: OverviewTradeRow[];
  trendColor: string;
  positive: boolean;
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-x-auto">
      <h3 className={`text-sm font-semibold mb-2 ${trendColor}`}>{title}</h3>
      <table className="w-full min-w-[760px] text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-1.5">Coin</th>
            <th className="text-right py-1.5">Price</th>
            <th className="text-right py-1.5">24h</th>
            <th className="text-right py-1.5">Direction</th>
            <th className="text-right py-1.5">Entry</th>
            <th className="text-right py-1.5">Target</th>
            <th className="text-right py-1.5">Stop Loss</th>
            <th className="text-right py-1.5">Support</th>
            <th className="text-right py-1.5">Resistance</th>
            <th className="text-right py-1.5">Vol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((coin) => (
            <tr key={`${coin.exchange}:${coin.symbol}`} className="border-b border-gray-800/50">
              <td className="py-1.5 text-gray-200">{coin.symbol}</td>
              <td className="py-1.5 text-right text-gray-200">{formatPrice(coin.price)}</td>
              <td className={`py-1.5 text-right font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                {coin.priceChangePercent >= 0 ? '+' : ''}
                {coin.priceChangePercent.toFixed(2)}%
              </td>
              <td className={`py-1.5 text-right font-semibold ${directionTextColor(coin.direction)}`}>
                {coin.direction}
              </td>
              <td className="py-1.5 text-right text-gray-200">{formatPrice(coin.entry)}</td>
              <td className={`py-1.5 text-right ${coin.direction === 'SHORT' ? 'text-red-400' : 'text-green-400'}`}>
                {formatPrice(coin.target)}
              </td>
              <td className={`py-1.5 text-right ${coin.direction === 'SHORT' ? 'text-green-400' : 'text-red-400'}`}>
                {formatPrice(coin.stopLoss)}
              </td>
              <td className="py-1.5 text-right text-gray-300">
                {coin.support ? formatPrice(coin.support) : 'N/A'}
              </td>
              <td className="py-1.5 text-right text-gray-300">
                {coin.resistance ? formatPrice(coin.resistance) : 'N/A'}
              </td>
              <td className="py-1.5 text-right text-gray-400">{formatVolume(coin.volume24h)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
