import API from './api';

export const assignmentService = {
  // Get assignments for a worker
  getWorkerAssignments: async (workerId) => {
    try {
      const res = await API.get('/worker/assignments');
      if (res && res.success) {
        return { success: true, data: res.assignments || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get all assignments (Admin view)
  getAllAssignments: async () => {
    try {
      const res = await API.get('/admin/assignments');
      if (res && res.success) {
        return { success: true, data: res.assignments || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Update assignment status by Admin
  updateAssignmentStatus: async (assignmentId, status) => {
    try {
      const res = await API.put(`/admin/assignments/${assignmentId}/status`, { status });
      if (res && res.success) {
        return { success: true, data: res.assignment };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Trash endpoints
  getTrashAssignments: async () => {
    try {
      const res = await API.get('/admin/assignments/trash');
      if (res && res.success) return { success: true, data: res.assignments || [] };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  softDeleteAssignment: async (id) => {
    try {
      const res = await API.delete(`/admin/assignments/${id}`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  restoreAssignment: async (id) => {
    try {
      const res = await API.patch(`/admin/assignments/${id}/restore`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  permanentDeleteAssignment: async (id) => {
    try {
      const res = await API.delete(`/admin/assignments/${id}/permanent`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },
};

export default assignmentService;
