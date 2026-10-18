import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useNotifications } from '../../context/NotificationContext';
import { Sparkles, Bell, User, LogOut, Menu, X, Shield, Briefcase, Calendar } from 'lucide-react';

export const Navbar = () => {
  const { user, logout, isAdmin, isRecruiter, isWorker, isOperations } = useAuth();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getDashboardPath = () => {
    if (isAdmin) return '/admin/dashboard';
    if (isRecruiter) return '/recruiter/dashboard';
    if (isOperations) return '/operations/dashboard';
    if (isWorker) return '/worker/dashboard';
    return '/';
  };

  return (
    <nav className="sticky top-0 z-40 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-brand-600 via-purple-600 to-indigo-600 text-white shadow-lg shadow-brand-600/30 group-hover:scale-105 transition-transform duration-300">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              JOBBY<span className="gradient-text">HOP</span>
            </span>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-6 text-sm font-medium">
            <Link to="/" className="text-slate-300 hover:text-white transition-colors">
              Home
            </Link>
            <Link to="/about" className="text-slate-300 hover:text-white transition-colors">
              About
            </Link>
            <Link to="/how-it-works" className="text-slate-300 hover:text-white transition-colors">
              How It Works
            </Link>
            <Link to="/contact" className="text-slate-300 hover:text-white transition-colors">
              Contact
            </Link>
          </div>

          {/* User Auth Action Cluster */}
          <div className="hidden md:flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-3">
                <Link
                  to={getDashboardPath()}
                  className="gradient-btn px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                >
                  {isAdmin && <Shield className="w-3.5 h-3.5" />}
                  {isRecruiter && <Briefcase className="w-3.5 h-3.5" />}
                  {isWorker && <Calendar className="w-3.5 h-3.5" />}
                  Dashboard
                </Link>

                {/* Notifications Bell Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 relative transition-colors"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center border-2 border-slate-950">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                      <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-950/50">
                        <h4 className="text-sm font-bold text-white">In-App Notifications</h4>
                        {unreadCount > 0 && (
                          <button
                            onClick={markAllAsRead}
                            className="text-xs font-medium text-brand-400 hover:text-brand-300"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/50">
                        {notifications.length === 0 ? (
                          <p className="p-6 text-center text-xs text-slate-400">No notifications yet.</p>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n._id}
                              onClick={() => markAsRead(n._id)}
                              className={`p-4 text-xs cursor-pointer hover:bg-slate-800/50 transition-colors ${
                                !n.isRead ? 'bg-brand-950/20' : ''
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="font-semibold text-slate-200">{n.title}</p>
                                <span className="text-[10px] text-slate-500">
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-slate-400 mt-1">{n.message}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Menu */}
                <button
                  onClick={handleLogout}
                  title="Logout"
                  className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 hover:border-rose-900/50 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Link
                  to="/login/worker"
                  className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Worker Login
                </Link>
                <Link
                  to="/login/recruiter"
                  className="px-3 py-2 text-sm font-medium text-slate-300 hover:text-white transition-colors"
                >
                  Recruiter Login
                </Link>
                <Link
                  to="/register/worker"
                  className="gradient-btn px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Join as Worker
                </Link>
                <Link
                  to="/register/recruiter"
                  className="px-4 py-2 rounded-xl border border-brand-500/40 bg-brand-500/10 text-brand-300 hover:bg-brand-500/20 text-xs font-bold uppercase tracking-wider transition-all"
                >
                  Hire Staff
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl bg-slate-900 text-slate-300 hover:text-white"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-slate-800 bg-slate-950 p-4 space-y-3 max-h-[85vh] overflow-y-auto">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 hover:text-white py-1"
          >
            Home
          </Link>
          <Link
            to="/about"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 hover:text-white py-1"
          >
            About
          </Link>
          <Link
            to="/how-it-works"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 hover:text-white py-1"
          >
            How It Works
          </Link>
          <Link
            to="/contact"
            onClick={() => setMobileMenuOpen(false)}
            className="block text-sm text-slate-300 hover:text-white py-1"
          >
            Contact
          </Link>

          {user ? (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <div className="px-2 py-1 bg-slate-900 rounded-xl text-xs font-bold text-brand-300 flex items-center justify-between">
                <span>Role: {user.role}</span>
                <span className="text-[10px] text-slate-400">{user.email}</span>
              </div>

              {/* Role Quick Links */}
              <div className="grid grid-cols-2 gap-1.5 py-1 text-xs">
                {isAdmin && (
                  <>
                    <Link to="/admin/dashboard" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Dashboard</Link>
                    <Link to="/admin/job-requests" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Job Requests</Link>
                    <Link to="/admin/applications" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Applications</Link>
                    <Link to="/admin/attendance" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Attendance</Link>
                    <Link to="/admin/payments" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Payments</Link>
                    <Link to="/admin/recruiters" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Recruiters</Link>
                    <Link to="/admin/workers" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Workers</Link>
                  </>
                )}
                {isRecruiter && (
                  <>
                    <Link to="/recruiter/dashboard" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Dashboard</Link>
                    <Link to="/recruiter/create-job" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Create Job</Link>
                    <Link to="/recruiter/submitted-events" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">My Events</Link>
                    <Link to="/recruiter/profile" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Profile</Link>
                  </>
                )}
                {isWorker && (
                  <>
                    <Link to="/worker/dashboard" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Dashboard</Link>
                    <Link to="/worker/available-jobs" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Available Jobs</Link>
                    <Link to="/worker/applications" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">My Applications</Link>
                    <Link to="/worker/assignments" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">My Assignments</Link>
                    <Link to="/worker/payments" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">My Payments</Link>
                    <Link to="/worker/availability" onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg bg-slate-900 text-slate-200">Availability</Link>
                  </>
                )}
              </div>

              <button
                onClick={() => {
                  handleLogout();
                  setMobileMenuOpen(false);
                }}
                className="w-full text-center py-2 text-xs font-semibold text-rose-400 hover:bg-rose-950/30 rounded-xl"
              >
                Logout
              </button>
            </div>
          ) : (
            <div className="pt-3 border-t border-slate-800 space-y-2">
              <Link
                to="/login/worker"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm text-slate-300 hover:text-white"
              >
                Worker Login
              </Link>
              <Link
                to="/login/recruiter"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 text-sm text-slate-300 hover:text-white"
              >
                Recruiter Login
              </Link>
              <Link
                to="/register/worker"
                onClick={() => setMobileMenuOpen(false)}
                className="gradient-btn block text-center py-2 rounded-xl text-xs font-bold uppercase"
              >
                Join as Worker
              </Link>
              <Link
                to="/register/recruiter"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-center py-2 rounded-xl border border-brand-500/40 text-brand-300 text-xs font-bold uppercase"
              >
                Hire Event Staff
              </Link>
            </div>
          )}
        </div>
      )}
    </nav>
  );
};

export default Navbar;
