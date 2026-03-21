// ============================================================
// Shared support/resistance helpers for chart components
// ============================================================

export interface CandleLevelInput {
  high: number;
  low: number;
}

export interface Level {
  price: number;
  timeframes: string[];
}

const LEVEL_MERGE_TOLERANCE_PCT = 0.003;

export function buildTimeframeCandidates(candles: CandleLevelInput[], currentPrice: number) {
  const supports = candles.map((c) => c.low).filter((p) => p <= currentPrice);
  const resistances = candles.map((c) => c.high).filter((p) => p >= currentPrice);

  return {
    support: supports.length > 0 ? Math.max(...supports) : Math.min(...candles.map((c) => c.low)),
    resistance: resistances.length > 0
      ? Math.min(...resistances)
      : Math.max(...candles.map((c) => c.high)),
  };
}

function updateAveragePrice(currentAverage: number, count: number, nextPrice: number): number {
  return (currentAverage * count + nextPrice) / (count + 1);
}

export function mergeLevels(
  candidates: { price: number; timeframe: string }[],
  currentPrice: number,
  side: 'support' | 'resistance'
): Level[] {
  const tolerance = Math.max(currentPrice * LEVEL_MERGE_TOLERANCE_PCT, 1e-8);
  const sorted = [...candidates].sort((a, b) =>
    side === 'support' ? b.price - a.price : a.price - b.price
  );
  const groups: Level[] = [];

  for (const candidate of sorted) {
    const existing = groups.find((g) => Math.abs(g.price - candidate.price) <= tolerance);
    if (existing) {
      if (existing.timeframes.includes(candidate.timeframe)) continue;
      existing.price = updateAveragePrice(existing.price, existing.timeframes.length, candidate.price);
      existing.timeframes.push(candidate.timeframe);
      continue;
    }

    groups.push({ price: candidate.price, timeframes: [candidate.timeframe] });
  }

  return groups.slice(0, 3);
}
