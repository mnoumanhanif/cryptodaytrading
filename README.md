# Crypto Day Trading Platform

This repository contains a Next.js-based crypto trading intelligence dashboard.  
It ingests exchange market data, computes multi-indicator analysis, generates trade signals, and presents risk-aware setups in a trader-friendly UI.

---

## A) Project Overview

### Purpose
Provide short-term crypto market scanning and decision support for day traders by combining:
- live exchange market data
- technical indicators
- signal scoring
- risk management outputs

### Key Features
- Real-time scanner with **BUY / HOLD / SELL** signals
- Top-500 market universe explorer with pagination/sorting
- Multi-exchange support (Binance, Bybit, Bitget)
- Technical analysis stack (RSI, MACD, Bollinger, MA, Ichimoku, Stoch RSI, ADX, Fibonacci)
- Trade signal detail panel with entry zones and rationale
- ATR-based stop loss + take profit ladders
- Portfolio-level risk gating (kill switch, daily loss cap, max open positions)
- Watchlist with local persistence and P&L tracking

### Target Users
- Retail day traders
- Technical analysts
- Startup teams building execution workflows on top of market intelligence

---

## B) Architecture

### System Design (Text Diagram)
```text
Browser UI (Dashboard + Tabs)
    ├─ uses hooks (polling/search/watchlist state)
    ├─ calls Next.js API routes
    │      ├─ scanner / market-overview / top-500 / search / klines / ticker
    │      └─ portfolio-risk / trade-journal
    └─ renders analysis, charts, and risk outputs

API Routes (src/app/api/*)
    ├─ fetch exchange data (binance/bybit/bitget adapters)
    ├─ run analyzer + indicators + risk + regime logic
    ├─ enforce portfolio risk checks
    └─ return normalized JSON for UI

Core Domain (src/lib/*)
    ├─ indicators + scoring + trade signal generation
    ├─ risk and cost modeling
    ├─ portfolio risk controls
    ├─ in-memory trade journal
    └─ exchange abstraction layer
```

### Data Flow
1. User opens `/` → `Dashboard` renders.
2. Hooks call APIs (`/api/scanner`, `/api/coins/top`, etc.).
3. API routes fetch ticker/klines from selected exchanges.
4. `analyzeEnhanced()` computes indicators, score, signal, risk targets, cost-adjusted RR, regime, and risk rejection reasons.
5. UI displays lists/cards/charts and user can track symbols in watchlist.

### Tech Stack
- **Frontend/Backend framework**: Next.js 15 App Router
- **Language**: TypeScript
- **UI**: React 19 + Tailwind CSS
- **Charting**: custom SVG candlestick components
- **State**: React hooks + localStorage (watchlist)
- **Runtime storage**: in-memory for portfolio risk/trade journal

---

## C) Features Breakdown

### 1) Market Data Ingestion
- Multi-exchange adapters in `src/lib/exchangeMarket.ts`
- Exchange clients under `src/lib/exchanges/*`
- Top pairs, per-symbol ticker, and kline retrieval
- Route-level cache + deadline-aware batching in scanner/market-analysis routes

### 2) Signal Generation
- Core analyzer: `src/lib/analyzer.ts`
- Composite score from indicator modules (`src/lib/indicators.ts`, `src/lib/indicators/*.ts`)
- Threshold-based signal mapping:
  - score > 70 → SELL
  - score < 40 → BUY
  - else HOLD
- Trade signal includes entry zone, confidence, and top rationale factors

### 3) Trade Execution
- **Current state**: no broker order placement yet (signal-only system)
- APIs generate actionable levels, but orders are not sent to exchanges

### 4) Risk Management
- Position-level: ATR-based SL/TP in `src/lib/risk.ts`
- Cost-adjusted net RR model (fees, slippage, spread)
- Portfolio-level gates in `src/lib/portfolioRisk.ts`:
  - max daily loss
  - max consecutive losses
  - max open positions
  - min net RR threshold
  - kill switch

### 5) UI Dashboards
- Tabbed dashboard in `src/components/Dashboard.tsx`
- Scanner, Heatmap, Top 500, Market Overview, Patterns, Watchlist
- Coin detail cards with advanced indicator and risk panels

---

## D) Setup Guide

### Prerequisites
- Node.js 18+ (recommended for Next.js 15)
- npm

### Install & Run
```bash
npm install
npm run dev
```
Open `http://localhost:3000`.

### Environment Variables (`.env.local`)
```bash
PAGES_EXPORT=false
NEXT_PUBLIC_STATIC_EXPORT=false
BINANCE_API_KEY=
BYBIT_API_KEY=
BITGET_API_KEY=
```

### Build
```bash
npm run build
```

### Notes
- API routes are dynamic and configured with `maxDuration` for serverless runtime constraints.
- Static export mode is available via:
  ```bash
  PAGES_EXPORT=true NEXT_PUBLIC_STATIC_EXPORT=true npm run build
  ```

---

## E) API Documentation

### `GET /api/scanner`
Scans top market pairs and returns enhanced analysis.

