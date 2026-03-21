'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { formatPrice, formatVolume } from '@/lib/utils';

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

interface FuturesOverviewResponse {
  timestamp: number;
  source: 'binance-futures';
  warnings?: string[];
  topLongs: FuturesTradeRow[];
  topShorts: FuturesTradeRow[];
  scannedUniverse: number;
}

interface FuturesSearchResponse {
  timestamp: number;
  source: 'binance-futures';
  coin?: FuturesTradeRow;
  error?: string;
}

export default function FuturesTradingPanel() {
  const [overview, setOverview] = useState<FuturesOverviewResponse | null>(null);
  const [searchSymbol, setSearchSymbol] = useState('');
  const [searchResult, setSearchResult] = useState<FuturesTradeRow | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch('/api/futures-overview', { cache: 'no-store' });
      const data = (await res.json()) as FuturesOverviewResponse & { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? 'Unable to load futures overview right now');
      }
      setOverview(data);
      setSearchResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load futures overview');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
    const id = window.setInterval(fetchOverview, 30_000);
    return () => window.clearInterval(id);
  }, [fetchOverview]);

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    const raw = searchSymbol.trim().toUpperCase();
    if (!raw) return;
    setSearching(true);
    setError(null);
    try {
      const symbol = raw.endsWith('USDT') ? raw : `${raw}USDT`;
      const res = await fetch(`/api/futures-overview?symbol=${encodeURIComponent(symbol)}`, {
        cache: 'no-store',
      });
      const data = (await res.json()) as FuturesSearchResponse;
      if (!res.ok || !data.coin) {
        throw new Error(data.error ?? 'Futures coin lookup is currently unavailable');
      }
      setSearchResult(data.coin);
    } catch (err) {
      setSearchResult(null);
      setError(err instanceof Error ? err.message : 'Futures coin lookup failed');
    } finally {
      setSearching(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-gray-400">Loading Binance futures overview…</div>;
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
        ⚠ {error}
      </div>
    );
  }

  if (!overview) {
    return <div className="text-sm text-gray-400">No futures data available.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Binance Futures Universe Scanned</p>
          <p className="text-xl font-semibold text-white">{overview.scannedUniverse}</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Directional Setups</p>
          <p className="text-xl font-semibold text-white">
            {overview.topLongs.length} Long · {overview.topShorts.length} Short
          </p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
          <p className="text-xs text-gray-500">Mode</p>
          <p className="text-sm font-semibold text-teal-300">Hedging mode (long/short plans side-by-side)</p>
        </div>
      </div>

      <form
        onSubmit={handleSearch}
        className="bg-gray-900 border border-gray-800 rounded-lg p-3 flex flex-col sm:flex-row gap-2 sm:items-center"
      >
        <p className="text-xs text-gray-400 sm:w-72">Search any Binance futures USDT perpetual pair</p>
        <input
          type="text"
          value={searchSymbol}
          onChange={(e) => setSearchSymbol(e.target.value)}
          placeholder="e.g. BTCUSDT or BTC"
          className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-teal-500"
        />
        <button
          type="submit"
          disabled={searching || !searchSymbol.trim()}
          className="px-4 py-2 rounded bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-sm font-medium text-white transition-colors"
        >
          {searching ? 'Searching…' : 'Search Futures'}
        </button>
      </form>

      {searchResult && (
        <div className="bg-teal-500/10 border border-teal-500/30 rounded-lg p-3">
          <h3 className="text-sm font-semibold text-teal-300 mb-2">{searchResult.symbol} Futures Trade Plan</h3>
          <div className="grid grid-cols-2 md:grid-cols-9 gap-3 text-sm">
            <Metric label="Direction" value={searchResult.direction} />
            <Metric label="Entry" value={formatPrice(searchResult.entry)} />
            <Metric label="Target 1" value={formatPrice(searchResult.target1)} />
            <Metric label="Target 2" value={formatPrice(searchResult.target2)} />
            <Metric label="Target 3" value={formatPrice(searchResult.target3)} />
            <Metric label="Stop Loss" value={formatPrice(searchResult.stopLoss)} />
            <Metric label="Support" value={searchResult.support ? formatPrice(searchResult.support) : 'N/A'} />
            <Metric
              label="Resistance"
              value={searchResult.resistance ? formatPrice(searchResult.resistance) : 'N/A'}
            />
            <Metric label="Confidence" value={`${Math.round(searchResult.confidence)}%`} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <FuturesTable title="Top Long Futures Setups" rows={overview.topLongs} trendColor="text-green-400" />
        <FuturesTable title="Top Short Futures Setups" rows={overview.topShorts} trendColor="text-red-400" />
      </div>

      <p className="text-xs text-gray-500">
        Data source: Binance Futures API (USDT perpetual) · Last updated:{' '}
        {new Date(overview.timestamp).toLocaleTimeString()}
      </p>
      <p className="text-xs text-gray-500">
        Hedging mode guidance: run independent risk-managed long and short plans only when both setups validate your
        strategy and exchange hedging mode is enabled.
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

function FuturesTable({
  title,
  rows,
  trendColor,
}: {
  title: string;
  rows: FuturesTradeRow[];
  trendColor: string;
}) {
  return (
    <section className="bg-gray-900 border border-gray-800 rounded-lg p-3 overflow-x-auto">
      <h3 className={`text-sm font-semibold mb-2 ${trendColor}`}>{title}</h3>
      <table className="w-full min-w-[980px] text-sm">
        <thead>
          <tr className="text-xs text-gray-500 border-b border-gray-800">
            <th className="text-left py-1.5">Coin</th>
            <th className="text-right py-1.5">Price</th>
            <th className="text-right py-1.5">24h</th>
            <th className="text-right py-1.5">Direction</th>
            <th className="text-right py-1.5">Entry</th>
            <th className="text-right py-1.5">Target 1</th>
            <th className="text-right py-1.5">Target 2</th>
            <th className="text-right py-1.5">Target 3</th>
            <th className="text-right py-1.5">Stop Loss</th>
            <th className="text-right py-1.5">Support</th>
            <th className="text-right py-1.5">Resistance</th>
            <th className="text-right py-1.5">Vol</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((coin) => (
            <tr key={coin.symbol} className="border-b border-gray-800/50">
              <td className="py-1.5 text-gray-200">{coin.symbol}</td>
              <td className="py-1.5 text-right text-gray-200">{formatPrice(coin.price)}</td>
              <td
                className={`py-1.5 text-right font-medium ${
                  coin.priceChangePercent >= 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {coin.priceChangePercent >= 0 ? '+' : ''}
                {coin.priceChangePercent.toFixed(2)}%
              </td>
              <td className={`py-1.5 text-right font-semibold ${coin.direction === 'SHORT' ? 'text-red-400' : 'text-green-400'}`}>
                {coin.direction}
              </td>
              <td className="py-1.5 text-right text-gray-200">{formatPrice(coin.entry)}</td>
              <td className="py-1.5 text-right text-green-400">{formatPrice(coin.target1)}</td>
              <td className="py-1.5 text-right text-green-300">{formatPrice(coin.target2)}</td>
              <td className="py-1.5 text-right text-cyan-300">{formatPrice(coin.target3)}</td>
              <td className="py-1.5 text-right text-red-400">{formatPrice(coin.stopLoss)}</td>
              <td className="py-1.5 text-right text-gray-300">{coin.support ? formatPrice(coin.support) : 'N/A'}</td>
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
