import API from './api';

export const cancellationService = {


  // Submit a cancellation request (Worker or Recruiter)
  createCancellationRequest: async (cancellationData, user) => {
    try {
      let res;
      if (user.role === 'RECRUITER') {
        res = await API.post(`/recruiter/jobs/${cancellationData.jobId}/cancel-request`, { reason: cancellationData.reason });
      } else {
        res = await API.post('/worker/cancel-assignment-request', { assignmentId: cancellationData.assignmentId, reason: cancellationData.reason });
      }
      if (res && res.success) {
        return { success: true, data: res.cancellationRequest };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

};

export default cancellationService;
