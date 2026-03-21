// ============================================================
// Ticker API – live price for a symbol
// GET /api/ticker?symbol=BTCUSDT
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchPrice } from '@/lib/binance';
import { TickerResponse } from '@/lib/types';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter required' }, { status: 400 });
    }

    // Validate symbol format (alphanumeric only)
    if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }

    const price = await fetchPrice(symbol.toUpperCase());

    const response: TickerResponse = {
      symbol: symbol.toUpperCase(),
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
