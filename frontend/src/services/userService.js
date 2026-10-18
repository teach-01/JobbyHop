import API from './api';

export const userService = {
  // Get all recruiters (Admin view)
  getRecruiters: async () => {
    try {
      const res = await API.get('/admin/recruiters');
      if (res && res.success) {
        return { success: true, data: res.recruiters || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get all workers (Admin view)
  getWorkers: async () => {
    try {
      const res = await API.get('/admin/workers');
      if (res && res.success) {
        return { success: true, data: res.workers || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get single user profile by ID (Admin view — no password fields)
  getUserById: async (userId) => {
    try {
      const res = await API.get(`/admin/users/${userId}`);
      if (res && res.success) {
        return { success: true, data: res.user };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },


  // Update worker profile
  updateWorkerProfile: async (userId, profileData) => {
    try {
      const res = await API.put('/worker/profile', profileData);
      if (res && res.success) {
        return { success: true, data: res.profile };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get recruiter profile
  getRecruiterProfile: async () => {
    try {
      const res = await API.get('/recruiter/profile');
      if (res && res.success) {
        return { success: true, data: res.profile };
      }
      return { success: false, message: res?.message || 'Failed to fetch profile' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Update recruiter profile
  updateRecruiterProfile: async (userId, profileData) => {
    try {
      const res = await API.put('/recruiter/profile', profileData);
      if (res && res.success) {
        return { success: true, data: res.profile };
      }
      return { success: false, message: res?.message || 'Failed to update profile' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Update worker availability
  updateWorkerAvailability: async (userId, availabilityData) => {
    try {
      const res = await API.put('/worker/availability', availabilityData);
      if (res && res.success) {
        return { success: true, data: res.availability };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin update user status
  updateUserStatus: async (userId, status, reason, adminUser) => {
    try {
      const res = await API.post('/admin/users/status', { userId, status, reason });
      if (res && res.success) {
        return { success: true, data: { status: res.status } };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin update user rating
  updateUserRating: async (userId, rating) => {
    try {
      const res = await API.put(`/admin/users/${userId}/rating`, { rating });
      if (res && res.success) {
        return { success: true, data: res.profile };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin reset user password
  resetUserPassword: async (userId, reason) => {
    try {
      const res = await API.post(`/admin/users/${userId}/reset-password`, { reason });
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin force password change
  forceUserPasswordChange: async (userId, reason) => {
    try {
      const res = await API.post(`/admin/users/${userId}/force-password-change`, { reason });
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin get user history
  getUserHistory: async (userId) => {
    try {
      const res = await API.get(`/admin/users/${userId}/history`);
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.warn('API get user history failed, fallback to mock:', e);
    }
    return { success: true, history: [] };
  },
  // Admin delete user account (soft-delete; preserves historical records)
  deleteUser: async (userId, reason) => {
    try {
      const res = await API.delete(`/admin/users/${userId}`, { data: { reason } });
      if (res && res.success) {
        return res;
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  deleteSelfAccount: async () => {
    try {
      const res = await API.delete('/auth/me');
      if (res && res.success) {
        return res;
      }
      // If success is falsy, return error with any message the server sent
      return { success: false, message: res?.message || 'Account deletion failed. Please try again.' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Account deletion failed. Please try again.' };
    }
  }
};

export default userService;
