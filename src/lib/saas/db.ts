import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { SaaSTier } from './config';

let cachedClient: SupabaseClient | null = null;

export function getSupabaseAdminClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    return null;
  }

  if (!cachedClient) {
    cachedClient = createClient(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  return cachedClient;
}

export async function appendAuditLog(event: {
  workspaceId: string;
  userId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('audit_logs').insert({
    workspace_id: event.workspaceId,
    user_id: event.userId,
    action: event.action,
    metadata: event.metadata ?? {},
    created_at: new Date().toISOString(),
  });
}

export async function upsertWorkspaceMembership(params: {
  workspaceId: string;
  userId: string;
  role: 'admin' | 'user';
  tier: 'free' | 'pro';
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('workspaces').upsert(
    {
      id: params.workspaceId,
      tier: params.tier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  await supabase.from('workspace_members').upsert(
    {
      workspace_id: params.workspaceId,
      user_id: params.userId,
      role: params.role,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id,user_id' }
  );
}

export async function upsertSubscription(params: {
  workspaceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  status: string;
  priceId?: string | null;
  currentPeriodEnd?: string | null;
  tier: 'free' | 'pro';
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('workspaces').upsert(
    {
      id: params.workspaceId,
      tier: params.tier,
      stripe_customer_id: params.stripeCustomerId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  await supabase.from('subscriptions').upsert(
    {
      workspace_id: params.workspaceId,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      status: params.status,
      price_id: params.priceId ?? null,
      current_period_end: params.currentPeriodEnd ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'stripe_subscription_id' }
  );
}

export type WorkspaceBillingState = {
  tier: SaaSTier;
  hasActiveSubscription: boolean;
  latestSubscriptionStatus: string | null;
};

const ACTIVE_SUBSCRIPTION_STATUSES = new Set<string>(['active', 'trialing']);

export async function getWorkspaceBillingState(workspaceId: string): Promise<WorkspaceBillingState | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const [{ data: workspace }, { data: subscriptions }] = await Promise.all([
    supabase.from('workspaces').select('tier').eq('id', workspaceId).maybeSingle(),
    supabase
      .from('subscriptions')
      .select('status,updated_at')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false })
      .limit(5),
  ]);

  const latestSubscriptionStatus = subscriptions?.[0]?.status ?? null;
  const hasActiveSubscription = (subscriptions ?? []).some((subscription) =>
    ACTIVE_SUBSCRIPTION_STATUSES.has(String(subscription.status ?? '').toLowerCase())
  );

  return {
    tier: workspace?.tier === 'pro' ? 'pro' : 'free',
    hasActiveSubscription,
    latestSubscriptionStatus,
  };
}

export async function setWorkspaceTier(workspaceId: string, tier: SaaSTier): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('workspaces').upsert(
    {
      id: workspaceId,
      tier,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
}

export type ManualPaymentApprovalRecord = {
  workspace_id: string;
  status: 'approved' | 'rejected';
  reason: string | null;
  reviewed_by_user_id: string;
  metadata?: Record<string, unknown>;
};

export async function insertManualPaymentApproval(params: ManualPaymentApprovalRecord): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('payment_approvals').insert({
    workspace_id: params.workspace_id,
    status: params.status,
    reason: params.reason,
    reviewed_by_user_id: params.reviewed_by_user_id,
    metadata: params.metadata ?? {},
  });
}

export async function listManualPaymentApprovalsByWorkspace(workspaceId: string, limit: number = 50) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from('payment_approvals')
    .select('id,workspace_id,status,reason,reviewed_by_user_id,reviewed_at,metadata,created_at')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  return data ?? [];
}

export type PersistedPortfolioState = {
  dailyRealizedPnlPct: number;
  openPositionCount: number;
  consecutiveLosses: number;
  tradingEnabled: boolean;
};

export async function getPortfolioStateByWorkspace(workspaceId: string): Promise<PersistedPortfolioState | null> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from('portfolio_state')
    .select('daily_realized_pnl_pct,open_position_count,consecutive_losses,trading_enabled')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (!data) return null;
  return {
    dailyRealizedPnlPct: Number(data.daily_realized_pnl_pct ?? 0),
    openPositionCount: Number(data.open_position_count ?? 0),
    consecutiveLosses: Number(data.consecutive_losses ?? 0),
    tradingEnabled: Boolean(data.trading_enabled ?? true),
  };
}

export async function upsertPortfolioStateByWorkspace(workspaceId: string, state: PersistedPortfolioState): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('portfolio_state').upsert(
    {
      workspace_id: workspaceId,
      daily_realized_pnl_pct: state.dailyRealizedPnlPct,
      open_position_count: state.openPositionCount,
      consecutive_losses: state.consecutiveLosses,
      trading_enabled: state.tradingEnabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'workspace_id' }
  );
}

export async function listTradeJournalEntriesByWorkspace(workspaceId: string, symbol?: string, limit: number = 100) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return null;

  let query = supabase
    .from('trade_journal')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (symbol) {
    query = query.eq('symbol', symbol);
  }

  const { data } = await query;
  return data ?? [];
}

export async function insertTradeJournalEntry(params: {
  workspaceId: string;
  entry: Record<string, unknown>;
}): Promise<void> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) return;

  await supabase.from('trade_journal').insert({
    workspace_id: params.workspaceId,
    ...params.entry,
    created_at: new Date().toISOString(),
  });
}
