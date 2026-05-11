import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripeClient, mapStripeStatusToTier } from '@/lib/saas/stripe';
import { upsertSubscription } from '@/lib/saas/db';

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
      const workspaceId = getWorkspaceIdFromSubscription(subscription);
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;

      if (workspaceId && customerId) {
        const currentPeriodEnd = subscription.items.data[0]?.current_period_end
          ? new Date(subscription.items.data[0].current_period_end * 1000).toISOString()
          : null;

        await upsertSubscription({
          workspaceId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          priceId: subscription.items.data[0]?.price.id ?? null,
          currentPeriodEnd,
          tier: mapStripeStatusToTier(subscription.status),
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
