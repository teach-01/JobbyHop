import React, { useState, useEffect } from 'react';
import Modal from '../common/Modal';
import { CalendarCheck, AlertTriangle, Clock } from 'lucide-react';
import { parseTo24HourTime, formatDisplayTime, TIME_24H_REGEX } from '../../utils/timeFormatters';

export const AttendanceModal = ({ isOpen, onClose, attendanceRecord, onSubmitAttendance }) => {
  const [formData, setFormData] = useState({
    status: 'PENDING',
    checkInTime: '',
    checkOutTime: '',
    isOvernightShift: false,
    notes: '',
  });

  const [checkInInvalidLegacy, setCheckInInvalidLegacy] = useState(null);
  const [checkOutInvalidLegacy, setCheckOutInvalidLegacy] = useState(null);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (attendanceRecord) {
      const parsedIn = parseTo24HourTime(attendanceRecord.checkInTime);
      const parsedOut = parseTo24HourTime(attendanceRecord.checkOutTime);

      setFormData({
        status: attendanceRecord.status || 'PENDING',
        checkInTime: parsedIn === null ? '' : parsedIn,
        checkOutTime: parsedOut === null ? '' : parsedOut,
        isOvernightShift: Boolean(attendanceRecord.isOvernightShift),
        notes: attendanceRecord.notes || '',
      });

      setCheckInInvalidLegacy(parsedIn === null ? attendanceRecord.checkInTime : null);
      setCheckOutInvalidLegacy(parsedOut === null ? attendanceRecord.checkOutTime : null);
      setValidationError('');
    }
  }, [attendanceRecord]);

  if (!attendanceRecord) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setValidationError('');

    const inTime = formData.checkInTime?.trim();
    const outTime = formData.checkOutTime?.trim();

    // Validate 24-hour time format if entered
    if (inTime && !TIME_24H_REGEX.test(inTime)) {
      setValidationError('Check-in time must be a valid time in HH:mm format.');
      return;
    }

    if (outTime && !TIME_24H_REGEX.test(outTime)) {
      setValidationError('Check-out time must be a valid time in HH:mm format.');
      return;
    }

    // Chronological validation for same-day shifts
    if (inTime && outTime && !formData.isOvernightShift) {
      if (outTime <= inTime) {
        setValidationError('Check-out time must be later than check-in time for same-day shifts. If the shift crosses midnight, please check "Overnight shift".');
        return;
      }
    }

    onSubmitAttendance(attendanceRecord._id, {
      status: formData.status,
      checkInTime: inTime || '',
      checkOutTime: outTime || '',
      isOvernightShift: Boolean(formData.isOvernightShift),
      notes: formData.notes?.trim() || '',
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Mark / Edit Worker Attendance">
      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Worker & Event header */}
        <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
          <div>
            <p className="text-slate-400">Worker</p>
            <p className="font-bold text-white text-sm">{attendanceRecord.workerProfile?.fullName || 'Worker'}</p>
            <p className="text-[10px] text-slate-500">{attendanceRecord.workerId?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-slate-400">Event</p>
            <p className="font-bold text-white text-sm">{attendanceRecord.jobTitle || attendanceRecord.jobId?.title || 'Job Event'}</p>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Status Dropdown */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Attendance Status</label>
          <select
            value={formData.status}
            onChange={(e) => {
              setFormData({ ...formData, status: e.target.value });
              setValidationError('');
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
          >
            <option value="PENDING">PENDING</option>
            <option value="PRESENT">PRESENT</option>
            <option value="ABSENT">ABSENT</option>
            <option value="LATE">LATE</option>
            <option value="EXCUSED">EXCUSED</option>
          </select>
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Check-in Time
            </label>
            <input
              type="time"
              value={formData.checkInTime}
              onChange={(e) => {
                setFormData({ ...formData, checkInTime: e.target.value });
                setValidationError('');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            />
            {formData.checkInTime && (
              <p className="text-[10px] text-slate-400 mt-1">
                Display: <span className="text-emerald-400 font-bold">{formatDisplayTime(formData.checkInTime).label}</span>
              </p>
            )}
            {checkInInvalidLegacy && (
              <p className="text-[10px] text-amber-400 mt-1.5 flex items-start gap-1 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Previously invalid value: <strong>"{checkInInvalidLegacy}"</strong>. Please select a valid time.</span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              Check-out Time
            </label>
            <input
              type="time"
              value={formData.checkOutTime}
              onChange={(e) => {
                setFormData({ ...formData, checkOutTime: e.target.value });
                setValidationError('');
              }}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            />
            {formData.checkOutTime && (
              <p className="text-[10px] text-slate-400 mt-1">
                Display: <span className="text-purple-400 font-bold">{formatDisplayTime(formData.checkOutTime).label}</span>
              </p>
            )}
            {checkOutInvalidLegacy && (
              <p className="text-[10px] text-amber-400 mt-1.5 flex items-start gap-1 bg-amber-500/10 border border-amber-500/20 p-1.5 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>Previously invalid value: <strong>"{checkOutInvalidLegacy}"</strong>. Please select a valid time.</span>
              </p>
            )}
          </div>
        </div>

        {/* Overnight Shift Toggle */}
        <div className="flex items-center gap-2 pt-1 pb-1">
          <input
            type="checkbox"
            id="isOvernightShift"
            checked={formData.isOvernightShift}
            onChange={(e) => {
              setFormData({ ...formData, isOvernightShift: e.target.checked });
              setValidationError('');
            }}
            className="rounded border-slate-700 bg-slate-900 text-brand-500 focus:ring-0 cursor-pointer"
          />
          <label htmlFor="isOvernightShift" className="text-slate-300 text-xs cursor-pointer select-none">
            Overnight Shift (ends on the next calendar day)
          </label>
        </div>

        {/* Admin Notes */}
        <div>
          <label className="block text-slate-300 font-semibold mb-1">Admin Verification Notes</label>
          <textarea
            rows="2"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500"
            placeholder="Add notes about punctuality or shift performance..."
          />
        </div>

        {/* Action Buttons */}
        <div className="pt-4 border-t border-slate-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-slate-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="gradient-btn px-5 py-2 rounded-xl font-bold flex items-center gap-1.5"
          >
            <CalendarCheck className="w-4 h-4" /> Save Attendance
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AttendanceModal;
