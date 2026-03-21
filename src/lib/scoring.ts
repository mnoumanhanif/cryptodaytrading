// ============================================================
// Shared composite scoring constants
// ============================================================

export const COMPOSITE_KEYS = ['rsi', 'macd', 'bollinger', 'volume', 'ma', 'ichimoku'] as const;
export type CompositeKey = (typeof COMPOSITE_KEYS)[number];

export const BUY_THRESHOLD = 40;
export const SELL_THRESHOLD = 70;
