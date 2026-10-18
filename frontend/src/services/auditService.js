import API from './api';

export const auditService = {
  // Active logs (isDeleted !== true)
  getAuditLogs: async () => {
    try {
      const res = await API.get('/admin/audit-logs');
      if (res && res.success) {
        return { success: true, data: res.auditLogs || [] };
      }
      return { success: false, data: [] };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Trash (isDeleted === true)
  getTrashLogs: async () => {
    try {
      const res = await API.get('/admin/audit-logs/trash');
      if (res && res.success) {
        return { success: true, data: res.auditLogs || [] };
      }
      return { success: false, data: [] };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Move to Trash (soft delete)
  softDelete: async (id) => {
    try {
      const res = await API.delete(`/admin/audit-logs/${id}`);
      return res && res.success ? { success: true } : { success: false, message: res?.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Restore from Trash
  restore: async (id) => {
    try {
      const res = await API.patch(`/admin/audit-logs/${id}/restore`);
      return res && res.success ? { success: true } : { success: false, message: res?.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Permanently delete from Trash
  permanentDelete: async (id) => {
    try {
      const res = await API.delete(`/admin/audit-logs/${id}/permanent`);
      return res && res.success ? { success: true } : { success: false, message: res?.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },
};

export default auditService;
