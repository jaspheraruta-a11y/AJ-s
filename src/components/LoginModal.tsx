import React, { useState, useMemo } from 'react';
import { X, Mail, Lock, Chrome, ArrowRight, Loader2, User, Phone, MapPin, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabase';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Password strength logic ───────────────────────────────────────────────────
type StrengthLevel = 'empty' | 'weak' | 'fair' | 'strong' | 'very-strong';

interface StrengthInfo {
  level: StrengthLevel;
  score: number;        // 0–4
  label: string;
  color: string;        // gradient CSS
  textColor: string;
  segments: number;     // filled segments out of 4
}

function getPasswordStrength(password: string): StrengthInfo {
  if (!password) {
    return { level: 'empty', score: 0, label: '', color: 'transparent', textColor: '', segments: 0 };
  }

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) {
    return { level: 'weak', score: 1, label: 'Weak', color: 'linear-gradient(90deg,#ef4444,#f97316)', textColor: '#ef4444', segments: 1 };
  } else if (score === 2) {
    return { level: 'fair', score: 2, label: 'Fair', color: 'linear-gradient(90deg,#f97316,#eab308)', textColor: '#f97316', segments: 2 };
  } else if (score === 3) {
    return { level: 'strong', score: 3, label: 'Strong', color: 'linear-gradient(90deg,#22c55e,#16a34a)', textColor: '#22c55e', segments: 3 };
  } else {
    return { level: 'very-strong', score: 4, label: 'Very Strong', color: 'linear-gradient(90deg,#06b6d4,#6366f1)', textColor: '#6366f1', segments: 4 };
  }
}

