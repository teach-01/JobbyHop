import API from './api';

export const paymentService = {
  // Get payments for a worker
  getWorkerPayments: async (workerId) => {
    try {
      const res = await API.get('/worker/payments');
      if (res && res.success) {
        return { success: true, data: res.payments || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get all payments (Admin view) — fetch up to 1000 to support full client-side search
  getAllPayments: async () => {
    try {
      const res = await API.get('/admin/payments?limit=1000');
      if (res && res.success) {
        return { success: true, data: res.payments || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Update payment status by Admin (PENDING, PROCESSING, PAID, ON_HOLD, FAILED)
  updatePaymentStatus: async (paymentId, updateData, adminUser) => {
    try {
      const res = await API.put('/admin/payments/status', {
        paymentId,
        status: updateData.status,
        transactionRef: updateData.transactionRef,
        adminNotes: updateData.adminNotes,
      });
      if (res && res.success) {
        return { success: true, data: res.payment };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get Recruiter Payment Summary
  getRecruiterPaymentSummary: async () => {
    try {
      const res = await API.get('/recruiter/payment-summary');
      if (res && res.success) {
        return { success: true, data: res.data };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // ── Payment Admin Trash Lifecycle ─────────────────────────────────────────

  // Soft-delete (move to Trash)
  softDeletePayment: async (id) => {
    try {
      const res = await API.delete(`/admin/payments/${id}`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Failed to delete payment' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Failed to move payment to trash' };
    }
  },

  // Get trash payments
  getTrashPayments: async () => {
    try {
      const res = await API.get('/admin/payments/trash');
      if (res && res.success) return { success: true, data: res.payments || [] };
      return { success: false, message: res?.message || 'Failed to fetch trash' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Failed to fetch payment trash' };
    }
  },

  // Restore from Trash
  restorePayment: async (id) => {
    try {
      const res = await API.patch(`/admin/payments/${id}/restore`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Failed to restore payment' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Failed to restore payment' };
    }
  },

  // Permanent delete from Trash
  permanentDeletePayment: async (id) => {
    try {
      const res = await API.delete(`/admin/payments/${id}/permanent`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Failed to permanently delete payment' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Failed to permanently delete payment' };
    }
  },
};

export default paymentService;
