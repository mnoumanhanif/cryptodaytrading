// ============================================================
// Shared formatting & rounding utilities
// ============================================================

/**
 * Round a number to 8 decimal places (satoshi precision).
 * Replaces the repeated `Math.round(v * 1e8) / 1e8` pattern.
 */
export function roundTo8(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

/**
 * Format a crypto price for display with adaptive decimal places.
 * - ≥ 1 000 → no decimals  (e.g. "$65,432")
 * - ≥ 1     → 2 decimals   (e.g. "$12.34")
 * - ≥ 0.01  → 4 decimals   (e.g. "$0.0012")
 * - < 0.01  → 6 decimals   (e.g. "$0.000001")
 */
export function formatPrice(price: number): string {
  if (price >= 1000) return `$${price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (price >= 1) return `$${price.toFixed(2)}`;
  if (price >= 0.01) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(6)}`;
}

/**
 * Format a raw price number (no "$" prefix) for chart labels.
 */
export function formatPriceRaw(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 0 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(6);
}

/**
 * Format a USD volume value with B/M/K suffix.
 */
export function formatVolume(volume: number): string {
  if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(0)}K`;
  return `$${volume.toFixed(2)}`;
}

/**
 * Clamp a score to the 0-100 range.
 */
export function clampScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}
