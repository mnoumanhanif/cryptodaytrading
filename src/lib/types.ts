// ============================================================
// TypeScript interfaces for the Crypto Day Trading Dashboard
// ============================================================

/** Raw 24h ticker data from Binance */
export interface BinanceTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  lastPrice: string;
  volume: string;
  quoteVolume: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  count: number;
}

/** A single OHLCV candlestick */
export interface Candle {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
}

/** RSI indicator result */
export interface RSIResult {
  value: number;
  signal: 'oversold' | 'neutral' | 'overbought';
  score: number; // 0-100
}

/** MACD indicator result */
export interface MACDResult {
  macd: number;
  signal: number;
  histogram: number;
  crossover: 'bullish' | 'bearish' | 'none';
  score: number;
}

/** Bollinger Bands result */
export interface BollingerResult {
  upper: number;
  middle: number;
  lower: number;
  percentB: number; // where price sits 0=lower, 1=upper
  score: number;
}

/** Volume analysis result */
export interface VolumeResult {
  currentVolume: number;
  averageVolume: number;
  volumeRatio: number;
  spike: boolean;
  score: number;
}

/** Moving average analysis result */
export interface MAResult {
  ema9: number;
  ema21: number;
  sma50: number;
  trend: 'bullish' | 'bearish' | 'neutral';
  goldenCross: boolean;
  score: number;
}

/** Ichimoku Cloud indicator result */
export interface IchimokuResult {
  tenkan: number;
  kijun: number;
  senkouA: number;
  senkouB: number;
  chikou: number;
  cloudColor: 'bullish' | 'bearish';
  signal: 'bullish' | 'bearish' | 'neutral';
  score: number;
}

/** Stochastic RSI indicator result */
export interface StochasticRSIResult {
  k: number;
  d: number;
  signal: 'oversold' | 'neutral' | 'overbought';
  score: number;
}

/** Average Directional Index result */
export interface ADXResult {
  adx: number;
  plusDI: number;
  minusDI: number;
  trend: 'strong_bull' | 'strong_bear' | 'weak' | 'none';
  score: number;
}

/** Fibonacci retracement levels */
export interface FibonacciResult {
  high: number;
  low: number;
  levels: {
    r0: number;
    r236: number;
    r382: number;
    r500: number;
    r618: number;
    r786: number;
    r1000: number;
  };
  nearestSupport: number;
  nearestResistance: number;
}

/** Combined indicator results */
export interface IndicatorResults {
  rsi: RSIResult;
  macd: MACDResult;
  bollinger: BollingerResult;
  volume: VolumeResult;
  ma: MAResult;
  ichimoku?: IchimokuResult;
  stochRSI?: StochasticRSIResult;
  adx?: ADXResult;
  fibonacci?: FibonacciResult;
}

/** Trading signal */
export type Signal = 'BUY' | 'SELL' | 'HOLD';

/** Risk/reward targets with multi-level take-profit */
export interface RiskTargets {
  entryPrice: number;
  stopLoss: number;
  targetPrice: number;
  stopLossPercent: number;
  targetPercent: number;
  riskRewardRatio: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  takeProfit1Percent: number;
  takeProfit2Percent: number;
  takeProfit3Percent: number;
}

/** Trade signal with entry/exit details */
export interface TradeSignal {
  type: 'BUY' | 'SELL' | 'HOLD';
  entryZoneLow: number;
  entryZoneHigh: number;
  confidence: number;
  prediction: 'UP' | 'DOWN' | 'SIDEWAYS';
  probability: number; // 0-1
  market_regime: 'TRENDING' | 'RANGING' | 'VOLATILE';
  key_factors: string[];
  risk_flags: string[];
  rationale: string[];
}

/** Full analysis for a single coin */
export interface CoinAnalysis {
  symbol: string;
  price: number;
  priceChange24h: number;
  priceChangePercent: number;
  volume24h: number;
  high24h: number;
  low24h: number;
  score: number; // composite 0-100
  signal: Signal;
  indicators: IndicatorResults;
  risk: RiskTargets;
  tradeSignal: TradeSignal;
  updatedAt: number;
}

/** Watchlist item stored in localStorage */
export interface WatchListItem {
  symbol: string;
  entryPrice: number;
  addedAt: number;
  targetPrice: number;
  stopLoss: number;
}

/** Short-term risk targets for 1-2 hour trading */
export interface ShortTermRisk {
  entryPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  stopLossPercent: number;
  takeProfit1: number;
  takeProfit1Percent: number;
  takeProfit2: number;
  takeProfit2Percent: number;
  takeProfit3: number;
  takeProfit3Percent: number;
  riskRewardRatio: number;
}

/** A single buy signal result for the top-10 output */
export interface BuySignalResult {
  rank: number;
  symbol: string;
  prediction: 'UP' | 'DOWN' | 'SIDEWAYS';
  probability: number;            // 0-1
  confidence: number;             // 0-100
  market_regime: 'TRENDING' | 'RANGING' | 'VOLATILE';
  key_factors: string[];
  risk_flags: string[];
  currentPrice: number;
  entryZoneLow: number;
  entryZoneHigh: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidenceScore: number;
  keySignals: string[];
  profitPotential: number;         // estimated max % gain
  timeFrame: string;               // e.g. '1H' or '4H'
  priceChangePercent: number;
  volume24h: number;
  volumeRatio: number;
  rsiValue: number;
  macdHistogram: number;
  bollingerPercentB: number;
  riskRewardRatio: number;
}

