// ============================================================
// Trade Journal API – view logged signals and journal stats
// GET /api/trade-journal              → recent entries + stats
// GET /api/trade-journal?symbol=BTCUSDT → entries for a symbol
// ============================================================

import { NextResponse } from 'next/server';
import { getRecentEntries, getJournalEntries, getJournalStats } from '@/lib/tradeJournal';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';
import { listTradeJournalEntriesByWorkspace } from '@/lib/saas/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const tradeJournalQuerySchema = z.object({
  symbol: z.string().regex(/^[A-Za-z0-9]+$/).optional(),
});

export async function GET(request: Request) {
  try {
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;
    const context = contextOrResponse;

    const { searchParams } = new URL(request.url);
    const parsed = tradeJournalQuerySchema.safeParse({
      symbol: searchParams.get('symbol') ?? undefined,
    });
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }
    const symbol = parsed.data.symbol;

    const dbEntries = await listTradeJournalEntriesByWorkspace(context.workspaceId, symbol, 100);
    const entries = dbEntries ?? (symbol ? getJournalEntries(symbol) : getRecentEntries(100));
    const stats = dbEntries
      ? {
          totalSignals: entries.length,
          buySignals: entries.filter((e: any) => e.signal === 'BUY').length,
          sellSignals: entries.filter((e: any) => e.signal === 'SELL').length,
          pendingOutcomes: entries.filter((e: any) => e.outcome === 'PENDING').length,
          completedTrades: entries.filter((e: any) => e.outcome !== 'PENDING').length,
          winRate: (() => {
            const completed = entries.filter((e: any) => e.outcome !== 'PENDING');
            const wins = completed.filter((e: any) => ['TP1', 'TP2', 'TP3'].includes(e.outcome));
            return completed.length > 0 ? (wins.length / completed.length) * 100 : 0;
          })(),
        }
      : getJournalStats();

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
