import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Shield, Lock, CreditCard } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="bg-slate-950 border-t border-slate-800 text-slate-400 py-12 mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="space-y-4">
            <Link to="/" className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-600 text-white">
                <Sparkles className="w-4 h-4 fill-current" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">JOBBY<span className="gradient-text">HOP</span></span>
            </Link>
            <p className="text-xs text-slate-400 leading-relaxed">
              Commercial Event Staffing & Job Management Platform. Connecting Recruiters and High-Energy Event Staff with Admin Protection & 10–15 day Payout Tracking.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Platform Roles</h4>
            <ul className="space-y-2 text-xs">
              <li><Link to="/register/recruiter" className="hover:text-brand-400 transition-colors">Post Event Jobs (Recruiters)</Link></li>
              <li><Link to="/register/worker" className="hover:text-brand-400 transition-colors">Join as Event Worker</Link></li>
              <li><Link to="/login" className="hover:text-brand-400 transition-colors">Admin & Staff Portal Login</Link></li>
              <li><Link to="/how-it-works" className="hover:text-brand-400 transition-colors">Admin Mediation Workflow</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Security & Guarantees</h4>
            <ul className="space-y-2 text-xs">
              <li className="flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-emerald-400" /> Admin Mediated Staffing</li>
              <li className="flex items-center gap-2"><Lock className="w-3.5 h-3.5 text-brand-400" /> Recruiter Contact Protection</li>
              <li className="flex items-center gap-2"><CreditCard className="w-3.5 h-3.5 text-purple-400" /> 10–15 Day Payout Timeline</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3">Support</h4>
            <p className="text-xs text-slate-400 mb-2">Need assistance with event staffing or payments?</p>
            <a href="mailto:supportjobbyhop@gmail.com" className="text-xs font-semibold text-brand-400 hover:underline">
              supportjobbyhop@gmail.com
            </a>
          </div>
        </div>

        <div className="pt-8 border-t border-slate-900 text-center text-xs text-slate-500">
          <p>© {new Date().getFullYear()} JobbyHop Platform. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
