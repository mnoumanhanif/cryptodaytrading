// ============================================================
// Ticker API – live price for a symbol
// GET /api/ticker?symbol=BTCUSDT
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchPrice } from '@/lib/binance';
import { TickerResponse } from '@/lib/types';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 15;
const tickerQuerySchema = z.object({
  symbol: z.string().regex(/^[A-Za-z0-9]+$/),
});

export async function GET(request: NextRequest) {
  try {
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const parsed = tickerQuerySchema.safeParse({
      symbol: searchParams.get('symbol'),
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }
    const symbol = parsed.data.symbol.toUpperCase();

    const price = await fetchPrice(symbol);

    const response: TickerResponse = {
      symbol,
      price,
      timestamp: Date.now(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Ticker error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch price', details: String(error) },
      { status: 500 }
    );
  }
}
