import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import jobService from '../../services/jobService';
import JobCard from '../../components/jobs/JobCard';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import EmptyState from '../../components/common/EmptyState';
import { Search, Filter, X, ShieldCheck } from 'lucide-react';
import { getLocationString } from '../../utils/locationHelper';

export const WorkerAvailableJobs = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [selectedEventType, setSelectedEventType] = useState('ALL');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [minPayment, setMinPayment] = useState('');
  const [showFilterDrawer, setShowFilterDrawer] = useState(false);

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const workerId = user?._id || localStorage.getItem('jobbyhop_user_id');
        const res = await jobService.getAvailableJobsForWorker(workerId);
        if (res && res.success) {
          setJobs(res.data || []);
        }
      } catch (err) {
        console.error('Error fetching available jobs for worker:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [user?._id]);

  if (loading) return <LoadingSpinner label="Fetching verified event jobs..." />;

  const filteredJobs = jobs.filter((job) => {
    if (!job) return false;
    // Display only jobs/events that satisfy Admin approval and activation requirements
    if (job.status !== 'APPROVED') return false;
    const titleStr = (job.title || '').toLowerCase();
    const descStr = (job.description || '').toLowerCase();
    const locStr = getLocationString(job.location).toLowerCase();

    // Keyword match
    if (
      keyword &&
      !titleStr.includes(keyword.toLowerCase()) &&
      !descStr.includes(keyword.toLowerCase()) &&
      !locStr.includes(keyword.toLowerCase())
    ) {
      return false;
    }
    // Event Type
    if (selectedEventType !== 'ALL' && job.eventType !== selectedEventType) {
      return false;
    }
    // Location
    if (selectedLocation && !locStr.includes(selectedLocation.toLowerCase())) {
      return false;
    }
    // Min Payment
    if (minPayment && (job.adminApprovedPayment || 0) < Number(minPayment)) {
      return false;
    }
    return true;
  });

  const clearFilters = () => {
    setKeyword('');
    setSelectedEventType('ALL');
    setSelectedLocation('');
    setMinPayment('');
  };

  const eventTypes = ['ALL', 'Wedding', 'Corporate Function', 'Concert', 'College Fest', 'Birthday', 'Exhibition', 'Private Event', 'Other'];

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="glass-card p-6 rounded-3xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h1 className="text-2xl font-extrabold text-white">Available Verified Jobs</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            All jobs displayed are pre-approved by JobbyHop Admin with verified payout guarantees.
          </p>
        </div>

        <button
          onClick={() => setShowFilterDrawer(!showFilterDrawer)}
          className="px-4 py-2.5 rounded-xl border border-slate-700 bg-slate-900 text-xs font-bold text-slate-200 flex items-center gap-2 hover:bg-slate-800"
        >
          <Filter className="w-4 h-4 text-brand-400" /> Filter Jobs
        </button>
      </div>

      {/* Search Bar & Quick Event Pills */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-4 top-3.5" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl pl-11 pr-4 py-3 text-xs text-white placeholder-slate-500 focus:border-brand-500 outline-none"
            placeholder="Search by job title, location, or skills (e.g. VIP Hostess, Bandra)..."
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {eventTypes.map((type) => (
            <button
              key={type}
              onClick={() => setSelectedEventType(type)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition-all ${
                selectedEventType === type
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {/* Drawer / Filter Panel */}
      {showFilterDrawer && (
        <div className="glass-card p-6 rounded-2xl border border-slate-800 space-y-4 animate-in fade-in duration-200 text-xs">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="font-bold text-white">Advanced Search Filters</h3>
            <button onClick={clearFilters} className="text-brand-400 hover:underline">
              Clear All Filters
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 font-medium mb-1">Location Filter</label>
              <input
                type="text"
                value={selectedLocation}
                onChange={(e) => setSelectedLocation(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                placeholder="City or Area (e.g. Mumbai, Delhi)"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-medium mb-1">Minimum Payment (₹)</label>
              <input
                type="number"
                value={minPayment}
                onChange={(e) => setMinPayment(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white"
                placeholder="e.g. 1500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Job Grid */}
      {filteredJobs.length === 0 ? (
        <EmptyState
          title="No Available Jobs Found"
          description="Try broadening your search keywords or clearing filters."
          actionText="Reset Filters"
          onAction={clearFilters}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredJobs.map((job) => (
            <JobCard
              key={job._id}
              job={job}
              isWorker={true}
              onViewDetails={() => navigate(`/worker/jobs/${job._id}`)}
              onApply={() => navigate(`/worker/jobs/${job._id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkerAvailableJobs;
