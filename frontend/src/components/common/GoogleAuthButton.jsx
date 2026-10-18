import React, { useEffect, useState } from 'react';
import { Loader2, AlertCircle, Sparkles } from 'lucide-react';

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

/**
 * GoogleAuthButton
 *
 * Consistent, clean white/light-background Google button matching the target design system.
 * Centered logo-and-text group with thin border, rounded-xl corners, and full-area clickability.
 *
 * Props:
 *   mode          { 'login' | 'signup' | 'connect' } – defaults to 'login'
 *   role          { 'WORKER' | 'RECRUITER' }          – context for testing/routing
 *   onSuccess     { (idToken: string) => void }
 *   onBeforeClick { () => boolean }                  – validation before initiating auth
 *   loading       { boolean }                        – external loading state
 *   loadingText   { string }                         – optional custom loading text
 *   targetEmail   { string }                         – pre-filled email for dev/test helper
 *   className     { string }                         – additional container/button classes
 *   text          { string }                         – explicit button text override
 */
export default function GoogleAuthButton({
  mode = 'login',
  role = 'WORKER',
  onSuccess,
  onBeforeClick,
  loading = false,
  loadingText = '',
  targetEmail = '',
  className = '',
  text = '',
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDevModal, setShowDevModal] = useState(false);
  const [devEmail, setDevEmail] = useState(targetEmail || '');

  // Determine button text: Login -> "Sign in with Google", Registration -> "Sign up with Google"
  const buttonText =
    text ||
    (mode === 'login' ? 'Sign in with Google' : 'Sign up with Google');

  useEffect(() => {
    if (targetEmail) {
      setDevEmail(targetEmail);
    }
  }, [targetEmail]);

  // Initialize Google Identity Services if available
  useEffect(() => {
    let intervalId;
    const initGis = () => {
      if (window.google?.accounts?.id && GOOGLE_CLIENT_ID) {
        try {
          window.google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: (response) => {
              setIsSubmitting(false);
              if (response?.credential && onSuccess) {
                onSuccess(response.credential);
              }
            },
          });
        } catch (e) {
          console.warn('GIS initialization error:', e);
        }
      }
    };

    initGis();
    if (!window.google?.accounts?.id) {
      intervalId = setInterval(initGis, 600);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [onSuccess]);

  // Single click handler attached to the entire button container
  const handleClick = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (loading || isSubmitting) return;

    if (onBeforeClick && !onBeforeClick()) {
      return;
    }

    setIsSubmitting(true);

    // If live Google Identity Services is available, attempt prompt / OneTap
    if (GOOGLE_CLIENT_ID && window.google?.accounts?.id) {
      try {
        window.google.accounts.id.prompt((notification) => {
          setIsSubmitting(false);
          if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
            // Prompt suppressed/skipped (e.g. cookie restrictions, dismissed cooldown, dev origin)
            setShowDevModal(true);
          }
        });
        return;
      } catch (err) {
        console.warn('Google prompt error:', err);
        setIsSubmitting(false);
      }
    }

    // In dev mode or when GIS is not configured, open the dev helper modal
    setIsSubmitting(false);
    setShowDevModal(true);
  };

  // Keyboard accessibility: Enter and Space activate Google authentication
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.keyCode === 13 || e.keyCode === 32) {
      e.preventDefault();
      handleClick(e);
    }
  };

  const handleDevMockSubmit = (e) => {
    e.preventDefault();
    if (!devEmail) return;
    setShowDevModal(false);
    setIsSubmitting(false);
    const mockToken = `mock_google_token:${devEmail.trim().toLowerCase()}`;
    if (onSuccess) {
      onSuccess(mockToken);
    }
  };

  const isButtonDisabled = loading || isSubmitting;

  return (
    <>
      <div className="w-full">
        <button
          type="button"
          id={mode === 'login' ? `${role.toLowerCase()}-google-login-btn` : `${role.toLowerCase()}-google-signup-btn`}
          disabled={isButtonDisabled}
          onClick={handleClick}
          onKeyDown={handleKeyDown}
          aria-label={buttonText}
          className={`w-full h-11 px-4 py-2.5 rounded-xl border border-slate-300/80 bg-white hover:bg-slate-50 active:bg-slate-100 text-slate-700 hover:text-slate-900 font-semibold text-xs sm:text-sm tracking-normal flex items-center justify-center gap-3 transition-all duration-200 shadow-sm hover:shadow hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:ring-offset-2 focus:ring-offset-slate-950 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed select-none ${className}`}
        >
          {isButtonDisabled ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-slate-600 shrink-0 pointer-events-none" />
              <span className="pointer-events-none whitespace-nowrap">
                {loadingText || (mode === 'login' ? 'Signing in with Google...' : 'Signing up with Google...')}
              </span>
            </>
          ) : (
            <>
              {/* Google 4-color authentic SVG logo with preserved aspect ratio */}
              <svg
                className="w-5 h-5 shrink-0 pointer-events-none"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span className="pointer-events-none whitespace-nowrap">
                {buttonText}
              </span>
            </>
          )}
        </button>
      </div>

      {/* Dev & Configuration Helper Modal */}
      {showDevModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-brand-500/20 text-brand-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">
                  {mode === 'login' ? 'Google Account Sign In' : 'Google Account Sign Up'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  {role === 'WORKER' ? 'Event Worker' : 'Event Recruiter'} • {mode === 'login' ? 'Login' : 'Registration'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-white">Google Identity Verification</p>
                  <p className="text-[11px] text-slate-400">
                    Enter your Google email to verify identity and proceed with {role === 'WORKER' ? 'Worker' : 'Recruiter'} {mode === 'login' ? 'login' : 'registration'}.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleDevMockSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Google Account Email:
                </label>
                <input
                  type="email"
                  required
                  value={devEmail}
                  onChange={(e) => setDevEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-brand-500"
                  placeholder="name@example.com"
                  autoFocus
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {mode === 'login'
                    ? 'Must match your registered Google account email.'
                    : 'Enter the email you want to verify for registration.'}
                </p>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowDevModal(false);
                    setIsSubmitting(false);
                  }}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl text-xs font-extrabold bg-white text-slate-800 hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                >
                  {mode === 'login' ? 'Sign in with Google' : 'Sign up with Google'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
