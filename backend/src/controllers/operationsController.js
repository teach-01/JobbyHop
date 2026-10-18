const Job = require('../models/Job');
const Application = require('../models/Application');
const Assignment = require('../models/Assignment');
const Attendance = require('../models/Attendance');
const Payment = require('../models/Payment');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const WorkerProfile = require('../models/WorkerProfile');
const { createNotification } = require('../services/notificationService');
const { logAuditEvent } = require('../services/auditService');
const { JOB_STATUS, ASSIGNMENT_STATUS, ATTENDANCE_STATUS, PAYMENT_STATUS, ROLES } = require('../config/constants');

exports.getDashboardStats = async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pendingAttendance = await Attendance.countDocuments({ status: ATTENDANCE_STATUS.PENDING });
    const pendingEvents = await Assignment.countDocuments({ status: ASSIGNMENT_STATUS.ASSIGNED });
    const pendingPayments = await Payment.countDocuments({ status: PAYMENT_STATUS.PENDING, isDeleted: { $ne: true } });

    res.json({
      success: true,
      stats: {
        pendingAttendance,
        pendingEvents,
        pendingPayments
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAttendanceList = async (req, res, next) => {
  try {
    const attendance = await Attendance.find()
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone')
      .sort({ date: -1 })
      .limit(50);
    res.json({ success: true, attendance });
  } catch (error) {
    next(error);
  }
};

exports.updateAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, checkInTime, checkOutTime, notes } = req.body;

    const record = await Attendance.findById(id);
    if (!record) return res.status(404).json({ success: false, message: 'Attendance record not found' });

    if (record.verifiedByAdminId && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Attendance verified by Admin — editing is locked.' });
    }

    const previousValue = record.status;
    record.status = status;
    if (checkInTime) record.checkInTime = checkInTime;
    if (checkOutTime) record.checkOutTime = checkOutTime;
    if (notes !== undefined) record.notes = notes;

    await record.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: req.user.role,
      action: 'UPDATE_ATTENDANCE',
      entityName: 'Attendance',
      entityId: record._id,
      previousValue,
      newValue: status,
      notes: `${req.user.role} marked attendance as ${status}`,
    });

    res.json({ success: true, message: 'Attendance updated successfully', record });
  } catch (error) {
    next(error);
  }
};

exports.getEvents = async (req, res, next) => {
  try {
    const assignments = await Assignment.find()
      .populate('jobId', 'title eventType eventDate location status adminApprovedPayment')
      .populate('workerId', 'email phone')
      .sort({ assignedAt: -1 })
      .limit(50);
    res.json({ success: true, assignments });
  } catch (error) {
    next(error);
  }
};

exports.completeEvent = async (req, res, next) => {
  try {
    const { id } = req.params; // assignment ID
    const { notes } = req.body;

    const assignment = await Assignment.findById(id).populate('jobId');
    if (!assignment) return res.status(404).json({ success: false, message: 'Assignment not found' });

    if (assignment.verifiedByAdminId && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Event completion verified by Admin — editing is locked.' });
    }

    const previousValue = assignment.status;
    assignment.status = ASSIGNMENT_STATUS.COMPLETED;
    if (notes !== undefined) assignment.notes = notes;
    await assignment.save();

    // Trigger payment creation logic if needed
    let payment = await Payment.findOne({ assignmentId: assignment._id });
    if (!payment) {
        const expectedDate = new Date();
        expectedDate.setDate(expectedDate.getDate() + 12);
        payment = await Payment.create({
            assignmentId: assignment._id,
            jobId: assignment.jobId._id,
            workerId: assignment.workerId,
            amount: assignment.jobId.adminApprovedPayment,
            status: PAYMENT_STATUS.PENDING,
            expectedPaymentDate: expectedDate,
            paymentTimelineText: 'Payout processing scheduled within 10–15 days after event completion.',
        });
    }

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: req.user.role,
      action: 'COMPLETE_EVENT',
      entityName: 'Assignment',
      entityId: assignment._id,
      previousValue,
      newValue: ASSIGNMENT_STATUS.COMPLETED,
      notes: `${req.user.role} marked assignment as COMPLETED`,
    });

    res.json({ success: true, message: 'Event marked as completed', assignment });
  } catch (error) {
    next(error);
  }
};

exports.getPayments = async (req, res, next) => {
  try {
    const payments = await Payment.find({ isDeleted: { $ne: true } })
      .populate('jobId', 'title eventType eventDate location')
      .populate('workerId', 'email phone')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, payments });
  } catch (error) {
    next(error);
  }
};

exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, transactionRef } = req.body;

    const payment = await Payment.findById(id).populate('jobId');
    if (!payment) return res.status(404).json({ success: false, message: 'Payment record not found' });

    if (payment.isDeleted) {
      return res.status(400).json({ success: false, message: 'Cannot update a trashed payment. Restore it first.' });
    }

    if (payment.verifiedByAdminId && req.user.role !== ROLES.ADMIN) {
      return res.status(403).json({ success: false, message: 'Payment verified by Admin — editing is locked.' });
    }

    const previousStatus = payment.status;
    payment.status = status;
    if (transactionRef) payment.transactionRef = transactionRef;
    
    if (status === PAYMENT_STATUS.PROCESSING) {
        payment.processedAt = new Date();
    } else if (status === PAYMENT_STATUS.PAID) {
        payment.paidAt = new Date();
    }

    await payment.save();

    await logAuditEvent({
      performedByUserId: req.user._id,
      performedByRole: req.user.role,
      action: 'UPDATE_PAYMENT_STATUS',
      entityName: 'Payment',
      entityId: payment._id,
      previousValue: previousStatus,
      newValue: status,
      notes: `${req.user.role} changed payment status to ${status}. Ref: ${transactionRef || 'N/A'}`,
    });

    res.json({ success: true, message: `Payment status updated to ${status}`, payment });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find({ type: { $in: ['ATTENDANCE_UPDATED', 'EVENT_COMPLETED', 'PAYMENT_PAID', 'PAYMENT_PROCESSING'] } })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (error) {
    next(error);
  }
};

exports.getAuditHistory = async (req, res, next) => {
  try {
    const logs = await AuditLog.find()
      .populate('performedByUserId', 'email role')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, logs });
  } catch (error) {
    next(error);
  }
};
