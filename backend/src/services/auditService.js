const AuditLog = require('../models/AuditLog');

const logAuditEvent = async ({
  performedByUserId,
  performedByRole,
  action,
  entityName,
  entityId,
  previousValue = null,
  newValue = null,
  notes = '',
  subjectName = '',
  subjectRole = '',
}) => {
  try {
    const auditLog = await AuditLog.create({
      performedByUserId,
      performedByRole,
      action,
      entityName,
      entityId,
      previousValue,
      newValue,
      notes,
      subjectName,
      subjectRole,
    });
    return auditLog;
  } catch (error) {
    console.error('Failed to create audit log:', error.message);
  }
};


module.exports = {
  logAuditEvent,
};
