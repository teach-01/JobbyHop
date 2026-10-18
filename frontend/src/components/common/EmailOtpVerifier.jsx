import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ShieldCheck, RefreshCw, Mail, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import API from '../../services/api';

/**
 * EmailOtpVerifier
 *
 * Props:
 *   email        {string}   – email to send OTP to
 *   onVerified   {fn}       – called when OTP verified successfully
 *   onBack       {fn}       – called when user wants to go back to edit email
 */
const RESEND_COOLDOWN_SECS = 60;

export default function EmailOtpVerifier({ email, onVerified, onBack }) {
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [sendStatus, setSendStatus] = useState('sent'); // It was already sent by parent
  const [verifyStatus, setVerifyStatus] = useState('idle'); // idle | verifying | verified | error
  const [sendError, setSendError] = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECS);
  const inputRefs = useRef([]);
  const timerRef = useRef(null);
  const isSendingRef = useRef(false);

  // ── Component Mount ────────────────────────────────────────────────────────
  useEffect(() => {
    startCooldown();
    // focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 100);
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCooldown = useCallback((seconds = RESEND_COOLDOWN_SECS) => {
    setCooldown(seconds);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, []);

  const handleSendOtp = async () => {
    if (isSendingRef.current) return;
    isSendingRef.current = true;
    setSendStatus('sending');
    setSendError('');
    setVerifyError('');
    setOtp(['', '', '', '', '', '']);
    try {
      await API.post('/auth/send-email-otp', { email });
      setSendStatus('sent');
      startCooldown();
      // focus first input
      setTimeout(() => inputRefs.current[0]?.focus(), 100);
    } catch (err) {
      setSendStatus('error');
      const msg = typeof err === 'string' ? err : 'Failed to send verification code.';
      setSendError(msg);
      // If server says wait X seconds, parse it
      const match = msg.match(/(\d+)\s*second/);
      if (match) startCooldown(parseInt(match[1], 10));
    } finally {
      isSendingRef.current = false;
    }
  };

  // ── OTP digit input handlers ──────────────────────────────────────────────
  const handleDigitChange = (index, value) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);
    setVerifyError('');
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputRefs.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const paste = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!paste) return;
    const next = [...otp];
    paste.split('').forEach((ch, i) => { next[i] = ch; });
    setOtp(next);
    inputRefs.current[Math.min(paste.length, 5)]?.focus();
  };

  // ── Submit OTP ────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      setVerifyError('Please enter all 6 digits.');
      return;
    }
    setVerifyStatus('verifying');
    setVerifyError('');
    try {
      await API.post('/auth/verify-email-otp', { email, otp: code });
      setVerifyStatus('verified');
      setTimeout(() => onVerified(), 600);
    } catch (err) {
      setVerifyStatus('error');
      setVerifyError(typeof err === 'string' ? err : 'Incorrect or expired code.');
    }
  };

  // ── Computed state ────────────────────────────────────────────────────────
  const isVerified = verifyStatus === 'verified';
  const isVerifying = verifyStatus === 'verifying';
  const isSending = sendStatus === 'sending';
  const allDigits = otp.every((d) => d !== '');

  return (
    <div className="space-y-6 text-xs">
      {/* Header */}
      <div className="text-center space-y-2">
        <div
          className={`inline-flex p-3 rounded-2xl shadow-lg mb-2 transition-colors duration-300 ${
            isVerified ? 'bg-emerald-600' : 'bg-indigo-600'
          } text-white`}
        >
          {isVerified ? (
            <CheckCircle2 className="w-6 h-6" />
          ) : (
            <ShieldCheck className="w-6 h-6" />
          )}
        </div>
        <h3 className="text-lg font-extrabold text-white">Verify Your Email</h3>
        <p className="text-slate-400 text-xs">
          We sent a 6-digit code to{' '}
          <span className="text-brand-400 font-semibold break-all">{email}</span>
        </p>
      </div>

      {/* Send status messages */}
      {sendStatus === 'sent' && !isSending && (
        <div className="flex items-center gap-2 bg-indigo-950/60 border border-indigo-700 rounded-xl px-3 py-2 text-indigo-300">
          <Mail className="w-4 h-4 shrink-0" />
          <span>Code sent! Check your inbox (and spam folder).</span>
        </div>
      )}
      {sendError && (
        <div className="flex items-center gap-2 bg-red-950/60 border border-red-700 rounded-xl px-3 py-2 text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{sendError}</span>
        </div>
      )}

      {/* OTP digit inputs */}
      <div className="flex justify-center gap-2">
        {otp.map((digit, i) => (
          <input
            key={i}
            ref={(el) => (inputRefs.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigitChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={i === 0 ? handlePaste : undefined}
            disabled={isVerified || isVerifying}
            className={`w-10 h-12 text-center text-lg font-bold rounded-xl border transition-all duration-150
              bg-slate-950 text-white
              ${digit ? 'border-indigo-500' : 'border-slate-700'}
              ${isVerified ? 'border-emerald-500 text-emerald-400' : ''}
              focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500
              disabled:opacity-60 disabled:cursor-not-allowed
            `}
            aria-label={`OTP digit ${i + 1}`}
          />
        ))}
      </div>

      {/* Verify error */}
      {verifyError && (
        <div className="flex items-center gap-2 bg-red-950/60 border border-red-700 rounded-xl px-3 py-2 text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{verifyError}</span>
        </div>
      )}

      {/* Verified success banner */}
      {isVerified && (
        <div className="flex items-center gap-2 bg-emerald-950/60 border border-emerald-600 rounded-xl px-3 py-2 text-emerald-300">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="font-semibold">Email verified! Completing registration…</span>
        </div>
      )}

      {/* Action buttons */}
      {!isVerified && (
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleVerify}
            disabled={!allDigits || isVerifying || isSending}
            className="gradient-btn w-full py-2.5 rounded-xl font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isVerifying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Verifying…
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" /> Verify Code
              </>
            )}
          </button>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onBack}
              disabled={isVerifying || isSending}
              className="text-slate-400 hover:text-slate-200 transition-colors py-1.5 disabled:opacity-40"
            >
              ← Change email
            </button>

            <button
              type="button"
              onClick={handleSendOtp}
              disabled={cooldown > 0 || isSending || isVerifying}
              className="flex items-center gap-1.5 text-indigo-400 hover:text-indigo-200 transition-colors py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              {cooldown > 0 ? `Resend in ${cooldown}s` : isSending ? 'Sending…' : 'Resend Code'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
