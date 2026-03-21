// ============================================================
// Market regime detection – trend / range / high-volatility
// Uses ATR, ADX, and moving average alignment to classify
// the current market environment for a given asset.
// ============================================================

import { Candle, IndicatorResults, MarketRegime, RegimeResult } from './types';
import { calculateATR } from './risk';

/**
 * Detect the current market regime from indicator results and candles.
 *
 * Classification rules:
 * - high_volatility: ATR% > threshold (default 5%) regardless of trend
 * - trending_up:     ADX > 25 and MA trend is bullish
 * - trending_down:   ADX > 25 and MA trend is bearish
 * - ranging:         ADX <= 25 (weak directional movement)
 */
export function detectRegime(
  candles: Candle[],
  indicators: IndicatorResults
): RegimeResult {
  const price = candles.length > 0 ? candles[candles.length - 1].close : 0;
  const atr = calculateATR(candles);
  const atrPercent = price > 0 ? (atr / price) * 100 : 0;
  const adxValue = indicators.adx?.adx ?? 0;
  const adxTrend = indicators.adx?.trend ?? 'none';
  const maTrend = indicators.ma.trend;

  // Determine trend direction from multiple sources
  let trendDirection: 'up' | 'down' | 'neutral' = 'neutral';
  if (maTrend === 'bullish' || adxTrend === 'strong_bull') {
    trendDirection = 'up';
  } else if (maTrend === 'bearish' || adxTrend === 'strong_bear') {
    trendDirection = 'down';
  }

  // High volatility threshold: ATR > 5% of price
  const HIGH_VOL_THRESHOLD = 5;
  // ADX threshold for trending vs ranging
  const ADX_TREND_THRESHOLD = 25;

  let regime: MarketRegime;
  let confidence: number;
  let description: string;

  if (atrPercent > HIGH_VOL_THRESHOLD) {
    regime = 'high_volatility';
    confidence = Math.min(95, 50 + atrPercent * 5);
    description = `High volatility (ATR ${atrPercent.toFixed(1)}%) – wider stops needed, higher false signal risk`;
  } else if (adxValue > ADX_TREND_THRESHOLD && trendDirection === 'up') {
    regime = 'trending_up';
    confidence = Math.min(95, 40 + adxValue);
    description = `Uptrend (ADX ${adxValue.toFixed(0)}) – trend-following signals favored`;
  } else if (adxValue > ADX_TREND_THRESHOLD && trendDirection === 'down') {
    regime = 'trending_down';
    confidence = Math.min(95, 40 + adxValue);
    description = `Downtrend (ADX ${adxValue.toFixed(0)}) – short signals favored, longs risky`;
  } else {
    regime = 'ranging';
    confidence = Math.min(90, 60 + (ADX_TREND_THRESHOLD - adxValue) * 2);
    description = `Range-bound (ADX ${adxValue.toFixed(0)}) – mean-reversion signals favored, breakout signals risky`;
  }

  return {
    regime,
    confidence: Math.round(confidence),
    atrPercent: Math.round(atrPercent * 100) / 100,
    adxValue: Math.round(adxValue * 100) / 100,
    trendDirection,
    description,
  };
}
