// ============================================================
// Portfolio Risk API – view and manage portfolio risk state
// GET  /api/portfolio-risk          → current state + config
// POST /api/portfolio-risk          → update state (kill switch, etc.)
// ============================================================

import { NextResponse } from 'next/server';
import {
  getAccountState,
  updateAccountState,
  setTradingEnabled,
  getPortfolioRiskSummary,
  getPortfolioIntelligence,
  DEFAULT_PORTFOLIO_RISK_CONFIG,
} from '@/lib/portfolioRisk';
import { z } from 'zod';
import { requireAdminRole, requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';
import { appendAuditLog } from '@/lib/saas/db';
import { getPortfolioStateByWorkspace, upsertPortfolioStateByWorkspace } from '@/lib/saas/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const portfolioRiskBodySchema = z.object({
  tradingEnabled: z.boolean().optional(),
  dailyRealizedPnlPct: z.number().finite().min(-100).max(100).optional(),
  openPositionCount: z.number().int().min(0).max(1000).optional(),
  consecutiveLosses: z.number().int().min(0).max(1000).optional(),
});

export async function GET(request: Request) {
  try {
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;
    const context = contextOrResponse;

    const persistedState = await getPortfolioStateByWorkspace(context.workspaceId);
    if (persistedState) {
      updateAccountState(persistedState);
    }

    const intelligence = getPortfolioIntelligence();
    return NextResponse.json({
      state: getAccountState(),
      config: DEFAULT_PORTFOLIO_RISK_CONFIG,
      summary: getPortfolioRiskSummary(),
      ...intelligence,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Portfolio risk error:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve portfolio risk state', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;
    const adminResponse = requireAdminRole(contextOrResponse);
    if (adminResponse) return adminResponse;

    const bodyJson: unknown = await request.json();
    const parsed = portfolioRiskBodySchema.safeParse(bodyJson);
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }
    const body = parsed.data;

    // Handle kill switch toggle
    if (typeof body.tradingEnabled === 'boolean') {
      setTradingEnabled(body.tradingEnabled);
    }

    // Handle state updates (e.g., recording a loss)
    const stateFields = ['dailyRealizedPnlPct', 'openPositionCount', 'consecutiveLosses'] as const;
    const updates: Record<string, number> = {};
    for (const field of stateFields) {
      if (typeof body[field] === 'number') updates[field] = body[field];
    }
    if (Object.keys(updates).length > 0) {
      updateAccountState(updates);
    }

    const state = getAccountState();
    await upsertPortfolioStateByWorkspace(contextOrResponse.workspaceId, state);

    await appendAuditLog({
      workspaceId: contextOrResponse.workspaceId,
      userId: contextOrResponse.userId,
      action: 'portfolio_risk.updated',
      metadata: {
        updates: body,
      },
    });

    const intelligence = getPortfolioIntelligence();
    return NextResponse.json({
      state: getAccountState(),
      summary: getPortfolioRiskSummary(),
      ...intelligence,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Portfolio risk update error:', error);
    return NextResponse.json(
      { error: 'Failed to update portfolio risk state', details: String(error) },
      { status: 500 }
    );
  }
}
