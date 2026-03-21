// ============================================================
// Risk management – stop loss, multi-level take-profit, risk/reward
// Uses ATR (Average True Range) for volatility-based adjustment
// ============================================================

import { Candle, CostAssumptions, NetRiskReward, RiskTargets } from './types';
import { roundTo8 } from './utils';

// ============================================================
// Default execution cost assumptions (Bybit linear/spot-like)
// ============================================================
export const DEFAULT_COST_ASSUMPTIONS: CostAssumptions = {
  makerFeePct: 0.1,   // 0.1% maker fee
  takerFeePct: 0.1,    // 0.1% taker fee
  slippageBps: 5,      // 5 bps expected slippage
  spreadBps: 3,        // 3 bps expected spread
};

/** Calculate Average True Range for volatility measurement */
export function calculateATR(candles: Candle[], period: number = 14): number {
  if (candles.length < period + 1) return 0;

  const trueRanges: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high;
    const low = candles[i].low;
    const prevClose = candles[i - 1].close;
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    trueRanges.push(tr);
  }

  // Simple ATR: average of last 'period' true ranges
  const recentTR = trueRanges.slice(-period);
  return recentTR.reduce((a, b) => a + b, 0) / recentTR.length;
}

/**
 * Calculate risk targets with dynamic ATR-based adjustment.
 * Includes three take-profit levels at 50%, 75%, and 100% of the full target.
 */
export function calculateRiskTargets(price: number, candles: Candle[]): RiskTargets {
  const atr = calculateATR(candles);
  const atrPercent = price > 0 ? (atr / price) * 100 : 2;

  // Adjust for volatility: high-volatility coins get wider stops
  const volatilityMultiplier = Math.max(1, Math.min(2, atrPercent / 2));

  const stopLossPercent = Math.min(5, 2.5 * volatilityMultiplier); // 2.5% to 5%
  // Strict 1:3 risk-to-reward framework
  const targetPercent = stopLossPercent * 3;

  const stopLoss = price * (1 - stopLossPercent / 100);
  const targetPrice = price * (1 + targetPercent / 100);

  const riskRewardRatio = 3;

  // Multi-level take-profit at 1R, 2R, and 3R
  const takeProfit1Percent = Math.round(stopLossPercent * 100) / 100;
  const takeProfit2Percent = Math.round(stopLossPercent * 2 * 100) / 100;
  const takeProfit3Percent = Math.round(targetPercent * 100) / 100;

  const round = roundTo8;

  return {
    entryPrice: price,
    stopLoss: round(stopLoss),
    targetPrice: round(targetPrice),
    stopLossPercent: Math.round(stopLossPercent * 100) / 100,
    targetPercent: Math.round(targetPercent * 100) / 100,
    riskRewardRatio: Math.round(riskRewardRatio * 100) / 100,
    takeProfit1: round(price * (1 + takeProfit1Percent / 100)),
    takeProfit2: round(price * (1 + takeProfit2Percent / 100)),
    takeProfit3: round(price * (1 + takeProfit3Percent / 100)),
    takeProfit1Percent,
    takeProfit2Percent,
    takeProfit3Percent,
  };
}

/**
 * Calculate short-term risk targets for 1–2 hour intraday trading.
 * Uses ATR-based stops and strict 1:3 reward structure (+1R, +2R, +3R).
 */
export function calculateShortTermRisk(price: number, candles: Candle[]): {
  stopLoss: number;
  stopLossPercent: number;
  takeProfit1: number;
  takeProfit1Percent: number;
  takeProfit2: number;
  takeProfit2Percent: number;
  takeProfit3: number;
  takeProfit3Percent: number;
  riskRewardRatio: number;
} {
  const atr = calculateATR(candles);
  const atrPercent = price > 0 ? (atr / price) * 100 : 2;

  // Clamp stop loss between 1.5% and 3% based on ATR
  const slPercent = Math.max(1.5, Math.min(3, atrPercent));
  // Strict 1:3 risk-to-reward via 1R/2R/3R targets
  const tp1Percent = Math.round(slPercent * 100) / 100;
  const tp2Percent = Math.round(slPercent * 2 * 100) / 100;
  const tp3Percent = Math.round(slPercent * 3 * 100) / 100;

  const round = roundTo8;
  const stopLoss = round(price * (1 - slPercent / 100));
  const tp3Price = round(price * (1 + tp3Percent / 100));
  const riskRewardRatio = 3;

  return {
    stopLoss,
    stopLossPercent: Math.round(slPercent * 100) / 100,
    takeProfit1: round(price * (1 + tp1Percent / 100)),
    takeProfit1Percent: tp1Percent,
    takeProfit2: round(price * (1 + tp2Percent / 100)),
    takeProfit2Percent: tp2Percent,
    takeProfit3: tp3Price,
    takeProfit3Percent: tp3Percent,
    riskRewardRatio,
  };
}

