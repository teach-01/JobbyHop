import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Clock, Users, ArrowRight, CheckCircle2, Briefcase, Award } from 'lucide-react';

export const HomePage = () => {
  return (
    <div className="space-y-24 pb-16">
      {/* Hero Section */}
      <section className="relative pt-12 lg:pt-20 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-600/20 rounded-full blur-[140px] -z-10 pointer-events-none"></div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider">
            <Sparkles className="w-4 h-4 fill-current text-brand-400" />
            Next-Gen Event Staffing & Job Platform
          </div>

          <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white leading-tight">
            Connect Event Recruiters <br />
            with <span className="gradient-text">Top-Tier Event Staff</span>
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            JobbyHop connects event recruiters with skilled workers through a trusted, Admin-managed staffing workflow with guaranteed 10–15 day payout tracking.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/register/worker"
              className="gradient-btn w-full sm:w-auto px-8 py-4 rounded-2xl text-sm font-extrabold uppercase tracking-wider flex items-center justify-center gap-2 group"
            >
              <span>Find Event Work</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>

            <Link
              to="/register/recruiter"
              className="w-full sm:w-auto px-8 py-4 rounded-2xl border border-brand-500/40 bg-slate-900/80 hover:bg-slate-800 text-brand-300 text-sm font-extrabold uppercase tracking-wider transition-all"
            >
              Post a Job / Hire Staff
            </Link>
          </div>

          {/* Quick Demo Login Link */}
          <div className="pt-2 text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login/worker" className="text-brand-400 font-bold hover:underline">
              Log in to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* Metrics Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-8 border border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-white">500+</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Events Staffed</p>
          </div>
          <div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-brand-400">100%</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Admin Protection</p>
          </div>
          <div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-purple-400">10–15d</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Payout Timeline</p>
          </div>
          <div>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-emerald-400">4.9 ★</h3>
            <p className="text-xs text-slate-400 mt-1 uppercase font-semibold">Worker Rating</p>
          </div>
        </div>
      </section>

      {/* Admin Mediation Architecture Features */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <h2 className="text-3xl font-extrabold text-white">Why Choose JobbyHop?</h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto">
            Our Centralized Admin Mediation rule guarantees safety, payment transparency, and hassle-free coordination for both recruiters and workers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4">
            <div className="p-3.5 rounded-2xl bg-brand-500/10 text-brand-400 w-fit">
              <Shield className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Strict Admin Control</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Recruiters and workers never communicate directly. Admin reviews, edits payments, assigns staff, and verifies event completion.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 text-emerald-400 w-fit">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">10–15 Day Guaranteed Pay</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Every worker payout is tracked transparently and processed by Admin within 10–15 days after verified event completion.
            </p>
          </div>

          <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4">
            <div className="p-3.5 rounded-2xl bg-purple-500/10 text-purple-400 w-fit">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Multi-Worker Assignments</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Whether you need 2 hostesses or 20 security guards for a concert, Admin coordinates and assigns whole teams seamlessly.
            </p>
          </div>
        </div>
      </section>

      {/* How It Works Workflow */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        <div className="text-center space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Step-by-Step</span>
          <h2 className="text-3xl font-extrabold text-white">How JobbyHop Works</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="p-6 glass-card rounded-2xl border border-slate-800 relative">
            <div className="text-3xl font-black text-brand-500/30 mb-2">01</div>
            <h4 className="text-sm font-bold text-white mb-1">Recruiter Submits Job</h4>
            <p className="text-xs text-slate-400">Recruiter posts event date, hours, staff required, and proposed payment.</p>
          </div>

          <div className="p-6 glass-card rounded-2xl border border-slate-800 relative">
            <div className="text-3xl font-black text-brand-500/30 mb-2">02</div>
            <h4 className="text-sm font-bold text-white mb-1">Admin Edits & Approves</h4>
            <p className="text-xs text-slate-400">Admin reviews details, sets final worker payment, and approves job.</p>
          </div>

          <div className="p-6 glass-card rounded-2xl border border-slate-800 relative">
            <div className="text-3xl font-black text-brand-500/30 mb-2">03</div>
            <h4 className="text-sm font-bold text-white mb-1">Worker Applies & Assigned</h4>
            <p className="text-xs text-slate-400">Worker browses verified jobs, applies, and Admin assigns selected staff.</p>
          </div>

          <div className="p-6 glass-card rounded-2xl border border-slate-800 relative">
            <div className="text-3xl font-black text-brand-500/30 mb-2">04</div>
            <h4 className="text-sm font-bold text-white mb-1">Attendance & Payout</h4>
            <p className="text-xs text-slate-400">Admin tracks attendance, completes event, and processes payout (10–15d).</p>
          </div>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card rounded-3xl p-12 text-center border border-brand-500/30 bg-gradient-to-r from-brand-950/60 via-purple-950/40 to-slate-950">
          <h2 className="text-3xl font-extrabold text-white mb-4">Ready for Your Next Event?</h2>
          <p className="text-sm text-slate-300 max-w-xl mx-auto mb-8">
            Join hundreds of event coordinators, luxury planners, and high-energy staffing professionals on JobbyHop.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register/worker" className="gradient-btn px-8 py-3.5 rounded-xl text-xs font-bold uppercase">
              Join as Event Staff
            </Link>
            <Link to="/register/recruiter" className="px-8 py-3.5 rounded-xl border border-slate-700 hover:bg-slate-800 text-white text-xs font-bold uppercase">
              Post an Event Request
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
