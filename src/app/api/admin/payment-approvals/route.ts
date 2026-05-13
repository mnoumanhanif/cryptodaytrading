import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import {
  appendAuditLog,
  getWorkspaceBillingState,
  insertManualPaymentApproval,
  listManualPaymentApprovalsByWorkspace,
  setWorkspaceTier,
} from '@/lib/saas/db';
import { badRequestFromZod } from '@/lib/saas/validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const postSchema = z.object({
  action: z.enum(['approve', 'reject']),
  workspaceId: z.string().trim().min(1).optional(),
  reason: z.string().trim().max(500).optional(),
});

export async function GET(request: Request) {
  try {
    const contextOrResponse = await requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspaceId')?.trim() || contextOrResponse.workspaceId;

    const [billingState, approvals] = await Promise.all([
      getWorkspaceBillingState(workspaceId),
      listManualPaymentApprovalsByWorkspace(workspaceId, 50),
    ]);

    return NextResponse.json({
      workspaceId,
      billing: billingState,
      approvals,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('Admin payment approvals GET error:', error);
    return NextResponse.json({ error: 'Failed to load payment approvals' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contextOrResponse = await requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) return contextOrResponse;

    const bodyJson: unknown = await request.json();
    const parsed = postSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    const workspaceId = parsed.data.workspaceId || contextOrResponse.workspaceId;
    const nextTier = parsed.data.action === 'approve' ? 'pro' : 'free';

    await setWorkspaceTier(workspaceId, nextTier);
    await insertManualPaymentApproval({
      workspace_id: workspaceId,
      status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
      reason: parsed.data.reason ?? null,
      reviewed_by_user_id: contextOrResponse.userId,
      metadata: {
        requestedBy: contextOrResponse.userId,
        source: 'admin-api',
      },
    });

    await appendAuditLog({
      workspaceId,
      userId: contextOrResponse.userId,
      action: `billing.manual_${parsed.data.action}`,
      metadata: {
        reason: parsed.data.reason ?? null,
        tierAfterAction: nextTier,
      },
    });

    const billing = await getWorkspaceBillingState(workspaceId);
    return NextResponse.json({
      workspaceId,
      billing,
      status: parsed.data.action === 'approve' ? 'approved' : 'rejected',
      message:
        parsed.data.action === 'approve'
          ? 'Payment approved and workspace upgraded to pro.'
          : 'Payment rejected and workspace remains on free tier.',
    });
  } catch (error) {
    console.error('Admin payment approvals POST error:', error);
    return NextResponse.json({ error: 'Failed to process payment approval action' }, { status: 500 });
  }
}
