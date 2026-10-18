import React from 'react';
import { Inbox } from 'lucide-react';

export const EmptyState = ({
  icon: Icon = Inbox,
  title = 'No records found',
  description = 'There are no items matching your request right now.',
  actionLabel,
  onAction,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center glass-card rounded-2xl border border-slate-800 my-4">
      <div className="p-4 rounded-full bg-slate-900/80 border border-slate-700/60 mb-4">
        <Icon className="w-10 h-10 text-slate-400" />
      </div>
      <h4 className="text-lg font-bold text-white mb-1">{title}</h4>
      <p className="text-sm text-slate-400 max-w-sm mb-6">{description}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="gradient-btn px-6 py-2.5 rounded-xl text-sm font-semibold"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
