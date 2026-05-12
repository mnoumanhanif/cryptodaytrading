import { NextResponse } from 'next/server';
import { ADMIN_ONLY_RULES, PRIVILEGED_ACTION_RULES, type SaaSRole, type SaaSTier } from './config';
import { appendAuditLog, getWorkspaceBillingState, upsertWorkspaceMembership } from './db';

export interface SaaSRequestContext {
  requestId: string;
  userId: string;
  role: SaaSRole;
  workspaceId: string;
  tier: SaaSTier;
}

export function getRequestContext(request: Request): SaaSRequestContext | null {
  const headers = request.headers;
  const userId = headers.get('x-saas-user-id');
  const role = headers.get('x-saas-role') as SaaSRole | null;
  const workspaceId = headers.get('x-saas-workspace-id');
  const tier = headers.get('x-saas-tier') as SaaSTier | null;
  const requestId = headers.get('x-saas-request-id') ?? crypto.randomUUID();

  if (!userId || !role || !workspaceId || !tier) {
    return null;
  }

  return {
    requestId,
    userId,
    role,
    workspaceId,
    tier,
  };
}

function getPathname(request: Request): string {
  return new URL(request.url).pathname;
}

function isPublicContext(context: SaaSRequestContext): boolean {
  return context.userId.startsWith('public-user-');
}

function isRuleMatch(request: Request, rules: Array<{ path: string; method: string }>): boolean {
  const pathname = getPathname(request);
  const method = request.method.toUpperCase();
  return rules.some((rule) => rule.path === pathname && rule.method.toUpperCase() === method);
}

export async function requireRequestContext(request: Request): Promise<SaaSRequestContext | NextResponse> {
  const context = getRequestContext(request);
  if (!context) {
    const requestId = crypto.randomUUID();
    return {
      requestId,
      userId: `public-user-${requestId}`,
      role: 'user',
      workspaceId: `public-workspace-${requestId}`,
      tier: 'free',
    };
  }

  if (!isPublicContext(context)) {
    try {
      await upsertWorkspaceMembership({
        workspaceId: context.workspaceId,
        userId: context.userId,
        role: context.role,
        tier: context.tier,
      });
    } catch (error) {
      console.error('Failed to sync workspace membership role:', error);
    }
  }

  return context;
}

export async function requireAdminRole(context: SaaSRequestContext, request: Request): Promise<NextResponse | null> {
  if (!isRuleMatch(request, ADMIN_ONLY_RULES)) {
    return null;
  }

  if (context.role === 'admin') {
    return null;
  }

  await appendAuditLog({
    workspaceId: context.workspaceId,
    userId: context.userId,
    action: 'access.denied.admin_required',
    metadata: {
      path: getPathname(request),
      method: request.method.toUpperCase(),
      role: context.role,
    },
  });

  return NextResponse.json({ error: 'Admin role is required for this action' }, { status: 403 });
}

export async function requireAdminPaidAccess(context: SaaSRequestContext, request: Request): Promise<NextResponse | null> {
  if (!isRuleMatch(request, PRIVILEGED_ACTION_RULES)) {
    return null;
  }

  const adminResponse = await requireAdminRole(context, request);
  if (adminResponse) return adminResponse;

  const billingState = await getWorkspaceBillingState(context.workspaceId);
  const hasPaidAccess =
    context.tier === 'pro' ||
    billingState?.tier === 'pro' ||
    Boolean(billingState?.hasActiveSubscription);

  if (hasPaidAccess) {
    return null;
  }

  await appendAuditLog({
    workspaceId: context.workspaceId,
    userId: context.userId,
    action: 'access.denied.payment_required',
    metadata: {
      path: getPathname(request),
      method: request.method.toUpperCase(),
      role: context.role,
      tierFromToken: context.tier,
      workspaceTier: billingState?.tier ?? null,
      latestSubscriptionStatus: billingState?.latestSubscriptionStatus ?? null,
    },
  });

  return NextResponse.json(
    { error: 'An approved payment (pro tier or active subscription) is required for this action' },
    { status: 402 }
  );
}