/**
 * Calculate position size in units based on account risk.
 * @param accountSize - Total account value in USD
 * @param riskPercent - Percentage of account willing to risk (e.g. 1 for 1%)
 * @param entryPrice  - Entry price of the asset
 * @param stopLoss    - Stop-loss price
 * @returns Number of units to buy, or 0 if inputs are invalid
 */
export function calculatePositionSize(
  accountSize: number,
  riskPercent: number,
  entryPrice: number,
  stopLoss: number
): number {
  const riskAmount = accountSize * (riskPercent / 100);
  const riskPerUnit = Math.abs(entryPrice - stopLoss);
  if (riskPerUnit <= 0) return 0;
  return Math.floor((riskAmount / riskPerUnit) * 1e8) / 1e8;
}

// ============================================================
// Execution cost model
// ============================================================

/** Estimate fee in price terms for a given position */
export function estimateFees(
  price: number,
  size: number,
  feePct: number
): number {
  return price * size * (feePct / 100);
}

/** Estimate slippage in price terms */
export function estimateSlippage(
  price: number,
  bps: number
): number {
  return price * (bps / 10_000);
}

/**
 * Calculate net risk/reward after accounting for fees, slippage, and spread.
 * Models a full round-trip: entry cost + exit cost.
 */
export function calculateNetRiskReward(
  entryPrice: number,
  stopLoss: number,
  targetPrice: number,
  costs: CostAssumptions = DEFAULT_COST_ASSUMPTIONS
): NetRiskReward {
  const round = roundTo8;
  const isShort = targetPrice < entryPrice;

  // Entry costs: taker fee (market order) + slippage + half spread
  const entryFeePct = costs.takerFeePct / 100;
  const entrySlippagePct = costs.slippageBps / 10_000;
  const halfSpreadPct = costs.spreadBps / 20_000;
  const totalEntryCostPct = entryFeePct + entrySlippagePct + halfSpreadPct;

  // Exit costs: maker fee (limit order for TP) or taker fee (market order for SL)
  const exitFeePct = costs.makerFeePct / 100; // assume limit exit
  const exitSlippagePct = costs.slippageBps / 10_000;
  const totalExitCostPct = exitFeePct + exitSlippagePct + halfSpreadPct;

  // Total round-trip cost as % of position
  const totalCostPct = (totalEntryCostPct + totalExitCostPct) * 100;

  // Adjusted prices
  const entrySlippage = entryPrice * (entrySlippagePct + halfSpreadPct);
  const exitSlippage = entryPrice * (exitSlippagePct + halfSpreadPct);
  const entryFee = entryPrice * entryFeePct;
  const exitFee = entryPrice * exitFeePct;

  const effectiveEntry = isShort
    ? entryPrice * (1 - totalEntryCostPct)
    : entryPrice * (1 + totalEntryCostPct);
  const netTarget = isShort
    ? targetPrice * (1 + totalExitCostPct)
    : targetPrice * (1 - totalExitCostPct);
  const netStopLoss = isShort
    ? stopLoss * (1 + totalExitCostPct)
    : stopLoss * (1 - totalExitCostPct);

  // Gross risk/reward (before costs)
  const grossGain = isShort ? entryPrice - targetPrice : targetPrice - entryPrice;
  const grossLoss = isShort ? stopLoss - entryPrice : entryPrice - stopLoss;
  const grossRR = grossLoss > 0 ? grossGain / grossLoss : 0;

  // Net risk/reward (after costs)
  const netGain = isShort ? effectiveEntry - netTarget : netTarget - effectiveEntry;
  const netLoss = isShort ? netStopLoss - effectiveEntry : effectiveEntry - netStopLoss;
  const netRR = netLoss > 0 ? Math.max(0, netGain / netLoss) : 0;

  // Break-even: minimum % move from entry to cover round-trip costs
  const breakEvenMovePct = totalCostPct;

  return {
    grossRR: Math.round(grossRR * 100) / 100,
    netRR: Math.round(netRR * 100) / 100,
    breakEvenMovePct: Math.round(breakEvenMovePct * 10000) / 10000,
    totalCostPct: Math.round(totalCostPct * 10000) / 10000,
    entrySlippage: round(entrySlippage),
    exitSlippage: round(exitSlippage),
    entryFee: round(entryFee),
    exitFee: round(exitFee),
    netTarget: round(netTarget),
    netStopLoss: round(netStopLoss),
    costAssumptions: costs,
  };
}
