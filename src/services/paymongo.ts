/**
 * PayMongo service utilities.
 * All requests go through the Vite dev-proxy at /api/paymongo
 * so the Secret Key is never exposed to the browser.
 */

const PROXY_BASE = '/api/paymongo/v1';

/** Convert peso amount to centavos (PayMongo uses smallest unit) */
export const toСentavos = (pesos: number) => Math.round(pesos * 100);

/** -------------------------------------------------------------------
 *  SOURCES FLOW  (simplest – redirects user to GCash hosted page)
 * ------------------------------------------------------------------- */
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

  const res = await fetch(`${PROXY_BASE}/sources`, {
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

/** -------------------------------------------------------------------
 *  PAYMENT INTENTS FLOW  (for cards; included for future use)
 * ------------------------------------------------------------------- */
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

  const res = await fetch(`${PROXY_BASE}/payment_intents`, {
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
