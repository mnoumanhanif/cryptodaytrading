// ============================================================
// Average Directional Index (ADX) calculation
// ============================================================

import { Candle, ADXResult } from '../types';
import { clampScore } from '../utils';

export function calculateADX(candles: Candle[], period = 14): ADXResult {
  const fallback: ADXResult = { adx: 0, plusDI: 0, minusDI: 0, trend: 'none', score: 50 };
  if (candles.length < period * 2 + 1) return fallback;

  const trueRanges: number[] = [];
  const plusDMs: number[] = [];
  const minusDMs: number[] = [];

  for (let i = 1; i < candles.length; i++) {
    const curr = candles[i];
    const prev = candles[i - 1];
    const tr = Math.max(
      curr.high - curr.low,
      Math.abs(curr.high - prev.close),
      Math.abs(curr.low - prev.close)
    );
    trueRanges.push(tr);

    const upMove = curr.high - prev.high;
    const downMove = prev.low - curr.low;
    plusDMs.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDMs.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  // Smoothed sums (Wilder smoothing)
  function wilder(arr: number[], p: number): number[] {
    const result: number[] = [];
    let sum = arr.slice(0, p).reduce((a, b) => a + b, 0);
    result.push(sum);
    for (let i = p; i < arr.length; i++) {
      sum = sum - sum / p + arr[i];
      result.push(sum);
    }
    return result;
  }

  const smoothedTR = wilder(trueRanges, period);
  const smoothedPlusDM = wilder(plusDMs, period);
  const smoothedMinusDM = wilder(minusDMs, period);

  const plusDIArr = smoothedPlusDM.map((v, i) =>
    smoothedTR[i] === 0 ? 0 : (v / smoothedTR[i]) * 100
  );
  const minusDIArr = smoothedMinusDM.map((v, i) =>
    smoothedTR[i] === 0 ? 0 : (v / smoothedTR[i]) * 100
  );

  const dxArr = plusDIArr.map((p, i) => {
    const m = minusDIArr[i];
    const sum = p + m;
    return sum === 0 ? 0 : (Math.abs(p - m) / sum) * 100;
  });

  // ADX = smoothed average of DX
  const adxArr = wilder(dxArr, period);
  const adx = adxArr[adxArr.length - 1];
  const plusDI = plusDIArr[plusDIArr.length - 1];
  const minusDI = minusDIArr[minusDIArr.length - 1];

  let trend: ADXResult['trend'] = 'none';
  let score = 50;

  if (adx >= 25 && plusDI > minusDI) {
    trend = 'strong_bull';
    score = 75 + Math.min(25, (adx - 25) / 2);
  } else if (adx >= 25 && minusDI > plusDI) {
    trend = 'strong_bear';
    score = 25 - Math.min(25, (adx - 25) / 2);
  } else if (adx >= 20) {
    trend = 'weak';
    score = plusDI > minusDI ? 60 : 40;
  }

  return {
    adx: Math.round(adx * 100) / 100,
    plusDI: Math.round(plusDI * 100) / 100,
    minusDI: Math.round(minusDI * 100) / 100,
    trend,
    score: clampScore(score),
  };
}