// ─── Reusable input wrapper ────────────────────────────────────────────────────
function InputField({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#a8a29e', marginLeft: '4px', display: 'block' }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <Icon
          style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#c4b5a5', pointerEvents: 'none', flexShrink: 0 }}
        />
        {children}
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [mode, setMode] = useState<'login' | 'signup' | 'magic-link'>('login');

  const strength = useMemo(() => getPasswordStrength(password), [password]);
  const passwordsMatch = confirmPassword === '' ? null : password === confirmPassword;

  // reset fields when switching modes
  const switchMode = (next: 'login' | 'signup' | 'magic-link') => {
    setMode(next);
    setMessage(null);
    setPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('');
    setAddress('');
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Google login failed' });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      if (mode === 'magic-link') {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        setMessage({ type: 'success', text: 'Check your email for the magic link!' });
      } else if (mode === 'signup') {
        if (password !== confirmPassword) {
          setMessage({ type: 'error', text: 'Passwords do not match.' });
          setLoading(false);
          return;
        }
        if (strength.score < 2) {
          setMessage({ type: 'error', text: 'Please choose a stronger password.' });
          setLoading(false);
          return;
        }

        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;

        // Insert profile row with all additional fields
        if (data.user) {
          await supabase.from('profiles').upsert({
            id: data.user.id,
            email,
            full_name: fullName.trim() || null,
            phone: phone.trim() || null,
            address: address.trim() || null,
            role: 'client',
          });
        }

        setMessage({ type: 'success', text: 'Account created! Please check your email for verification.' });
        switchMode('login');
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Authentication failed' });
    } finally {
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    paddingLeft: '2.75rem',
    paddingRight: '2.75rem',
    paddingTop: '0.75rem',
    paddingBottom: '0.75rem',
    background: '#fafaf9',
    border: '1.5px solid #e7e5e4',
    borderRadius: '14px',
    fontSize: '0.9rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    color: '#292524',
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{ position: 'absolute', inset: 0, background: 'rgba(41,37,36,0.45)', backdropFilter: 'blur(6px)' }}
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 24 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            style={{
              position: 'relative',
              background: '#fff',
              borderRadius: '28px',
              width: '100%',
              maxWidth: '440px',
              overflowY: 'auto',
              maxHeight: '92vh',
              boxShadow: '0 32px 80px rgba(0,0,0,0.18)',
            }}
          >
            <div style={{ padding: '2rem' }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
                <div>
                  <AnimatePresence mode="wait">
                    <motion.h2
                      key={mode}
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.18 }}
                      style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7b6a6c', fontFamily: 'Georgia, serif', marginBottom: '0.25rem' }}
                    >
                      {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Create Account' : 'Magic Link'}
                    </motion.h2>
                  </AnimatePresence>
                  <p style={{ fontSize: '0.85rem', color: '#a8a29e' }}>
                    {mode === 'login'
                      ? "Log in to your AJ's Café account"
                      : mode === 'signup'
                      ? 'Join our coffee community'
                      : 'Sign in without a password'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  style={{ padding: '0.4rem', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: '#a8a29e', transition: 'background 0.2s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f5f5f4')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <X style={{ width: '1.25rem', height: '1.25rem' }} />
                </button>
              </div>

              {/* Message banner */}
              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    style={{
                      padding: '0.75rem 1rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: message.type === 'success' ? '#f0fdf4' : '#fef2f2',
                      color: message.type === 'success' ? '#166534' : '#991b1b',
                      overflow: 'hidden',
                    }}
                  >
                    {message.text}
                  </motion.div>
                )}
              </AnimatePresence>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {/* Google */}
                <button
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: '#fff', border: '1.5px solid #e7e5e4',
                    borderRadius: '14px', cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                    fontWeight: 600, fontSize: '0.9rem', color: '#44403c',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = '#a8a29e'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                  <Chrome style={{ width: '1.1rem', height: '1.1rem', color: '#ea4335' }} />
                  Continue with Google
                </button>

                {/* Divider */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <div style={{ flex: 1, height: '1px', background: '#f5f5f4' }} />
                  <span style={{ padding: '0 0.75rem', fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#d6d3d1' }}>
                    or use email
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#f5f5f4' }} />
                </div>

                {/* Form */}
                <form onSubmit={handleEmailAuth} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                  {/* ── SIGNUP ONLY: Full Name ── */}
                  <AnimatePresence>
                    {mode === 'signup' && (
                      <motion.div
                        key="full-name"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <InputField icon={User} label="Full Name">
                          <input
                            type="text"
                            required
                            value={fullName}
                            onChange={e => setFullName(e.target.value)}
                            placeholder="Juan dela Cruz"
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#7b6a6c'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                          />
                        </InputField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Email */}
                  <InputField icon={Mail} label="Email Address">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      style={inputStyle}
                      onFocus={e => { e.currentTarget.style.borderColor = '#7b6a6c'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                      onBlur={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                    />
                  </InputField>

                  {/* ── SIGNUP ONLY: Phone ── */}
                  <AnimatePresence>
                    {mode === 'signup' && (
                      <motion.div
                        key="phone"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <InputField icon={Phone} label="Phone Number">
                          <input
                            type="tel"
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="+63 912 345 6789"
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#7b6a6c'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                          />
                        </InputField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* ── SIGNUP ONLY: Address ── */}
                  <AnimatePresence>
                    {mode === 'signup' && (
                      <motion.div
                        key="address"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <InputField icon={MapPin} label="Delivery Address">
                          <input
                            type="text"
                            value={address}
                            onChange={e => setAddress(e.target.value)}
                            placeholder="123 Brgy. Sample, City"
                            style={inputStyle}
                            onFocus={e => { e.currentTarget.style.borderColor = '#7b6a6c'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                            onBlur={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                          />
                        </InputField>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Password */}
                  {mode !== 'magic-link' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <InputField icon={Lock} label="Password">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          placeholder="••••••••"
                          style={inputStyle}
                          onFocus={e => { e.currentTarget.style.borderColor = '#7b6a6c'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                          onBlur={e => { e.currentTarget.style.borderColor = '#e7e5e4'; e.currentTarget.style.boxShadow = 'none'; }}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(v => !v)}
                          style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: 0 }}
                        >
                          {showPassword ? <EyeOff style={{ width: '1rem', height: '1rem' }} /> : <Eye style={{ width: '1rem', height: '1rem' }} />}
                        </button>
                      </InputField>

                      {/* Password strength meter – only shown in signup */}
                      <AnimatePresence>
                        {mode === 'signup' && password.length > 0 && (
                          <motion.div
                            key="strength-meter"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            style={{ overflow: 'hidden' }}
                          >
                            {/* Segment bar */}
                            <div style={{ display: 'flex', gap: '4px', marginTop: '2px' }}>
                              {[1, 2, 3, 4].map(seg => (
                                <motion.div
                                  key={seg}
                                  animate={{
                                    background: seg <= strength.segments ? strength.color : '#e7e5e4',
                                    scaleY: seg <= strength.segments ? 1 : 0.6,
                                  }}
                                  transition={{ duration: 0.3, ease: 'easeOut' }}
                                  style={{
                                    flex: 1, height: '5px', borderRadius: '99px',
                                    transformOrigin: 'left center',
                                  }}
                                />
                              ))}
                            </div>

                            {/* Label row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px' }}>
                              <ShieldCheck style={{ width: '0.8rem', height: '0.8rem', color: strength.textColor, flexShrink: 0 }} />
                              <motion.span
                                key={strength.label}
                                initial={{ opacity: 0, x: -6 }}
                                animate={{ opacity: 1, x: 0 }}
                                style={{ fontSize: '0.72rem', fontWeight: 700, color: strength.textColor, letterSpacing: '0.04em' }}
                              >
                                {strength.label}
                              </motion.span>
                              <span style={{ fontSize: '0.7rem', color: '#a8a29e' }}>
                                {strength.level === 'weak' && '— add uppercase, numbers & symbols'}
                                {strength.level === 'fair' && '— keep going, add more variety'}
                                {strength.level === 'strong' && '— great! add symbols to max it out'}
                                {strength.level === 'very-strong' && '— excellent password!'}
                              </span>
                            </div>

                            {/* Animated strength pill badge */}
                            <motion.div
                              key={strength.level}
                              initial={{ scale: 0.8, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              transition={{ type: 'spring', damping: 14, stiffness: 260 }}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: '4px',
                                marginTop: '5px', padding: '2px 10px',
                                borderRadius: '99px', fontSize: '0.68rem', fontWeight: 700,
                                letterSpacing: '0.07em', textTransform: 'uppercase',
                                background: strength.color, color: '#fff',
                              }}
                            >
                              {strength.label}
                            </motion.div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* ── SIGNUP ONLY: Confirm password ── */}
                  <AnimatePresence>
                    {mode === 'signup' && (
                      <motion.div
                        key="confirm-pw"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{ overflow: 'hidden' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <InputField icon={Lock} label="Confirm Password">
                            <input
                              type={showConfirmPassword ? 'text' : 'password'}
                              required
                              value={confirmPassword}
                              onChange={e => setConfirmPassword(e.target.value)}
                              placeholder="••••••••"
                              style={{
                                ...inputStyle,
                                borderColor: confirmPassword
                                  ? passwordsMatch
                                    ? '#22c55e'
                                    : '#ef4444'
                                  : '#e7e5e4',
                              }}
                              onFocus={e => { e.currentTarget.style.boxShadow = '0 0 0 3px rgba(123,106,108,0.12)'; }}
                              onBlur={e => { e.currentTarget.style.boxShadow = 'none'; }}
                            />
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword(v => !v)}
                              style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#a8a29e', padding: 0 }}
                            >
                              {showConfirmPassword ? <EyeOff style={{ width: '1rem', height: '1rem' }} /> : <Eye style={{ width: '1rem', height: '1rem' }} />}
                            </button>
                          </InputField>

                          {/* Match feedback */}
                          <AnimatePresence>
                            {confirmPassword.length > 0 && (
                              <motion.div
                                initial={{ opacity: 0, y: -4 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -4 }}
                                style={{
                                  fontSize: '0.75rem', fontWeight: 600,
                                  color: passwordsMatch ? '#16a34a' : '#dc2626',
                                  display: 'flex', alignItems: 'center', gap: '4px',
                                  paddingLeft: '2px',
                                }}
                              >
                                <motion.span
                                  key={passwordsMatch ? 'match' : 'no-match'}
                                  initial={{ scale: 0.7, rotate: -10 }}
                                  animate={{ scale: 1, rotate: 0 }}
                                  transition={{ type: 'spring', damping: 12, stiffness: 300 }}
                                >
                                  {passwordsMatch ? '✓' : '✗'}
                                </motion.span>
                                {passwordsMatch ? 'Passwords match' : 'Passwords do not match'}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: '100%', padding: '0.875rem 1rem',
                      background: 'linear-gradient(135deg,#7b6a6c,#9d7e80)',
                      color: '#fff', border: 'none', borderRadius: '14px',
                      fontWeight: 700, fontSize: '0.95rem', cursor: loading ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                      boxShadow: '0 4px 16px rgba(123,106,108,0.28)',
                      opacity: loading ? 0.65 : 1,
                      transition: 'opacity 0.2s, transform 0.15s',
                      marginTop: '0.25rem',
                    }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = 'translateY(-1px)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    {loading ? (
                      <Loader2 style={{ width: '1.125rem', height: '1.125rem', animation: 'spin 1s linear infinite' }} />
                    ) : (
                      <>
                        {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Magic Link'}
                        <ArrowRight style={{ width: '1.125rem', height: '1.125rem' }} />
                      </>
                    )}
                  </button>
                </form>

                {/* Mode switcher */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', paddingTop: '0.25rem' }}>
                  {mode === 'login' ? (
                    <>
                      <button onClick={() => switchMode('signup')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#78716c' }}>
                        Don't have an account?{' '}
                        <span style={{ fontWeight: 700, color: '#7b6a6c' }}>Sign up</span>
                      </button>
                      <button onClick={() => switchMode('magic-link')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#78716c' }}>
                        Forgot password?{' '}
                        <span style={{ fontWeight: 700, color: '#7b6a6c' }}>Use Magic Link</span>
                      </button>
                    </>
                  ) : (
                    <button onClick={() => switchMode('login')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: '#78716c' }}>
                      Already have an account?{' '}
                      <span style={{ fontWeight: 700, color: '#7b6a6c' }}>Log in</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
