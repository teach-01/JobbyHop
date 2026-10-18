import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { userService } from '../../services/userService';
import ImageUploader from '../../components/common/ImageUploader';
import Modal from '../../components/common/Modal';
import { Building2, Mail, Phone, MapPin, Save, User, Trash2, AlertTriangle, Lock } from 'lucide-react';

export const RecruiterProfile = () => {
  const { user, updateUserProfile, logout } = useAuth();
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    fullName: user?.profile?.fullName || '',
    companyName: user?.profile?.companyName || '',
    email: user?.email || user?.profile?.email || '',
    companyDescription: user?.profile?.companyDescription || '',
    phone: user?.profile?.phone || user?.phone || '',
    location: user?.profile?.location || '',
    logo: user?.profile?.companyLogo || user?.profile?.logo || '',
  });

  const isLocked = user?.profile?.isInitialSetupComplete || false;

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await userService.getRecruiterProfile();
        if (res && res.success && res.data) {
          const p = res.data;
          setFormData((prev) => ({
            ...prev,
            fullName: p.fullName || prev.fullName,
            companyName: p.companyName || prev.companyName,
            email: p.email || user?.email || prev.email,
            companyDescription: p.companyDescription ?? prev.companyDescription,
            phone: p.phone || prev.phone,
            location: p.location || prev.location,
            logo: p.companyLogo || p.logo || prev.logo,
          }));
        }
      } catch (err) {
        // Fallback to local user auth state
      }
    };
    fetchProfile();
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await userService.updateRecruiterProfile(user._id, formData);
      if (res && res.success) {
        updateUserProfile(res.data || { ...formData, isInitialSetupComplete: true });
        showToast('Company profile updated successfully!', 'success');
      } else {
        showToast(res?.message || 'Failed to update profile', 'error');
      }
    } catch (err) {
      showToast('Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div className="glass-card p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white">Recruiter & Company Profile</h1>
        <p className="text-xs text-slate-400">Manage your event agency information and contact details.</p>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6 text-xs">
        <ImageUploader
          label="Company Logo / Brand Badge"
          value={formData.logo}
          locked={isLocked}
          lockedTitle="Locked Company Logo"
          lockedDescription="Your company logo was set during initial profile creation. It is permanently locked for account integrity."
          onChange={(url) => setFormData({ ...formData, logo: url })}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">Contact Person Name</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <Lock className="w-3 h-3 text-slate-400" /> Locked
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={formData.fullName}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 cursor-not-allowed select-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">Company / Organization Name</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <Lock className="w-3 h-3 text-slate-400" /> Locked
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={formData.companyName}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 font-bold cursor-not-allowed select-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">Recruiter Email ID</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <Lock className="w-3 h-3 text-slate-400" /> Locked
              </span>
            </div>
            <input
              type="email"
              readOnly
              disabled
              value={formData.email}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 cursor-not-allowed select-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-slate-300 font-semibold">Phone Number</label>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 bg-slate-800/60 px-2 py-0.5 rounded-md border border-slate-700/40">
                <Lock className="w-3 h-3 text-slate-400" /> Locked
              </span>
            </div>
            <input
              type="text"
              readOnly
              disabled
              value={formData.phone}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-xl px-3 py-2.5 text-slate-400 cursor-not-allowed select-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Location</label>
          <input
            type="text"
            required
            value={formData.location}
            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Company Description</label>
          <textarea
            rows="3"
            value={formData.companyDescription}
            onChange={(e) => setFormData({ ...formData, companyDescription: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
            placeholder="Describe your event management focus (weddings, corporate, concerts...)"
          />
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button
            type="submit"
            disabled={loading || deleting}
            className="gradient-btn px-6 py-2.5 rounded-xl font-bold flex items-center gap-2"
          >
            <Save className="w-4 h-4" /> Save Profile
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
            Deleting your account will permanently remove your account and associated recruiter/company profile data. 
            Your deletion action will be recorded in the Admin Audit History.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleteConfirmOpen(true)}
          className="px-6 py-2.5 rounded-xl font-bold flex items-center gap-2 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all border border-rose-500/20"
        >
          <Trash2 className="w-4 h-4" /> Delete My Account
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

export default RecruiterProfile;
