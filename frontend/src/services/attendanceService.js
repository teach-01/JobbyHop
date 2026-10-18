import API from './api';

export const attendanceService = {
  // Get worker attendance records
  getWorkerAttendance: async (workerId) => {
    try {
      const res = await API.get('/worker/attendance');
      if (res && res.success) {
        return { success: true, data: res.attendance || [] };
      }
      return { success: false, data: [], message: 'Failed to load attendance records' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, data: [], message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },


  // Get all attendance records (Admin view)
  getAllAttendance: async (params = {}) => {
    try {
      const res = await API.get('/admin/attendance', { params });
      if (res && res.success) {
        return { success: true, data: res.attendance || [] };
      }
      return { success: false, data: [], message: res?.message || 'Failed to load attendance records' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, data: [], message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin marks or updates worker attendance
  markAttendanceByAdmin: async (attendanceIdOrData, formData, adminUser) => {
    try {
      const attendanceId = typeof attendanceIdOrData === 'string' ? attendanceIdOrData : (formData?.attendanceId || formData?._id);
      if (!attendanceId) {
        return { success: false, message: 'Attendance ID is required' };
      }
      const res = await API.put('/admin/attendance/update', {
        attendanceId,
        status: formData.status,
        checkInTime: formData.checkInTime,
        checkOutTime: formData.checkOutTime,
        isOvernightShift: formData.isOvernightShift,
        notes: formData.notes,
      });
      if (res && res.success) {
        return { success: true, data: res.record };
      }
      return { success: false, message: res?.message || 'Failed to update attendance' };
    } catch (e) {
      console.error('API request failed:', e);
      const errMsg = e?.response?.data?.message || e?.message || (typeof e === 'string' ? e : 'Operation failed');
      return { success: false, message: errMsg };
    }
  },


  // ── Trash Lifecycle ────────────────────────────────────────────────────────

  getTrashAttendance: async (params = {}) => {
    try {
      const res = await API.get('/admin/attendance/trash', { params });
      if (res && res.success) {
        return { success: true, data: res.attendance || [] };
      }
      return { success: false, data: [], message: res?.message || 'Failed to load trash records' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, data: [], message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  softDeleteAttendance: async (id) => {
    try {
      const res = await API.delete(`/admin/attendance/${id}`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  restoreAttendance: async (id) => {
    try {
      const res = await API.patch(`/admin/attendance/${id}/restore`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  permanentDeleteAttendance: async (id) => {
    try {
      const res = await API.delete(`/admin/attendance/${id}/permanent`);
      return { success: res?.success, message: res?.message };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },
};

export default attendanceService;
