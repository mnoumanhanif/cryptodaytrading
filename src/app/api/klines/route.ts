// ============================================================
// Klines API – candlestick data for a symbol
// GET /api/klines?symbol=BTCUSDT&interval=1h&limit=100
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines } from '@/lib/binance';
import { KlinesResponse } from '@/lib/types';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const klinesQuerySchema = z.object({
  symbol: z.string().regex(/^[A-Za-z0-9]+$/),
  interval: z.enum(['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','1w','1M']).optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const contextOrResponse = await requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const parsed = klinesQuerySchema.safeParse({
      symbol: searchParams.get('symbol'),
      interval: searchParams.get('interval') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }
    const symbol = parsed.data.symbol.toUpperCase();
    const interval = parsed.data.interval ?? '1h';
    const limit = parsed.data.limit ?? 100;

    const candles = await fetchKlines(symbol, interval, limit);

    const response: KlinesResponse = {
      symbol,
      interval,
      candles,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Klines error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch klines', details: String(error) },
      { status: 500 }
    );
  }
}