/** Market analysis API response */
export interface MarketAnalysisResponse {
  topBuySignals: BuySignalResult[];
  timestamp: number;
  totalAnalyzed: number;
  totalCandidates: number;
}

/** API response wrapper */
export interface ScannerResponse {
  coins: CoinAnalysis[];
  timestamp: number;
  totalScanned: number;
}

/** Klines API response */
export interface KlinesResponse {
  symbol: string;
  interval: string;
  candles: Candle[];
}

/** Ticker API response */
export interface TickerResponse {
  symbol: string;
  price: number;
  timestamp: number;
}

// ============================================================
// Execution cost model types
// ============================================================

/** Fee and slippage cost assumptions for a trade */
export interface CostAssumptions {
  makerFeePct: number;   // e.g. 0.1 for 0.1%
  takerFeePct: number;   // e.g. 0.1 for 0.1%
  slippageBps: number;   // expected slippage in basis points
  spreadBps: number;     // expected spread in basis points
}

/** Net risk/reward after deducting execution costs */
export interface NetRiskReward {
  grossRR: number;           // risk/reward before costs
  netRR: number;             // risk/reward after costs
  breakEvenMovePct: number;  // minimum % move to cover costs
  totalCostPct: number;      // total round-trip cost as % of position
  entrySlippage: number;     // estimated entry slippage in price
  exitSlippage: number;      // estimated exit slippage in price
  entryFee: number;          // entry fee in price
  exitFee: number;           // exit fee in price
  netTarget: number;         // target price after costs
  netStopLoss: number;       // stop loss adjusted for costs
  costAssumptions: CostAssumptions;
}

// ============================================================
// Market regime types
// ============================================================

/** Detected market regime */
export type MarketRegime = 'trending_up' | 'trending_down' | 'ranging' | 'high_volatility';

/** Market regime detection result */
export interface RegimeResult {
  regime: MarketRegime;
  confidence: number;        // 0-100 how certain the regime classification is
  atrPercent: number;        // ATR as % of price
  adxValue: number;          // ADX value (trend strength)
  trendDirection: 'up' | 'down' | 'neutral';
  description: string;
}

// ============================================================
// Portfolio risk guard types
// ============================================================

/** Current account/portfolio state for risk checks */
export interface AccountState {
  dailyRealizedPnlPct: number;   // today's realized PnL as % of account
  openPositionCount: number;      // number of currently open positions
  consecutiveLosses: number;      // current streak of consecutive losses
  tradingEnabled: boolean;        // kill switch
}

/** Portfolio risk configuration */
export interface PortfolioRiskConfig {
  maxDailyLossPct: number;        // e.g. 3 for 3% max daily loss
  maxConsecutiveLosses: number;   // e.g. 4
  maxOpenPositions: number;       // e.g. 3
  minNetRR: number;               // minimum net RR after costs, e.g. 1.5
  maxAtrPercent: number;          // max ATR% to allow trades, e.g. 8
}

/** Result of portfolio risk check */
export interface PortfolioRiskCheck {
  allowed: boolean;
  reasons: string[];              // rejection reasons if not allowed
}

// ============================================================
// Trade journal types
// ============================================================

/** Outcome of a completed trade */
export type TradeOutcome = 'TP1' | 'TP2' | 'TP3' | 'SL' | 'TIMEOUT' | 'PENDING';

/** A single trade journal entry */
export interface TradeJournalEntry {
  id: string;
  symbol: string;
  signal: Signal;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  score: number;
  confidence: number;
  regime: MarketRegime;
  netRR: number;
  costAssumptions: CostAssumptions;
  rationale: string[];
  indicators: Record<string, number>;   // snapshot of key indicator values
  createdAt: number;
  outcome: TradeOutcome;
  exitPrice?: number;
  exitedAt?: number;
  realizedPnlPct?: number;
}

// ============================================================
// Enhanced analysis types (augmented outputs)
// ============================================================

/** Enhanced trade signal with cost model and regime awareness */
export interface EnhancedTradeSignal extends TradeSignal {
  netRiskReward: NetRiskReward;
  regime: RegimeResult;
  rejectionReasons: string[];     // reasons signal was filtered/downgraded
}

/** Enhanced coin analysis with execution realism */
export interface EnhancedCoinAnalysis extends CoinAnalysis {
  netRiskReward: NetRiskReward;
  regime: RegimeResult;
  rejectionReasons: string[];
  enhancedTradeSignal: EnhancedTradeSignal;
}

/** Enhanced buy signal result with cost model data */
export interface EnhancedBuySignalResult extends BuySignalResult {
  netRiskReward: number;          // net RR after costs
  regime: MarketRegime;
  regimeConfidence: number;
  costAssumptions: CostAssumptions;
  rejectionReasons: string[];
  breakEvenMovePct: number;
}

/** Enhanced scanner response */
export interface EnhancedScannerResponse extends ScannerResponse {
  coins: EnhancedCoinAnalysis[];
  portfolioRisk: {
    tradingEnabled: boolean;
    dailyLossCapReached: boolean;
  };
}

/** Enhanced market analysis response */
export interface EnhancedMarketAnalysisResponse extends MarketAnalysisResponse {
  topBuySignals: EnhancedBuySignalResult[];
  portfolioRisk: {
    tradingEnabled: boolean;
    dailyLossCapReached: boolean;
  };
}
