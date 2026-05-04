/**
 * PayMongo service utilities.
 * Requests go through /api/paymongo (Vercel function or Vite dev proxy) so the
 * secret key stays server-side.
 */

const PROXY_BASE = '/api/paymongo';

/** Convert peso amount to centavos (PayMongo smallest unit for PHP). */
export const toCentavos = (pesos: number) => Math.round(pesos * 100);

/** PayMongo requires at least ₱20.00 (2000 centavos) for payment intents. */
export const PAYMONGO_MIN_CARD_PESOS = 20;

function parsePayMongoError(json: unknown): string {
  const j = json as { errors?: { detail?: string }[]; error?: string };
  const detail = j?.errors?.[0]?.detail;
  if (detail) return detail;
  if (j?.error) return j.error;
  return 'PayMongo request failed';
}

async function payMongoRequest<T = unknown>(
  method: 'GET' | 'POST',
  targetPath: string,
  body?: object,
): Promise<T> {
  const qs = `target=${encodeURIComponent(targetPath)}`;
  const url = method === 'GET' ? `${PROXY_BASE}?${qs}` : `${PROXY_BASE}?${qs}`;
  const res = await fetch(url, {
    method,
    headers: {
      Accept: 'application/json',
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
  });
  const json = (await res.json().catch(() => ({}))) as T;
  if (!res.ok) {
    throw new Error(parsePayMongoError(json));
  }
  return json;
}

export interface CreateSourceParams {
  amount: number;
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
        amount: toCentavos(params.amount),
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

  const json = await payMongoRequest<{ data: PayMongoSource }>('POST', 'sources', body);
  return json.data;
}

export interface PayMongoPaymentIntent {
  id: string;
  type: string;
  attributes: {
    amount: number;
    currency: string;
    status: string;
    client_key: string;
    next_action: null | {
      type: string;
      redirect: { url: string; return_url: string };
    };
    last_payment_error: null | { failed_code?: string; message?: string };
  };
}

export async function createCardPaymentIntent(amountPesos: number): Promise<PayMongoPaymentIntent> {
  if (amountPesos + 1e-9 < PAYMONGO_MIN_CARD_PESOS) {
    throw new Error(`Card payments require a minimum of ₱${PAYMONGO_MIN_CARD_PESOS.toFixed(2)}.`);
  }
  const body = {
    data: {
      attributes: {
        amount: toCentavos(amountPesos),
        currency: 'PHP',
        payment_method_allowed: ['card'],
        capture_type: 'automatic',
        payment_method_options: {
          card: { request_three_d_secure: 'automatic' },
        },
      },
    },
  };
  const json = await payMongoRequest<{ data: PayMongoPaymentIntent }>('POST', 'payment_intents', body);
  return json.data;
}

export interface PayMongoPaymentMethod {
  id: string;
  type: string;
  attributes: { type: string };
}

export async function createCardPaymentMethod(params: {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  billingName?: string;
}): Promise<PayMongoPaymentMethod> {
  const digits = params.cardNumber.replace(/\D/g, '');
  let year = params.expYear;
  if (year < 100) year += 2000;

  const body = {
    data: {
      attributes: {
        type: 'card',
        details: {
          card_number: digits,
          exp_month: params.expMonth,
          exp_year: year,
          cvc: params.cvc.replace(/\s/g, ''),
        },
        ...(params.billingName?.trim() && {
          billing: { name: params.billingName.trim() },
        }),
      },
    },
  };

  const json = await payMongoRequest<{ data: PayMongoPaymentMethod }>('POST', 'payment_methods', body);
  return json.data;
}

export async function attachPaymentMethodToIntent(
  paymentIntentId: string,
  paymentMethodId: string,
  returnUrl: string,
): Promise<PayMongoPaymentIntent> {
  const body = {
    data: {
      attributes: {
        payment_method: paymentMethodId,
        return_url: returnUrl,
      },
    },
  };
  const json = await payMongoRequest<{ data: PayMongoPaymentIntent }>(
    'POST',
    `payment_intents/${paymentIntentId}/attach`,
    body,
  );
  return json.data;
}

export async function retrievePaymentIntent(paymentIntentId: string): Promise<PayMongoPaymentIntent> {
  const json = await payMongoRequest<{ data: PayMongoPaymentIntent }>(
    'GET',
    `payment_intents/${paymentIntentId}`,
  );
  return json.data;
}

/** Poll after attach when status is `processing` (e.g. some issuer flows). */
export async function retrievePaymentIntentWhenReady(
  paymentIntentId: string,
  opts?: { maxAttempts?: number; intervalMs?: number },
): Promise<PayMongoPaymentIntent> {
  const maxAttempts = opts?.maxAttempts ?? 12;
  const intervalMs = opts?.intervalMs ?? 700;
  for (let i = 0; i < maxAttempts; i++) {
    const pi = await retrievePaymentIntent(paymentIntentId);
    const s = pi.attributes.status;
    if (s === 'succeeded' || s === 'awaiting_next_action') return pi;
    const err = pi.attributes.last_payment_error;
    if (err?.message) throw new Error(err.message);
    if (s !== 'processing') {
      throw new Error(`Payment could not be completed (status: ${s}).`);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error('Payment is still processing. Please check your statement or try again later.');
}
