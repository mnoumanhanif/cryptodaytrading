// ============================================================
// Portfolio-level risk guards
// Enforces daily loss caps, max open positions, loss streaks,
// and a kill switch to immediately disable trading signals.
// ============================================================

import {
  AccountState,
  MarketRegime,
  PortfolioIntelligenceReport,
  NetRiskReward,
  PortfolioRiskCheck,
  PortfolioRiskConfig,
  RegimeResult,
  TradeOutcome,
} from './types';
import { getJournalEntries } from './tradeJournal';

// ============================================================
// Default configuration
// ============================================================
export const DEFAULT_PORTFOLIO_RISK_CONFIG: PortfolioRiskConfig = {
  maxDailyLossPct: 3,        // 3% max daily loss
  maxDrawdownPct: 3,         // 3% max drawdown
  maxConsecutiveLosses: 4,   // 4 consecutive losses → pause
  maxOpenPositions: 3,       // max 3 open positions at once
  maxRiskPerTradePct: 2,     // max 2% account risk per trade
  minNetRR: 1.5,             // minimum 1.5 net RR after costs
  maxAtrPercent: 8,          // reject if ATR% > 8 (extreme volatility)
};

const ADAPTIVE_CONFIDENCE_THRESHOLD = 75;
const ADAPTIVE_POSITION_SIZE_PCT = 0.5;
const MIN_TRADES_FOR_RISK_ASSESSMENT = 5;
const LOW_WIN_RATE_THRESHOLD = 50;
const MIN_REGIME_SAMPLES = 5;

function isWinningOutcome(outcome: TradeOutcome): boolean {
  return outcome === 'TP1' || outcome === 'TP2' || outcome === 'TP3';
}

// ============================================================
// In-memory account state (persists within server process lifetime)
// In production this would be backed by a database.
// ============================================================
let accountState: AccountState = {
  dailyRealizedPnlPct: 0,
  openPositionCount: 0,
  consecutiveLosses: 0,
  tradingEnabled: true,
};

let lastResetDate: string = new Date().toISOString().slice(0, 10);

/** Reset daily counters if a new day has started */
function maybeResetDaily(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== lastResetDate) {
    accountState.dailyRealizedPnlPct = 0;
    lastResetDate = today;
  }
}

/** Get current account state (read-only copy) */
export function getAccountState(): AccountState {
  maybeResetDaily();
  return { ...accountState };
}

/** Update account state (used by trade journal when trades close) */
export function updateAccountState(updates: Partial<AccountState>): void {
  maybeResetDaily();
  accountState = { ...accountState, ...updates };
}

/** Emergency kill switch – immediately disable all trading signals */
export function setTradingEnabled(enabled: boolean): void {
  accountState.tradingEnabled = enabled;
}

/**
 * Check whether a new trade is allowed given current portfolio risk.
 * Returns { allowed: true } or { allowed: false, reasons: [...] }.
 */
