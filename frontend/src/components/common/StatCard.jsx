import React from 'react';
import { Link } from 'react-router-dom';

export const StatCard = ({ title, value, subtitle, icon: Icon, color = 'brand', trend, to }) => {
  const colorStyles = {
    brand:   'from-brand-500/20 to-purple-500/10 text-brand-400 border-brand-500/20',
    emerald: 'from-emerald-500/20 to-teal-500/10 text-emerald-400 border-emerald-500/20',
    amber:   'from-amber-500/20 to-orange-500/10 text-amber-400 border-amber-500/20',
    blue:    'from-blue-500/20 to-cyan-500/10 text-blue-400 border-blue-500/20',
    rose:    'from-rose-500/20 to-pink-500/10 text-rose-400 border-rose-500/20',
    purple:  'from-purple-500/20 to-brand-500/10 text-purple-400 border-purple-500/20',
    indigo:  'from-indigo-500/20 to-blue-500/10 text-indigo-400 border-indigo-500/20',
    cyan:    'from-cyan-500/20 to-blue-500/10 text-cyan-400 border-cyan-500/20',
  };

  const currentStyle = colorStyles[color] || colorStyles.brand;

  const inner = (
    <div
      className={`p-6 rounded-2xl glass-card border bg-gradient-to-br ${currentStyle} relative overflow-hidden group transition-all duration-200 ${
        to
          ? 'cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-black/40 hover:border-slate-500/60 active:translate-y-0 active:scale-[0.99]'
          : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">{title}</p>
          <h3 className="text-3xl font-extrabold text-white mt-2 tracking-tight">{value}</h3>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700/50 shadow-inner group-hover:scale-110 transition-transform duration-300">
            <Icon className="w-6 h-6" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-4 flex items-center text-xs font-semibold text-emerald-400">
          <span>{trend}</span>
        </div>
      )}
      {to && (
        <div className="mt-4 flex items-center gap-1 text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">
          <span>View</span>
          <span className="inline-block transition-transform duration-200 group-hover:translate-x-1">→</span>
        </div>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="block focus:outline-none focus:ring-2 focus:ring-brand-500/40 rounded-2xl" tabIndex={0} aria-label={`Go to ${title}`}>
        {inner}
      </Link>
    );
  }
  return inner;
};

export default StatCard;
