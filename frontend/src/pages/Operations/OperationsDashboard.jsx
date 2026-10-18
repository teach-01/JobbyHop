import React, { useState, useEffect } from 'react';
import operationsService from '../../services/operationsService';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import { LayoutDashboard, CalendarCheck, CreditCard, Layers } from 'lucide-react';

export const OperationsDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await operationsService.getDashboardStats();
        if (res.success) setStats(res.stats);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <LoadingSpinner label="Loading Operations Dashboard..." />;

  return (
    <div className="space-y-8 pb-12">
      <div>
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <LayoutDashboard className="w-8 h-8 text-brand-500" />
          Operations Dashboard
        </h1>
        <p className="mt-2 text-slate-400">Overview of pending tasks and operational metrics.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-3xl border border-brand-500/30 flex flex-col items-center text-center">
          <CalendarCheck className="w-10 h-10 text-brand-400 mb-3" />
          <h3 className="text-4xl font-black text-white">{stats?.pendingAttendance || 0}</h3>
          <p className="text-sm font-semibold text-brand-200 mt-1 uppercase tracking-wider">Pending Attendance</p>
        </div>
        
        <div className="glass-card p-6 rounded-3xl border border-purple-500/30 flex flex-col items-center text-center">
          <Layers className="w-10 h-10 text-purple-400 mb-3" />
          <h3 className="text-4xl font-black text-white">{stats?.pendingEvents || 0}</h3>
          <p className="text-sm font-semibold text-purple-200 mt-1 uppercase tracking-wider">Pending Events</p>
        </div>
        
        <div className="glass-card p-6 rounded-3xl border border-emerald-500/30 flex flex-col items-center text-center">
          <CreditCard className="w-10 h-10 text-emerald-400 mb-3" />
          <h3 className="text-4xl font-black text-white">{stats?.pendingPayments || 0}</h3>
          <p className="text-sm font-semibold text-emerald-200 mt-1 uppercase tracking-wider">Pending Payments</p>
        </div>
      </div>
    </div>
  );
};

export default OperationsDashboard;
