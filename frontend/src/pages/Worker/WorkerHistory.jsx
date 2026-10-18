import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import applicationService from '../../services/applicationService';
import assignmentService from '../../services/assignmentService';
import paymentService from '../../services/paymentService';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { History, FileText, CheckCircle, CreditCard } from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';

export const WorkerHistory = () => {
  const { user } = useAuth();
  const [apps, setApps] = useState([]);
  const [asgs, setAsgs] = useState([]);
  const [pays, setPays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('ASSIGNMENTS');

  useEffect(() => {
    const fetchHistory = async () => {
      if (user?._id) {
        const [aRes, sRes, pRes] = await Promise.all([
          applicationService.getWorkerApplications(user._id),
          assignmentService.getWorkerAssignments(user._id),
          paymentService.getWorkerPayments(user._id),
        ]);
        if (aRes.success) setApps(aRes.data);
        if (sRes.success) setAsgs(sRes.data);
        if (pRes.success) setPays(pRes.data);
      }
      setLoading(false);
    };
    fetchHistory();
  }, [user]);

  if (loading) return <LoadingSpinner label="Loading your complete work history..." />;

  return (
    <div className="space-y-6 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800">
        <h1 className="text-2xl font-extrabold text-white">Worker Activity & Shift History</h1>
        <p className="text-xs text-slate-400">Complete record of applications, shift assignments, and payouts.</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setTab('ASSIGNMENTS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            tab === 'ASSIGNMENTS'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          Event Assignments ({asgs.length})
        </button>
        <button
          onClick={() => setTab('APPLICATIONS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            tab === 'APPLICATIONS'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          Applications ({apps.length})
        </button>
        <button
          onClick={() => setTab('PAYMENTS')}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            tab === 'PAYMENTS'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-900 text-slate-400 border border-slate-800'
          }`}
        >
          Payout Records ({pays.length})
        </button>
      </div>

      {/* Content */}
      {tab === 'ASSIGNMENTS' && (
        <div className="space-y-3">
          {asgs.map((a) => (
            <div key={a._id} className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">{a.jobTitle}</h4>
                <p className="text-slate-400 mt-1">{formatDate(a.eventDate)} • {getLocationString(a.location)}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-400">{formatCurrency(a.finalApprovedPayment)}</p>
                <StatusBadge status={a.status} />
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'APPLICATIONS' && (
        <div className="space-y-3">
          {apps.map((ap) => (
            <div key={ap._id} className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">{ap.jobTitle}</h4>
                <p className="text-slate-400 mt-1">Applied: {formatDate(ap.appliedDate)}</p>
              </div>
              <StatusBadge status={ap.status} />
            </div>
          ))}
        </div>
      )}

      {tab === 'PAYMENTS' && (
        <div className="space-y-3">
          {pays.map((p) => (
            <div key={p._id} className="glass-card p-5 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <h4 className="font-bold text-white text-sm">{p.jobTitle}</h4>
                <p className="text-slate-400 mt-1">Expected Payout: {formatDate(p.expectedPaymentDate)} • Ref: {p.transactionRef || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-emerald-400">{formatCurrency(p.amount)}</p>
                <StatusBadge status={p.status} type="payment" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerHistory;
