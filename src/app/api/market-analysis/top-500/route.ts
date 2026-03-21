// ============================================================
// Market Analysis API – Top 500 analysis with top-10 BUY signals
// GET /api/market-analysis/top-500
//
// Phase 1: Fetch & analyze top 500 coins by trading volume
// Phase 2: Filter for short-term (1-2 hour) trading candidates
// Phase 3: Return top 10 BUY signals with entry/exit targets
// ============================================================

import { NextResponse } from 'next/server';
import { getTopUSDTPairs, fetchKlines } from '@/lib/binance';
import { analyzeEnhanced } from '@/lib/analyzer';
import { calculateShortTermRisk, calculateNetRiskReward, DEFAULT_COST_ASSUMPTIONS } from '@/lib/risk';
import { detectRegime } from '@/lib/regime';
import { getPortfolioRiskSummary } from '@/lib/portfolioRisk';
import {
  BinanceTicker,
  EnhancedBuySignalResult,
  EnhancedCoinAnalysis,
  EnhancedMarketAnalysisResponse,
} from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

let cachedResult: EnhancedMarketAnalysisResponse | null = null;
let lastFetchTime = 0;
const CACHE_TTL = 30_000; // 30 seconds
const BATCH_SIZE = 10;
const DEADLINE_MS = 55_000; // leave 5s buffer before the 60s maxDuration limit

/**
 * Phase 2 pre-filter: narrow 500 tickers down to ~50 candidates
 * based on 24h price change and volume before fetching klines.
 */
function preFilterCandidates(
  tickers: BinanceTicker[]
): BinanceTicker[] {
  // Calculate median volume for relative comparison
  const volumes = tickers.map((t) => parseFloat(t.quoteVolume)).sort((a, b) => a - b);
  const medianVolume = volumes[Math.floor(volumes.length / 2)] || 0;

  return tickers.filter((t) => {
    const change = parseFloat(t.priceChangePercent);
    const vol = parseFloat(t.quoteVolume);
    // Positive momentum (+0.5% to +15%) and above-median volume
    return change >= 0.5 && change <= 15 && vol >= medianVolume;
  });
}

/**
 * Phase 2 detailed filter: apply indicator-level criteria
 * for 1-2 hour short-term trading.
 */
function isShortTermCandidate(coin: EnhancedCoinAnalysis): boolean {
  const { indicators, score, priceChangePercent, tradeSignal, enhancedTradeSignal } = coin;
  // Minimum composite score
  if (score < 65) return false;
  if (tradeSignal.confidence < 70) return false;
  if (tradeSignal.probability < 0.6) return false;
  // Positive 24h momentum — relaxed to +0.5% to capture coins that are
  // just beginning to trend up; the stricter indicator filters below
  // weed out false positives.
  if (priceChangePercent < 0.5) return false;
  // Volume above average
  if (indicators.volume.volumeRatio < 1.2) return false;
  if (tradeSignal.market_regime === 'RANGING' || tradeSignal.market_regime === 'VOLATILE') return false;
  if (enhancedTradeSignal.netRiskReward.netRR < 1.5) return false;
  if (enhancedTradeSignal.tradeDecision.decision === 'NO_TRADE') return false;
  // At least one bullish confirmation from key indicators
  const bullishSignals = [
    indicators.rsi.value < 60,                            // RSI not overbought
    indicators.macd.histogram > 0,                        // MACD histogram positive
    indicators.macd.crossover === 'bullish',              // MACD bullish crossover
    indicators.bollinger.percentB < 0.7,                  // Not at upper band
    indicators.ma.trend === 'bullish',                    // MA bullish
    indicators.ichimoku?.signal === 'bullish',            // Ichimoku bullish
    indicators.rsi.signal === 'oversold',                 // RSI oversold reversal
  ].filter(Boolean).length;

  return bullishSignals >= 2;
}

/**
 * Phase 3: Build an EnhancedBuySignalResult from an EnhancedCoinAnalysis.
 */
