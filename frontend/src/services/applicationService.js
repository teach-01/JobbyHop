import API from './api';

export const applicationService = {
  // Get applications for a worker
  getWorkerApplications: async (workerId) => {
    try {
      const res = await API.get('/worker/applications');
      if (res && res.success) {
        return { success: true, data: res.applications || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get applications for a specific job (Admin view)
  getJobApplications: async (jobId) => {
    try {
      const res = await API.get(`/admin/applications?jobId=${jobId}`);
      if (res && res.success) {
        return { success: true, data: res.applications || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get all active (non-deleted) applications (Admin master list)
  getAllApplications: async () => {
    try {
      const res = await API.get('/admin/applications');
      if (res && res.success) {
        return { success: true, data: res.applications || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Worker submits application for an approved job
  applyForJob: async (jobId, workerUser) => {
    try {
      const res = await API.post(`/worker/jobs/${jobId}/apply`);
      if (res && res.success) {
        return { success: true, data: res.application };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin approves application and assigns worker
  approveAndAssignWorker: async (applicationId, adminUser) => {
    try {
      const res = await API.post('/admin/applications/approve-assign', { applicationId });
      if (res && res.success) {
        return { success: true, data: res.assignment };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin rejects application
  rejectApplication: async (applicationId, adminUser) => {
    try {
      const res = await API.post('/admin/applications/reject', { applicationId });
      if (res && res.success) {
        return { success: true, message: 'Application rejected.' };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin updates application status directly
  updateApplicationStatus: async (id, status) => {
    try {
      const res = await API.put(`/admin/applications/${id}/status`, { status });
      if (res && res.success) {
        return { success: true, data: res.application };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // ── Trash Lifecycle ────────────────────────────────────────────────────────

  // Get all soft-deleted applications (Trash)
  getTrashApplications: async () => {
    try {
      const res = await API.get('/admin/applications/trash');
      if (res && res.success) {
        return { success: true, data: res.applications || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Soft-delete an application (moves to trash)
  softDeleteApplication: async (id) => {
    try {
      const res = await API.delete(`/admin/applications/${id}`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Restore an application from trash
  restoreApplication: async (id) => {
    try {
      const res = await API.patch(`/admin/applications/${id}/restore`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Permanently delete an application (must be in trash first)
  permanentDeleteApplication: async (id) => {
    try {
      const res = await API.delete(`/admin/applications/${id}/permanent`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },
};

export default applicationService;
