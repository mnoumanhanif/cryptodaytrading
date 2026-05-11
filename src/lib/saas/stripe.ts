import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2026-04-22.dahlia',
    });
  }

  return stripeClient;
}

export function mapStripeStatusToTier(status: string): 'free' | 'pro' {
  if (status === 'active' || status === 'trialing') {
    return 'pro';
  }
  return 'free';
}
