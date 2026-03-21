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
  StructuredTradeDecision,
  TradeSignal,
} from './types';
import { calculateRSI, calculateMACD, calculateBollinger, calculateVolume, calculateMA } from './indicators';
import { calculateIchimoku } from './indicators/ichimoku';
import { calculateStochasticRSI } from './indicators/stochasticRSI';
import { calculateADX } from './indicators/adx';
import { calculateFibonacci } from './indicators/fibonacci';
import { calculateRiskTargets, calculateNetRiskReward, DEFAULT_COST_ASSUMPTIONS } from './risk';
import { detectRegime } from './regime';
import { canOpenTrade, getAccountState } from './portfolioRisk';
import { logSignal } from './tradeJournal';
import { BUY_THRESHOLD, COMPOSITE_KEYS, SELL_THRESHOLD } from './scoring';
import { roundTo8 } from './utils';
import {
  RANGING_MARKET_REGIME,
  VOLATILE_MARKET_REGIME,
  EXTREME_VOLATILITY_THRESHOLD,
  HIGH_VOLATILITY_POSITION_SIZE_PCT,
  HIGH_VOLATILITY_THRESHOLD,
  MAX_POSITION_SIZE_PCT,
  MIN_CONFIDENCE_THRESHOLD,
  MIN_POSITION_SIZE_PCT,
  MIN_PROBABILITY_THRESHOLD,
  MIN_RR_FIRST_TRADE,
  MIN_RR_SUBSEQUENT_TRADES,
  POSITION_SIZE_REDUCTION_PER_OPEN_TRADE,
  MODERATE_VOLATILITY_POSITION_SIZE_PCT,
  MODERATE_VOLATILITY_THRESHOLD,
  MAX_DECISION_REASONS,
} from './tradeDecisionConfig';

type MarketStructure = 'higher_highs' | 'lower_lows' | 'range';

function detectMarketStructure(candles: Candle[]): MarketStructure {
  if (candles.length < 6) return 'range';
  const recent = candles.slice(-6);
  let higherHighs = 0;
  let higherLows = 0;
  let lowerHighs = 0;
  let lowerLows = 0;

  for (let i = 1; i < recent.length; i++) {
    if (recent[i].high > recent[i - 1].high) higherHighs++;
    if (recent[i].low > recent[i - 1].low) higherLows++;
    if (recent[i].high < recent[i - 1].high) lowerHighs++;
    if (recent[i].low < recent[i - 1].low) lowerLows++;
  }

  if (higherHighs >= 3 && higherLows >= 3) return 'higher_highs';
  if (lowerHighs >= 3 && lowerLows >= 3) return 'lower_lows';
  return 'range';
}

function evaluateDataQuality(candles: Candle[]): { quality: number; flags: string[] } {
  const flags: string[] = [];
  if (candles.length < 60) flags.push('Insufficient candle history');
  if (candles.length < 3) return { quality: 30, flags };

  const intervals: number[] = [];
  for (let i = 1; i < candles.length; i++) intervals.push(candles[i].openTime - candles[i - 1].openTime);
  const typicalInterval = intervals[Math.floor(intervals.length / 2)] ?? intervals[0] ?? 0;

  let missingCandles = 0;
  let anomalySpikes = 0;
  for (let i = 1; i < candles.length; i++) {
    const gap = candles[i].openTime - candles[i - 1].openTime;
    if (typicalInterval > 0 && gap > typicalInterval * 1.5) missingCandles++;
    const jump = Math.abs((candles[i].close - candles[i - 1].close) / Math.max(candles[i - 1].close, 1e-8));
    if (jump > 0.15) anomalySpikes++;
  }

  if (missingCandles > 0) flags.push('Missing candle gaps detected');
  if (anomalySpikes > 0) flags.push('Abnormal price spikes detected');

  let quality = 100;
  quality -= Math.min(40, missingCandles * 10);
  quality -= Math.min(35, anomalySpikes * 7);
  if (candles.length < 60) quality -= 15;

  return { quality: Math.max(0, Math.round(quality)), flags };
}

