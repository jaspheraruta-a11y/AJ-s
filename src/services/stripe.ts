/**
 * Stripe service utilities.
 * Server-side calls go through the Vite dev-proxy at /api/stripe so the
 * Secret Key is never exposed to the browser.
 * The public (publishable) key is safe to embed in client-side code.
 */

import { loadStripe, Stripe } from '@stripe/stripe-js';

// ── Stripe.js singleton ────────────────────────────────────────────────────
let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    const pubKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY as string;
    if (!pubKey) throw new Error('VITE_STRIPE_PUBLIC_KEY is not set');
    stripePromise = loadStripe(pubKey);
  }
  return stripePromise;
}

// ── Proxy base for server-side Stripe calls ────────────────────────────────
const STRIPE_PROXY = '/api/stripe/v1';

/** Convert peso amount to cents (Stripe uses smallest currency unit) */
export const toCents = (pesos: number) => Math.round(pesos * 100);

/**
 * Create a Stripe PaymentIntent via the server-side proxy.
 * Returns the client_secret needed by Stripe Elements to finalize payment.
 */
export async function createStripePaymentIntent(
  amountPesos: number,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  const body = new URLSearchParams({
    amount: String(toCents(amountPesos)),
    currency: 'php',
    'payment_method_types[]': 'card',
    'automatic_payment_methods[enabled]': 'false',
  });

  const res = await fetch(`${STRIPE_PROXY}/payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.error?.message ?? `Stripe error: ${res.status}`);
  }

  const json = await res.json();
  return { clientSecret: json.client_secret, paymentIntentId: json.id };
}
