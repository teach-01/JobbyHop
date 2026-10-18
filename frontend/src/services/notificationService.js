import API from './api';

export const notificationService = {
  getUserNotifications: async (userId) => {
    try {
      const res = await API.get('/notifications');
      if (res && res.success) {
        return { success: true, data: res.notifications || [] };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  markAsRead: async (notificationId) => {
    try {
      const res = await API.put(`/notifications/${notificationId}/read`);
      if (res && res.success) {
        return { success: true };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  markAllAsRead: async (userId) => {
    try {
      const res = await API.delete('/notifications/read-all');
      if (res && res.success) {
        return { success: true };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },
};

export default notificationService;
