// ============================================================
// Ichimoku Cloud indicator calculation
// ============================================================

import { Candle, IchimokuResult } from '../types';
import { roundTo8 } from '../utils';

function highestHigh(candles: Candle[], start: number, end: number): number {
  let max = -Infinity;
  for (let i = start; i <= end; i++) max = Math.max(max, candles[i].high);
  return max;
}

function lowestLow(candles: Candle[], start: number, end: number): number {
  let min = Infinity;
  for (let i = start; i <= end; i++) min = Math.min(min, candles[i].low);
  return min;
}

export function calculateIchimoku(candles: Candle[]): IchimokuResult {
  const n = candles.length;
  const fallback: IchimokuResult = {
    tenkan: 0,
    kijun: 0,
    senkouA: 0,
    senkouB: 0,
    chikou: 0,
    cloudColor: 'bearish',
    signal: 'neutral',
    score: 50,
  };

  if (n < 52) return fallback;

  const last = n - 1;

  // Tenkan-sen (Conversion Line): 9-period midpoint
  const tenkan = (highestHigh(candles, last - 8, last) + lowestLow(candles, last - 8, last)) / 2;

  // Kijun-sen (Base Line): 26-period midpoint
  const kijun = (highestHigh(candles, last - 25, last) + lowestLow(candles, last - 25, last)) / 2;

  // Senkou Span A (Leading Span A): (tenkan + kijun) / 2, projected 26 forward
  const senkouA = (tenkan + kijun) / 2;

  // Senkou Span B (Leading Span B): 52-period midpoint, projected 26 forward
  const senkouB = (highestHigh(candles, last - 51, last) + lowestLow(candles, last - 51, last)) / 2;

  // Chikou Span (Lagging Span): current close projected 26 back
  const chikou = candles[last].close;

  const price = candles[last].close;
  const cloudColor = senkouA >= senkouB ? 'bullish' : 'bearish';
  const aboveCloud = price > Math.max(senkouA, senkouB);
  const belowCloud = price < Math.min(senkouA, senkouB);
  const tenkanAboveKijun = tenkan > kijun;

  let signal: IchimokuResult['signal'] = 'neutral';
  let score = 50;

  if (aboveCloud && tenkanAboveKijun) {
    signal = 'bullish';
    score = 80;
  } else if (belowCloud && !tenkanAboveKijun) {
    signal = 'bearish';
    score = 20;
  } else if (aboveCloud) {
    signal = 'bullish';
    score = 65;
  } else if (belowCloud) {
    signal = 'bearish';
    score = 35;
  }

  const round = roundTo8;
  return {
    tenkan: round(tenkan),
    kijun: round(kijun),
    senkouA: round(senkouA),
    senkouB: round(senkouB),
    chikou: round(chikou),
    cloudColor,
    signal,
    score,
  };
}