**Query params**
- `exchanges=binance,bybit,bitget` (optional)
- `exchange=binance` (optional, single exchange)
- `signal=BUY|SELL|HOLD` (optional)
- `sort=score|change|volume` (optional, default `score`)
- `limit=1..500` (optional)

**Response (shape)**
```json
{
  "coins": [
    {
      "symbol": "BTCUSDT",
      "score": 63.8,
      "signal": "HOLD",
      "tradeSignal": { "type": "HOLD", "confidence": 74 },
      "risk": { "entryPrice": 65000, "stopLoss": 63400, "targetPrice": 69800 }
    }
  ],
  "timestamp": 1700000000000,
  "totalScanned": 100,
  "portfolioRisk": { "tradingEnabled": true, "dailyLossCapReached": false }
}
```

### `GET /api/market-overview`
Returns uptrend/downtrend opportunities; supports single-symbol lookup.

**Query params**
- `exchange` / `exchanges`
- `symbol` (optional symbol-specific mode)

### `GET /api/coins/top`
Top 500 market listing with pagination and sorting.

**Query params**
- `page`, `limit`, `sort`, `total`, `exchange`/`exchanges`

### `GET /api/coins/search`
Search by fuzzy query (`q`) or exact symbol (`symbol`).

### `GET /api/klines`
Candlestick data.

**Query params**
- `symbol` (required)
- `interval` (1m, 3m, 5m, ..., 1M)
- `limit` (max 500)

### `GET /api/ticker`
Latest ticker snapshot for a symbol.

### `GET /api/trade-journal`
Returns in-memory signal journal entries and summary stats.

### `GET/POST /api/portfolio-risk`
- GET: current account risk state + summary
- POST: update state and/or trading enablement

---

## F) Trading Logic Explanation

### Strategy Style
This is a **short-term technical confluence strategy engine**:
- indicator-based scoring
- momentum + trend + volatility checks
- risk/return constraints before surfacing opportunities

### Entry/Exit Model
- Entry zone is built around market price (±0.5%).
- Stop loss and targets derive from ATR volatility.
- Multi-target take profits (TP1, TP2, TP3) enforce staged exits.
- Signal orientation is adjusted for short setups when bearish context dominates.

### Risk Rules
- Position sizing via risk-per-trade math
- Net RR calculation after estimated execution costs
- Portfolio guardrails can reject otherwise valid setups

### Important Assumption
- Current outputs are advisory signals; no exchange order execution is performed.

---

## G) Improvements & Missing Pieces (Production Readiness)

### Security Gaps
- No authentication/authorization on sensitive APIs
- No request rate limiting
- Input validation is present on some routes but inconsistent across all endpoints

### Performance Gaps
- Heavy indicator calculations in request path for large scan universes
- In-memory cache only (single-process, non-distributed)
- No background job queue for expensive scans

### Scalability Gaps
- In-memory portfolio state and trade journal (lost on restart)
- No durable database layer
- No centralized observability (metrics/tracing/alerts)

### Reliability Gaps
- No automated tests (unit/integration/e2e)
- No CI quality gates for trading logic regressions
- No fault-tolerant exchange retry/circuit-breaker strategy

---

## Refactor Structure Proposal (Separation of Concerns)

Proposed target layout:
```text
src/
  app/
    (dashboard)/
    api/
      scanner/
      market/
      portfolio/
      journal/
  modules/
    market-data/
      services/
      exchanges/
      dto/
    analysis/
      indicators/
      scoring/
      strategies/
    trading/
      signals/
      risk/
      portfolio/
      journal/
  ui/
    dashboard/
    scanner/
    charts/
    shared/
  hooks/
  config/
  types/
  utils/
```

### Concrete Refactoring Suggestions
1. Split `src/lib/analyzer.ts` into:
   - `scoreCalculator.ts`
   - `signalGenerator.ts`
   - `enhancedAnalyzer.ts`
2. Move route parsing/validation into shared schema validators.
3. Introduce service layer per domain (`MarketDataService`, `SignalService`, `PortfolioRiskService`).
4. Replace in-memory state with database-backed repositories.
5. Normalize naming conventions:
   - route handlers thin
   - business logic in `services`
   - pure logic in `domain`
6. Add test pyramid:
   - indicator unit tests
   - analyzer/risk integration tests
   - API contract tests

---

## Quick Module Map (Current Codebase)

- **Frontend app entry**: `src/app/page.tsx`
- **Main UI orchestration**: `src/components/Dashboard.tsx`
- **API routes**: `src/app/api/**/route.ts`
- **Core analysis logic**: `src/lib/analyzer.ts`
- **Risk models**: `src/lib/risk.ts`, `src/lib/portfolioRisk.ts`
- **Exchange integrations**: `src/lib/exchangeMarket.ts`, `src/lib/exchanges/*`

---

## Development Notes

- `npm run build` currently succeeds and performs type/lint checks during build.
- `npm run lint` prompts for ESLint migration in this environment (project lint setup migration pending).

---

## Disclaimer

This system provides technical analysis and signal tooling only.  
It is **not financial advice** and should be used with independent risk judgment.
