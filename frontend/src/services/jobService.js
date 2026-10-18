import API from './api';

export const jobService = {
  // Get all jobs (Admin view) with optional search/filter/pagination
  getAllJobs: async (params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.status) query.set('status', params.status);
      if (params.search) query.set('search', params.search);
      if (params.page) query.set('page', params.page);
      if (params.limit) query.set('limit', params.limit);
      if (params.eventType) query.set('eventType', params.eventType);
      if (params.dateFrom) query.set('dateFrom', params.dateFrom);
      if (params.dateTo) query.set('dateTo', params.dateTo);
      if (params.createdFrom) query.set('createdFrom', params.createdFrom);
      if (params.createdTo) query.set('createdTo', params.createdTo);
      if (params.payMin) query.set('payMin', params.payMin);
      if (params.payMax) query.set('payMax', params.payMax);
      if (params.sort) query.set('sort', params.sort);
      const qs = query.toString();
      const res = await API.get(`/admin/job-requests${qs ? `?${qs}` : ''}`);
      if (res && res.success) {
        return { success: true, data: res.jobs || [], pagination: res.pagination, statusCounts: res.statusCounts };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get available jobs for Workers (ONLY ADMIN APPROVED JOBS!)
  // Returns paginated data + pagination.totalDocs for real count display on dashboard
  getAvailableJobsForWorker: async (workerId, params = {}) => {
    try {
      const query = new URLSearchParams();
      if (params.limit) query.set('limit', params.limit);
      if (params.page) query.set('page', params.page);
      const qs = query.toString();
      const res = await API.get(`/worker/jobs${qs ? `?${qs}` : ''}`);
      if (res && res.success) {
        return {
          success: true,
          data: res.jobs || [],
          pagination: res.pagination || { totalDocs: (res.jobs || []).length },
        };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get jobs created by a specific Recruiter
  getRecruiterJobs: async (params = {}) => {
    try {
      let queryStr = '';
      if (typeof params === 'object' && params !== null) {
        const query = new URLSearchParams();
        if (params.status) query.set('status', params.status);
        if (params.search) query.set('search', params.search);
        query.set('limit', params.limit || '1000');
        queryStr = `?${query.toString()}`;
      } else {
        queryStr = '?limit=1000';
      }
      const res = await API.get(`/recruiter/jobs${queryStr}`);
      if (res && res.success) {
        return { success: true, data: res.jobs || [], stats: res.stats, pagination: res.pagination };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Get single job details (Recruiter view)
  getJobById: async (id) => {
    try {
      const res = await API.get(`/recruiter/jobs/${id}`);
      if (res && res.success) {
        return { success: true, data: res.job };
      }
      return { success: false, message: 'Job not found' };
    } catch (e) {
      // Fallback: try worker endpoint (for Worker job details)
      try {
        const res2 = await API.get(`/worker/jobs/${id}`);
        if (res2 && res2.success) return { success: true, data: res2.job };
      } catch (_) {}
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Recruiter creates a new Job request (status: PENDING_REVIEW)
  createJob: async (jobData, recruiterUser) => {
    try {
      const payload = {
        title: jobData.title,
        description: jobData.description,
        eventType: jobData.eventType || 'Other',
        eventDate: jobData.eventDate,
        startTime: jobData.startTime,
        endTime: jobData.endTime,
        location: jobData.location,
        latitude: jobData.latitude,
        longitude: jobData.longitude,
        workersRequired: Number(jobData.workersRequired) || 1,
        requiredSkills: Array.isArray(jobData.requiredSkills)
          ? jobData.requiredSkills
          : (jobData.requiredSkills || '').split(',').map((s) => s.trim()).filter(Boolean),
        workerRequirements: jobData.workerRequirements || '',
        responsibilities: jobData.responsibilities || '',
        recruiterProposedPayment: Number(jobData.proposedPayment || jobData.recruiterProposedPayment) || 0,
        additionalInstructions: jobData.additionalInstructions || '',
      };
      const res = await API.post('/recruiter/jobs', payload);
      if (res && res.success) {
        return { success: true, data: res.job };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Admin reviews job request (Approve or Reject & set Admin Approved Payment)
  reviewJobByAdmin: async (jobId, reviewData, adminUser) => {
    try {
      const payload = {
        title: reviewData.title,
        description: reviewData.description,
        eventType: reviewData.eventType,
        eventDate: reviewData.eventDate,
        startTime: reviewData.startTime,
        endTime: reviewData.endTime,
        location: reviewData.location,
        workersRequired: reviewData.workersRequired,
        adminApprovedPayment: Number(reviewData.adminApprovedPayment),
        action: reviewData.action || (reviewData.status === 'REJECTED' ? 'REJECT' : 'APPROVE'),
        adminNotes: reviewData.adminNotes,
      };
      const res = await API.put(`/admin/jobs/${jobId}/review`, payload);
      if (res && res.success) {
        return { success: true, data: res.job };
      }
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
    }
  },

  // Mark event completed by Admin
  completeEventByAdmin: async (jobId, completionNotes, adminUser) => {
    try {
      const res = await API.post(`/admin/events/${jobId}/complete`, { adminNotes: completionNotes });
      if (res && res.success) {
        return { success: true, message: res.message, data: res.job };
      }
      return { success: false, message: res?.message || 'Operation failed' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : e?.response?.data?.message || 'Operation failed' };
    }
  },

  // Mark event not completed / Reopen event by Admin
  reopenEventByAdmin: async (jobId, adminNotes, adminUser) => {
    try {
      const res = await API.post(`/admin/events/${jobId}/reopen`, { adminNotes });
      if (res && res.success) {
        return { success: true, message: res.message, data: res.job };
      }
      return { success: false, message: res?.message || 'Failed to reopen event' };
    } catch (e) {
      console.error('API request failed:', e);
      return { success: false, message: typeof e === 'string' ? e : e?.response?.data?.message || 'Operation failed' };
    }
  },
  // Trash Lifecycle
  softDeleteJob: async (id) => {
    try {
      const res = await API.delete(`/admin/jobs/${id}`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Failed to move to trash' };
    }
  },

  getTrashJobs: async () => {
    try {
      const res = await API.get('/admin/jobs/trash');
      if (res && res.success) return { success: true, data: res.jobs || [] };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Failed to fetch trash' };
    }
  },

  restoreJob: async (id) => {
    try {
      const res = await API.patch(`/admin/jobs/${id}/restore`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Failed to restore job' };
    }
  },

  permanentDeleteJob: async (id) => {
    try {
      const res = await API.delete(`/admin/jobs/${id}/permanent`);
      if (res && res.success) return { success: true, message: res.message };
    } catch (e) {
      return { success: false, message: typeof e === 'string' ? e : 'Failed to permanently delete job' };
    }
  },

  // Fetch accurate event counts from the backend (upcoming, completed, trashed)
  // These counts exclude trashed events and match the AdminEvents page filter logic.
  getEventStats: async () => {
    try {
      const res = await API.get('/admin/events/stats');
      if (res && res.success) return { success: true, stats: res.stats };
      return { success: false, stats: { upcomingEvents: 0, completedEvents: 0, trashedEvents: 0 } };
    } catch (e) {
      console.error('getEventStats failed:', e);
      return { success: false, stats: { upcomingEvents: 0, completedEvents: 0, trashedEvents: 0 } };
    }
  },
};

export default jobService;
