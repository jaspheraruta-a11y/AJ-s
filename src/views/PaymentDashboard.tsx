import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  CreditCard,
  Wallet,
  Store,
  ChevronLeft,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import { supabase } from '../supabase';
import { createGCashSource } from '../services/paymongo';
import { getStripe, createStripePaymentIntent } from '../services/stripe';
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useElements,
  useStripe,
} from '@stripe/react-stripe-js';

type PaymentMethod = 'gcash' | 'card' | 'counter' | null;

// ── Pending order stored in sessionStorage so we can restore it after redirect ──
const PENDING_ORDER_KEY = 'paymongo_pending_order';

interface PendingOrder {
  cart: any[];
  total: number;
  userId: string | null;
  paymentMethod: PaymentMethod;
  sourceId?: string;
}

function savePendingOrder(order: PendingOrder) {
  sessionStorage.setItem(PENDING_ORDER_KEY, JSON.stringify(order));
}

function loadPendingOrder(): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(PENDING_ORDER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearPendingOrder() {
  sessionStorage.removeItem(PENDING_ORDER_KEY);
}

const CART_STATE_KEY = 'payment_cart_state';

// ── Stripe Element style ───────────────────────────────────────────────────
const stripeElementStyle = {
  base: {
    fontSize: '15px',
    color: '#44403c',
    fontFamily: '"Inter", sans-serif',
    fontSmoothing: 'antialiased',
    '::placeholder': { color: '#a8a29e' },
  },
  invalid: { color: '#ef4444', iconColor: '#ef4444' },
};

// ── Card Form (inner – must live inside <Elements>) ────────────────────────
function StripeCardForm({
  total,
  cart,
  userId,
  onSuccess,
  onError,
}: {
  total: number;
  cart: any[];
  userId: string | null;
  onSuccess: (pts: number) => void;
  onError: (msg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [cardName, setCardName] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const handlePay = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);

    try {
      // 1. Create PaymentIntent on the server (via Vite proxy)
      const { clientSecret } = await createStripePaymentIntent(total);

      // 2. Confirm card payment in the browser
      const cardNumber = elements.getElement(CardNumberElement);
      if (!cardNumber) throw new Error('Card fields not ready');

      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: cardNumber,
          billing_details: { name: cardName || undefined },
        },
      });

      if (error) throw new Error(error.message ?? 'Card payment failed');
      if (paymentIntent?.status !== 'succeeded') throw new Error('Payment not completed');

      // 3. Save order to Supabase
      const pts = await saveOrder({ cart, total, userId, paymentMethod: 'card', sourceId: paymentIntent.id });
      sessionStorage.removeItem(CART_STATE_KEY);
      onSuccess(pts);
    } catch (err: any) {
      onError(err.message ?? 'Card payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full px-4 py-3 rounded-xl border-2 transition-all duration-200 bg-white ${focusedField === field
      ? 'border-[#7b6a6c] shadow-sm shadow-[#7b6a6c]/10'
      : 'border-stone-200 hover:border-stone-300'
    }`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="mt-4 space-y-4"
    >
      {/* Decorative card preview strip */}
      <div className="relative h-28 bg-gradient-to-br from-[#7b6a6c] to-[#4a3b3d] rounded-2xl overflow-hidden flex items-end p-5 shadow-lg">
        <div className="absolute top-4 left-5 flex gap-1.5">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/30" />
          ))}
        </div>
        <div className="absolute top-4 right-5">
          <div className="w-10 h-7 rounded bg-white/20 border border-white/30" />
        </div>
        <div className="w-full">
          <p className="text-white/50 text-[10px] uppercase tracking-widest mb-0.5">Card holder</p>
          <p className="text-white font-mono text-sm font-bold truncate">
            {cardName || 'YOUR NAME'}
          </p>
        </div>
        {/* Shine */}
        <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none" />
      </div>

      {/* Card Holder Name */}
      <div>
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
          Card Holder Name
        </label>
        <input
          type="text"
          placeholder="Full name on card"
          value={cardName}
          onChange={(e) => setCardName(e.target.value)}
          onFocus={() => setFocusedField('name')}
          onBlur={() => setFocusedField(null)}
          className={fieldClass('name') + ' text-sm outline-none'}
        />
      </div>

      {/* Card Number */}
      <div>
        <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
          Card Number
        </label>
        <div className={fieldClass('number')}>
          <CardNumberElement
            options={{ style: stripeElementStyle, showIcon: true }}
            onFocus={() => setFocusedField('number')}
            onBlur={() => setFocusedField(null)}
          />
        </div>
      </div>

      {/* Expiry & CVC */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            Expiry Date
          </label>
          <div className={fieldClass('expiry')}>
            <CardExpiryElement
              options={{ style: stripeElementStyle }}
              onFocus={() => setFocusedField('expiry')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-bold text-stone-500 uppercase tracking-wider mb-1.5">
            CVC
          </label>
          <div className={fieldClass('cvc')}>
            <CardCvcElement
              options={{ style: stripeElementStyle }}
              onFocus={() => setFocusedField('cvc')}
              onBlur={() => setFocusedField(null)}
            />
          </div>
        </div>
      </div>

      {/* Pay Button */}
      <button
        onClick={handlePay}
        disabled={processing || !stripe}
        className="w-full py-4 bg-[#7b6a6c] hover:bg-[#6a5b5d] disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg shadow-[#7b6a6c]/20 transition-all flex items-center justify-center gap-2 mt-2"
      >
        {processing ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Processing…
          </>
        ) : (
          <>
            <Lock className="w-4 h-4" />
            Pay ₱{total.toFixed(2)} Securely
          </>
        )}
      </button>

      {/* Trust badges */}
      <div className="flex items-center justify-center gap-2 text-stone-400 text-xs">
        <ShieldCheck className="w-4 h-4 text-green-400" />
        Secured by Stripe · 256-bit SSL encryption
      </div>
    </motion.div>
  );
}

// ── Points calculation: every ₱1 = 0.01 points ────────────────────────────
function calculatePoints(total: number): number {
  return Math.round(total * 0.01 * 100) / 100; // 0.01 pts per peso, rounded to 2 decimals
}

// ── Award points to user profile ──────────────────────────────────────────
async function awardPoints(userId: string, orderId: string, total: number): Promise<number> {
  const pointsEarned = calculatePoints(total);
  if (pointsEarned <= 0 || !userId) return 0;

  // Increment points on the profile (using rpc or update with current value)
  const { data: profile, error: fetchErr } = await supabase
    .from('profiles')
    .select('points')
    .eq('id', userId)
    .single();

  if (fetchErr) {
    console.warn('Could not fetch profile for points update:', fetchErr.message);
    return 0;
  }

  const currentPoints = (profile?.points as number) ?? 0;
  const newPoints = currentPoints + pointsEarned;

  const { error: updateErr } = await supabase
    .from('profiles')
    .update({ points: newPoints, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (updateErr) {
    console.warn('Could not update points:', updateErr.message);
    return 0;
  }

  return pointsEarned;
}

// ── Save order + payment to Supabase ───────────────────────────────────────
async function saveOrder(pending: PendingOrder): Promise<number> {
  const orderNumber = 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase();

  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert([{
      order_number: orderNumber,
      user_id: pending.userId || null,
      status: pending.paymentMethod === 'counter' ? 'pending' : 'preparing',
      order_type: 'walkin',
      subtotal: pending.total,
      discount_amount: 0,
      total: pending.total,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }])
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItemsToInsert = pending.cart.map((item: any) => ({
    order_id: orderData.id,
    product_id: item.id,
    product_name: item.name,
    size: item.selectedSize?.name || null,
    quantity: item.quantity,
    unit_price: item.price + (item.selectedSize?.price_modifier || 0),
    line_total: item.totalPrice,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItemsToInsert);
  if (itemsError) throw itemsError;

  // Map 'counter' to 'cash' — the DB enum only allows: cash | card | gcash | paymaya
  const dbMethod = pending.paymentMethod === 'counter' ? 'cash' : pending.paymentMethod;

  const { error: paymentError } = await supabase.from('payments').insert([{
    order_id: orderData.id,
    method: dbMethod,
    status: pending.paymentMethod === 'counter' ? 'pending' : 'paid',
    amount: pending.total,
    reference_number: pending.sourceId || null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }]);
  if (paymentError) {
    console.error('Payment record insert failed:', paymentError);
    // Non-fatal — order already created, just log and continue
  }

  // Award loyalty points if user is logged in
  let pointsEarned = 0;
  if (pending.userId) {
    pointsEarned = await awardPoints(pending.userId, orderData.id, pending.total);
  }

  return pointsEarned;
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function PaymentDashboard() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const cartState: { cart: any[]; total: number } | null =
    location.state?.cart
      ? { cart: location.state.cart, total: location.state.total || 0 }
      : (() => {
        try {
          const raw = sessionStorage.getItem(CART_STATE_KEY);
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      })();

  const cart = cartState?.cart ?? [];
  const total = cartState?.total ?? 0;

  useEffect(() => {
    if (location.state?.cart) {
      sessionStorage.setItem(CART_STATE_KEY, JSON.stringify({ cart: location.state.cart, total: location.state.total || 0 }));
    }
  }, [location.state]);

  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isCounterOrder, setIsCounterOrder] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [gcashRedirecting, setGcashRedirecting] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  // Stripe Elements provider state
  const [stripePromise] = useState(() => getStripe());

  // ── Return from GCash redirect ───────────────────────────────────────────
  // Guard ref — ensures saveOrder is called at most once even in React 18
  // Strict Mode (which double-invokes effects in development).
  const gcashHandled = useRef(false);

  useEffect(() => {
    const status = searchParams.get('status');
    if (!status) return;

    // Prevent double-execution (React 18 Strict Mode / re-renders)
    if (gcashHandled.current) return;
    gcashHandled.current = true;

    if (status === 'success' || status === 'chargeable') {
      const pending = loadPendingOrder();
      if (pending) {
        // Clear BEFORE saving so a second call won't find the order again
        clearPendingOrder();
        saveOrder(pending).then((pts) => {
          setPointsEarned(pts);
          setIsSuccess(true);
          setTimeout(() => navigate('/', { replace: true }), 4000);
        }).catch((err) => {
          console.error('Failed to finalize order after GCash:', err);
          setErrorMsg('Payment received but order could not be saved. Please contact support.');
          setIsFailed(true);
        });
      } else {
        setIsSuccess(true);
        setTimeout(() => navigate('/', { replace: true }), 4000);
      }
    } else {
      clearPendingOrder();
      setErrorMsg('GCash payment was cancelled or failed. Please try again.');
      setIsFailed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── GCash / Counter payment handler ─────────────────────────────────────
  const handleNonCardPayment = async () => {
    if (!selectedMethod || selectedMethod === 'card') return;
    setIsProcessing(true);
    setErrorMsg('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id ?? null;

      if (selectedMethod === 'gcash') {
        const origin = window.location.origin;
        const returnBase = `${origin}/payment`;
        const source = await createGCashSource({
          amount: total,
          redirectSuccess: `${returnBase}?status=success&source_id=${encodeURIComponent('SOURCE_ID')}`,
          redirectFailed: `${returnBase}?status=failed`,
        });
        savePendingOrder({ cart, total, userId, paymentMethod: 'gcash', sourceId: source.id });
        setGcashRedirecting(true);
        window.location.href = source.attributes.redirect.checkout_url;
        return;
      }

      // Counter
      const counterPts = await saveOrder({ cart, total, userId, paymentMethod: 'counter' });
      sessionStorage.removeItem(CART_STATE_KEY);
      setIsProcessing(false);
      setPointsEarned(counterPts);
      setIsCounterOrder(true);
      setIsSuccess(true);
      setTimeout(() => navigate('/', { replace: true }), 4000);
    } catch (err: any) {
      console.error('Payment failed:', err);
      setIsProcessing(false);
      setErrorMsg(err?.message ?? 'Failed to process payment. Please try again.');
    }
  };

  // Stripe callbacks
  const handleStripeSuccess = useCallback((pts: number) => {
    setPointsEarned(pts);
    setIsSuccess(true);
    setTimeout(() => navigate('/', { replace: true }), 4000);
  }, [navigate]);

  const handleStripeError = useCallback((msg: string) => {
    setErrorMsg(msg);
  }, []);

  // ── Screens ──────────────────────────────────────────────────────────────
  if (isSuccess) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-[#7b6a6c]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm w-full text-center"
        >
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
            <CheckCircle2 className="w-24 h-24 text-green-500 mb-6" />
          </motion.div>
          <h2 className="font-serif text-3xl font-bold mb-2">{isCounterOrder ? 'Order Placed!' : 'Payment Successful!'}</h2>
          <p className="text-stone-500 mb-6">
            {isCounterOrder
              ? 'Your order is pending. Please proceed to the counter to complete your payment.'
              : 'Your order is being prepared. Taking you back to the home page…'}
          </p>

          {/* Points earned badge */}
          {pointsEarned > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="w-full bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-2xl px-6 py-4 mb-6 flex items-center gap-4"
            >
              <div className="w-12 h-12 bg-amber-400 rounded-full flex items-center justify-center shrink-0 shadow-md shadow-amber-200">
                <span className="text-xl">⭐</span>
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">Points Earned</p>
                <p className="text-2xl font-bold text-amber-700">+{pointsEarned.toFixed(1)} pts</p>
                <p className="text-xs text-amber-500">Added to your loyalty account</p>
              </div>
            </motion.div>
          )}

          <div className="w-8 h-8 border-4 border-stone-200 border-t-[#7b6a6c] rounded-full animate-spin" />
        </motion.div>
      </div>
    );
  }

  if (isFailed) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-[#7b6a6c]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm w-full text-center"
        >
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}>
            <XCircle className="w-24 h-24 text-red-400 mb-6" />
          </motion.div>
          <h2 className="font-serif text-3xl font-bold mb-2">Payment Failed</h2>
          <p className="text-stone-500 mb-8">{errorMsg || 'Something went wrong. Please try again.'}</p>
          <button
            onClick={() => { setIsFailed(false); setErrorMsg(''); }}
            className="py-3 px-8 bg-[#7b6a6c] hover:bg-[#6a5b5d] text-white rounded-2xl font-bold transition-all"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  if (gcashRedirecting) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6 text-[#7b6a6c]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-10 rounded-[40px] shadow-2xl flex flex-col items-center max-w-sm w-full text-center"
        >
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6">
            <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
          </div>
          <h2 className="font-serif text-2xl font-bold mb-2">Redirecting to GCash</h2>
          <p className="text-stone-500">Please complete your payment in the GCash app or browser tab…</p>
        </motion.div>
      </div>
    );
  }

  const { data: sessionData } = { data: { session: null } }; // placeholder – userId fetched inside handlers
  const isCard = selectedMethod === 'card';

  return (
    <div className="min-h-screen bg-stone-50 text-[#7b6a6c] selection:bg-[#7b6a6c] selection:text-white">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-stone-200 sticky top-0 z-50 px-6 py-4 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-stone-100 rounded-full transition-colors mr-4"
        >
          <ChevronLeft className="w-6 h-6 text-stone-600" />
        </button>
        <span className="font-serif text-xl font-bold tracking-tight">Checkout</span>
      </header>

      <main className="max-w-4xl mx-auto p-6 md:p-12 pb-24 grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Left Column: Payment Methods */}
        <div className="space-y-8">
          <div>
            <h1 className="font-serif text-3xl font-bold mb-2">Payment Method</h1>
            <p className="text-stone-500">Choose how you would like to pay for your delicious order.</p>
          </div>

          <div className="space-y-4">
            {/* GCash */}
            <PaymentOption
              id="gcash"
              title="GCash"
              description="Pay securely via GCash e-wallet — redirects to GCash checkout."
              noPadIcon
              icon={
                <img
                  src="/GCash_Logo.png"
                  alt="GCash"
                  className="w-full h-full object-cover rounded-xl"
                />
              }
              badge={<span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1"><ExternalLink className="w-3 h-3" /> Redirects to GCash</span>}
              selected={selectedMethod === 'gcash'}
              onClick={() => setSelectedMethod('gcash')}
            />

            {/* Card */}
            <PaymentOption
              id="card"
              title="Credit or Debit Card"
              description="Visa, Mastercard, JCB, or Amex — powered by Stripe."
              icon={<CreditCard className="w-6 h-6" />}
              badge={<span className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Lock className="w-3 h-3" /> Stripe Secure</span>}
              selected={selectedMethod === 'card'}
              onClick={() => setSelectedMethod('card')}
            />

            {/* Counter */}
            <PaymentOption
              id="counter"
              title="Pay in Counter"
              description="Pay with cash or card physically at the café."
              icon={<Store className="w-6 h-6" />}
              selected={selectedMethod === 'counter'}
              onClick={() => setSelectedMethod('counter')}
            />
          </div>

          {/* ── Callout / inline form based on selection ── */}
          <AnimatePresence mode="wait">
            {selectedMethod === 'gcash' && (
              <motion.div
                key="gcash-info"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700 flex gap-3"
              >
                <ExternalLink className="w-5 h-5 mt-0.5 shrink-0" />
                <div>
                  <p className="font-bold mb-0.5">You'll be redirected to GCash</p>
                  <p className="text-blue-600">After completing payment in GCash, you'll be automatically brought back here to confirm your order.</p>
                </div>
              </motion.div>
            )}

            {selectedMethod === 'card' && (
              <motion.div
                key="card-form"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-white border border-stone-100 rounded-3xl p-6 shadow-lg shadow-stone-100/50"
              >
                <Elements stripe={stripePromise}>
                  <StripeCardFormWrapper
                    total={total}
                    cart={cart}
                    onSuccess={handleStripeSuccess}
                    onError={handleStripeError}
                  />
                </Elements>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error */}
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Right Column: Order Summary */}
        <div>
          <div className="bg-white rounded-[40px] shadow-xl shadow-stone-200/50 p-8 border border-stone-100 sticky top-28">
            <h2 className="font-serif text-2xl font-bold mb-6">Order Summary</h2>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto no-scrollbar mb-6 pr-2">
              {cart.length === 0 ? (
                <p className="text-stone-400 italic text-center py-4">Your cart is empty.</p>
              ) : (
                cart.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-start gap-4 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-stone-800 truncate">{item.name}</p>
                      {item.selectedSize && <p className="text-stone-500 text-xs">Size: {item.selectedSize.name}</p>}
                      <p className="text-stone-500 text-xs">Qty: {item.quantity}</p>
                    </div>
                    <span className="font-mono font-bold text-stone-700 whitespace-nowrap">₱{item.totalPrice.toFixed(2)}</span>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-stone-100 pt-6 space-y-4">
              <div className="flex justify-between text-stone-500 text-sm">
                <span>Subtotal</span><span>₱{total.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-stone-500 text-sm">
                <span>Tax & Fees</span><span>₱0.00</span>
              </div>
              <div className="flex justify-between items-end pt-4 border-t border-stone-100">
                <span className="font-bold text-xl">Total</span>
                <span className="font-mono font-bold text-3xl">₱{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Show confirm button only for non-card methods (card has its own button inside the form) */}
            {selectedMethod !== 'card' && (
              <button
                id="confirm-payment-btn"
                onClick={handleNonCardPayment}
                disabled={!selectedMethod || isProcessing || cart.length === 0}
                className="mt-8 w-full py-4 bg-[#7b6a6c] hover:bg-[#6a5b5d] disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-lg shadow-[#7b6a6c]/20 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {selectedMethod === 'gcash' ? 'Creating GCash Link…' : 'Processing…'}
                  </>
                ) : selectedMethod === 'gcash' ? (
                  <>
                    <img
                      src="/GCash_Logo.png"
                      alt=""
                      className="w-5 h-5 object-contain brightness-0 invert"
                    />
                    Pay with GCash
                  </>
                ) : (
                  'Confirm Payment'
                )}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Wrapper to inject userId from session ──────────────────────────────────
function StripeCardFormWrapper({
  total,
  cart,
  onSuccess,
  onError,
}: {
  total: number;
  cart: any[];
  onSuccess: (pts: number) => void;
  onError: (msg: string) => void;
}) {
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }, []);

  return (
    <StripeCardForm
      total={total}
      cart={cart}
      userId={userId}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}

// ── PaymentOption Component ────────────────────────────────────────────────
function PaymentOption({
  title,
  description,
  icon,
  badge,
  selected,
  onClick,
  noPadIcon = false,
}: {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  noPadIcon?: boolean;
}) {
  return (
    <div
      onClick={onClick}
      className={`relative p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 group ${selected
        ? 'border-[#7b6a6c] bg-[#7b6a6c]/5'
        : 'border-stone-100 bg-white hover:border-stone-300 hover:shadow-md'
        }`}
    >
      <div className="flex items-center gap-4">
        <div className={`rounded-xl overflow-hidden transition-colors flex items-center justify-center shrink-0 ${noPadIcon ? 'w-14 h-14' : 'p-3'} ${selected ? 'bg-[#7b6a6c] text-white' : 'bg-stone-100 text-stone-500 group-hover:bg-stone-200'}`}>
          {icon}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={`font-bold text-lg ${selected ? 'text-[#7b6a6c]' : 'text-stone-800'}`}>{title}</h3>
            {badge}
          </div>
          <p className="text-stone-500 text-sm">{description}</p>
        </div>
        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ${selected ? 'border-[#7b6a6c]' : 'border-stone-300'}`}>
          {selected && <div className="w-3 h-3 bg-[#7b6a6c] rounded-full" />}
        </div>
      </div>
    </div>
  );
}
