// ============================================================
// Klines API – candlestick data for a symbol
// GET /api/klines?symbol=BTCUSDT&interval=1h&limit=100
// ============================================================

import { NextRequest, NextResponse } from 'next/server';
import { fetchKlines } from '@/lib/binance';
import { KlinesResponse } from '@/lib/types';

// Vercel serverless configuration
export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const VALID_INTERVALS = ['1m','3m','5m','15m','30m','1h','2h','4h','6h','8h','12h','1d','1w','1M'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');
    const interval = searchParams.get('interval') || '1h';
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    if (!symbol) {
      return NextResponse.json({ error: 'Symbol parameter required' }, { status: 400 });
    }

    // Validate symbol format (alphanumeric only)
    if (!/^[A-Z0-9]+$/.test(symbol.toUpperCase())) {
      return NextResponse.json({ error: 'Invalid symbol format' }, { status: 400 });
    }

    // Validate interval format
    if (!VALID_INTERVALS.includes(interval)) {
      return NextResponse.json({ error: `Invalid interval. Must be one of: ${VALID_INTERVALS.join(', ')}` }, { status: 400 });
    }

    const candles = await fetchKlines(symbol.toUpperCase(), interval, Math.min(limit, 500));

    const response: KlinesResponse = {
      symbol: symbol.toUpperCase(),
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
