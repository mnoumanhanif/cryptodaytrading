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

export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function GET() {
  try {
    const intelligence = getPortfolioIntelligence();
    return NextResponse.json({
      state: getAccountState(),
      config: DEFAULT_PORTFOLIO_RISK_CONFIG,
      summary: getPortfolioRiskSummary(),
      intelligence,
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
    const body = await request.json();

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

    const intelligence = getPortfolioIntelligence();
    return NextResponse.json({
      state: getAccountState(),
      summary: getPortfolioRiskSummary(),
      intelligence,
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
