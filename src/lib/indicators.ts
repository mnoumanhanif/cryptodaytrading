// ============================================================
// Technical indicators: RSI, MACD, Bollinger Bands, Volume, MA
// ============================================================

import {
  Candle,
  RSIResult,
  MACDResult,
  BollingerResult,
  VolumeResult,
  MAResult,
} from './types';
import { ema, sma } from './math';
import { roundTo8, clampScore } from './utils';

// ============================================================
// RSI (14-period)
// ============================================================
export function calculateRSI(candles: Candle[], period: number = 14): RSIResult {
  if (candles.length < period + 1) {
    return { value: 50, signal: 'neutral', score: 50 };
  }

  const closes = candles.map((c) => c.close);
  let avgGain = 0;
  let avgLoss = 0;

  // Initial average gain/loss
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  // Smooth the averages
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) {
      avgGain = (avgGain * (period - 1) + change) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
    }
  }

  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi = 100 - 100 / (1 + rs);

  let signal: RSIResult['signal'] = 'neutral';
  let score = 50;

  if (rsi < 30) {
    signal = 'oversold';
    score = 80 + (30 - rsi); // More oversold = higher score
  } else if (rsi > 70) {
    signal = 'overbought';
    score = Math.max(0, 30 - (rsi - 70));
  } else {
    score = 50 + (50 - rsi); // Closer to oversold = slightly higher
  }

  return { value: Math.round(rsi * 100) / 100, signal, score: clampScore(score) };
}

// ============================================================
// MACD (12, 26, 9)
// ============================================================
export function calculateMACD(candles: Candle[]): MACDResult {
  if (candles.length < 26) {
    return { macd: 0, signal: 0, histogram: 0, crossover: 'none', score: 50 };
  }

  const closes = candles.map((c) => c.close);
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);

  const macdLine = ema12.map((v, i) => v - ema26[i]);
  const signalLine = ema(macdLine, 9);

  const lastIdx = macdLine.length - 1;
  const prevIdx = lastIdx - 1;

  const macdVal = macdLine[lastIdx];
  const signalVal = signalLine[lastIdx];
  const histogram = macdVal - signalVal;

  let crossover: MACDResult['crossover'] = 'none';
  if (prevIdx >= 0) {
    const prevMACD = macdLine[prevIdx];
    const prevSignal = signalLine[prevIdx];
    if (prevMACD <= prevSignal && macdVal > signalVal) {
      crossover = 'bullish';
    } else if (prevMACD >= prevSignal && macdVal < signalVal) {
      crossover = 'bearish';
    }
  }

  let score = 50;
  if (crossover === 'bullish') score = 85;
  else if (crossover === 'bearish') score = 15;
  else if (histogram > 0) score = 60 + Math.min(20, histogram * 1000);
  else score = 40 - Math.min(20, Math.abs(histogram) * 1000);

  return {
    macd: roundTo8(macdVal),
    signal: roundTo8(signalVal),
    histogram: roundTo8(histogram),
    crossover,
    score: clampScore(score),
  };
}

// ============================================================
// Bollinger Bands (20-period, 2 std dev)
// ============================================================
export function calculateBollinger(candles: Candle[], period: number = 20): BollingerResult {
  if (candles.length < period) {
    return { upper: 0, middle: 0, lower: 0, percentB: 0.5, score: 50 };
  }

  const closes = candles.map((c) => c.close);
  const recentCloses = closes.slice(-period);
  const middle = recentCloses.reduce((a, b) => a + b, 0) / period;

  const variance =
    recentCloses.reduce((sum, val) => sum + Math.pow(val - middle, 2), 0) / period;
  const stdDev = Math.sqrt(variance);

  const upper = middle + 2 * stdDev;
  const lower = middle - 2 * stdDev;
  const currentPrice = closes[closes.length - 1];
  const bandWidth = upper - lower;
  const percentB = bandWidth === 0 ? 0.5 : (currentPrice - lower) / bandWidth;

  let score = 50;
  if (percentB < 0.2) score = 80 + (0.2 - percentB) * 100; // Near lower band
  else if (percentB > 0.8) score = 20 - (percentB - 0.8) * 100; // Near upper band
  else score = 50;

  return {
    upper: roundTo8(upper),
    middle: roundTo8(middle),
    lower: roundTo8(lower),
    percentB: Math.round(percentB * 100) / 100,
    score: clampScore(score),
  };
}

// ============================================================
// Volume Analysis
// ============================================================
export function calculateVolume(candles: Candle[], lookback: number = 20): VolumeResult {
  if (candles.length < lookback) {
    return { currentVolume: 0, averageVolume: 0, volumeRatio: 1, spike: false, score: 50 };
  }

  const volumes = candles.map((c) => c.volume);
  const currentVolume = volumes[volumes.length - 1];
  const avgVolume =
    volumes.slice(-lookback - 1, -1).reduce((a, b) => a + b, 0) / lookback;

  const volumeRatio = avgVolume === 0 ? 1 : currentVolume / avgVolume;
  const spike = volumeRatio > 2;

  let score = 50;
  if (spike) score = 75 + Math.min(25, (volumeRatio - 2) * 10);
  else if (volumeRatio > 1.5) score = 65;
  else if (volumeRatio > 1) score = 55;
  else score = 40;

  return {
    currentVolume,
    averageVolume: Math.round(avgVolume * 100) / 100,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    spike,
    score: clampScore(score),
  };
}

// ============================================================
// EMA/SMA Moving Averages (9, 21, 50)
// ============================================================
export function calculateMA(candles: Candle[]): MAResult {
  if (candles.length < 50) {
    return { ema9: 0, ema21: 0, sma50: 0, trend: 'neutral', goldenCross: false, score: 50 };
  }

  const closes = candles.map((c) => c.close);
  const ema9Arr = ema(closes, 9);
  const ema21Arr = ema(closes, 21);
  const sma50Arr = sma(closes, 50);

  const ema9Val = ema9Arr[ema9Arr.length - 1];
  const ema21Val = ema21Arr[ema21Arr.length - 1];
  const sma50Val = sma50Arr[sma50Arr.length - 1];
  const price = closes[closes.length - 1];

  const goldenCross = ema9Val > ema21Val && ema21Val > sma50Val;
  let trend: MAResult['trend'] = 'neutral';

  if (price > ema9Val && ema9Val > ema21Val) trend = 'bullish';
  else if (price < ema9Val && ema9Val < ema21Val) trend = 'bearish';

  let score = 50;
  if (goldenCross && trend === 'bullish') score = 90;
  else if (trend === 'bullish') score = 70;
  else if (trend === 'bearish') score = 20;
  else score = 50;

  return {
    ema9: roundTo8(ema9Val),
    ema21: roundTo8(ema21Val),
    sma50: roundTo8(sma50Val),
    trend,
    goldenCross,
    score: clampScore(score),
  };
}
