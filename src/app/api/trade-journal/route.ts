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
import { TradeJournalEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const tradeJournalQuerySchema = z.object({
  symbol: z.string().regex(/^[A-Za-z0-9]+$/).optional(),
});

type JournalStatsShape = {
  totalSignals: number;
  buySignals: number;
  sellSignals: number;
  pendingOutcomes: number;
  completedTrades: number;
  winRate: number;
};

type JournalLikeEntry = Pick<TradeJournalEntry, 'signal' | 'outcome'>;

function buildStatsFromEntries(entries: JournalLikeEntry[]): JournalStatsShape {
  const completed = entries.filter((entry) => entry.outcome !== 'PENDING');
  const wins = completed.filter((entry) => ['TP1', 'TP2', 'TP3'].includes(entry.outcome));
  return {
    totalSignals: entries.length,
    buySignals: entries.filter((entry) => entry.signal === 'BUY').length,
    sellSignals: entries.filter((entry) => entry.signal === 'SELL').length,
    pendingOutcomes: entries.filter((entry) => entry.outcome === 'PENDING').length,
    completedTrades: completed.length,
    winRate: completed.length > 0 ? (wins.length / completed.length) * 100 : 0,
  };
}

export async function GET(request: Request) {
  try {
    const contextOrResponse = await requireRequestContext(request);
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
    const stats = dbEntries ? buildStatsFromEntries(entries as JournalLikeEntry[]) : getJournalStats();

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
