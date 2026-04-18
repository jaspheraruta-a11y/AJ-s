import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ScrollText, CheckCircle, X, Clock, AlertTriangle, CreditCard, ShieldCheck, Coffee } from 'lucide-react';

interface UserAgreementModalProps {
  isOpen: boolean;
  onAccept: () => void;
}

const STORAGE_KEY = 'ajs_cafe_agreement_accepted';

export function useAgreementModal() {
  const [showAgreement, setShowAgreement] = useState(false);

  useEffect(() => {
    const accepted = localStorage.getItem(STORAGE_KEY);
    if (!accepted) {
      // Small delay so the page renders first
      const t = setTimeout(() => setShowAgreement(true), 800);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShowAgreement(false);
  };

  return { showAgreement, handleAccept };
}

const SECTIONS = [
  {
    icon: <Clock className="w-5 h-5 text-amber-600" />,
    bg: 'bg-amber-50 border-amber-200',
    title: '⏱️ Order Cancellation Policy',
    highlight: true,
    content: (
      <>
        <p className="text-stone-700 text-sm leading-relaxed">
          Orders that remain in <span className="font-bold text-amber-700">Pending</span> status
          (i.e., payment has <span className="font-bold">not been completed</span>) for more than{' '}
          <span className="font-bold text-red-600">1 hour (60 minutes)</span> will be{' '}
          <span className="font-bold text-red-600">automatically cancelled</span>. This frees up
          inventory and kitchen capacity for other customers.
        </p>
        <ul className="mt-3 space-y-1.5 text-sm text-stone-600">
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            If your order is cancelled due to non-payment, you may re-order at any time.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Please complete payment promptly to secure your order.
          </li>
          <li className="flex items-start gap-2">
            <span className="text-amber-500 mt-0.5">•</span>
            Loyalty points will not be awarded for cancelled orders.
          </li>
        </ul>
      </>
    ),
  },
  {
    icon: <CreditCard className="w-5 h-5 text-blue-600" />,
    bg: 'bg-blue-50 border-blue-200',
    title: '💳 Payment & Pricing',
    content: (
      <ul className="space-y-1.5 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="text-blue-400 mt-0.5">•</span>
          All prices are in Philippine Peso (₱) and inclusive of applicable taxes.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-400 mt-0.5">•</span>
          Payment must be settled before or upon receipt of your order.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-blue-400 mt-0.5">•</span>
          Prices are subject to change without prior notice.
        </li>
      </ul>
    ),
  },
  {
    icon: <Coffee className="w-5 h-5 text-[#7b6a6c]" />,
    bg: 'bg-stone-50 border-stone-200',
    title: '🍽️ Order Accuracy & Modifications',
    content: (
      <ul className="space-y-1.5 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="text-stone-400 mt-0.5">•</span>
          Please review your order carefully before checkout — confirmed orders cannot be modified.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-stone-400 mt-0.5">•</span>
          Item availability may vary. In case an item is unavailable, our staff will contact you.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-stone-400 mt-0.5">•</span>
          Preparation times are estimates and may vary during peak hours.
        </li>
      </ul>
    ),
  },
  {
    icon: <ShieldCheck className="w-5 h-5 text-green-600" />,
    bg: 'bg-green-50 border-green-200',
    title: '🔐 Loyalty Points & Rewards',
    content: (
      <ul className="space-y-1.5 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="text-green-500 mt-0.5">•</span>
          Loyalty points are awarded only upon successful, paid orders (₱1 = 0.01 pt).
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-500 mt-0.5">•</span>
          Points have no monetary value and cannot be exchanged for cash.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-green-500 mt-0.5">•</span>
          AJ's Café reserves the right to revoke points obtained through fraud or abuse.
        </li>
      </ul>
    ),
  },
  {
    icon: <AlertTriangle className="w-5 h-5 text-orange-600" />,
    bg: 'bg-orange-50 border-orange-200',
    title: '⚠️ Conduct & Account Use',
    content: (
      <ul className="space-y-1.5 text-sm text-stone-600">
        <li className="flex items-start gap-2">
          <span className="text-orange-400 mt-0.5">•</span>
          Your account is personal and must not be shared with others.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-orange-400 mt-0.5">•</span>
          Repeated failed logins will result in a temporary account restriction.
        </li>
        <li className="flex items-start gap-2">
          <span className="text-orange-400 mt-0.5">•</span>
          AJ's Café reserves the right to suspend accounts involved in misuse or fraudulent activity.
        </li>
      </ul>
    ),
  },
];

export default function UserAgreementModal({ isOpen, onAccept }: UserAgreementModalProps) {
  const [hasScrolled, setHasScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setHasScrolled(false);
      setAgreed(false);
    }
  }, [isOpen]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 40;
    if (nearBottom) setHasScrolled(true);
  };

  const canAccept = hasScrolled && agreed;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[9991] flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              initial={{ scale: 0.88, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.88, y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            >
              {/* Header gradient bar */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#7b6a6c] via-amber-400 to-[#7b6a6c]" />

              {/* Header */}
              <div className="px-7 pt-6 pb-4 border-b border-stone-100">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-[#7b6a6c]/10 flex items-center justify-center flex-shrink-0">
                    <ScrollText className="w-5 h-5 text-[#7b6a6c]" />
                  </div>
                  <div>
                    <h2 className="font-serif text-xl font-bold text-[#7b6a6c] leading-tight">
                      Terms &amp; User Agreement
                    </h2>
                    <p className="text-xs text-stone-400 mt-0.5">
                      AJ's Café · Please read before continuing
                    </p>
                  </div>
                </div>

                {/* Scroll hint */}
                {!hasScrolled && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="mt-4 flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2"
                  >
                    <motion.span
                      animate={{ y: [0, 3, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      ↓
                    </motion.span>
                    Scroll down to read and accept the full agreement
                  </motion.div>
                )}
                {hasScrolled && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mt-4 flex items-center gap-2 text-xs text-green-600 bg-green-50 border border-green-200 rounded-xl px-3 py-2"
                  >
                    <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    You've read the full agreement — please confirm below
                  </motion.div>
                )}
              </div>

              {/* Scrollable content */}
              <div
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto px-7 py-5 space-y-4"
              >
                <p className="text-sm text-stone-500 leading-relaxed">
                  Welcome to <span className="font-bold text-[#7b6a6c]">AJ's Café</span>! By
                  using our ordering platform, you agree to the following terms. Please read them
                  carefully before placing any order.
                </p>

                {SECTIONS.map((section, idx) => (
                  <div
                    key={idx}
                    className={`rounded-2xl border p-4 ${section.bg}`}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      {section.icon}
                      <h3 className="font-bold text-[#7b6a6c] text-sm">{section.title}</h3>
                    </div>
                    {section.content}
                  </div>
                ))}

                {/* Last updated */}
                <p className="text-center text-[11px] text-stone-300 pb-2">
                  Last updated: April 2026 · AJ's Café, Laligan, Valencia, Bukidnon
                </p>
              </div>

              {/* Footer */}
              <div className="px-7 py-5 border-t border-stone-100 bg-stone-50/80 space-y-4">
                {/* Checkbox */}
                <label
                  className={`flex items-start gap-3 cursor-pointer group transition-opacity ${
                    !hasScrolled ? 'opacity-40 pointer-events-none' : 'opacity-100'
                  }`}
                >
                  <div
                    onClick={() => hasScrolled && setAgreed(v => !v)}
                    className={`w-5 h-5 rounded-md border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                      agreed
                        ? 'bg-[#7b6a6c] border-[#7b6a6c]'
                        : 'border-stone-300 bg-white group-hover:border-[#7b6a6c]'
                    }`}
                  >
                    {agreed && (
                      <motion.svg
                        initial={{ pathLength: 0 }}
                        animate={{ pathLength: 1 }}
                        transition={{ duration: 0.2 }}
                        viewBox="0 0 12 10"
                        fill="none"
                        className="w-3 h-3"
                      >
                        <motion.path
                          d="M1 5l3.5 3.5L11 1"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                        />
                      </motion.svg>
                    )}
                  </div>
                  <span className="text-sm text-stone-600 leading-relaxed">
                    I have read and agree to{' '}
                    <span className="font-semibold text-[#7b6a6c]">AJ's Café</span>'s Terms &amp;
                    User Agreement, including the{' '}
                    <span className="font-semibold text-red-600">1-hour pending order cancellation policy</span>.
                  </span>
                </label>

                {/* Accept button */}
                <motion.button
                  onClick={canAccept ? onAccept : undefined}
                  disabled={!canAccept}
                  whileTap={canAccept ? { scale: 0.97 } : {}}
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                    canAccept
                      ? 'bg-[#7b6a6c] hover:bg-[#6a5a5c] text-white shadow-lg shadow-[#7b6a6c]/25 cursor-pointer'
                      : 'bg-stone-200 text-stone-400 cursor-not-allowed'
                  }`}
                >
                  {canAccept ? (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      I Agree — Enter AJ's Café
                    </>
                  ) : !hasScrolled ? (
                    'Read the full agreement to continue'
                  ) : (
                    'Please check the box above'
                  )}
                </motion.button>

                <p className="text-center text-[11px] text-stone-400">
                  By clicking "I Agree", you accept all terms outlined above.
                </p>
              </div>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
