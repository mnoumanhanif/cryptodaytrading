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
  coin?: OverviewTradeRow;
  error?: string;
}

const EXCHANGE_LABELS: Record<SupportedExchange, string> = {
  binance: 'Binance',
  bybit: 'Bybit',
  bitget: 'Bitget',
};

interface MarketOverviewPanelProps {
  selectedExchanges: SupportedExchange[];
}

export default function MarketOverviewPanel({ selectedExchanges }: MarketOverviewPanelProps) {
  const [overview, setOverview] = useState<MarketOverviewResponse | null>(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResult, setSearchResult] = useState<OverviewTradeRow | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCoin, setSelectedCoin] = useState<OverviewTradeRow | null>(null);

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

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const raw = searchSymbol.trim().toUpperCase();
    if (!raw) return;
    setSearching(true);
    setError(null);
    try {
      const symbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
      const res = await fetch(
        `/api/market-overview?exchanges=${encodeURIComponent(selectedExchangeParam)}&symbol=${encodeURIComponent(symbol)}`,
        {
          cache: 'no-store',
        }
      );
      const data = (await res.json()) as CoinSearchResponse;
      if (!res.ok || !data.coin) {
        throw new Error(data.error ?? 'Coin lookup is currently unavailable');
      }
      setSearchResult(data.coin);
    } catch (err) {
      setSearchResult(null);
      setError(err instanceof Error ? err.message : 'Coin lookup failed');
    } finally {
      setSearching(false);
    }
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
        <p className="text-xs text-gray-400 sm:w-60">Search any coin beyond top 100 lists</p>
        <input
          type="text"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          placeholder="e.g. BTCUSDT or BTC"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={searching || !searchSymbol.trim()}
          className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {searching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {searchResult && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-cyan-300 mb-2">{searchResult.symbol} Trade Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            <Metric label="Direction" value={searchResult.direction} />
            <Metric label="Entry" value={formatPrice(searchResult.entry)} />
            <Metric label="Target" value={formatPrice(searchResult.target)} />
            <Metric label="Stop Loss" value={formatPrice(searchResult.stopLoss)} />
            <Metric label="Support" value={searchResult.support ? formatPrice(searchResult.support) : 'N/A'} />
            <Metric label="Resistance" value={searchResult.resistance ? formatPrice(searchResult.resistance) : 'N/A'} />
          </div>
        </div>
      )}

      <div className="space-y-4">
        <TrendTable
          title="Top 500 Uptrend Coins"
          rows={overview.uptrend}
          trendColor="text-green-400"
          positive
          onSelectCoin={setSelectedCoin}
        />
        <TrendTable
          title="Top 500 Downtrend Coins"
          rows={overview.downtrend}
          trendColor="text-red-400"
          positive={false}
          onSelectCoin={setSelectedCoin}
        />
      </div>

      <p className="text-xs text-gray-500">
        Data source: {(overview.sources ?? [overview.source]).map((exchange) => EXCHANGE_LABELS[exchange]).join(', ')} ·
        Last updated:{' '}
        {new Date(overview.timestamp).toLocaleTimeString()}
      </p>

      {selectedCoin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-3" onClick={() => setSelectedCoin(null)}>
          <div
            className="w-full max-w-2xl rounded-xl border border-cyan-500/30 bg-gray-900 p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-cyan-300">{selectedCoin.symbol} — Full Signal Details</h3>
              <button
                type="button"
                onClick={() => setSelectedCoin(null)}
                className="text-xs px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-200"
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <Metric label="Exchange" value={EXCHANGE_LABELS[selectedCoin.exchange]} />
              <Metric label="Price" value={formatPrice(selectedCoin.price)} />
              <Metric label="24h Change" value={`${selectedCoin.priceChangePercent >= 0 ? '+' : ''}${selectedCoin.priceChangePercent.toFixed(2)}%`} />
              <Metric label="Direction" value={selectedCoin.direction} />
              <Metric label="Confidence" value={`${Math.round(selectedCoin.confidence)}%`} />
              <Metric label="Entry" value={formatPrice(selectedCoin.entry)} />
              <Metric label="Target" value={formatPrice(selectedCoin.target)} />
              <Metric label="Stop Loss" value={formatPrice(selectedCoin.stopLoss)} />
              <Metric label="Support" value={selectedCoin.support ? formatPrice(selectedCoin.support) : 'N/A'} />
              <Metric label="Resistance" value={selectedCoin.resistance ? formatPrice(selectedCoin.resistance) : 'N/A'} />
              <Metric label="Volume" value={formatVolume(selectedCoin.volume24h)} />
            </div>
          </div>
        </div>
      )}
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
  onSelectCoin,
}: {
  title: string;
  rows: OverviewTradeRow[];
  trendColor: string;
  positive: boolean;
  onSelectCoin: (coin: OverviewTradeRow) => void;
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-3">
      <h3 className={`text-sm font-semibold mb-2 ${trendColor}`}>{title}</h3>
      <div className="space-y-2">
        {rows.map((coin) => (
          <button
            key={`${coin.exchange}:${coin.symbol}`}
            type="button"
            onClick={() => onSelectCoin(coin)}
            className="w-full text-left border border-gray-800 rounded-lg p-2 hover:border-cyan-500/40 hover:bg-gray-800/40 transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-gray-100">{coin.symbol}</span>
              <span className={`text-xs font-semibold ${directionTextColor(coin.direction)}`}>{coin.direction}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
              <div>
                <p className="text-gray-500">Price</p>
                <p className="text-gray-200">{formatPrice(coin.price)}</p>
              </div>
              <div>
                <p className="text-gray-500">24h</p>
                <p className={`font-medium ${positive ? 'text-green-400' : 'text-red-400'}`}>
                  {coin.priceChangePercent >= 0 ? '+' : ''}
                  {coin.priceChangePercent.toFixed(2)}%
                </p>
              </div>
              <div>
                <p className="text-gray-500">Entry</p>
                <p className="text-gray-200">{formatPrice(coin.entry)}</p>
              </div>
              <div>
                <p className="text-gray-500">Target</p>
                <p className={coin.direction === 'SHORT' ? 'text-red-400' : 'text-green-400'}>{formatPrice(coin.target)}</p>
              </div>
              <div>
                <p className="text-gray-500">Stop Loss</p>
                <p className={coin.direction === 'SHORT' ? 'text-green-400' : 'text-red-400'}>{formatPrice(coin.stopLoss)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
