// ============================================================
// Shared math helpers for technical indicator calculations
// ============================================================

/**
 * Calculate Exponential Moving Average (EMA).
 * Uses a Simple Moving Average (SMA) for the initial seed value, then applies
 * the EMA smoothing factor `k = 2 / (period + 1)` for subsequent values.
 * @param values - Array of numeric data points (e.g. closing prices)
 * @param period - Lookback period for the EMA calculation
 * @returns Array of EMA values, same length as `values`
 */
export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);

  // Start with SMA for the first value
  let sum = 0;
  for (let i = 0; i < Math.min(period, values.length); i++) {
    sum += values[i];
  }
  result.push(sum / Math.min(period, values.length));

  for (let i = 1; i < values.length; i++) {
    const prev = result[result.length - 1];
    result.push(values[i] * k + prev * (1 - k));
  }
  return result;
}

/**
 * Lightweight EMA variant that uses the first value as the seed directly
 * (no SMA initialization). Commonly used for short-period smoothing such as
 * Stochastic RSI %K/%D smoothing.
 * @param values - Array of numeric data points
 * @param period - Lookback period that determines the smoothing factor
 * @returns Array of EMA values, same length as `values`
 */
export function emaSimple(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [values[0]];
  for (let i = 1; i < values.length; i++) {
    result.push(values[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/**
 * Calculate Simple Moving Average (SMA) using a sliding window.
 * Returns NaN for indices before the first full window is available.
 * @param values - Array of numeric data points (e.g. closing prices)
 * @param period - Number of data points to average over
 * @returns Array of SMA values, same length as `values`
 */
export function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  let runningSum = 0;

  for (let i = 0; i < values.length; i++) {
    runningSum += values[i];
    if (i < period - 1) {
      result.push(NaN);
    } else {
      if (i >= period) {
        runningSum -= values[i - period];
      }
      result.push(runningSum / period);
    }
  }
  return result;
}
