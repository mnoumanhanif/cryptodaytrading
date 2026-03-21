// ============================================================
// Stochastic RSI calculation
// ============================================================

import { Candle, StochasticRSIResult } from '../types';
import { emaSimple } from '../math';
import { clampScore } from '../utils';

function calculateRSISeries(closes: number[], period: number): number[] {
  const rsi: number[] = [];
  if (closes.length < period + 1) return rsi;

  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const chg = closes[i] - closes[i - 1];
    if (chg > 0) avgGain += chg;
    else avgLoss += Math.abs(chg);
  }
  avgGain /= period;
  avgLoss /= period;
  rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));

  for (let i = period + 1; i < closes.length; i++) {
    const chg = closes[i] - closes[i - 1];
    if (chg > 0) {
      avgGain = (avgGain * (period - 1) + chg) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(chg)) / period;
    }
    rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
  }
  return rsi;
}

export function calculateStochasticRSI(
  candles: Candle[],
  rsiPeriod = 14,
  stochPeriod = 14,
  smoothK = 3,
  smoothD = 3
): StochasticRSIResult {
  const fallback: StochasticRSIResult = { k: 50, d: 50, signal: 'neutral', score: 50 };
  const closes = candles.map((c) => c.close);
  const rsiSeries = calculateRSISeries(closes, rsiPeriod);

  if (rsiSeries.length < stochPeriod) return fallback;

  const stochK: number[] = [];
  for (let i = stochPeriod - 1; i < rsiSeries.length; i++) {
    const window = rsiSeries.slice(i - stochPeriod + 1, i + 1);
    const minRSI = Math.min(...window);
    const maxRSI = Math.max(...window);
    stochK.push(maxRSI === minRSI ? 50 : ((rsiSeries[i] - minRSI) / (maxRSI - minRSI)) * 100);
  }

  if (stochK.length < smoothK) return fallback;
  const smoothedK = emaSimple(stochK, smoothK);
  const smoothedD = emaSimple(smoothedK, smoothD);

  const k = smoothedK[smoothedK.length - 1];
  const d = smoothedD[smoothedD.length - 1];

  let signal: StochasticRSIResult['signal'] = 'neutral';
  let score = 50;

  if (k < 20 && d < 20) {
    signal = 'oversold';
    score = 75 + (20 - Math.min(k, d));
  } else if (k > 80 && d > 80) {
    signal = 'overbought';
    score = 25 - (Math.max(k, d) - 80);
  } else if (k > d && k < 50) {
    score = 60;
  } else if (k < d && k > 50) {
    score = 40;
  }

  return {
    k: Math.round(k * 100) / 100,
    d: Math.round(d * 100) / 100,
    signal,
    score: clampScore(score),
  };
}
