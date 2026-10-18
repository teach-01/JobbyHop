import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Award, Users, Sparkles, CheckCircle2, Clock, ArrowRight } from 'lucide-react';

export const AboutPage = () => {
  return (
    <div className="space-y-16 pb-16">
      {/* Header Banner */}
      <section className="relative pt-12 text-center space-y-4">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/30 text-brand-300 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-4 h-4 text-brand-400 fill-current" />
          About JobbyHop
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white">
          Empowering Events Through <span className="gradient-text">Trusted Mediation</span>
        </h1>
        <p className="text-slate-300 text-sm max-w-2xl mx-auto leading-relaxed">
          JobbyHop is an event staffing and job management platform designed to connect premier event recruiters with reliable event workers through a centralized, Admin-managed workflow.
        </p>
      </section>

      {/* Core Mission */}
      <section className="max-w-6xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-4">
          <h2 className="text-2xl font-bold text-white">The Central Controller Advantage</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Unlike uncontrolled gig marketplaces where ghosting, wage disputes, and lack of accountability occur, JobbyHop operates under strict Admin oversight.
          </p>
          <ul className="space-y-3 text-xs text-slate-300">
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Recruiter job requests undergo Admin review & payment standardization.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Worker profiles are verified before assignment.</span>
            </li>
            <li className="flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>Guaranteed 10–15 day worker payout timeline managed by Admin.</span>
            </li>
          </ul>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-800 space-y-6 bg-gradient-to-tr from-brand-950/40 via-slate-900 to-slate-950">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-brand-500/20 text-brand-400 border border-brand-500/30">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Zero Direct Exploitation</h3>
              <p className="text-xs text-slate-400">Admin protects both sides from unexpected rate changes.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">10–15 Day Payout Tracking</h3>
              <p className="text-xs text-slate-400">Clear timeline from event completion to verified bank/UPI payout.</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Award className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Professional Staff Quality</h3>
              <p className="text-xs text-slate-400">Curated talent pool for weddings, corporate summits & concerts.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-4 text-center">
        <div className="glass-card rounded-3xl p-8 border border-slate-800 space-y-4">
          <h3 className="text-xl font-bold text-white">Join the JobbyHop Network Today</h3>
          <p className="text-xs text-slate-400">Experience seamless event staffing with guaranteed payouts and admin support.</p>
          <div className="flex justify-center gap-4 pt-2">
            <Link to="/register/worker" className="gradient-btn px-6 py-2.5 rounded-xl text-xs font-bold">
              Become Event Staff
            </Link>
            <Link to="/register/recruiter" className="px-6 py-2.5 rounded-xl border border-slate-700 text-white text-xs font-bold">
              Hire Staff for Events
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default AboutPage;
