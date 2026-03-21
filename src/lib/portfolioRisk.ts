// ============================================================
// Portfolio-level risk guards
// Enforces daily loss caps, max open positions, loss streaks,
// and a kill switch to immediately disable trading signals.
// ============================================================

import {
  AccountState,
  NetRiskReward,
  PortfolioRiskCheck,
  PortfolioRiskConfig,
  RegimeResult,
} from './types';

// ============================================================
// Default configuration
// ============================================================
export const DEFAULT_PORTFOLIO_RISK_CONFIG: PortfolioRiskConfig = {
  maxDailyLossPct: 3,        // 3% max daily loss
  maxConsecutiveLosses: 4,   // 4 consecutive losses → pause
  maxOpenPositions: 3,       // max 3 open positions at once
  minNetRR: 1.5,             // minimum 1.5 net RR after costs
  maxAtrPercent: 8,          // reject if ATR% > 8 (extreme volatility)
};

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
