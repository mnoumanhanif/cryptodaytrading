'use client';

import React from 'react';
import MarketScanner from '@/components/MarketScanner';
import CoinFilter from '@/components/CoinFilter';
import WatchList from '@/components/WatchList';
import AddMarketPairModal from '@/components/AddMarketPairModal';
import { useDashboard } from '@/contexts/DashboardContext';
import { DEFAULT_TOTAL_SCANNED } from '@/components/dashboard-pages/dashboardHelpers';

export default function ScannerPage() {
  const {
    coins,
    loading,
    effectiveSelectedExchanges,
    selectedExchangeLabels,
    items,
    addCoin,
    removeCoin,
    isWatching,
    customMarketPairs,
    addMarketPairOpen,
    setAddMarketPairOpen,
    query,
    setQuery,
    signalFilter,
    setSignalFilter,
    sortBy,
    setSortBy,
    scannerPage,
    setScannerPage,
    scannerTotalPages,
    scannerCoins,
    displayCoins,
    localFilteredCoins,
    handleApiSearch,
    apiSearchResults,
    apiSearching,
    apiSearchError,
    totalScanned,
    handleAddMarketPair,
  } = useDashboard();

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left: Scanner */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              Market Scanner
            </h2>
            <span className="text-xs text-gray-500 bg-gray-900 border border-gray-800 px-2 py-0.5 rounded">
              Page {scannerPage} / {scannerTotalPages}
            </span>
          </div>
          <p className="text-xs text-gray-500 -mt-1">{selectedExchangeLabels} live scanner feed</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-500">Results</p>
              <p className="text-sm font-semibold text-white">
                Showing {scannerCoins.length} of {Math.max(totalScanned, coins.length, DEFAULT_TOTAL_SCANNED)}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-500">BUY</p>
              <p className="text-sm font-semibold text-green-400">
                {coins.filter(c => c.signal === 'BUY').length}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-500">SELL</p>
              <p className="text-sm font-semibold text-red-400">
                {coins.filter(c => c.signal === 'SELL').length}
              </p>
            </div>
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-2.5">
              <p className="text-[11px] text-gray-500">HOLD</p>
              <p className="text-sm font-semibold text-yellow-400">
                {coins.filter(c => c.signal === 'HOLD').length}
              </p>
            </div>
          </div>

          <CoinFilter
            query={query}
            onQueryChange={setQuery}
            signalFilter={signalFilter}
            onSignalFilterChange={setSignalFilter}
            sortBy={sortBy}
            onSortChange={setSortBy}
            onApiSearch={handleApiSearch}
            apiSearching={apiSearching}
            apiResultCount={apiSearchResults.length}
            localResultCount={localFilteredCoins.length}
          />

          {/* Show API search status/results indicator */}
          {query.trim() && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-gray-400">
                Local: {localFilteredCoins.length} coins
              </span>
              {apiSearchResults.length > 0 && (
                <span className="text-blue-400">
                  + {apiSearchResults.filter((c) => !localFilteredCoins.some((lc) => lc.symbol === c.symbol)).length} from exchange API
                </span>
              )}
              {apiSearching && (
                <span className="text-yellow-400 flex items-center gap-1">
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Searching exchange...
                </span>
              )}
              {apiSearchError && (
                <span className="text-red-400">Search error: {apiSearchError}</span>
              )}
            </div>
          )}

          <MarketScanner
            coins={scannerCoins}
            loading={loading || apiSearching}
            onAddToWatchlist={addCoin}
            isWatching={isWatching}
            summaryLabel={
              query.trim()
                ? `Showing ${displayCoins.length} coins${apiSearchResults.length > 0 ? ' (includes exchange search)' : ' (filtered)'}`
                : `Showing ${scannerCoins.length} of ${Math.max(totalScanned, coins.length, DEFAULT_TOTAL_SCANNED)} coins`
            }
          />

          {!loading && scannerTotalPages > 1 && (
            <div className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => setScannerPage((prev) => Math.max(1, prev - 1))}
                disabled={scannerPage === 1}
                className="px-3 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                ◀ Prev
              </button>
              <span className="text-xs text-gray-400">
                Page {scannerPage} / {scannerTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setScannerPage((prev) => Math.min(scannerTotalPages, prev + 1))}
                disabled={scannerPage === scannerTotalPages}
                className="px-3 py-1.5 rounded border border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-500 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                Next ▶
              </button>
            </div>
          )}
        </div>

        {/* Right: Watchlist sidebar */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Watchlist
              {items.length > 0 && (
                <span className="text-xs text-gray-500 font-normal">({items.length})</span>
              )}
            </h2>
            <button
              onClick={() => setAddMarketPairOpen(true)}
              className="px-2.5 py-1 rounded bg-cyan-900/60 border border-cyan-800 text-[11px] text-cyan-200 hover:bg-cyan-900 transition-colors cursor-pointer"
            >
              + Add Pair
            </button>
          </div>
          <WatchList items={items} coins={coins} onRemove={removeCoin} />
        </div>

      </div>

      <AddMarketPairModal
        isOpen={addMarketPairOpen}
        selectedExchanges={effectiveSelectedExchanges}
        isFull={customMarketPairs.isFull}
        onClose={() => setAddMarketPairOpen(false)}
        onAddCoin={handleAddMarketPair}
      />
    </div>
  );
}