function estimateHistoricalSimilarityProbability(candles: Candle[]): number {
  const lookback = 10;
  const horizon = 3;
  if (candles.length < lookback + horizon + 15) return 0.5;

  const closes = candles.map((c) => c.close);
  const currentStart = closes.length - lookback - horizon;
  const currentWindow = closes.slice(currentStart, currentStart + lookback);
  const candidates: { distance: number; nextReturn: number }[] = [];

  for (let i = lookback; i <= closes.length - lookback - horizon; i++) {
    const pastWindow = closes.slice(i - lookback, i);
    let distance = 0;
    for (let j = 1; j < lookback; j++) {
      const curRet = (currentWindow[j] - currentWindow[j - 1]) / Math.max(currentWindow[j - 1], 1e-8);
      const pastRet = (pastWindow[j] - pastWindow[j - 1]) / Math.max(pastWindow[j - 1], 1e-8);
      distance += Math.abs(curRet - pastRet);
    }
    const nextReturn = (closes[i + horizon] - closes[i]) / Math.max(closes[i], 1e-8);
    candidates.push({ distance, nextReturn });
  }

  candidates.sort((a, b) => a.distance - b.distance);
  const nearest = candidates.slice(0, 7);
  if (nearest.length === 0) return 0.5;

  const upCount = nearest.filter((s) => s.nextReturn > 0).length;
  return upCount / nearest.length;
}

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
  indicators: IndicatorResults,
  candles: Candle[]
): TradeSignal {
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
  const regime = detectRegime(candles, indicators);
  const market_regime: TradeSignal['market_regime'] =
    regime.regime === 'high_volatility' ? 'VOLATILE' : regime.regime === 'ranging' ? 'RANGING' : 'TRENDING';
  const dataQuality = evaluateDataQuality(candles);
  const marketStructure = detectMarketStructure(candles);
  const historicalSimilarityUpProb = estimateHistoricalSimilarityProbability(candles);

  const bullishSignals = [
    indicators.rsi.signal !== 'overbought',
    indicators.macd.crossover === 'bullish' || indicators.macd.histogram > 0,
    indicators.ma.trend === 'bullish',
    indicators.ichimoku?.signal === 'bullish',
    indicators.stochRSI?.signal === 'oversold',
  ].filter(Boolean).length;
  const bearishSignals = [
    indicators.rsi.signal === 'overbought',
    indicators.macd.crossover === 'bearish' || indicators.macd.histogram < 0,
    indicators.ma.trend === 'bearish',
    indicators.ichimoku?.signal === 'bearish',
    indicators.stochRSI?.signal === 'overbought',
  ].filter(Boolean).length;
  const structureUpProb =
    marketStructure === 'higher_highs' ? 0.62 : marketStructure === 'lower_lows' ? 0.38 : 0.5;
  const indicatorUpProb =
    bullishSignals + bearishSignals > 0 ? bullishSignals / (bullishSignals + bearishSignals) : 0.5;
  const ensembleUpProb = Math.min(
    0.95,
    Math.max(0.05, 0.45 * indicatorUpProb + 0.35 * historicalSimilarityUpProb + 0.2 * structureUpProb)
  );
  const agreement = Math.round(
    ((Math.max(bullishSignals, bearishSignals) / Math.max(bullishSignals + bearishSignals, 1)) * 100)
  );
  const baseConfidence = Math.round(agreement * 0.45 + regime.confidence * 0.3 + dataQuality.quality * 0.25);

  const prediction: TradeSignal['prediction'] =
    baseConfidence < 60 ? 'SIDEWAYS' : ensembleUpProb >= 0.56 ? 'UP' : ensembleUpProb <= 0.44 ? 'DOWN' : 'SIDEWAYS';
  const probabilityRaw = prediction === 'UP' ? ensembleUpProb : prediction === 'DOWN' ? 1 - ensembleUpProb : 0.5;
  const probability = Math.round(probabilityRaw * 100) / 100;
  const signal: Signal = prediction === 'UP' ? 'BUY' : prediction === 'DOWN' ? 'SELL' : 'HOLD';
  const keyFactors = rationale.slice(0, 3);
  const riskFlags: string[] = [...dataQuality.flags];
  if (indicators.volume.volumeRatio < 0.8) riskFlags.push('Low liquidity');
  if (Math.abs(indicators.macd.histogram) > 0.02) riskFlags.push('News-driven momentum risk');
  if (indicators.rsi.signal === 'overbought') riskFlags.push('Overbought conditions');
  if (indicators.rsi.signal === 'oversold') riskFlags.push('Oversold bounce risk');
  if (market_regime === 'VOLATILE') riskFlags.push('High volatility');
  if ((indicators.adx?.adx ?? 0) < 15) riskFlags.push('Weak trend structure');
  if (baseConfidence < 60) riskFlags.push('Low confidence setup');

  return {
    type: signal,
    entryZoneLow,
    entryZoneHigh,
    confidence: baseConfidence,
    prediction,
    probability,
    market_regime,
    key_factors: keyFactors,
    risk_flags: riskFlags.slice(0, 4),
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

function buildTradeDecision(
  tradeSignal: TradeSignal,
  risk: RiskTargets,
  netRiskReward: ReturnType<typeof calculateNetRiskReward>,
  regime: ReturnType<typeof detectRegime>,
  rejectionReasons: string[]
): StructuredTradeDecision {
  const accountState = getAccountState();
  const calculatePositionSizePct = (): number => {
    const portfolioAdjustedSizePct = Math.min(
      MAX_POSITION_SIZE_PCT,
      Math.max(
        MIN_POSITION_SIZE_PCT,
        MAX_POSITION_SIZE_PCT - accountState.openPositionCount * POSITION_SIZE_REDUCTION_PER_OPEN_TRADE
      )
    );
    const volatilityAdjustedSize =
      regime.atrPercent > HIGH_VOLATILITY_THRESHOLD
        ? HIGH_VOLATILITY_POSITION_SIZE_PCT
        : regime.atrPercent > MODERATE_VOLATILITY_THRESHOLD
          ? MODERATE_VOLATILITY_POSITION_SIZE_PCT
          : MAX_POSITION_SIZE_PCT;
    return Math.max(
      MIN_POSITION_SIZE_PCT,
      Math.min(MAX_POSITION_SIZE_PCT, portfolioAdjustedSizePct, volatilityAdjustedSize)
    );
  };
  const positionSizePct = calculatePositionSizePct();
  const hasConflictingSignals = tradeSignal.type === 'HOLD';
  const hasSidewaysPrediction = tradeSignal.prediction === 'SIDEWAYS';
  const hasExtremeVolatility =
    regime.atrPercent > EXTREME_VOLATILITY_THRESHOLD || tradeSignal.market_regime === VOLATILE_MARKET_REGIME;
  const hasLowConfidence = tradeSignal.confidence < MIN_CONFIDENCE_THRESHOLD;
  const hasLowProbability = tradeSignal.probability < MIN_PROBABILITY_THRESHOLD;
  const requiredRiskReward =
    accountState.openPositionCount > 0 ? MIN_RR_SUBSEQUENT_TRADES : MIN_RR_FIRST_TRADE;
  const hasLowRiskReward = netRiskReward.netRR < requiredRiskReward;
  const marketRanging = regime.regime === 'ranging' || tradeSignal.market_regime === RANGING_MARKET_REGIME;

  const decisionReasons: string[] = [];
  if (hasLowConfidence) decisionReasons.push(`Confidence below required threshold (${MIN_CONFIDENCE_THRESHOLD})`);
  if (hasLowProbability) decisionReasons.push(`Probability below required threshold (${MIN_PROBABILITY_THRESHOLD})`);
  if (marketRanging || hasSidewaysPrediction) decisionReasons.push('Sideways/ranging market regime detected');
  if (hasConflictingSignals) decisionReasons.push('Conflicting indicator signals (no directional edge)');
  if (hasExtremeVolatility) decisionReasons.push('Extreme volatility detected');
  if (hasLowRiskReward) {
    decisionReasons.push(`Risk-reward below minimum ${requiredRiskReward.toFixed(1)} after costs`);
  }
  if (rejectionReasons.length > 0) decisionReasons.push(...rejectionReasons);

  const decision: StructuredTradeDecision['decision'] =
    decisionReasons.length > 0
      ? 'NO_TRADE'
      : tradeSignal.type === 'SELL'
        ? 'SELL'
        : 'BUY';

  const buildDecisionReasoning = (): string[] => {
    if (decision === 'NO_TRADE') {
      return decisionReasons.slice(0, MAX_DECISION_REASONS);
    }
    return [
      `Directional move probability ${(tradeSignal.probability * 100).toFixed(0)}% and confidence ${tradeSignal.confidence}% pass required thresholds`,
      `Market regime ${tradeSignal.market_regime} with ATR ${regime.atrPercent.toFixed(2)}% indicates acceptable trend/volatility conditions`,
      `Net risk-reward ${netRiskReward.netRR.toFixed(2)} exceeds required ${requiredRiskReward.toFixed(1)}`,
    ];
  };
  const directionalReasoning = buildDecisionReasoning();

  return {
    decision,
    entry_zone: [tradeSignal.entryZoneLow, tradeSignal.entryZoneHigh],
    stop_loss: risk.stopLoss,
    take_profits: [risk.takeProfit1, risk.takeProfit2, risk.takeProfit3],
    risk_reward_ratio: netRiskReward.netRR,
    position_size_pct: positionSizePct,
    confidence: tradeSignal.confidence,
    reasoning: directionalReasoning,
  };
}

/** Full analysis of a single coin given its ticker data and candles */
export function analyzeCoin(ticker: BinanceTicker, candles: Candle[]): CoinAnalysis {
  const price = parseFloat(ticker.lastPrice);
  const indicators = runIndicators(candles);
  const score = calculateCompositeScore(indicators);
  const signal = determineSignal(score);
  const risk = orientRiskTargetsForSignal(calculateRiskTargets(price, candles), signal, indicators);
  const tradeSignal = buildTradeSignal(price, score, indicators, candles);
  const finalSignal: Signal =
    tradeSignal.prediction === 'UP'
      ? 'BUY'
      : tradeSignal.prediction === 'DOWN'
        ? 'SELL'
        : 'HOLD';

  return {
    symbol: ticker.symbol,
    price,
    priceChange24h: parseFloat(ticker.priceChange),
    priceChangePercent: parseFloat(ticker.priceChangePercent),
    volume24h: parseFloat(ticker.quoteVolume),
    high24h: parseFloat(ticker.highPrice),
    low24h: parseFloat(ticker.lowPrice),
    score,
    signal: finalSignal,
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
  const tradeDecision = buildTradeDecision(tradeSignal, base.risk, netRiskReward, regime, rejectionReasons);

  // Enhanced trade signal
  const enhancedTradeSignal: EnhancedTradeSignal = {
    ...tradeSignal,
    netRiskReward,
    regime,
    rejectionReasons,
    tradeDecision,
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
