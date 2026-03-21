// ============================================================
// Core analysis engine – scoring & signal generation
// ============================================================

import {
  Candle,
  BinanceTicker,
  CoinAnalysis,
  EnhancedCoinAnalysis,
  EnhancedTradeSignal,
  IndicatorResults,
  RiskTargets,
  Signal,
  TradeSignal,
} from './types';
import { calculateRSI, calculateMACD, calculateBollinger, calculateVolume, calculateMA } from './indicators';
import { calculateIchimoku } from './indicators/ichimoku';
import { calculateStochasticRSI } from './indicators/stochasticRSI';
import { calculateADX } from './indicators/adx';
import { calculateFibonacci } from './indicators/fibonacci';
import { calculateRiskTargets, calculateNetRiskReward, DEFAULT_COST_ASSUMPTIONS } from './risk';
import { detectRegime } from './regime';
import { canOpenTrade } from './portfolioRisk';
import { logSignal } from './tradeJournal';
import { BUY_THRESHOLD, COMPOSITE_KEYS, SELL_THRESHOLD } from './scoring';
import { roundTo8 } from './utils';

/** Run all indicators on a set of candles */
export function runIndicators(candles: Candle[]): IndicatorResults {
  return {
    rsi: calculateRSI(candles),
    macd: calculateMACD(candles),
    bollinger: calculateBollinger(candles),
    volume: calculateVolume(candles),
    ma: calculateMA(candles),
    ichimoku: calculateIchimoku(candles),
    stochRSI: calculateStochasticRSI(candles),
    adx: calculateADX(candles),
    fibonacci: calculateFibonacci(candles),
  };
}

/** Calculate composite score from indicator results */
export function calculateCompositeScore(indicators: IndicatorResults): number {
  const scores = COMPOSITE_KEYS.map((key) =>
    key === 'ichimoku' ? indicators.ichimoku?.score ?? 50 : indicators[key].score
  );
  const average = scores.reduce((sum, val) => sum + val, 0) / scores.length;
  return Math.round(average * 100) / 100;
}

/** Determine signal from composite score */
export function determineSignal(score: number): Signal {
  if (score > SELL_THRESHOLD) return 'SELL';
  if (score < BUY_THRESHOLD) return 'BUY';
  return 'HOLD';
}

/** Build a detailed trade signal with entry zone, confidence, and rationale */
export function buildTradeSignal(
  price: number,
  score: number,
  indicators: IndicatorResults
): TradeSignal {
  const signal = determineSignal(score);
  const rationale: string[] = [];

  if (indicators.rsi.signal === 'oversold') rationale.push('RSI oversold – potential reversal');
  if (indicators.rsi.signal === 'overbought') rationale.push('RSI overbought – caution');
  if (indicators.macd.crossover === 'bullish') rationale.push('MACD bullish crossover');
  if (indicators.macd.crossover === 'bearish') rationale.push('MACD bearish crossover');
  if (indicators.bollinger.percentB < 0.2) rationale.push('Price near lower Bollinger Band');
  if (indicators.bollinger.percentB > 0.8) rationale.push('Price near upper Bollinger Band');
  if (indicators.volume.spike) rationale.push('Volume spike detected');
  if (indicators.ma.goldenCross) rationale.push('Golden cross (EMA9 > EMA21 > SMA50)');
  if (indicators.ma.trend === 'bullish') rationale.push('Moving averages bullish alignment');
  if (indicators.ichimoku?.signal === 'bullish') rationale.push('Price above Ichimoku cloud');
  if (indicators.ichimoku?.signal === 'bearish') rationale.push('Price below Ichimoku cloud');
  if (indicators.stochRSI?.signal === 'oversold') rationale.push('Stochastic RSI oversold');
  if ((indicators.adx?.adx ?? 0) > 25 && indicators.adx?.trend === 'strong_bull')
    rationale.push(`ADX ${indicators.adx?.adx} – strong uptrend confirmed`);
  if ((indicators.adx?.adx ?? 0) > 25 && indicators.adx?.trend === 'strong_bear')
    rationale.push(`ADX ${indicators.adx?.adx} – strong downtrend confirmed`);
  rationale.push(
    `Composite score ${Math.round(score)} uses equal weighting across RSI, MACD, Bollinger, Volume, MA, and Ichimoku`
  );

  // Entry zone: ±0.5% around current price
  const entryZoneLow = Math.round(price * 0.995 * 1e8) / 1e8;
  const entryZoneHigh = Math.round(price * 1.005 * 1e8) / 1e8;

  return {
    type: signal,
    entryZoneLow,
    entryZoneHigh,
    confidence: Math.max(
      0,
      Math.min(
        100,
        signal === 'BUY'
          ? Math.round((BUY_THRESHOLD - score) + 60)
          : signal === 'SELL'
            ? Math.round((score - SELL_THRESHOLD) + 60)
            : Math.round(100 - Math.min(Math.abs(score - BUY_THRESHOLD), Math.abs(score - SELL_THRESHOLD)) * 2)
      )
    ),
    rationale: rationale.slice(0, 5),
  };
}

