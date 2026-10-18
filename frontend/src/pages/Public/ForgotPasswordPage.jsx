import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowRight, CheckCircle2, Lock } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';
import API from '../../services/api';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const { showToast } = useNotifications();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await API.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setSent(true);
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message || 'Something went wrong. Please try again.');
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30 mb-1">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">Reset Password</h2>
          <p className="text-xs text-slate-400">
            Enter your registered email address to receive password reset instructions.
          </p>
        </div>

        {sent ? (
        <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Check your inbox!</p>
            <p className="text-xs text-slate-300">
              A password reset code has been sent to <span className="font-bold text-white">{email}</span>.
            </p>
            <p className="text-[11px] text-slate-500">
              Check your inbox (and spam folder). The reset code expires in <strong className="text-slate-400">15 minutes</strong>.
            </p>
            <div className="pt-2">
              <Link to="/reset-password" className="gradient-btn inline-block px-6 py-2.5 rounded-xl text-xs font-bold">
                Proceed to Reset Password
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Registered Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white focus:border-brand-500 outline-none"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="gradient-btn w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2"
            >
              {loading ? 'Sending...' : 'Send Reset Link'} <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-slate-800 text-center text-xs">
          <Link to="/login" className="text-brand-400 hover:underline font-semibold">
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
