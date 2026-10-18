import API from './api';

const operationsService = {
  getDashboardStats: () => API.get('/operations/dashboard'),
  
  getAttendance: () => API.get('/operations/attendance'),
  updateAttendance: (id, data) => API.patch(`/operations/attendance/${id}`, data),
  
  getEvents: () => API.get('/operations/events'),
  completeEvent: (id, notes) => API.patch(`/operations/events/${id}/complete`, { notes }),
  
  getPayments: () => API.get('/operations/payments'),
  updatePaymentStatus: (id, data) => API.patch(`/operations/payments/${id}`, data),
  
  getNotifications: () => API.get('/operations/notifications'),
  
  getAuditHistory: () => API.get('/operations/audit'),
};

export default operationsService;