export function canOpenTrade(
  netRR: NetRiskReward,
  regime: RegimeResult,
  config: PortfolioRiskConfig = DEFAULT_PORTFOLIO_RISK_CONFIG
): PortfolioRiskCheck {
  maybeResetDaily();
  const reasons: string[] = [];
  const warnings: string[] = [];

  // Kill switch
  if (!accountState.tradingEnabled) {
    reasons.push('Trading is disabled (kill switch active)');
  }

  // Daily loss cap
  if (accountState.dailyRealizedPnlPct <= -config.maxDailyLossPct) {
    reasons.push(
      `Daily loss cap reached (${accountState.dailyRealizedPnlPct.toFixed(2)}% >= ${config.maxDailyLossPct}% limit)`
    );
  }

  // Max open positions
  if (accountState.openPositionCount >= config.maxOpenPositions) {
    reasons.push(
      `Max open positions reached (${accountState.openPositionCount}/${config.maxOpenPositions})`
    );
  }

  // Consecutive losses
  if (accountState.consecutiveLosses >= config.maxConsecutiveLosses) {
    reasons.push(
      `Consecutive loss limit reached (${accountState.consecutiveLosses}/${config.maxConsecutiveLosses})`
    );
  }

  // Net RR quality gate
  if (netRR.netRR < config.minNetRR) {
    reasons.push(
      `Net risk/reward too low (${netRR.netRR.toFixed(2)} < ${config.minNetRR} minimum after costs)`
    );
  }

  // ATR volatility gate
  if (regime.atrPercent > config.maxAtrPercent) {
    reasons.push(
      `ATR volatility too extreme (${regime.atrPercent.toFixed(2)}% > ${config.maxAtrPercent}% limit)`
    );
  }

  // Regime-specific warnings (informational, don't block)
  if (regime.regime === 'ranging') {
    warnings.push('Market is range-bound – trend-following signals are less reliable');
  }

  if (regime.regime === 'high_volatility') {
    warnings.push('High volatility regime – increased false signal risk');
  }

  return {
    allowed: reasons.length === 0,
    reasons: [...reasons, ...warnings],
  };
}

/**
 * Build a summary of the portfolio risk state for API responses.
 */
export function getPortfolioRiskSummary(
  config: PortfolioRiskConfig = DEFAULT_PORTFOLIO_RISK_CONFIG
): { tradingEnabled: boolean; dailyLossCapReached: boolean } {
  maybeResetDaily();
  return {
    tradingEnabled: accountState.tradingEnabled,
    dailyLossCapReached: accountState.dailyRealizedPnlPct <= -config.maxDailyLossPct,
  };
}

