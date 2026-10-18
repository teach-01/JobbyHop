import API from './api';

export const recruiterPaymentService = {
  // ── Recruiter Endpoint: Get own payment obligations (Recruiter → Admin) ────
  // Calls GET /api/recruiter-payments/my-payments
  getMyPayments: async () => {
    try {
      const res = await API.get('/recruiter-payments/my-payments');
      if (res && res.success) {
        return {
          success: true,
          payments: res.payments || [],
          data: res.payments || [],
          summary: res.summary || {},
        };
      }
      return {
        success: false,
        payments: [],
        data: [],
        summary: {},
        message: res?.message || 'Failed to fetch payments',
      };
    } catch (e) {
      console.error('API request failed:', e);
      return {
        success: false,
        payments: [],
        data: [],
        summary: {},
        message: typeof e === 'string' ? e : e?.response?.data?.message || 'Operation failed',
      };
    }
  },

  // ── Recruiter Endpoint: Submit payment with UTR ───────────────────────────
  // Calls POST /api/recruiter-payments/:id/submit
  submitPayment: async (paymentId, { utr, utrNumber, paymentMethod }) => {
    try {
      const targetUtr = (utr || utrNumber || '').trim();
      const res = await API.post(`/recruiter-payments/${paymentId}/submit`, {
        utr: targetUtr,
        utrNumber: targetUtr,
        paymentMethod,
      });
      if (res && res.success) {
        return {
          success: true,
          payment: res.payment,
          data: res.payment,
          message: res.message,
        };
      }
      return { success: false, message: res?.message || 'Payment submission failed' };
    } catch (e) {
      console.error('API request failed:', e);
      return {
        success: false,
        message: typeof e === 'string' ? e : e?.response?.data?.message || 'Payment submission failed',
      };
    }
  },

  // ── Admin Endpoint: Get all RecruiterPayment records (Recruiter Collections)
  // Calls GET /api/admin/recruiter-payments
  getAllRecruiterPayments: async ({ status = 'ALL', search = '', page = 1, limit = 50 } = {}) => {
    try {
      const params = new URLSearchParams();
      if (status && status !== 'ALL') params.append('status', status);
      if (search) params.append('search', search);
      params.append('page', page);
      params.append('limit', limit);

      const res = await API.get(`/admin/recruiter-payments?${params.toString()}`);
      if (res && res.success) {
        return {
          success: true,
          payments: res.payments || [],
          data: res.payments || [],
          summary: res.summary || {},
          pagination: res.pagination,
        };
      }
      return {
        success: false,
        payments: [],
        data: [],
        summary: {},
        message: res?.message || 'Failed to fetch recruiter payments',
      };
    } catch (e) {
      console.error('API request failed:', e);
      return {
        success: false,
        payments: [],
        data: [],
        summary: {},
        message: typeof e === 'string' ? e : e?.response?.data?.message || 'Operation failed',
      };
    }
  },

  // ── Admin Endpoint: Get single payment by ID ──────────────────────────────
  getPaymentById: async (paymentId) => {
    try {
      const res = await API.get(`/admin/recruiter-payments/${paymentId}`);
      if (res && res.success) {
        return {
          success: true,
          payment: res.payment,
          data: res.payment,
          recruiterProfile: res.recruiterProfile,
        };
      }
      return { success: false, message: res?.message || 'Payment not found' };
    } catch (e) {
      console.error('API request failed:', e);
      return {
        success: false,
        message: typeof e === 'string' ? e : e?.response?.data?.message || 'Operation failed',
      };
    }
  },

  // ── Admin Endpoint: Update status (PENDING / COMPLETED) ───────────────────
  updatePaymentStatus: async (paymentId, { status, adminNotes }) => {
    try {
      const res = await API.patch(`/admin/recruiter-payments/${paymentId}/status`, {
        status,
        adminNotes,
      });
      if (res && res.success) {
        return {
          success: true,
          payment: res.payment,
          data: res.payment,
          message: res.message,
        };
      }
      return { success: false, message: res?.message || 'Status update failed' };
    } catch (e) {
      console.error('API request failed:', e);
      return {
        success: false,
        message: typeof e === 'string' ? e : e?.response?.data?.message || 'Status update failed',
      };
    }
  },

  // ── Direct Named Aliases for "Collections" terminology ────────────────────
  getAllCollections: async (params) => {
    return recruiterPaymentService.getAllRecruiterPayments(params);
  },

  getCollectionById: async (id) => {
    return recruiterPaymentService.getPaymentById(id);
  },

  updateCollectionStatus: async (id, data) => {
    return recruiterPaymentService.updatePaymentStatus(id, data);
  },

  submitCollection: async (payload) => {
    const id = payload.collectionId || payload.paymentId || payload.id;
    return recruiterPaymentService.submitPayment(id, {
      utr: payload.utrNumber || payload.utr,
      paymentMethod: payload.paymentMethod,
    });
  },

  // ── Trash / Delete / Restore endpoints ────────────────────────────────────
  getTrashCollections: async ({ search = '', page = 1, limit = 100 } = {}) => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      params.append('page', page);
      params.append('limit', limit);
      const res = await API.get(`/admin/recruiter-payments/trash?${params.toString()}`);
      if (res && res.success) {
        return {
          success: true,
          collections: res.collections || res.payments || res.data || [],
          data: res.collections || res.payments || res.data || [],
          trashCount: res.trashCount || 0,
        };
      }
      return { success: false, collections: [], data: [], trashCount: 0, message: res?.message || 'Failed to fetch trash' };
    } catch (e) {
      return { success: false, collections: [], data: [], trashCount: 0, message: e?.response?.data?.message || 'Operation failed' };
    }
  },

  softDeleteCollection: async (id) => {
    try {
      const res = await API.delete(`/admin/recruiter-payments/${id}`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Delete failed' };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Delete failed' };
    }
  },

  restoreCollection: async (id) => {
    try {
      const res = await API.post(`/admin/recruiter-payments/${id}/restore`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Restore failed' };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Restore failed' };
    }
  },

  permanentDeleteCollection: async (id) => {
    try {
      const res = await API.delete(`/admin/recruiter-payments/${id}/permanent`);
      if (res && res.success) return { success: true, message: res.message };
      return { success: false, message: res?.message || 'Permanent delete failed' };
    } catch (e) {
      return { success: false, message: e?.response?.data?.message || 'Permanent delete failed' };
    }
  },
};

export default recruiterPaymentService;
