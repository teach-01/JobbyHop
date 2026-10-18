import React, { useState } from 'react';
import { useNotifications } from '../../context/NotificationContext';
import { Settings, Save, ShieldCheck } from 'lucide-react';

export const AdminSettings = () => {
  const { showToast } = useNotifications();
  const [payoutWindowDays, setPayoutWindowDays] = useState(() => {
    const saved = localStorage.getItem('jobbyhop_admin_payout_window');
    return saved ? Number(saved) : 15;
  });
  const [autoApproveRecruiters, setAutoApproveRecruiters] = useState(() => {
    const saved = localStorage.getItem('jobbyhop_admin_auto_approve_recruiters');
    return saved !== null ? saved === 'true' : true;
  });

  const handleSaveSettings = (e) => {
    e.preventDefault();
    localStorage.setItem('jobbyhop_admin_payout_window', String(payoutWindowDays));
    localStorage.setItem('jobbyhop_admin_auto_approve_recruiters', String(autoApproveRecruiters));
    showToast('Platform operational settings saved successfully!', 'success');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white">Platform Settings & Controls</h1>
        <p className="text-slate-400">Configure global mediation rules, payout windows, and data resets.</p>
      </div>

      <form onSubmit={handleSaveSettings} className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6">
        <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">1. Payout & Guarantee Rules</h3>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Target Payout Timeline Window (Days)</label>
          <input
            type="number"
            min="10"
            max="30"
            value={payoutWindowDays}
            onChange={(e) => setPayoutWindowDays(Number(e.target.value))}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white font-bold"
          />
          <p className="text-[11px] text-slate-500 mt-1">Default rule: 10–15 days from event completion.</p>
        </div>

        <div className="pt-4 border-t border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">2. Demo & State Controls</h3>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-bold text-white">Reset Mock Data Store</p>
              <p className="text-[11px] text-slate-400">Restores initial test accounts (Admin, Recruiters, Workers) and sample jobs.</p>
            </div>
            <button
              type="button"
              disabled
              className="px-4 py-2 rounded-xl bg-slate-800/50 text-slate-500 border border-slate-800/50 cursor-not-allowed font-bold flex items-center gap-1.5"
            >
              Reset Disabled (Production)
            </button>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end">
          <button type="submit" className="gradient-btn px-6 py-2.5 rounded-xl font-bold flex items-center gap-2">
            <Save className="w-4 h-4" /> Save System Settings
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminSettings;