function shouldUseShortSetup(signal: Signal, indicators: IndicatorResults): boolean {
  if (signal === 'SELL') return true;
  if (signal === 'BUY') return false;

  return (
    indicators.ma.trend === 'bearish' ||
    indicators.ichimoku?.signal === 'bearish' ||
    ((indicators.adx?.adx ?? 0) > 25 && indicators.adx?.trend === 'strong_bear')
  );
}

function orientRiskTargetsForSignal(
  risk: RiskTargets,
  signal: Signal,
  indicators: IndicatorResults
): RiskTargets {
  if (!shouldUseShortSetup(signal, indicators)) return risk;

  const { entryPrice } = risk;
  const stopDistance = Math.abs(entryPrice - risk.stopLoss);
  const tp1Distance = Math.abs(risk.takeProfit1 - entryPrice);
  const tp2Distance = Math.abs(risk.takeProfit2 - entryPrice);
  const tp3Distance = Math.abs(risk.takeProfit3 - entryPrice);
  const targetDistance = Math.abs(risk.targetPrice - entryPrice);

  const stopLoss = roundTo8(entryPrice + stopDistance);
  const targetPrice = roundTo8(entryPrice - targetDistance);
  const takeProfit1 = roundTo8(entryPrice - tp1Distance);
  const takeProfit2 = roundTo8(entryPrice - tp2Distance);
  const takeProfit3 = roundTo8(entryPrice - tp3Distance);

  return {
    ...risk,
    stopLoss,
    targetPrice,
    takeProfit1,
    takeProfit2,
    takeProfit3,
  };
}

/** Full analysis of a single coin given its ticker data and candles */
export function analyzeCoin(ticker: BinanceTicker, candles: Candle[]): CoinAnalysis {
  const price = parseFloat(ticker.lastPrice);
  const indicators = runIndicators(candles);
  const score = calculateCompositeScore(indicators);
  const signal = determineSignal(score);
  const risk = orientRiskTargetsForSignal(calculateRiskTargets(price, candles), signal, indicators);
  const tradeSignal = buildTradeSignal(price, score, indicators);

  return {
    symbol: ticker.symbol,
    price,
    priceChange24h: parseFloat(ticker.priceChange),
    priceChangePercent: parseFloat(ticker.priceChangePercent),
    volume24h: parseFloat(ticker.quoteVolume),
    high24h: parseFloat(ticker.highPrice),
    low24h: parseFloat(ticker.lowPrice),
    score,
    signal,
    indicators,
    risk,
    tradeSignal,
    updatedAt: Date.now(),
  };
}

/**
 * Enhanced analysis: adds execution cost model, regime detection,
 * portfolio risk checks, rejection reasons, and trade journaling.
 */
export function analyzeEnhanced(
  ticker: BinanceTicker,
  candles: Candle[]
): EnhancedCoinAnalysis {
  const base = analyzeCoin(ticker, candles);
  const { price, risk, indicators, score, tradeSignal } = base;

  // Execution cost model
  const netRiskReward = calculateNetRiskReward(
    price,
    risk.stopLoss,
    risk.targetPrice,
    DEFAULT_COST_ASSUMPTIONS
  );

  // Market regime detection
  const regime = detectRegime(candles, indicators);

  // Portfolio risk check & rejection reasons
  const portfolioCheck = canOpenTrade(netRiskReward, regime);
  const rejectionReasons = portfolioCheck.reasons;

  // Enhanced trade signal
  const enhancedTradeSignal: EnhancedTradeSignal = {
    ...tradeSignal,
    netRiskReward,
    regime,
    rejectionReasons,
  };

  // Log BUY signals to the trade journal
  if (base.signal === 'BUY') {
    logSignal({
      symbol: base.symbol,
      signal: base.signal,
      entryPrice: price,
      stopLoss: risk.stopLoss,
      takeProfit1: risk.takeProfit1,
      takeProfit2: risk.takeProfit2,
      takeProfit3: risk.takeProfit3,
      score,
      confidence: tradeSignal.confidence,
      regime: regime.regime,
      netRR: netRiskReward.netRR,
      costAssumptions: DEFAULT_COST_ASSUMPTIONS,
      rationale: tradeSignal.rationale,
      indicators,
    });
  }

  return {
    ...base,
    netRiskReward,
    regime,
    rejectionReasons,
    enhancedTradeSignal,
  };
}
