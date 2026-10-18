import API from './api';

/**
 * bulkAdminService — wraps all bulk admin API endpoints.
 * Each method returns { success, message, count } or { success: false, message }.
 */

async function post(url, ids) {
  try {
    const res = await API.post(url, { ids });
    if (res && res.success) return { success: true, message: res.message, count: res.count };
    return { success: false, message: res?.message || 'Operation failed' };
  } catch (e) {
    return { success: false, message: typeof e === 'string' ? e : 'Operation failed' };
  }
}

const bulkAdminService = {
  // ── Jobs ──────────────────────────────────────────────────────────────────
  bulkDeleteJobs: (ids) => post('/admin/jobs/bulk/delete', ids),
  bulkRestoreJobs: (ids) => post('/admin/jobs/bulk/restore', ids),
  bulkPermanentDeleteJobs: (ids) => post('/admin/jobs/bulk/permanent-delete', ids),

  // ── Applications ──────────────────────────────────────────────────────────
  bulkDeleteApplications: (ids) => post('/admin/applications/bulk/delete', ids),
  bulkRestoreApplications: (ids) => post('/admin/applications/bulk/restore', ids),
  bulkPermanentDeleteApplications: (ids) => post('/admin/applications/bulk/permanent-delete', ids),

  // ── Assignments ───────────────────────────────────────────────────────────
  bulkDeleteAssignments: (ids) => post('/admin/assignments/bulk/delete', ids),
  bulkRestoreAssignments: (ids) => post('/admin/assignments/bulk/restore', ids),
  bulkPermanentDeleteAssignments: (ids) => post('/admin/assignments/bulk/permanent-delete', ids),

  // ── Attendance ────────────────────────────────────────────────────────────
  bulkDeleteAttendance: (ids) => post('/admin/attendance/bulk/delete', ids),
  bulkRestoreAttendance: (ids) => post('/admin/attendance/bulk/restore', ids),
  bulkPermanentDeleteAttendance: (ids) => post('/admin/attendance/bulk/permanent-delete', ids),

  // ── Audit Logs ────────────────────────────────────────────────────────────
  bulkDeleteAuditLogs: (ids) => post('/admin/audit-logs/bulk/delete', ids),
  bulkRestoreAuditLogs: (ids) => post('/admin/audit-logs/bulk/restore', ids),
  bulkPermanentDeleteAuditLogs: (ids) => post('/admin/audit-logs/bulk/permanent-delete', ids),

  // ── Recruiter Collections ─────────────────────────────────────────────────
  bulkDeleteCollections: (ids) => post('/admin/recruiter-payments/bulk/delete', ids),
  bulkRestoreCollections: (ids) => post('/admin/recruiter-payments/bulk/restore', ids),
  bulkPermanentDeleteCollections: (ids) => post('/admin/recruiter-payments/bulk/permanent-delete', ids),
};

export default bulkAdminService;
