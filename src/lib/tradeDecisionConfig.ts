export const MIN_CONFIDENCE_THRESHOLD = 70;
export const MIN_PROBABILITY_THRESHOLD = 0.6;
export const MIN_RR_FIRST_TRADE = 1.5;
// Require stronger RR when at least one position is already open to prioritize
// the best opportunities under increased portfolio exposure.
export const MIN_RR_SUBSEQUENT_TRADES = 2;
export const MIN_POSITION_SIZE_PCT = 0.5;
export const MAX_POSITION_SIZE_PCT = 2;
export const POSITION_SIZE_REDUCTION_PER_OPEN_TRADE = 0.5;
export const MODERATE_VOLATILITY_THRESHOLD = 3;
export const HIGH_VOLATILITY_THRESHOLD = 5;
export const EXTREME_VOLATILITY_THRESHOLD = 8;
export const MODERATE_VOLATILITY_POSITION_SIZE_PCT = 1;
export const HIGH_VOLATILITY_POSITION_SIZE_PCT = 0.5;
export const MAX_DECISION_REASONS = 3;
export const TRENDING_MARKET_REGIME = 'TRENDING';
export const RANGING_MARKET_REGIME = 'RANGING';
export const VOLATILE_MARKET_REGIME = 'VOLATILE';
