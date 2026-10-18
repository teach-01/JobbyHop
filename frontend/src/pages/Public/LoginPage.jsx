import React, { useState } from 'react';
import { useNavigate, Link, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Sparkles, Lock, Mail, ArrowRight, Shield, Briefcase, UserCheck, Eye, EyeOff } from 'lucide-react';
import GoogleAuthButton from '../../components/common/GoogleAuthButton';

export const LoginPage = ({ type }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [googleHandoffData, setGoogleHandoffData] = useState({ googleEmail: '', registrationToken: '' });
  const { login, googleLogin } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // Securely derive expected role from component prop or actual URL path
  const resolvedType = type || (
    location.pathname.startsWith('/login/recruiter') || location.pathname.startsWith('/recruiter/login')
      ? 'recruiter'
      : (location.pathname.startsWith('/login/worker') || location.pathname.startsWith('/worker/login')
        ? 'worker'
        : null)
  );
  const expectedRole = resolvedType === 'recruiter' ? 'RECRUITER' : resolvedType === 'worker' ? 'WORKER' : undefined;

  const handleGoogleLogin = async (idToken) => {
    setGoogleLoading(true);
    try {
      const res = await googleLogin(idToken, expectedRole);

      // If new Google user without an existing account, navigate directly to role-specific registration
      if (res && res.isNewUser) {
        if (expectedRole === 'WORKER') {
          navigate('/register/worker', {
            state: {
              googleEmail: res.googleEmail,
              registrationToken: res.registrationToken,
            },
          });
          return;
        }

        if (expectedRole === 'RECRUITER') {
          navigate('/register/recruiter', {
            state: {
              googleEmail: res.googleEmail,
              registrationToken: res.registrationToken,
            },
          });
          return;
        }

        // Fallback only if on generic non-role login
        setGoogleHandoffData({
          googleEmail: res.googleEmail,
          registrationToken: res.registrationToken,
        });
        setShowRoleModal(true);
        return;
      }

      showToast('Logged in successfully via Google!', 'success');
      if (res.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (res.user.role === 'RECRUITER') {
        navigate('/recruiter/dashboard');
      } else if (res.user.role === 'OPERATIONS') {
        navigate('/operations/dashboard');
      } else {
        navigate('/worker/dashboard');
      }
    } catch (err) {
      showToast(err.message || err || 'Google login failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await login(email, password, expectedRole);
      if (res.requirePasswordChange) {
        showToast('Password change required by Admin.', 'warning');
        navigate(`/force-password-change?token=${res.token}`);
        return;
      }
      
      showToast('Logged in successfully!', 'success');
      if (res.user.role === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (res.user.role === 'RECRUITER') {
        navigate('/recruiter/dashboard');
      } else if (res.user.role === 'OPERATIONS') {
        navigate('/operations/dashboard');
      } else {
        navigate('/worker/dashboard');
      }
    } catch (err) {
      showToast(err.message || err || 'Invalid email or password', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md space-y-8 glass-card p-8 rounded-3xl border border-slate-800 relative">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30 mb-2">
            <Sparkles className="w-6 h-6 fill-current" />
          </div>
          <h2 className="text-2xl font-extrabold text-white">
            {resolvedType === 'recruiter' ? 'Recruiter Login' : resolvedType === 'worker' ? 'Worker Login' : 'Welcome Back to JobbyHop'}
          </h2>
          <p className="text-xs text-slate-400">
            {resolvedType === 'recruiter' ? 'Login to manage your events and staff.' : resolvedType === 'worker' ? 'Login to find and manage your event jobs.' : 'Unified login for Recruiters and Workers.'}
          </p>
        </div>

        {searchParams.get('session_expired') && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-center">
            Your session has expired. Please log in again.
          </div>
        )}



        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-xs text-white focus:border-brand-500 outline-none"
                placeholder="you@example.com"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <Link to="/forgot-password" className="text-[11px] text-brand-400 hover:underline">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-10 py-2.5 text-xs text-white focus:border-brand-500 outline-none"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="gradient-btn w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2"
          >
            {loading ? 'Authenticating...' : 'Sign In with Password'} <ArrowRight className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-800" />
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">OR</span>
            <div className="flex-1 h-px bg-slate-800" />
          </div>

          <GoogleAuthButton
            mode="login"
            role={expectedRole || (resolvedType === 'recruiter' ? 'RECRUITER' : 'WORKER')}
            loading={googleLoading}
            onSuccess={handleGoogleLogin}
          />
        </form>

        <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400 space-y-1">
          <p>Don't have an account yet?</p>
          <div className="flex items-center justify-center gap-4 font-bold">
            <Link to="/register/worker" className="text-brand-400 hover:underline">
              Worker Sign Up
            </Link>
            <span>•</span>
            <Link to="/register/recruiter" className="text-purple-400 hover:underline">
              Recruiter Sign Up
            </Link>
          </div>
        </div>
      </div>

      {/* ── New Google User Role Selection Modal ────────────────────── */}
      {showRoleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl relative">
            <div className="text-center space-y-2">
              <div className="inline-flex p-3 rounded-2xl bg-indigo-600/20 text-indigo-400 mb-1">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-extrabold text-white">Welcome to JobbyHop!</h3>
              <p className="text-xs text-slate-400">
                Verified Google identity for{' '}
                <span className="text-indigo-400 font-semibold">{googleHandoffData.googleEmail}</span>.
              </p>
              <p className="text-xs text-slate-400">
                Please select your account type to proceed to registration:
              </p>
            </div>

            <div className="space-y-3">
              {/* Option 1: Worker */}
              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  navigate('/register/worker', {
                    state: {
                      googleEmail: googleHandoffData.googleEmail,
                      registrationToken: googleHandoffData.registrationToken,
                    },
                  });
                }}
                className="w-full p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 hover:bg-emerald-950/40 hover:border-emerald-500/60 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-xl bg-emerald-600 text-white mt-0.5 shadow-md">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-emerald-300">
                      Register as Event Worker
                    </span>
                    <ArrowRight className="w-4 h-4 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Work high-energy luxury summits, weddings, and concerts with guaranteed 10–15 day pay.
                  </p>
                </div>
              </button>

              {/* Option 2: Recruiter */}
              <button
                type="button"
                onClick={() => {
                  setShowRoleModal(false);
                  navigate('/register/recruiter', {
                    state: {
                      googleEmail: googleHandoffData.googleEmail,
                      registrationToken: googleHandoffData.registrationToken,
                    },
                  });
                }}
                className="w-full p-4 rounded-2xl border border-purple-500/30 bg-purple-950/20 hover:bg-purple-950/40 hover:border-purple-500/60 transition-all text-left flex items-start gap-3 group"
              >
                <div className="p-2.5 rounded-xl bg-purple-600 text-white mt-0.5 shadow-md">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white group-hover:text-purple-300">
                      Register as Event Recruiter
                    </span>
                    <ArrowRight className="w-4 h-4 text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Post event staffing requirements, review candidate rosters, and manage event operations.
                  </p>
                </div>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setShowRoleModal(false)}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors"
            >
              Cancel & Return
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginPage;
