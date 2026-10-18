import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CheckCircle,
  FileText,
  UserCheck,
  CalendarCheck,
  CreditCard,
  WalletCards,
  Bell,
  History,
  Settings,
  PlusCircle,
  Award,
  Layers,
  IndianRupee,
} from 'lucide-react';

export const Sidebar = () => {
  const { isAdmin, isRecruiter, isWorker, isOperations, user } = useAuth();

  const adminLinks = [
    { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/admin/recruiters', label: 'Recruiters', icon: Users },
    { to: '/admin/workers', label: 'Workers', icon: UserCheck },
    { to: '/admin/job-requests', label: 'Job Requests Queue', icon: Briefcase },
    { to: '/admin/applications', label: 'Applications', icon: FileText },
    { to: '/admin/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/admin/events', label: 'Events & Completion', icon: Layers },
    { to: '/admin/payments', label: 'Payments (10-15d)', icon: CreditCard },
    { to: '/admin/recruiter-collections', label: 'Recruiter Collections', icon: WalletCards },
    { to: '/admin/audit-logs', label: 'Audit History', icon: History },
    { to: '/admin/notifications', label: 'Notifications', icon: Bell },
    { to: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const recruiterLinks = [
    { to: '/recruiter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/recruiter/create-job', label: 'Create Job / Event', icon: PlusCircle },
    { to: '/recruiter/submitted-events', label: 'My Submitted Events', icon: Briefcase },
    { to: '/recruiter/profile', label: 'Company Profile', icon: Settings },
    { to: '/recruiter/payments', label: 'Recruiter Payments', icon: WalletCards },
    { to: '/recruiter/notifications', label: 'Notifications', icon: Bell },
  ];

  const workerLinks = [
    { to: '/worker/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/worker/available-jobs', label: 'Available Jobs', icon: Briefcase },
    { to: '/worker/applications', label: 'My Applications', icon: FileText },
    { to: '/worker/assignments', label: 'My Assignments', icon: CheckCircle },
    { to: '/worker/attendance', label: 'My Attendance', icon: CalendarCheck },
    { to: '/worker/payments', label: 'My Payments (10–15d)', icon: CreditCard },
    { to: '/worker/profile', label: 'My Profile', icon: Award },
    { to: '/worker/notifications', label: 'Notifications', icon: Bell },
  ];

  const operationsLinks = [
    { to: '/operations/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/operations/attendance', label: 'Attendance', icon: CalendarCheck },
    { to: '/operations/events', label: 'Events & Completion', icon: Layers },
    { to: '/operations/payments', label: 'Payments', icon: CreditCard },
    { to: '/operations/notifications', label: 'Notifications', icon: Bell },
    { to: '/operations/audit', label: 'Audit History', icon: History },
  ];

  const links = isAdmin ? adminLinks : isOperations ? operationsLinks : isRecruiter ? recruiterLinks : workerLinks;

  return (
    <aside className="hidden md:flex w-64 shrink-0 bg-slate-900/90 border-r border-slate-800 min-h-[calc(100vh-4rem)] p-4 flex-col justify-between">
      <div className="space-y-6">
        {/* User Role Badge */}
        <div className="px-3 py-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/40 text-brand-400 font-bold flex items-center justify-center text-sm">
            {user?.email?.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <p className="text-xs font-bold text-white truncate">{user?.profile?.fullName || user?.profile?.companyName || user?.email}</p>
            <span className="inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-brand-500/20 text-brand-300">
              {user?.role}
            </span>
          </div>
        </div>

        {/* Sidebar Nav Items */}
        <nav className="space-y-1">
          {links.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 ${
                    isActive
                      ? 'bg-gradient-to-r from-brand-600 to-purple-600 text-white shadow-md shadow-brand-900/40'
                      : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Admin Central Controller Notice */}
      <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-[11px] text-slate-400">
        <p className="font-semibold text-slate-300">Admin Mediation Protocol</p>
        <p className="mt-1 text-slate-500 leading-tight">
          All job posts, worker applications, and payouts (10–15d) are processed strictly via Admin.
        </p>
      </div>
    </aside>
  );
};

export default Sidebar;
