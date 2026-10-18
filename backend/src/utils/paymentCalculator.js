const Attendance = require('../models/Attendance');
const Assignment = require('../models/Assignment');
const Job = require('../models/Job');
const { ATTENDANCE_STATUS } = require('../config/constants');

/**
 * Calculates the Recruiter-to-Admin attendance-based payable amount and eligible attendee count.
 * 
 * Eligibility conditions (all must be satisfied):
 * 1. Attendance belongs to the correct event (jobId).
 * 2. Attendance status is PRESENT.
 * 3. Attendance has been verified by Admin (verifiedByAdminId is set).
 * 4. Attendance record is active and not in Trash (isDeleted !== true).
 * 5. De-duplicated by workerId (each worker counted at most once per event).
 * 
 * Recruiter Rate & Total Calculation:
 * - Preserves the Recruiter's original submitted per-person rate (job.offeredAmountPerPerson or job.recruiterProposedPayment).
 * - Total Payable = eligibleCount * recruiterPerPersonRate.
 * - Admin worker payout rate (job.adminApprovedPayment) is NEVER used for recruiter payment calculations.
 */
async function calculateAttendancePayable(jobId) {
  const job = await Job.findById(jobId).lean();
  if (!job) {
    return { eligibleCount: 0, totalPayable: 0, eligibleWorkers: [], defaultRate: 0, perPersonRate: 0 };
  }

  // Authoritative per-person rate submitted by Recruiter
  const recruiterPerPersonRate = Number(job.offeredAmountPerPerson ?? job.recruiterProposedPayment ?? 0);

  // Preserve fixed-price contract if explicitly specified on the event
  if (job.contractType === 'FIXED' || job.isFixedPrice === true) {
    const fixedAmount = Number(job.fixedPriceAmount || job.offeredTotalAmount || job.recruiterPaymentAmount || 0);
    return {
      eligibleCount: job.workersRequired || 1,
      totalPayable: fixedAmount,
      isFixedPrice: true,
      eligibleWorkers: [],
      defaultRate: fixedAmount,
      perPersonRate: recruiterPerPersonRate || fixedAmount,
    };
  }

  // Fetch only eligible attendance records: correct event, PRESENT, verified by Admin, not deleted
  const attendances = await Attendance.find({
    jobId: job._id,
    status: ATTENDANCE_STATUS.PRESENT,
    verifiedByAdminId: { $ne: null },
    isDeleted: { $ne: true },
  }).lean();

  // De-duplicate by workerId
  const seenWorkers = new Set();
  const eligibleWorkers = [];

  for (const att of attendances) {
    const wId = att.workerId ? att.workerId.toString() : null;
    if (!wId || seenWorkers.has(wId)) {
      continue;
    }
    seenWorkers.add(wId);

    eligibleWorkers.push({
      workerId: wId,
      rate: recruiterPerPersonRate,
      attendanceId: att._id.toString(),
    });
  }

  const eligibleCount = eligibleWorkers.length;
  const totalPayable = eligibleCount * recruiterPerPersonRate;

  return {
    eligibleCount,
    totalPayable,
    eligibleWorkers,
    defaultRate: recruiterPerPersonRate,
    perPersonRate: recruiterPerPersonRate,
  };
}

/**
 * Calculates the attendance-based payable amount for workers (Admin -> Worker payouts).
 * Uses worker-specific rates or job.adminApprovedPayment.
 */
async function calculateWorkerAttendancePayable(jobId) {
  const job = await Job.findById(jobId).lean();
  if (!job) {
    return { eligibleCount: 0, totalPayable: 0, eligibleWorkers: [], defaultRate: 0 };
  }

  const attendances = await Attendance.find({
    jobId: job._id,
    status: ATTENDANCE_STATUS.PRESENT,
    verifiedByAdminId: { $ne: null },
    isDeleted: { $ne: true },
  }).lean();

  const assignments = await Assignment.find({
    jobId: job._id,
    isDeleted: { $ne: true },
  }).lean();

  const assignmentByWorker = new Map();
  for (const asg of assignments) {
    if (asg.workerId) {
      assignmentByWorker.set(asg.workerId.toString(), asg);
    }
  }

  const seenWorkers = new Set();
  const eligibleWorkers = [];
  let totalPayable = 0;

  for (const att of attendances) {
    const wId = att.workerId ? att.workerId.toString() : null;
    if (!wId || seenWorkers.has(wId)) {
      continue;
    }
    seenWorkers.add(wId);

    const asg = assignmentByWorker.get(wId);
    let workerRate = 0;

    if (asg?.paymentSettlement?.amount != null && !isNaN(asg.paymentSettlement.amount) && asg.paymentSettlement.amount > 0) {
      workerRate = Number(asg.paymentSettlement.amount);
    } else if (job.adminApprovedPayment != null && !isNaN(job.adminApprovedPayment) && job.adminApprovedPayment > 0) {
      workerRate = Number(job.adminApprovedPayment);
    } else if (job.offeredAmountPerPerson != null && !isNaN(job.offeredAmountPerPerson) && job.offeredAmountPerPerson > 0) {
      workerRate = Number(job.offeredAmountPerPerson);
    } else if (job.recruiterProposedPayment != null && !isNaN(job.recruiterProposedPayment) && job.recruiterProposedPayment > 0) {
      workerRate = Number(job.recruiterProposedPayment);
    }

    totalPayable += workerRate;
    eligibleWorkers.push({
      workerId: wId,
      rate: workerRate,
      attendanceId: att._id.toString(),
    });
  }

  const defaultRate = Number(job.adminApprovedPayment || job.offeredAmountPerPerson || job.recruiterProposedPayment || 0);

  return {
    eligibleCount: eligibleWorkers.length,
    totalPayable,
    eligibleWorkers,
    defaultRate,
  };
}

module.exports = {
  calculateAttendancePayable,
  calculateRecruiterAttendancePayable: calculateAttendancePayable,
  calculateWorkerAttendancePayable,
};
