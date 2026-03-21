# CryptoScanner – Day Trading Dashboard

A Next.js 15 web app that auto-scans top USDT trading pairs on Binance, identifies short-term setups, and provides **BUY / SELL / HOLD** signals with target prices and stop losses.

## Features

- **Market Scanner** – Fetches top USDT pairs, runs 8 technical indicators, assigns a composite score (0–100), and filters for upside potential.
- **Market Heatmap** – Visual overview of market activity with color-coded tiles.
- **Market Overview** – Exchange overview with 25 uptrend and 25 downtrend coins including entry, target, stop-loss, support, and resistance.
- **Top 500** – Paginated, sortable table of the 500 highest-volume USDT pairs.
- **Binance Futures Tab** – Search all Binance USDT perpetual futures pairs and view entry, support/resistance, stop-loss, and 3 target prices with hedging-mode guidance.
- **Technical Indicators** – RSI (14), MACD (12/26/9), Bollinger Bands (20, 2σ), Volume Analysis, EMA/SMA (9/21/50), Ichimoku Cloud, Stochastic RSI, ADX, Fibonacci Retracement.
- **Risk Management** – ATR-based stop loss (2–5%) and multi-level take-profit targets (TP1/TP2/TP3) with risk-reward ratio.
- **Signal System** – BUY (score > 70), HOLD (40–70), SELL (< 40).
- **Candlestick Charts** – SVG-rendered OHLCV charts with 6 timeframes (1m to 1d) and volume bars.
- **Watchlist** – Add coins, track real-time P&L with visual progress bars, persisted in `localStorage`.
- **Dark Theme** – Trading-style dark UI with gradient accents.

## Tech Stack

- **Framework**: Next.js 15 (App Router) · TypeScript · React 19
- **Styling**: Tailwind CSS 3
- **Charts**: Custom SVG candlestick chart (no external chart library)
- **Data**: Public market endpoints from Binance, Bybit, Bitget, and MEXC (Binance selected by default for dashboard exchange selection)

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── scanner/route.ts    # Main scanner – analyzes top 50 coins (Binance)
│   │   ├── futures-overview/    # Binance futures trade setups + symbol lookup
│   │   ├── coins/
│   │   │   ├── search/route.ts # Search any USDT pair
│   │   │   └── top/route.ts    # Top 500 paginated ticker data
│   │   ├── klines/route.ts     # Candlestick data
│   │   └── ticker/route.ts     # Live price for a symbol
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx           # Main layout with tab navigation
│   ├── MarketOverviewPanel.tsx # Multi-exchange market overview + API key selector
│   ├── CoinCard.tsx            # Expandable coin analysis card
│   ├── CandlestickChart.tsx    # SVG OHLCV chart
│   ├── MarketScanner.tsx       # Scanner list view
│   ├── CoinHeatmap.tsx         # Heatmap visualization
│   ├── CoinFilter.tsx          # Search & filter controls
│   ├── TradeSignalBoard.tsx    # Entry/exit signal details
│   ├── RiskManagementPanel.tsx # Stop loss & take-profit panel
│   ├── AdvancedIndicators.tsx  # Ichimoku, StochRSI, ADX, Fibonacci
│   └── WatchList.tsx           # Persistent watchlist
├── hooks/
│   ├── useMarketData.ts        # 30s auto-refresh with error recovery
│   ├── useCoinSearch.ts        # Client + API search
│   └── useWatchList.ts         # localStorage-backed watchlist
└── lib/
    ├── analyzer.ts             # Core scoring & signal engine
    ├── binance.ts              # Binance market API client with retry
    ├── exchangeMarket.ts       # Multi-exchange ticker/kline fetch helpers
    ├── cache.ts                # In-memory TTL cache
    ├── indicators.ts           # RSI, MACD, Bollinger, Volume, MA
    ├── indicators/
    │   ├── ichimoku.ts         # Ichimoku Cloud
    │   ├── stochasticRSI.ts    # Stochastic RSI
    │   ├── adx.ts              # Average Directional Index
    │   └── fibonacci.ts        # Fibonacci retracement
    ├── math.ts                 # Shared EMA/SMA helpers
    ├── risk.ts                 # ATR, stop loss, take-profit calc
    ├── types.ts                # TypeScript interfaces
    └── utils.ts                # Formatting & rounding utilities
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/scanner` | GET | Scans top coins and returns scored analysis. Params: `signal`, `sort`, `limit`. |
| `/api/market-overview` | GET | Exchange overview (25 uptrend + 25 downtrend) with entry/target/stop-loss and support/resistance. Supports `exchange`, `exchanges` (comma-separated), and `symbol` lookup. |
| `/api/coins/top` | GET | Paginated ticker data for up to 500 USDT pairs. Params: `page`, `limit`, `sort`, `total`. |
| `/api/coins/search` | GET | Search any USDT pair by symbol. Params: `q` (fuzzy), `symbol` (exact), `limit`. |
| `/api/futures-overview` | GET | Binance USDT perpetual futures overview and symbol lookup with entry, stop-loss, TP1/TP2/TP3, support, resistance. Param: `symbol` (optional). |
| `/api/klines` | GET | Candlestick OHLCV data. Params: `symbol`, `interval`, `limit`. |
| `/api/ticker` | GET | Live price for a symbol. Params: `symbol`. |

## Getting Started (Local)

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Deploy to Vercel

This project is optimized for Vercel deployment:

1. **Push to GitHub** and import the repo in [vercel.com/new](https://vercel.com/new).
2. Add optional `BINANCE_API_KEY` for authenticated Binance market-data requests.
3. **Click Deploy** – Vercel auto-detects Next.js and configures the build.

### Vercel-specific optimizations

- API routes export `maxDuration` to avoid serverless timeouts.
- The scanner defaults to 50 coins (instead of 100) for faster response times.
- Deadline-aware batch processing stops gracefully before the function timeout.
- Stale cache is returned as a fallback when fresh data cannot be fetched.
- Fetch timeout is set to 8 seconds to fit within serverless limits.

### GitHub Pages (static export)

For a fully static deployment (no server-side API routes):

```bash
PAGES_EXPORT=true NEXT_PUBLIC_STATIC_EXPORT=true npm run build
```

The `out/` directory can be deployed to GitHub Pages or any static host. In this mode the client fetches directly from Binance APIs.

## Configuration

| Variable | Default | Description |
|---|---|---|
| `PAGES_EXPORT` | `false` | Set to `true` to enable static export for GitHub Pages. |
| `NEXT_PUBLIC_STATIC_EXPORT` | `false` | Set to `true` for client-side Binance calls (static mode). |
| `BINANCE_API_KEY` | _unset_ | Optional key sent on Binance requests as `X-MBX-APIKEY` (default selected exchange on dashboard). |
| `BINANCE_FUTURES_API_KEY` | _unset_ | Optional key sent on Binance Futures requests as `X-MBX-APIKEY` for `/api/futures-overview`. Falls back to `BINANCE_API_KEY` when unset. |
| `BITGET_API_KEY` | _unset_ | Optional exchange API key placeholder shown in dashboard selector. |
| `MEXC_API_KEY` | _unset_ | Optional exchange API key placeholder shown in dashboard selector. |

## Disclaimer

This is a technical analysis tool, **not financial advice**. Past patterns do not guarantee future performance. Trade at your own risk.
