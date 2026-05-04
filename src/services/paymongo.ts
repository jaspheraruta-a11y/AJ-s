/**
 * PayMongo service utilities.
 * All requests go through the Vercel Serverless Function at /api/paymongo
 * so the Secret Key is never exposed to the browser.
 */

const PROXY_BASE = '/api/paymongo';

/** Convert peso amount to centavos (PayMongo uses smallest unit) */
export const toСentavos = (pesos: number) => Math.round(pesos * 100);

export interface CreateSourceParams {
  amount: number; // in pesos
  redirectSuccess: string;
  redirectFailed: string;
  billing?: { name?: string; email?: string; phone?: string };
}

export interface PayMongoSource {
  id: string;
  type: string;
  attributes: {
    amount: number;
    currency: string;
    status: string;
    type: string;
    redirect: {
      checkout_url: string;
      success: string;
      failed: string;
    };
    billing?: Record<string, unknown>;
  };
}

/** 
 * SOURCES FLOW (GCash)
 */
export async function createGCashSource(params: CreateSourceParams): Promise<PayMongoSource> {
  const body = {
    data: {
      attributes: {
        amount: toСentavos(params.amount),
        currency: 'PHP',
        type: 'gcash',
        redirect: {
          success: params.redirectSuccess,
          failed: params.redirectFailed,
        },
        ...(params.billing && { billing: params.billing }),
      },
    },
  };

  // We append ?target=sources so the Vercel proxy knows where to send it
  const res = await fetch(`${PROXY_BASE}?target=sources`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.errors?.[0]?.detail ?? `PayMongo error: ${res.status}`);
  }

  const json = await res.json();
  return json.data as PayMongoSource;
}

/** 
 * PAYMENT INTENTS FLOW (Cards)
 */
export async function createPaymentIntent(amountPesos: number) {
  const body = {
    data: {
      attributes: {
        amount: toСentavos(amountPesos),
        currency: 'PHP',
        payment_method_allowed: ['card', 'gcash'],
        capture_type: 'automatic',
      },
    },
  };

  // We append ?target=payment_intents for card payments
  const res = await fetch(`${PROXY_BASE}?target=payment_intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.errors?.[0]?.detail ?? `PayMongo error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}