function buildBuySignal(
  coin: EnhancedCoinAnalysis,
  candles: import('@/lib/types').Candle[],
  rank: number
): EnhancedBuySignalResult {
  const price = coin.price;
  const shortTermRisk = calculateShortTermRisk(price, candles);
  const { indicators } = coin;

  // Calculate net RR for the short-term targets
  const shortTermNetRR = calculateNetRiskReward(
    price,
    shortTermRisk.stopLoss,
    shortTermRisk.takeProfit3,
    DEFAULT_COST_ASSUMPTIONS
  );

  // Detect regime for this specific coin
  const regime = detectRegime(candles, indicators);

  // Gather key active signals
  const keySignals: string[] = [];
  if (indicators.rsi.signal === 'oversold') keySignals.push('RSI Oversold ✓');
  else if (indicators.rsi.value >= 40 && indicators.rsi.value <= 60) keySignals.push('RSI Optimal Zone ✓');
  if (indicators.macd.crossover === 'bullish') keySignals.push('MACD Bullish ✓');
  else if (indicators.macd.histogram > 0) keySignals.push('MACD Positive ✓');
  if (indicators.volume.spike) keySignals.push('Vol Spike ✓');
  else if (indicators.volume.volumeRatio > 1.5) keySignals.push('High Volume ✓');
  if (indicators.ma.goldenCross) keySignals.push('EMA Golden Cross ✓');
  else if (indicators.ma.trend === 'bullish') keySignals.push('MA Bullish ✓');
  if (indicators.bollinger.percentB < 0.3) keySignals.push('Near Lower BB ✓');
  else if (indicators.bollinger.percentB < 0.5) keySignals.push('Below Mid BB ✓');
  if (indicators.ichimoku?.signal === 'bullish') keySignals.push('Ichimoku Bullish ✓');
  if (indicators.stochRSI?.signal === 'oversold') keySignals.push('StochRSI Oversold ✓');
  if (indicators.adx?.trend === 'strong_bull') keySignals.push('ADX Strong Uptrend ✓');

  // Estimate profit potential based on TP3 and confidence
  const profitPotential = shortTermRisk.takeProfit3Percent;

  // Time frame recommendation based on volatility and score
  const timeFrame = coin.score >= 80 ? '1H' : '1-2H';

  return {
    rank,
    symbol: coin.symbol,
    prediction: coin.tradeSignal.prediction,
    probability: coin.tradeSignal.probability,
    confidence: coin.tradeSignal.confidence,
    market_regime: coin.tradeSignal.market_regime,
    key_factors: coin.tradeSignal.key_factors,
    risk_flags: coin.tradeSignal.risk_flags,
    currentPrice: price,
    entryZoneLow: coin.tradeSignal.entryZoneLow,
    entryZoneHigh: coin.tradeSignal.entryZoneHigh,
    stopLoss: shortTermRisk.stopLoss,
    takeProfit1: shortTermRisk.takeProfit1,
    takeProfit2: shortTermRisk.takeProfit2,
    takeProfit3: shortTermRisk.takeProfit3,
    confidenceScore: coin.tradeSignal.confidence,
    keySignals: keySignals.slice(0, 6),
    profitPotential: Math.round(profitPotential * 100) / 100,
    timeFrame,
    priceChangePercent: coin.priceChangePercent,
    volume24h: coin.volume24h,
    volumeRatio: indicators.volume.volumeRatio,
    rsiValue: indicators.rsi.value,
    macdHistogram: indicators.macd.histogram,
    bollingerPercentB: indicators.bollinger.percentB,
    riskRewardRatio: shortTermRisk.riskRewardRatio,
    // Enhanced fields
    netRiskReward: shortTermNetRR.netRR,
    regime: regime.regime,
    regimeConfidence: regime.confidence,
    costAssumptions: DEFAULT_COST_ASSUMPTIONS,
    rejectionReasons: coin.rejectionReasons,
    breakEvenMovePct: shortTermNetRR.breakEvenMovePct,
    tradeDecision: coin.enhancedTradeSignal.tradeDecision,
  };
}

export async function GET() {
  try {
    const now = Date.now();
    // Return cache if fresh
    if (cachedResult && now - lastFetchTime < CACHE_TTL) {
      return NextResponse.json(cachedResult);
    }

    const startTime = Date.now();

    // Phase 1: Fetch top 500 tickers
    const allTickers = await getTopUSDTPairs(500);

    // Phase 2: Pre-filter based on ticker data to reduce kline fetches
    const candidates = preFilterCandidates(allTickers).slice(0, 60);

    // Fetch klines and analyze candidates in batches
    const analyzed: { coin: EnhancedCoinAnalysis; candles: import('@/lib/types').Candle[] }[] = [];

    for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
      if (Date.now() - startTime > DEADLINE_MS) break;

      const batch = candidates.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(async (ticker) => {
          const candles = await fetchKlines(ticker.symbol, '1h', 100);
          const coin = analyzeEnhanced(ticker, candles);
          return { coin, candles };
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          analyzed.push(result.value);
        }
      }
    }

    // Phase 2 continued: Apply detailed indicator-based filtering
    const filtered = analyzed.filter(({ coin }) => isShortTermCandidate(coin));

    // Phase 3: Rank by score (descending) and take top 10
    filtered.sort((a, b) => b.coin.score - a.coin.score);
    const top10 = filtered.slice(0, 10);

    const topBuySignals = top10.map(({ coin, candles }, idx) =>
      buildBuySignal(coin, candles, idx + 1)
    );

    const response: EnhancedMarketAnalysisResponse = {
      topBuySignals,
      timestamp: Date.now(),
      totalAnalyzed: analyzed.length,
      totalCandidates: candidates.length,
      portfolioRisk: getPortfolioRiskSummary(),
    };

    cachedResult = response;
    lastFetchTime = Date.now();

    return NextResponse.json(response);
  } catch (error) {
    console.error('Market analysis error:', error);

    if (cachedResult) {
      return NextResponse.json({ ...cachedResult, stale: true });
    }

    return NextResponse.json(
      { error: 'Failed to run market analysis', details: String(error) },
      { status: 500 }
    );
  }
}
