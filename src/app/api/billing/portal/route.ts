import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRequestContext } from '@/lib/saas/context';
import { badRequestFromZod } from '@/lib/saas/validation';
import { getStripeClient } from '@/lib/saas/stripe';
import { appendAuditLog, getSupabaseAdminClient, upsertWorkspaceMembership } from '@/lib/saas/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

const requestSchema = z.object({
  returnUrl: z.string().url(),
});

export async function POST(request: Request) {
  try {
    const contextOrResponse = requireRequestContext(request);
    if (contextOrResponse instanceof NextResponse) {
      return contextOrResponse;
    }
    const context = contextOrResponse;

    const bodyJson: unknown = await request.json();
    const parsed = requestSchema.safeParse(bodyJson);
    if (!parsed.success) {
      return badRequestFromZod(parsed.error);
    }

    await upsertWorkspaceMembership({
      workspaceId: context.workspaceId,
      userId: context.userId,
      role: context.role,
      tier: context.tier,
    });

    const supabase = getSupabaseAdminClient();
    let stripeCustomerId: string | null = null;

    if (supabase) {
      const { data } = await supabase
        .from('workspaces')
        .select('stripe_customer_id')
        .eq('id', context.workspaceId)
        .maybeSingle();
      stripeCustomerId = data?.stripe_customer_id ?? null;
    }

    const stripe = getStripeClient();
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        metadata: {
          workspace_id: context.workspaceId,
          created_by_user_id: context.userId,
        },
      });
      stripeCustomerId = customer.id;

      if (supabase) {
        await supabase.from('workspaces').upsert(
          {
            id: context.workspaceId,
            tier: context.tier,
            stripe_customer_id: stripeCustomerId,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      }
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: parsed.data.returnUrl,
    });

    await appendAuditLog({
      workspaceId: context.workspaceId,
      userId: context.userId,
      action: 'billing.portal_session.created',
      metadata: {
        customerId: stripeCustomerId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Billing portal error:', error);
    return NextResponse.json({ error: 'Failed to create billing portal session' }, { status: 500 });
  }
}
