import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import userService from '../../services/userService';
import { Calendar, Clock, Plus, Trash2, Save, CheckCircle2, Shield } from 'lucide-react';

export const WorkerAvailability = () => {
  const { user, updateUserProfile } = useAuth();
  const { showToast } = useNotifications();
  const [loading, setLoading] = useState(false);

  const [isAvailable, setIsAvailable] = useState(user?.profile?.availability?.isAvailable ?? true);
  const [availableDates, setAvailableDates] = useState(user?.profile?.availability?.availableDates || []);
  const [unavailableDates, setUnavailableDates] = useState(user?.profile?.availability?.unavailableDates || []);
  const [newAvailDate, setNewAvailDate] = useState('');
  const [newUnavailDate, setNewUnavailDate] = useState('');
  const [skills, setSkills] = useState(user?.profile?.skills || []);
  const [newSkill, setNewSkill] = useState('');

  const addAvailableDate = () => {
    if (newAvailDate && !availableDates.includes(newAvailDate)) {
      setAvailableDates([...availableDates, newAvailDate]);
      setNewAvailDate('');
    }
  };

  const removeAvailableDate = (date) => {
    setAvailableDates(availableDates.filter((d) => d !== date));
  };

  const addUnavailableDate = () => {
    if (newUnavailDate && !unavailableDates.includes(newUnavailDate)) {
      setUnavailableDates([...unavailableDates, newUnavailDate]);
      setNewUnavailDate('');
    }
  };

  const removeUnavailableDate = (date) => {
    setUnavailableDates(unavailableDates.filter((d) => d !== date));
  };

  const addSkill = () => {
    if (newSkill.trim() && !skills.includes(newSkill.trim())) {
      setSkills([...skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove) => {
    setSkills(skills.filter((s) => s !== skillToRemove));
  };

  const handleSave = async () => {
    setLoading(true);
    const availabilityData = {
      isAvailable,
      availableDates,
      unavailableDates,
      availableTimeSlots: user?.profile?.availability?.availableTimeSlots || ['09:00 - 17:00'],
    };

    try {
      const res = await userService.updateWorkerAvailability(user._id, availabilityData);
      if (res.success) {
        // Also update skills
        await userService.updateWorkerProfile(user._id, { skills });
        updateUserProfile({ availability: availabilityData, skills });
        showToast('Availability & skills schedule saved successfully!', 'success');
      }
    } catch (err) {
      showToast('Failed to save availability', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 text-xs">
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-white">Availability & Calendar Management</h1>
          <p className="text-xs text-slate-400">Keep your shift availability updated for Admin assignment view.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={loading}
          className="gradient-btn px-6 py-2.5 rounded-xl font-bold flex items-center gap-2"
        >
          <Save className="w-4 h-4" /> Save Schedule
        </button>
      </div>

      {/* Global Status Toggle */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-white">Overall Shift Availability</h3>
          <p className="text-xs text-slate-400">Toggle whether Admin can consider you for upcoming event shifts.</p>
        </div>
        <button
          type="button"
          onClick={() => setIsAvailable(!isAvailable)}
          className={`px-4 py-2 rounded-xl font-bold transition-all ${
            isAvailable
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
          }`}
        >
          {isAvailable ? '✓ Ready for Shift Assignments' : '✕ Currently Unavailable'}
        </button>
      </div>

      {/* Date Picker Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Available Dates */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-emerald-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Specific Available Dates
          </h3>

          <div className="flex gap-2">
            <input
              type="date"
              value={newAvailDate}
              onChange={(e) => setNewAvailDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <button
              type="button"
              onClick={addAvailableDate}
              className="gradient-btn px-3 py-2 rounded-xl font-bold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {availableDates.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No specific available dates added.</p>
            ) : (
              availableDates.map((date) => (
                <div key={date} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-semibold text-slate-200">{date}</span>
                  <button onClick={() => removeAvailableDate(date)} className="text-rose-400 hover:text-rose-300">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Unavailable Blockout Dates */}
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
          <h3 className="text-sm font-bold text-rose-400 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Blockout / Unavailable Dates
          </h3>

          <div className="flex gap-2">
            <input
              type="date"
              value={newUnavailDate}
              onChange={(e) => setNewUnavailDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            />
            <button
              type="button"
              onClick={addUnavailableDate}
              className="px-3 py-2 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 font-bold flex items-center gap-1 shrink-0"
            >
              <Plus className="w-4 h-4" /> Block
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto">
            {unavailableDates.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No blockout dates set.</p>
            ) : (
              unavailableDates.map((date) => (
                <div key={date} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="font-semibold text-rose-300">{date}</span>
                  <button onClick={() => removeUnavailableDate(date)} className="text-slate-400 hover:text-white">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Skills Editor */}
      <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4">
        <h3 className="text-sm font-bold text-white">Event Skills & Badges</h3>

        <div className="flex gap-2">
          <input
            type="text"
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
            placeholder="Add new skill (e.g. VIP Concierge, Ticket Scanner, Anchor)..."
          />
          <button
            type="button"
            onClick={addSkill}
            className="gradient-btn px-4 py-2 rounded-xl font-bold flex items-center gap-1 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Skill
          </button>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {skills.map((s) => (
            <span key={s} className="px-3 py-1.5 rounded-xl bg-brand-500/20 text-brand-300 border border-brand-500/30 flex items-center gap-2 font-semibold">
              {s}
              <button onClick={() => removeSkill(s)} className="text-slate-400 hover:text-rose-400">
                ×
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkerAvailability;
