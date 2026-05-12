import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient, mapStripeStatusToTier } from '@/lib/saas/stripe';
import { appendAuditLog, setWorkspaceTier, upsertSubscription } from '@/lib/saas/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

function getWorkspaceIdFromSubscription(subscription: Stripe.Subscription): string | null {
  const workspaceId = subscription.metadata?.workspace_id;
  if (workspaceId) return workspaceId;

  const customer = subscription.customer;
  if (typeof customer === 'string') {
    return `ws_${customer}`;
  }
  return null;
}

async function syncSubscriptionState(subscription: Stripe.Subscription): Promise<void> {
  const workspaceId = getWorkspaceIdFromSubscription(subscription);
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!workspaceId || !customerId) return;

  const subscriptionWithPeriod = subscription as Stripe.Subscription & { current_period_end?: number | null };
  const periodEndSeconds = subscriptionWithPeriod.current_period_end ?? null;
  const currentPeriodEnd = periodEndSeconds
    ? new Date(periodEndSeconds * 1000).toISOString()
    : null;
  const nextTier = mapStripeStatusToTier(subscription.status);

  await upsertSubscription({
    workspaceId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    priceId: subscription.items.data[0]?.price.id ?? null,
    currentPeriodEnd,
    tier: nextTier,
  });
  await setWorkspaceTier(workspaceId, nextTier);
  await appendAuditLog({
    workspaceId,
    userId: 'stripe-webhook',
    action: 'billing.subscription_synced',
    metadata: {
      subscriptionId: subscription.id,
      status: subscription.status,
      tier: nextTier,
    },
  });
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('stripe-signature');
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!signature || !webhookSecret) {
      return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 400 });
    }

    const rawBody = await request.text();
    const stripe = getStripeClient();

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    } catch (error) {
      return NextResponse.json({ error: `Invalid webhook signature: ${String(error)}` }, { status: 400 });
    }

    if (event.type === 'customer.subscription.created' || event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      await syncSubscriptionState(subscription);
    }

    if (event.type === 'invoice.payment_succeeded' || event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const invoiceWithSubscription = invoice as Stripe.Invoice & {
        subscription?: string | Stripe.Subscription | null;
      };
      const subscriptionId =
        typeof invoiceWithSubscription.subscription === 'string'
          ? invoiceWithSubscription.subscription
          : invoiceWithSubscription.subscription?.id ?? null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionState(subscription);
      } else {
        const workspaceId = invoice.metadata?.workspace_id ?? null;
        if (workspaceId) {
          const nextTier = event.type === 'invoice.payment_succeeded' ? 'pro' : 'free';
          await setWorkspaceTier(workspaceId, nextTier);
          await appendAuditLog({
            workspaceId,
            userId: 'stripe-webhook',
            action: `billing.${event.type}`,
            metadata: {
              invoiceId: invoice.id,
              tier: nextTier,
            },
          });
        }
      }
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id ?? null;
      if (subscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await syncSubscriptionState(subscription);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
