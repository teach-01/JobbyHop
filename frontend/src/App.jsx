import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Navbar from './components/common/Navbar';
import Sidebar from './components/common/Sidebar';
import Footer from './components/common/Footer';
import Toast from './components/common/Toast';
import PWAInstallPrompt from './components/common/PWAInstallPrompt';
import ProtectedRoute from './components/common/ProtectedRoute';
import FloatingChatButton from './components/support/FloatingChatButton';
import { useAuth } from './context/AuthContext';
import { useNotifications } from './context/NotificationContext';

// Public Pages
import HomePage from './pages/Public/HomePage';
import AboutPage from './pages/Public/AboutPage';
import HowItWorksPage from './pages/Public/HowItWorksPage';
import ContactPage from './pages/Public/ContactPage';
import LoginPage from './pages/Public/LoginPage';
import RegisterRecruiterPage from './pages/Public/RegisterRecruiterPage';
import RegisterWorkerPage from './pages/Public/RegisterWorkerPage';
import ForgotPasswordPage from './pages/Public/ForgotPasswordPage';
import ResetPasswordPage from './pages/Public/ResetPasswordPage';
import ForcePasswordChange from './pages/Public/ForcePasswordChange';

// Recruiter Pages
import RecruiterDashboard from './pages/Recruiter/RecruiterDashboard';
import RecruiterCreateJob from './pages/Recruiter/RecruiterCreateJob';
import RecruiterMyJobs from './pages/Recruiter/RecruiterMyJobs';
import RecruiterJobDetails from './pages/Recruiter/RecruiterJobDetails';
import RecruiterProfile from './pages/Recruiter/RecruiterProfile';
import RecruiterNotifications from './pages/Recruiter/RecruiterNotifications';
import RecruiterPayments from './pages/Recruiter/RecruiterPayments';

// Worker Pages
import WorkerDashboard from './pages/Worker/WorkerDashboard';
import WorkerAvailableJobs from './pages/Worker/WorkerAvailableJobs';
import WorkerJobDetails from './pages/Worker/WorkerJobDetails';
import WorkerApplications from './pages/Worker/WorkerApplications';
import WorkerAssignments from './pages/Worker/WorkerAssignments';
import WorkerAttendance from './pages/Worker/WorkerAttendance';
import WorkerPayments from './pages/Worker/WorkerPayments';
import WorkerProfile from './pages/Worker/WorkerProfile';
import WorkerNotifications from './pages/Worker/WorkerNotifications';
import WorkerHistory from './pages/Worker/WorkerHistory';

// Admin Pages
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminRecruiters from './pages/Admin/AdminRecruiters';
import AdminWorkers from './pages/Admin/AdminWorkers';
import AdminJobRequests from './pages/Admin/AdminJobRequests';
import AdminApprovedJobs from './pages/Admin/AdminApprovedJobs';
import AdminApplications from './pages/Admin/AdminApplications';
import AdminAttendance from './pages/Admin/AdminAttendance';
import AdminEvents from './pages/Admin/AdminEvents';
import AdminPayments from './pages/Admin/AdminPayments';
import AdminRecruiterCollections from './pages/Admin/AdminRecruiterCollections';
import AdminRecruiterPayments from './pages/Admin/AdminRecruiterPayments';
import AdminAuditLog from './pages/Admin/AdminAuditLog';
import AdminNotifications from './pages/Admin/AdminNotifications';
import AdminSettings from './pages/Admin/AdminSettings';

// Operations Pages
import OperationsDashboard from './pages/Operations/OperationsDashboard';
import OperationsAttendance from './pages/Operations/OperationsAttendance';
import OperationsEvents from './pages/Operations/OperationsEvents';
import OperationsPayments from './pages/Operations/OperationsPayments';
import OperationsNotifications from './pages/Operations/OperationsNotifications';
import OperationsAuditLog from './pages/Operations/OperationsAuditLog';

