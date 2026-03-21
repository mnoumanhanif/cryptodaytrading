// ============================================================
// Trade Journal API – view logged signals and journal stats
// GET /api/trade-journal              → recent entries + stats
// GET /api/trade-journal?symbol=BTCUSDT → entries for a symbol
// ============================================================

import { NextResponse } from 'next/server';
import { getRecentEntries, getJournalEntries, getJournalStats } from '@/lib/tradeJournal';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get('symbol');

    const entries = symbol
      ? getJournalEntries(symbol)
      : getRecentEntries(100);

    const stats = getJournalStats();

    return NextResponse.json({
      entries,
      stats,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Trade journal error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve trade journal', details: String(error) },
      { status: 500 }
    );
  }
}
