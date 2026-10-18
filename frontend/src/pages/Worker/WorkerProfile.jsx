import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import userService from '../../services/userService';
import ImageUploader from '../../components/common/ImageUploader';
import Modal from '../../components/common/Modal';
import { Save, Star, Lock, ShieldCheck, Info, Trash2, AlertTriangle } from 'lucide-react';

export const WorkerProfile = () => {
  const { user, updateUserProfile, logout } = useAuth();
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Helper to safely format Date of Birth to YYYY-MM-DD
  const formatDob = (dobValue) => {
    if (!dobValue) return '';
    try {
      const d = new Date(dobValue);
      if (isNaN(d.getTime())) return '';
      return d.toISOString().split('T')[0];
    } catch {
      return '';
    }
  };

  const currentProfile = user?.profile || {};
  const currentDob = formatDob(currentProfile.dob || currentProfile.dateOfBirth);

  const [formData, setFormData] = useState({
    fullName: currentProfile.fullName || '',
    profilePhoto: currentProfile.profilePhoto || '',
    location: currentProfile.location || '',
    dateOfBirth: currentDob,
    phone: currentProfile.phone || user?.phone || '',
    email: currentProfile.email || user?.email || '',
    experience: currentProfile.experience || '',
    previousEventExperience: currentProfile.previousEventExperience || '',
    preferredEventTypes: Array.isArray(currentProfile.preferredEventTypes)
      ? currentProfile.preferredEventTypes.join(', ')
      : Array.isArray(currentProfile.availability?.preferredEventTypes)
      ? currentProfile.availability.preferredEventTypes.join(', ')
      : '',
    bio: currentProfile.bio || '',
  });

  // Keep state in sync if auth context user profile updates
  useEffect(() => {
    if (user?.profile) {
      const p = user.profile;
      const dobFormatted = formatDob(p.dob || p.dateOfBirth);
      setFormData((prev) => ({
        ...prev,
        fullName: p.fullName || prev.fullName,
        profilePhoto: p.profilePhoto || prev.profilePhoto,
        location: p.location || prev.location,
        dateOfBirth: dobFormatted || prev.dateOfBirth,
        phone: p.phone || user.phone || prev.phone,
        email: p.email || user.email || prev.email,
        bio: p.bio !== undefined ? p.bio : prev.bio,
        experience: p.experience !== undefined ? p.experience : prev.experience,
        preferredEventTypes: Array.isArray(p.preferredEventTypes)
          ? p.preferredEventTypes.join(', ')
          : Array.isArray(p.availability?.preferredEventTypes)
          ? p.availability.preferredEventTypes.join(', ')
          : prev.preferredEventTypes,
      }));
    }
  }, [user]);

  // STRICT IMMUTABILITY:
  // Once saved/verified, these fields are permanently locked on My Profile
  const isNameLocked = Boolean(currentProfile.fullName);
  const isDobLocked = Boolean(currentProfile.dob || currentProfile.dateOfBirth);
  const isPhoneLocked = Boolean(currentProfile.phone || user?.phone);
  const isPhotoLocked = Boolean(currentProfile.profilePhoto);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.profilePhoto && !currentProfile.profilePhoto) {
      showToast('Profile photo is required for worker verification!', 'error');
      return;
    }

    setLoading(true);
    const updatedData = {
      ...formData,
      // Ensure backend receives both alias names for compatibility
      dob: formData.dateOfBirth,
      preferredEventTypes: formData.preferredEventTypes
        ? formData.preferredEventTypes
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    };

    try {
      const res = await userService.updateWorkerProfile(user._id, updatedData);
      if (res && res.success) {
        updateUserProfile(res.data || updatedData);
        showToast('Worker profile updated successfully!', 'success');
      } else {
        showToast(
          res?.message || 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
          'error'
        );
      }
    } catch (err) {
      showToast(
        err?.message || 'Legal name, date of birth, phone number and profile photo cannot be changed after verification.',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-xs">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">My Profile</h1>
          <p className="text-xs text-slate-400">Admin reviews verified details, photo, and shift history for assignments.</p>
        </div>
        {currentProfile.rating != null && currentProfile.rating >= 1 && currentProfile.rating <= 5 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-300 font-bold border border-amber-500/30">
            <Star className="w-4 h-4 fill-current" /> Rating: {currentProfile.rating} ★
          </div>
        )}
      </div>

      {/* Informational Policy Banner */}
      <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-start gap-3.5">
        <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 shrink-0 mt-0.5">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-xs">
          <p className="font-bold text-slate-200">Verified Personal Details are Permanently Locked</p>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            In compliance with event staffing verification standards, your <span className="text-slate-300 font-medium">Full Legal Name</span>, <span className="text-slate-300 font-medium">Date of Birth</span>, <span className="text-slate-300 font-medium">Phone Number</span>, and <span className="text-slate-300 font-medium">Profile Photo</span> cannot be changed or removed once saved. You can continue updating your location, skills, experience, and preferred event types below.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        {/* Profile Photo - Permanently Locked & Read-Only */}
        <ImageUploader
          label="Profile Photo *"
          value={formData.profilePhoto}
          onChange={() => {}}
          locked={isPhotoLocked || true}
        />

        {/* Row 1: Full Legal Name & Location */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-semibold">Full Legal Name *</label>
              {isNameLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <input
              type="text"
              required
              readOnly={isNameLocked}
              disabled={isNameLocked}
              value={formData.fullName}
              onChange={(e) => !isNameLocked && setFormData({ ...formData, fullName: e.target.value })}
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white font-medium ${
                isNameLocked
                  ? 'border-slate-800/80 bg-slate-900/60 opacity-80 cursor-not-allowed select-none'
                  : 'border-slate-700'
              }`}
            />
            {isNameLocked && (
              <p className="text-[10px] text-slate-500 mt-1">Verified during registration. Cannot be modified.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-semibold">Location / City *</label>
            </div>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
              placeholder="e.g. Mumbai, MH"
            />
          </div>
        </div>

        {/* Row 2: Date of Birth, Phone Number, Email */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-semibold">Date of Birth *</label>
              {isDobLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <input
              type="date"
              required
              readOnly={isDobLocked}
              disabled={isDobLocked}
              value={formData.dateOfBirth}
              onChange={(e) => !isDobLocked && setFormData({ ...formData, dateOfBirth: e.target.value })}
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white font-medium ${
                isDobLocked
                  ? 'border-slate-800/80 bg-slate-900/60 opacity-80 cursor-not-allowed select-none'
                  : 'border-slate-700'
              }`}
            />
            {isDobLocked && (
              <p className="text-[10px] text-slate-500 mt-1">Verified during registration. Cannot be modified.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-semibold">Phone Number *</label>
              {isPhoneLocked && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                  <Lock className="w-3 h-3" /> Locked
                </span>
              )}
            </div>
            <input
              type="text"
              required
              readOnly={isPhoneLocked}
              disabled={isPhoneLocked}
              value={formData.phone}
              onChange={(e) => !isPhoneLocked && setFormData({ ...formData, phone: e.target.value })}
              className={`w-full bg-slate-950 border rounded-xl px-3 py-2.5 text-white font-medium ${
                isPhoneLocked
                  ? 'border-slate-800/80 bg-slate-900/60 opacity-80 cursor-not-allowed select-none'
                  : 'border-slate-700'
              }`}
            />
            {isPhoneLocked && (
              <p className="text-[10px] text-slate-500 mt-1">Verified during registration. Cannot be modified.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-slate-300 font-semibold">Email Address</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <Lock className="w-3 h-3" /> Locked
              </span>
            </div>
            <input
              type="email"
              disabled
              readOnly
              value={formData.email}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 cursor-not-allowed select-none"
            />
            <p className="text-[10px] text-slate-500 mt-1">Primary authentication email.</p>
          </div>
        </div>

        {/* Row 3: Preferred Event Types */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">
            Preferred Event Types (Comma separated)
          </label>
          <input
            type="text"
            value={formData.preferredEventTypes}
            onChange={(e) => setFormData({ ...formData, preferredEventTypes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
            placeholder="e.g. Wedding, Corporate Function, Concert, Luxury Gala"
          />
        </div>

        {/* Row 4: Bio / About */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Bio / Profile Summary</label>
          <textarea
            rows="2"
            value={formData.bio}
            onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500 outline-none"
            placeholder="Share a short summary about your background, punctuality, and event demeanor..."
          />
        </div>

        {/* Row 5: Experience Highlights */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Overall Event Experience Summary</label>
          <textarea
            rows="2"
            value={typeof formData.experience === 'string' ? formData.experience : JSON.stringify(formData.experience)}
            onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:border-brand-500 outline-none"
            placeholder="Describe your hospitality, ushering, VIP escort, or crowd coordination experience..."
          />
        </div>

        {/* Action Button */}
        <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            Only non-locked fields will be updated upon saving.
          </p>
          <button
            type="submit"
            disabled={loading || deleting}
            className="gradient-btn px-6 py-2.5 rounded-xl font-bold flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> {loading ? 'Saving…' : 'Save Worker Profile'}
          </button>
        </div>
      </form>

      {/* Danger Zone */}
      <div className="mt-8 pt-6 border-t border-rose-500/30">
        <div className="mb-4">
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-rose-500" /> Danger Zone
          </h2>
          <p className="text-sm text-slate-400">
            Deleting your profile will permanently remove your account and associated personal/profile data. 
            Your deletion action will be recorded in the Admin Audit History.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          className="px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
        >
          <Trash2 className="w-4 h-4" /> Delete My Profile
        </button>
      </div>

      <Modal isOpen={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} title="Delete Account?" maxWidth="max-w-md">
        <div className="space-y-6 text-sm">
          <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400">
            <p className="font-bold flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" /> Are you sure you want to permanently delete your account?
            </p>
            <p className="text-xs">
              This action will remove your account and profile data. Your deletion action will remain available in Admin Audit History.
            </p>
          </div>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 font-bold text-slate-300 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                setDeleting(true);
                const res = await userService.deleteSelfAccount();
                if (res?.success) {
                  showToast('Your account has been permanently deleted.', 'success');
                  logout();
                  window.location.href = '/';
                } else {
                  showToast(res?.message || 'Failed to delete account.', 'error');
                  setDeleting(false);
                  setDeleteConfirmOpen(false);
                }
              }}
              disabled={deleting}
              className="px-4 py-2 font-bold bg-rose-500 text-white rounded-xl hover:bg-rose-600 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting...' : 'Delete Permanently'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default WorkerProfile;
