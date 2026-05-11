// ============================================================
// Trade journal – persistent signal logging
// Stores every signal snapshot for later outcome labeling
// and evaluation. Uses in-memory store with JSON export.
// In production, replace with SQLite or a real database.
// ============================================================

import {
  CostAssumptions,
  IndicatorResults,
  MarketRegime,
  Signal,
  TradeJournalEntry,
  TradeOutcome,
} from './types';
import { insertTradeJournalEntry } from './saas/db';

// ============================================================
// In-memory journal store (persists within server process)
// ============================================================
const journal: TradeJournalEntry[] = [];
const MAX_JOURNAL_ENTRIES = 10_000; // prevent unbounded growth

/** Generate a unique ID for a journal entry */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Log a new signal to the trade journal.
 * Captures full indicator snapshot, risk targets, regime, and cost assumptions.
 */
export function logSignal(params: {
  symbol: string;
  signal: Signal;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  score: number;
  confidence: number;
  regime: MarketRegime;
  netRR: number;
  costAssumptions: CostAssumptions;
  rationale: string[];
  indicators: IndicatorResults;
}): TradeJournalEntry {
  // Extract key indicator values as a flat snapshot
  const indicatorSnapshot: Record<string, number> = {
    rsi: params.indicators.rsi.value,
    rsiScore: params.indicators.rsi.score,
    macdHistogram: params.indicators.macd.histogram,
    macdScore: params.indicators.macd.score,
    bollingerPercentB: params.indicators.bollinger.percentB,
    bollingerScore: params.indicators.bollinger.score,
    volumeRatio: params.indicators.volume.volumeRatio,
    volumeScore: params.indicators.volume.score,
    maScore: params.indicators.ma.score,
  };

  if (params.indicators.ichimoku) {
    indicatorSnapshot.ichimokuScore = params.indicators.ichimoku.score;
  }
  if (params.indicators.stochRSI) {
    indicatorSnapshot.stochRSIK = params.indicators.stochRSI.k;
    indicatorSnapshot.stochRSIScore = params.indicators.stochRSI.score;
  }
  if (params.indicators.adx) {
    indicatorSnapshot.adx = params.indicators.adx.adx;
    indicatorSnapshot.adxScore = params.indicators.adx.score;
  }

  const entry: TradeJournalEntry = {
    id: generateId(),
    symbol: params.symbol,
    signal: params.signal,
    entryPrice: params.entryPrice,
    stopLoss: params.stopLoss,
    takeProfit1: params.takeProfit1,
    takeProfit2: params.takeProfit2,
    takeProfit3: params.takeProfit3,
    score: params.score,
    confidence: params.confidence,
    regime: params.regime,
    netRR: params.netRR,
    costAssumptions: params.costAssumptions,
    rationale: params.rationale,
    indicators: indicatorSnapshot,
    createdAt: Date.now(),
    outcome: 'PENDING',
  };

  // Enforce size limit by removing oldest entries
  if (journal.length >= MAX_JOURNAL_ENTRIES) {
    journal.splice(0, journal.length - MAX_JOURNAL_ENTRIES + 1);
  }

  journal.push(entry);
  void insertTradeJournalEntry({
    workspaceId: process.env.SAAS_DEFAULT_WORKSPACE_ID ?? 'default',
    entry: {
      id: entry.id,
      symbol: entry.symbol,
      signal: entry.signal,
      entry_price: entry.entryPrice,
      stop_loss: entry.stopLoss,
      take_profit_1: entry.takeProfit1,
      take_profit_2: entry.takeProfit2,
      take_profit_3: entry.takeProfit3,
      score: entry.score,
      confidence: entry.confidence,
      regime: entry.regime,
      net_rr: entry.netRR,
      cost_assumptions: entry.costAssumptions,
      rationale: entry.rationale,
      indicators: entry.indicators,
      created_at_ms: entry.createdAt,
      outcome: entry.outcome,
    },
  });
  return entry;
}

/**
 * Update the outcome of a journal entry (when trade closes).
 */
export function updateOutcome(
  id: string,
  outcome: TradeOutcome,
  exitPrice: number,
  entryPrice: number
): TradeJournalEntry | null {
  const entry = journal.find((e) => e.id === id);
  if (!entry) return null;

  entry.outcome = outcome;
  entry.exitPrice = exitPrice;
  entry.exitedAt = Date.now();
  entry.realizedPnlPct = entryPrice > 0
    ? ((exitPrice - entryPrice) / entryPrice) * 100
    : 0;

  return entry;
}

/** Get all journal entries, optionally filtered by symbol */
export function getJournalEntries(symbol?: string): TradeJournalEntry[] {
  if (symbol) {
    return journal.filter((e) => e.symbol === symbol);
  }
  return [...journal];
}

/** Get recent entries (last N) */
export function getRecentEntries(count: number = 50): TradeJournalEntry[] {
  return journal.slice(-count);
}

/** Get journal statistics */
export function getJournalStats(): {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  pendingOutcomes: number;
  completedTrades: number;
  winRate: number;
} {
  const completed = journal.filter((e) => e.outcome !== 'PENDING');
  const wins = completed.filter((e) =>
    e.outcome === 'TP1' || e.outcome === 'TP2' || e.outcome === 'TP3'
  );

  return {
    totalSignals: journal.length,
    buySignals: journal.filter((e) => e.signal === 'BUY').length,
    sellSignals: journal.filter((e) => e.signal === 'SELL').length,
    pendingOutcomes: journal.filter((e) => e.outcome === 'PENDING').length,
    completedTrades: completed.length,
    winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
  };
}

/** Export journal as JSON (for download/backup) */
export function exportJournal(): string {
  return JSON.stringify(journal, null, 2);
}
