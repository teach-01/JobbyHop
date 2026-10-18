import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { CreditCard, Clock, CheckCircle } from 'lucide-react';

export const PaymentModal = ({ isOpen, onClose, payment, onSubmitUpdate }) => {
  const [formData, setFormData] = useState({
    status: 'PENDING',
    transactionRef: '',
    adminNotes: '',
  });

  useEffect(() => {
    if (payment) {
      setFormData({
        status: payment.status || 'PENDING',
        transactionRef: payment.transactionRef || '',
        adminNotes: payment.adminNotes || '',
      });
    }
  }, [payment]);

  if (!payment) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmitUpdate(payment._id, formData);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Admin Payment Management">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Payment Timeline Callout */}
        <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400 shrink-0" />
          <div>
            <p className="font-bold">Target Payout Timeline: 10–15 Days</p>
            <p className="text-[11px] text-purple-200/80">
              Expected Payout Date: {formatDate(payment.expectedPaymentDate)}
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-2 gap-3">
          <div>
            <p className="text-slate-400">Worker</p>
            <p className="font-bold text-white text-sm">{payment.workerProfile?.fullName || 'Worker'}</p>
          </div>
          <div>
            <p className="text-slate-400">Final Pay Amount</p>
            <p className="font-extrabold text-emerald-400 text-base">{formatCurrency(payment.amount)}</p>
          </div>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Update Payment Status</label>
          <select
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white font-bold"
          >
            <option value="PENDING">PENDING (Verification in progress)</option>
            <option value="PROCESSING">PROCESSING (Initiated via bank/UPI)</option>
            <option value="PAID">PAID (Completed)</option>
            <option value="ON_HOLD">ON_HOLD</option>
            <option value="FAILED">FAILED</option>
          </select>
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Transaction / Reference ID (UPI / Bank Ref)</label>
          <input
            type="text"
            value={formData.transactionRef}
            onChange={(e) => setFormData({ ...formData, transactionRef: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            placeholder="e.g. UPI/20260918/987123"
          />
        </div>

        <div>
          <label className="block text-slate-300 font-semibold mb-1">Admin Audit Notes</label>
          <textarea
            rows="2"
            value={formData.adminNotes}
            onChange={(e) => setFormData({ ...formData, adminNotes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            placeholder="Add payment processing details..."
          />
        </div>

        <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-slate-400 hover:text-white">
            Cancel
          </button>
          <button type="submit" className="gradient-btn px-6 py-2 rounded-xl font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" /> Save Payment Status
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default PaymentModal;