function roundTo1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function getPortfolioIntelligence(
  config: PortfolioRiskConfig = DEFAULT_PORTFOLIO_RISK_CONFIG
): PortfolioIntelligenceReport {
  maybeResetDaily();
  const entries = getJournalEntries().filter((entry) => entry.outcome !== 'PENDING');
  const completedCount = entries.length;
  const wins = entries.filter((entry) => isWinningOutcome(entry.outcome));
  const losses = entries.filter((entry) => entry.realizedPnlPct !== undefined && entry.realizedPnlPct < 0);
  const avgRR = completedCount > 0
    ? entries.reduce((sum, entry) => sum + entry.netRR, 0) / completedCount
    : 0;
  const winRate = completedCount > 0 ? (wins.length / completedCount) * 100 : 0;
  const pnlSeries = entries
    .map((entry) => entry.realizedPnlPct)
    .filter((value): value is number => typeof value === 'number');

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;
  for (const pnl of pnlSeries) {
    cumulative += pnl;
    if (cumulative > peak) peak = cumulative;
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }

  const mean = pnlSeries.length > 0 ? pnlSeries.reduce((sum, pnl) => sum + pnl, 0) / pnlSeries.length : 0;
  const variance = pnlSeries.length > 1
    ? pnlSeries.reduce((sum, pnl) => sum + (pnl - mean) ** 2, 0) / (pnlSeries.length - 1)
    : 0;
  const stdDev = variance > 0 ? Math.sqrt(variance) : 0;
  const sharpeLike = stdDev > 0 ? mean / stdDev : 0;

  const dailyLossCapReached = accountState.dailyRealizedPnlPct <= -config.maxDailyLossPct;
  const drawdownExceeded = maxDrawdown >= config.maxDrawdownPct;
  const lossesExceeded = accountState.consecutiveLosses >= config.maxConsecutiveLosses;
  const killSwitchCondition = dailyLossCapReached || drawdownExceeded || lossesExceeded;
  if (killSwitchCondition) {
    accountState.tradingEnabled = false;
  }

  const adjustments: string[] = [];
  const insights: string[] = [];
  const recent = entries.slice(-20);
  const recentCount = recent.length;
  const recentWins = recentCount > 0 ? recent.filter((entry) => isWinningOutcome(entry.outcome)).length : 0;
  const recentWinRate = recentCount > 0 ? (recentWins / recentCount) * 100 : winRate;
  const regimeStats = recent.reduce<Partial<Record<MarketRegime, { wins: number; total: number }>>>((acc, entry) => {
    const key = entry.regime;
    if (!acc[key]) acc[key] = { wins: 0, total: 0 };
    acc[key].total += 1;
    if (isWinningOutcome(entry.outcome)) {
      acc[key].wins += 1;
    }
    return acc;
  }, {});

  if (lossesExceeded) {
    adjustments.push(`Consecutive losses reached ${accountState.consecutiveLosses}; trading disabled`);
  }
  if (drawdownExceeded) {
    adjustments.push(`Drawdown ${roundTo1(maxDrawdown)}% exceeds ${config.maxDrawdownPct}% limit; kill switch engaged`);
  }
  if (dailyLossCapReached) {
    adjustments.push(`Daily loss ${roundTo1(Math.abs(accountState.dailyRealizedPnlPct))}% hit cap; stop trading`);
  }
  if (accountState.openPositionCount >= config.maxOpenPositions) {
    adjustments.push(`Reduce new trades: max open positions is ${config.maxOpenPositions}`);
  }
  if (recentCount >= MIN_TRADES_FOR_RISK_ASSESSMENT && recentWinRate < LOW_WIN_RATE_THRESHOLD) {
    adjustments.push(`Increase confidence threshold to ${ADAPTIVE_CONFIDENCE_THRESHOLD}`);
    adjustments.push(`Reduce position size to ${ADAPTIVE_POSITION_SIZE_PCT}%`);
    insights.push('Recent win rate deterioration suggests strategy degradation');
  }
  if (accountState.openPositionCount >= Math.max(1, config.maxOpenPositions - 1)) {
    adjustments.push('Potential overtrading detected; throttle new entries');
    insights.push('Open-position pressure indicates overtrading behavior');
  }
  if (regimeStats.ranging && regimeStats.ranging.total >= MIN_REGIME_SAMPLES) {
    const rangingWinRate = (regimeStats.ranging.wins / regimeStats.ranging.total) * 100;
    if (rangingWinRate < winRate) {
      adjustments.push('Conservative mode: tighten filters in sideways markets');
      insights.push('Strategy underperforming in sideways market');
    }
  }
  if ((regimeStats.trending_up?.total ?? 0) + (regimeStats.trending_down?.total ?? 0) >= MIN_REGIME_SAMPLES) {
    insights.push('Aggressive mode favored during trending regimes');
  }

  const riskLevel: PortfolioIntelligenceReport['risk_level'] =
    !accountState.tradingEnabled || maxDrawdown >= config.maxDrawdownPct || accountState.dailyRealizedPnlPct <= -config.maxDailyLossPct
      ? 'HIGH'
      : (completedCount >= MIN_TRADES_FOR_RISK_ASSESSMENT && winRate < LOW_WIN_RATE_THRESHOLD) ||
          accountState.openPositionCount >= config.maxOpenPositions - 1
        ? 'MEDIUM'
        : 'LOW';

  const portfolioStatus: PortfolioIntelligenceReport['portfolio_status'] =
    riskLevel === 'HIGH' ? 'CRITICAL' : riskLevel === 'MEDIUM' ? 'WARNING' : 'SAFE';

  if (adjustments.length === 0) {
    adjustments.push('No immediate changes required; continue current risk controls');
  }
  if (insights.length === 0) {
    insights.push('Performance stable under current market conditions');
  }

  return {
    portfolio_status: portfolioStatus,
    trading_enabled: accountState.tradingEnabled,
    risk_level: riskLevel,
    adjustments,
    performance_summary: {
      win_rate: roundTo1(winRate),
      avg_rr: roundTo1(avgRR),
      drawdown: roundTo1(maxDrawdown),
      sharpe_like: roundTo1(sharpeLike),
    },
    insights,
  };
}