export function App() {
  const { user, loading } = useAuth();
  const { toast } = useNotifications();
  const location = useLocation();

  const isDashboardRoute =
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/recruiter') ||
    location.pathname.startsWith('/worker') ||
    location.pathname.startsWith('/operations');

  if (loading && isDashboardRoute) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-slate-400">Verifying session...</span>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (!loading && !user && isDashboardRoute) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-white">
      <Navbar />

      <Toast toast={toast} />
      <PWAInstallPrompt />

      <div className="flex-1">
        {user && isDashboardRoute ? (
          <div className="flex max-w-7xl mx-auto">
            <Sidebar />
            <main className="flex-1 p-6 md:p-8 min-w-0 overflow-hidden">
              <Routes>
                {/* RECRUITER ROUTES */}
                <Route
                  path="/recruiter/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/create-job"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterCreateJob />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs/create"
                  element={<Navigate to="/recruiter/create-job" replace />}
                />
                <Route
                  path="/recruiter/submitted-events"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterMyJobs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/jobs"
                  element={<Navigate to="/recruiter/submitted-events" replace />}
                />
                <Route
                  path="/recruiter/my-jobs"
                  element={<Navigate to="/recruiter/submitted-events" replace />}
                />
                <Route
                  path="/recruiter/submitted-events/:id"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterJobDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/profile"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterNotifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/recruiter/payments"
                  element={
                    <ProtectedRoute allowedRoles={['RECRUITER']}>
                      <RecruiterPayments />
                    </ProtectedRoute>
                  }
                />

                {/* WORKER ROUTES */}
                <Route
                  path="/worker/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/available-jobs"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerAvailableJobs />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/jobs"
                  element={<Navigate to="/worker/available-jobs" replace />}
                />
                <Route
                  path="/worker/jobs/:id"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerJobDetails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/applications"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerApplications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/assignments"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerAssignments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/attendance"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/payments"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerPayments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/availability"
                  element={<Navigate to="/worker/profile" replace />}
                />
                <Route
                  path="/worker/profile"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerProfile />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerNotifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/worker/history"
                  element={
                    <ProtectedRoute allowedRoles={['WORKER']}>
                      <WorkerHistory />
                    </ProtectedRoute>
                  }
                />

                {/* ADMIN ROUTES */}
                <Route
                  path="/admin/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/recruiters"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminRecruiters />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/workers"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminWorkers />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/job-requests"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminJobRequests />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/jobs/requests"
                  element={<Navigate to="/admin/job-requests" replace />}
                />
                <Route
                  path="/admin/jobs"
                  element={<Navigate to="/admin/job-requests?status=APPROVED" replace />}
                />
                <Route
                  path="/admin/applications"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminApplications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/assignments"
                  element={<Navigate to="/admin/dashboard" replace />}
                />
                <Route
                  path="/admin/attendance"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/events"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminEvents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/payments"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminPayments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/recruiter-collections"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminRecruiterCollections />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/recruiter-payments"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminRecruiterCollections />
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/admin/audit-logs"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminAuditLog />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/audit"
                  element={<Navigate to="/admin/audit-logs" replace />}
                />
                <Route
                  path="/admin/audit-history"
                  element={<Navigate to="/admin/audit-logs" replace />}
                />
                <Route
                  path="/admin/trash"
                  element={<Navigate to="/admin/audit-logs" replace />}
                />
                <Route
                  path="/admin/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminNotifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/settings"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminSettings />
                    </ProtectedRoute>
                  }
                />

                {/* OPERATIONS ROUTES */}
                <Route
                  path="/operations/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/operations/attendance"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsAttendance />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/operations/events"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsEvents />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/operations/payments"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsPayments />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/operations/notifications"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsNotifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/operations/audit"
                  element={
                    <ProtectedRoute allowedRoles={['OPERATIONS', 'ADMIN']}>
                      <OperationsAuditLog />
                    </ProtectedRoute>
                  }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        ) : (
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <Routes>
              {/* PUBLIC ROUTES */}
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/login/recruiter" element={<LoginPage type="recruiter" />} />
              <Route path="/login/worker" element={<LoginPage type="worker" />} />
              <Route path="/recruiter/login" element={<Navigate to="/login/recruiter" replace />} />
              <Route path="/worker/login" element={<Navigate to="/login/worker" replace />} />
              <Route path="/register/recruiter" element={<RegisterRecruiterPage />} />
              <Route path="/register/worker" element={<RegisterWorkerPage />} />
              <Route path="/recruiter/register" element={<Navigate to="/register/recruiter" replace />} />
              <Route path="/worker/register" element={<Navigate to="/register/worker" replace />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />
              <Route path="/force-password-change" element={<ForcePasswordChange />} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        )}
      </div>

      {/* Floating Chatbot Button – visible on all pages */}
      <FloatingChatButton />

      <Footer />
    </div>
  );
}

export default App;
