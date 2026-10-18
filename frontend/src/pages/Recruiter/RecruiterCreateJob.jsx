import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { jobService } from '../../services/jobService';
import LocationSearchInput from '../../components/common/LocationSearchInput';
import { ShieldAlert, ArrowRight, IndianRupee, Calendar, Clock, Users } from 'lucide-react';

export const RecruiterCreateJob = () => {
  const { user } = useAuth();
  const { showToast } = useNotifications();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    eventType: 'Wedding',
    eventDate: '',
    startTime: '10:00',
    endTime: '18:00',
    location: '',
    latitude: null,
    longitude: null,
    workersRequired: 2,
    requiredSkills: '',
    workerRequirements: '',
    responsibilities: '',
    proposedPayment: 1500,
    additionalInstructions: '',
  });

  const eventTypes = [
    'Wedding',
    'Corporate Function',
    'Concert',
    'College Fest',
    'Birthday',
    'Exhibition',
    'Private Event',
    'Other',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.location || !formData.location.trim()) {
      showToast('Please enter an event location / venue.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await jobService.createJob(formData, user);
      if (res.success) {
        showToast('Event submitted successfully! Status set to Pending Admin Review.', 'success');
        navigate('/recruiter/submitted-events');
      } else {
        showToast(res.message || 'Failed to submit job request.', 'error');
      }
    } catch (err) {
      showToast(err.message || 'An error occurred', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Mandatory Admin Review Notice */}
      <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-amber-300">Mandatory Admin Review Requirement:</p>
          <p className="text-[11px] text-amber-200/90 mt-0.5">
            Your job request will be reviewed by JobbyHop Admin before it becomes available to workers. Admin may standardize or adjust the final approved payment rate prior to publishing.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6 text-xs">
        {/* Basic Details */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">1. Event Overview</h3>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Job / Event Title *</label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
              placeholder="e.g. Luxury Royal Wedding Hospitality Hostesses"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Type *</label>
              <select
                value={formData.eventType}
                onChange={(e) => setFormData({ ...formData, eventType: e.target.value })}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              >
                {eventTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">Event Location / Venue *</label>
              <LocationSearchInput 
                location={formData.location}
                latitude={formData.latitude}
                longitude={formData.longitude}
                onChange={({ location, latitude, longitude }) => 
                  setFormData({ ...formData, location, latitude, longitude })
                }
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Detailed Event Description *</label>
            <textarea
              required
              rows="3"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:border-brand-500 outline-none"
              placeholder="Describe event atmosphere, guest profile, and overview..."
            />
          </div>
        </div>

        {/* Date, Time & Logistics */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">2. Timing & Headcount</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Event Date *</label>
              <div className="relative">
                <Calendar className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="date"
                  required
                  value={formData.eventDate}
                  onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Start Time *</label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="time"
                  required
                  value={formData.startTime}
                  onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">End Time *</label>
              <div className="relative">
                <Clock className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="time"
                  required
                  value={formData.endTime}
                  onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Number of Workers Required *</label>
              <div className="relative">
                <Users className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.workersRequired}
                  onChange={(e) => setFormData({ ...formData, workersRequired: Number(e.target.value) })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-3 py-2.5 text-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-purple-400 mb-1">Proposed Payment per Worker (₹) *</label>
              <div className="relative">
                <IndianRupee className="w-4 h-4 text-purple-400 absolute left-3 top-3" />
                <input
                  type="number"
                  min="500"
                  required
                  value={formData.proposedPayment}
                  onChange={(e) => setFormData({ ...formData, proposedPayment: Number(e.target.value) })}
                  className="w-full bg-slate-950 border-2 border-purple-500/50 rounded-xl pl-10 pr-3 py-2.5 text-purple-300 font-bold"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Requirements & Skills */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">3. Requirements & Responsibilities</h3>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Required Skills (Comma separated)</label>
            <input
              type="text"
              value={formData.requiredSkills}
              onChange={(e) => setFormData({ ...formData, requiredSkills: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              placeholder="e.g. VIP Hospitality, Ushering, English & Hindi Fluency"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Dress Code & Worker Requirements</label>
            <input
              type="text"
              value={formData.workerRequirements}
              onChange={(e) => setFormData({ ...formData, workerRequirements: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              placeholder="e.g. Formal black suit, neat hairstyle, punctuality required"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Additional Instructions for Admin</label>
            <textarea
              rows="2"
              value={formData.additionalInstructions}
              onChange={(e) => setFormData({ ...formData, additionalInstructions: e.target.value })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white"
              placeholder="Special instructions or notes for Admin reviewer..."
            />
          </div>
        </div>

        {/* Submit Action */}
        <div className="pt-6 border-t border-slate-800 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/recruiter/dashboard')}
            className="px-5 py-2.5 rounded-xl text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="gradient-btn px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-2"
          >
            {loading ? 'Submitting...' : 'Submit Job for Admin Review'}{' '}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
};

export default RecruiterCreateJob;
