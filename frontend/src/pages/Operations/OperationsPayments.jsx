import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import { useNotifications } from '../../context/NotificationContext';
import StatusBadge from '../../components/common/StatusBadge';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { formatDate } from '../../utils/formatters';
import { CreditCard, Lock } from 'lucide-react';

export const OperationsPayments = () => {
  const { showToast } = useNotifications();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const res = await operationsService.getPayments();
      if (res.success) setRecords(res.payments);
    } catch (err) {
      showToast('Failed to load payments.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (id, status, currentRef) => {
    const ref = prompt('Enter Transaction UTR/Reference:', currentRef || '');
    if (ref === null) return;
    
    try {
      const res = await operationsService.updatePaymentStatus(id, { status, transactionRef: ref });
      if (res.success) {
        showToast(`Payment marked as ${status}.`, 'success');
        fetchData();
      }
    } catch (err) {
      showToast(err || 'Failed to update payment.', 'error');
    }
  };

  if (loading) return <LoadingSpinner label="Loading Payments..." />;

  return (
    <div className="space-y-8 pb-12 text-xs">
      <div>
        <h1 className="text-2xl font-extrabold text-white flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-brand-500" />
          Operations: Payments
        </h1>
        <p className="mt-1 text-slate-400">Manage payment transitions (PROCESSING / PAID) and UTR references.</p>
      </div>

      {records.length === 0 ? (
        <EmptyState title="No Payments Found" />
      ) : (
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="px-4 py-3">Worker</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">UTR/Ref</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {records.map((rec) => {
                  const isLocked = !!rec.verifiedByAdminId;
                  return (
                    <tr key={rec._id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3.5 font-bold text-white">{rec.workerId?.email}</td>
                      <td className="px-4 py-3.5 font-semibold text-brand-300">{rec.jobId?.title}</td>
                      <td className="px-4 py-3.5 text-emerald-400 font-black">₹{rec.amount}</td>
                      <td className="px-4 py-3.5"><StatusBadge status={rec.status} /></td>
                      <td className="px-4 py-3.5 text-slate-400">{rec.transactionRef || '-'}</td>
                      <td className="px-4 py-3.5 text-right flex justify-end items-center gap-2">
                        {isLocked ? (
                          <span className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase bg-slate-900 px-2 py-1 rounded">
                            <Lock className="w-3 h-3" />
                            Payment Verified by Admin — Editing Locked
                          </span>
                        ) : (
                          <>
                            <button onClick={() => handleUpdate(rec._id, 'PROCESSING', rec.transactionRef)} className="px-2 py-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded font-semibold transition-colors">
                              Processing
                            </button>
                            <button onClick={() => handleUpdate(rec._id, 'PAID', rec.transactionRef)} className="px-2 py-1 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 rounded font-semibold transition-colors">
                              Paid
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OperationsPayments;
