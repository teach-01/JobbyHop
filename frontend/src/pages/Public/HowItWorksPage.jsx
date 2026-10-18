import React from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, ShieldCheck, UserCheck, CalendarCheck, Award, CreditCard, ArrowRight } from 'lucide-react';

export const HowItWorksPage = () => {
  const recruiterSteps = [
    {
      num: '01',
      title: 'Submit Event Request',
      desc: 'Recruiter submits job details including event date, hours, staff required, and proposed payment.',
    },
    {
      num: '02',
      title: 'Admin Review & Payment Standard',
      desc: 'JobbyHop Admin reviews details and standardizes worker pay (e.g. ₹1500 → ₹1000). Only Admin-approved jobs go live.',
    },
    {
      num: '03',
      title: 'Admin Staff Assignment',
      desc: 'Admin evaluates worker applications and assigns verified staff to the event. Recruiter tracks assigned count.',
    },
    {
      num: '04',
      title: 'Event Execution & Completion',
      desc: 'Staff works shift; Admin verifies attendance and marks event completed.',
    },
  ];

  const workerSteps = [
    {
      num: '01',
      title: 'Browse Approved Jobs',
      desc: 'Worker views verified jobs with final Admin-approved payments. Recruiter original proposed rates remain hidden.',
    },
    {
      num: '02',
      title: 'One-Click Apply',
      desc: 'Apply for shifts matching your skills and schedule. Profile photo is required for application review.',
    },
    {
      num: '03',
      title: 'Admin Assignment & Attendance',
      desc: 'Receive assignment confirmation from Admin. Check in/check out at event.',
    },
    {
      num: '04',
      title: '10–15 Day Guaranteed Payout',
      desc: 'Track payment status from Pending → Processing → Paid within 10–15 days after event completion.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Header Banner */}
      <section className="text-center space-y-3 pt-8">
        <span className="text-xs font-bold uppercase tracking-wider text-brand-400">Complete Workflow</span>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          How <span className="gradient-text">JobbyHop</span> Operates
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm max-w-2xl mx-auto">
          Centralized Admin mediation ensures security, quality staffing, and guaranteed worker payouts.
        </p>
      </section>

      {/* Recruiter Workflow */}
      <section className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">For Event Recruiters & Organizers</h2>
            <p className="text-xs text-slate-400">How to request and staff your event</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {recruiterSteps.map((step) => (
            <div key={step.num} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3 relative">
              <span className="text-3xl font-black text-purple-500/30">{step.num}</span>
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Worker Workflow */}
      <section className="max-w-6xl mx-auto px-4 space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">For Event Staff & Workers</h2>
            <p className="text-xs text-slate-400">How to find jobs and receive guaranteed payments</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {workerSteps.map((step) => (
            <div key={step.num} className="glass-card p-6 rounded-2xl border border-slate-800 space-y-3 relative">
              <span className="text-3xl font-black text-emerald-500/30">{step.num}</span>
              <h3 className="text-sm font-bold text-white">{step.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="glass-card p-8 rounded-3xl border border-brand-500/30 bg-gradient-to-r from-brand-950/60 to-slate-950 space-y-4">
          <h3 className="text-2xl font-bold text-white">Ready to Get Started?</h3>
          <div className="flex justify-center gap-4">
            <Link to="/register/worker" className="gradient-btn px-6 py-3 rounded-xl text-xs font-bold uppercase">
              Join as Worker
            </Link>
            <Link to="/register/recruiter" className="px-6 py-3 rounded-xl border border-brand-500/40 text-brand-300 text-xs font-bold uppercase">
              Register as Recruiter
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HowItWorksPage;
