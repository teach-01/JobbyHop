import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import API from '../../services/api';
import ImageUploader from '../../components/common/ImageUploader';
import EmailOtpVerifier from '../../components/common/EmailOtpVerifier';
import GoogleAuthButton from '../../components/common/GoogleAuthButton';
import { UserCheck, ArrowRight, Eye, EyeOff, Mail, Phone, MapPin, Calendar, Wrench, FileText, Lock, CheckCircle2 } from 'lucide-react';

export const RegisterWorkerPage = () => {
  const location = useLocation();
  const googleEmail = location.state?.googleEmail || '';
  const registrationToken = location.state?.registrationToken || '';

  const [formData, setFormData] = useState({
    fullName: '',
    profilePhoto: '',
    phone: '',
    location: '',
    dob: '',
    skills: '',
    bio: '', // Past Experience
    email: googleEmail || '',
    password: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (googleEmail) {
      setFormData((prev) => ({ ...prev, email: googleEmail }));
    }
  }, [googleEmail]);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // step: 'form' | 'otp'
  const [step, setStep] = useState('form');
  const isSubmittingRef = useRef(false);

  const { registerWorker, googleRegisterWorker } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();

  // Validate all manual fields
  const validateForm = () => {
    if (!formData.profilePhoto) {
      showToast('Worker profile photo is required!', 'error');
      return false;
    }

    const b64Part = formData.profilePhoto.includes(',')
      ? formData.profilePhoto.split(',')[1]
      : formData.profilePhoto;
    const decodedBytes = Math.floor((b64Part.length * 3) / 4);
    if (decodedBytes > 1_000_000) {
      showToast('Profile photo must be 1 MB or smaller.', 'error');
      return false;
    }

    if (!formData.fullName.trim()) {
      showToast('Full Name is required.', 'error');
      return false;
    }
    if (!formData.phone.trim()) {
      showToast('Mobile Number is required.', 'error');
      return false;
    }
    if (!formData.location.trim()) {
      showToast('Location is required.', 'error');
      return false;
    }
    if (!formData.dob) {
      showToast('Date of Birth is required.', 'error');
      return false;
    }
    const effectiveEmail = (googleEmail || formData.email).trim();
    if (!effectiveEmail || !effectiveEmail.includes('@')) {
      showToast('Valid Email Address is required.', 'error');
      return false;
    }

    if (!formData.password || formData.password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      showToast('Passwords do not match.', 'error');
      return false;
    }

    return true;
  };

  // ── Step 1: Submit handler (Normal OTP flow OR Google handoff registration) ─
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (!validateForm()) return;

    // If registration was initiated via Google login handoff, skip OTP
    if (registrationToken) {
      await handleGoogleConnect(registrationToken);
      return;
    }

    // Normal registration path -> send Email OTP
    isSubmittingRef.current = true;
    setLoading(true);
    try {
      const emailToSend = (googleEmail || formData.email).trim().toLowerCase();
      await API.post('/auth/send-email-otp', { email: emailToSend });
      showToast('Verification code sent to your email.', 'info');
      setStep('otp');
    } catch (err) {
      showToast(err.message || err || 'Failed to send verification code', 'error');
    } finally {
      isSubmittingRef.current = false;
      setLoading(false);
    }
  };

  // ── Step 2: OTP verified – complete normal registration ──────────────────
  const handleOtpVerified = async () => {
    setLoading(true);
    try {
      await registerWorker({
        ...formData,
        email: (googleEmail || formData.email).trim().toLowerCase(),
      });
      showToast('Worker account created successfully!', 'success');
      navigate('/worker/dashboard');
    } catch (err) {
      showToast(err.message || err || 'Registration failed', 'error');
      setStep('form');
    } finally {
      setLoading(false);
    }
  };

  // ── Google Connect flow (skip OTP, verify email, create worker) ──────────
  const handleGoogleConnect = async (tokenOrId) => {
    if (!validateForm()) return;
    setGoogleLoading(true);
    try {
      await googleRegisterWorker(tokenOrId || registrationToken, {
        ...formData,
        email: (googleEmail || formData.email).trim().toLowerCase(),
      });
      showToast('Worker account created and Google connected successfully!', 'success');
      navigate('/worker/dashboard');
    } catch (err) {
      showToast(err.message || err || 'Google connection failed', 'error');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-10 px-4">
      <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-600 text-white shadow-lg mb-2">
            <UserCheck className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-extrabold text-white">Worker Registration</h1>
          <p className="text-xs text-slate-400">
            Join as an event worker for luxury summits, weddings, and concerts with guaranteed 10–15 day pay.
          </p>
        </div>

        {/* ── Verified Google Identity Notice ─────────────────────────────── */}
        {googleEmail && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 mt-0.5 shrink-0">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="flex-1 text-xs">
              <p className="font-bold text-white">Google Identity Verified</p>
              <p className="text-slate-300 mt-0.5">
                Google account verified for <span className="font-semibold text-emerald-400">{googleEmail}</span>.
                All Worker profile fields must be manually entered below. Email OTP will be skipped.
              </p>
            </div>
          </div>
        )}

        {/* ── Step indicator (for normal registration) ────────────────────── */}
        {!registrationToken && (
          <div className="flex items-center justify-center gap-2 text-xs">
            <div className={`flex items-center gap-1.5 ${step === 'form' ? 'text-emerald-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 'form' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>1</span>
              Worker Details
            </div>
            <div className="h-px w-6 bg-slate-700" />
            <div className={`flex items-center gap-1.5 ${step === 'otp' ? 'text-indigo-400 font-bold' : 'text-slate-500'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === 'otp' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</span>
              Verify Email
            </div>
          </div>
        )}

        {/* ── STEP 1: Registration form ─────────────────────────────────── */}
        {step === 'form' && (
          <form onSubmit={handleFormSubmit} className="space-y-4 text-xs">
            {/* 1. Profile Photo / Image */}
            <div>
              <ImageUploader
                label="Profile Photo / Image (JPG, PNG, WEBP - Max 1MB) *"
                required={true}
                value={formData.profilePhoto}
                onChange={(photo) => setFormData({ ...formData, profilePhoto: photo })}
                onError={(err) => showToast(err, 'error')}
              />
            </div>

            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 text-[11px] text-slate-400">
              <span className="text-amber-400 font-semibold">Important: </span>
              Full Legal Name, Date of Birth, Mobile Number, and Profile Photo will be verified and permanently locked after registration.
            </div>

            {/* 2. Full Name & 3. Mobile Number */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                  placeholder="e.g. Aarav Sharma"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <Phone className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Mobile Number *
                </label>
                <input
                  type="tel"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>

            {/* 4. Location & 5. Date of Birth */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <MapPin className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Location *
                </label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                  placeholder="e.g. Mumbai, Maharashtra"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <Calendar className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Date of Birth *
                </label>
                <input
                  type="date"
                  required
                  value={formData.dob}
                  onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            {/* 6. Skills */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                <Wrench className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                Skills (comma-separated)
              </label>
              <input
                type="text"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                placeholder="e.g. Guest Hospitality, VIP Usher, Stage Coordination, Crowd Control"
              />
            </div>

            {/* 7. Past Experience */}
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                <FileText className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                Past Experience
              </label>
              <textarea
                rows="2"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white outline-none focus:border-emerald-500"
                placeholder="Briefly describe your previous event roles or experience..."
              />
            </div>

            {/* 8. Email Address */}
            {!googleEmail && (
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <Mail className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white outline-none focus:border-emerald-500"
                  placeholder="worker@example.com"
                />
              </div>
            )}

            {/* 9. Password & 10. Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Password *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2.5 text-white outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  <Lock className="w-3.5 h-3.5 inline mr-1 text-slate-500" />
                  Confirm Password *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3 pr-9 py-2.5 text-white outline-none focus:border-emerald-500"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-3 text-slate-500 hover:text-slate-300"
                  >
                    {showConfirmPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Action Buttons: [ Register ] OR [ Connect with Google ] */}
            <div className="space-y-3 pt-2">
              <button
                type="submit"
                disabled={loading || googleLoading}
                className="gradient-btn w-full py-3 rounded-xl text-xs font-extrabold uppercase tracking-wider flex items-center justify-center gap-2"
              >
                {registrationToken
                  ? (googleLoading ? 'Creating Worker Account…' : 'Complete Registration (Skip Email OTP)')
                  : (loading ? 'Sending OTP…' : 'Register with Email OTP')
                }
                <ArrowRight className="w-4 h-4" />
              </button>

              {!registrationToken && (
                <>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-px bg-slate-800" />
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">OR</span>
                    <div className="flex-1 h-px bg-slate-800" />
                  </div>

                  <GoogleAuthButton
                    mode="signup"
                    role="WORKER"
                    loading={googleLoading}
                    targetEmail={formData.email}
                    onBeforeClick={validateForm}
                    onSuccess={handleGoogleConnect}
                  />
                </>
              )}
            </div>
          </form>
        )}

        {/* ── STEP 2: OTP verification ─────────────────────────────────── */}
        {step === 'otp' && (
          <EmailOtpVerifier
            email={formData.email.trim().toLowerCase()}
            onVerified={handleOtpVerified}
            onBack={() => setStep('form')}
          />
        )}

        <p className="text-center text-xs text-slate-400">
          Already registered?{' '}
          <Link to="/login/worker" className="text-emerald-400 font-bold hover:underline">
            Log in here
          </Link>
          <span className="mx-2">•</span>
          <Link to="/register/recruiter" className="text-purple-400 hover:underline">
            Register as Recruiter
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterWorkerPage;
