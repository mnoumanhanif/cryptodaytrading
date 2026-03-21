// ============================================================
// Fibonacci retracement level calculation
// ============================================================

import { Candle, FibonacciResult } from '../types';
import { roundTo8 } from '../utils';

const FIB_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1.0];

export function calculateFibonacci(candles: Candle[], lookback = 50): FibonacciResult {
  const recent = candles.slice(-lookback);
  const high = Math.max(...recent.map((c) => c.high));
  const low = Math.min(...recent.map((c) => c.low));
  const range = high - low;
  const price = candles[candles.length - 1].close;

  const [r0, r236, r382, r500, r618, r786, r1000] = FIB_RATIOS.map(
    (r) => roundTo8(high - range * r)
  );

  const allLevels = [r0, r236, r382, r500, r618, r786, r1000];

  const nearestSupport =
    allLevels
      .filter((l) => l <= price)
      .sort((a, b) => b - a)[0] ?? low;

  const nearestResistance =
    allLevels
      .filter((l) => l > price)
      .sort((a, b) => a - b)[0] ?? high;

  return {
    high,
    low,
    levels: { r0, r236, r382, r500, r618, r786, r1000 },
    nearestSupport,
    nearestResistance,
  };
}
