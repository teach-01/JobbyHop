import React from 'react';
import { Shield, Clock, User, ArrowRight } from 'lucide-react';
import { formatDateTime } from '../../utils/formatters';

export const AuditLogTable = ({ auditLogs = [] }) => {
  if (!auditLogs || auditLogs.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-slate-400 glass-card rounded-2xl">
        No audit log history recorded yet.
      </div>
    );
  }

  return (
    <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
            <tr>
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">User & Role</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Audit Details / Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-300">
            {auditLogs.map((log) => (
              <tr key={log._id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-brand-400" />
                  {formatDateTime(log.createdAt || log.timestamp)}
                </td>
                <td className="px-4 py-3.5 font-medium">
                  <span className="flex items-center gap-1 text-white">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    {log.performedByUserId?.email || 'System Admin'}
                  </span>
                  <span className="text-[10px] text-slate-500 uppercase">{log.performedByRole}</span>
                </td>
                <td className="px-4 py-3.5 font-bold text-brand-300">
                  {log.action}
                </td>
                <td className="px-4 py-3.5 text-slate-400">
                  {log.entityName}
                </td>
                <td className="px-4 py-3.5 max-w-xs truncate">
                  {log.previousValue && log.newValue ? (
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-rose-400 line-through">
                        {typeof log.previousValue === 'object' ? JSON.stringify(log.previousValue) : log.previousValue}
                      </span>
                      <ArrowRight className="w-3 h-3 text-slate-500" />
                      <span className="text-emerald-400 font-bold">
                        {typeof log.newValue === 'object' ? JSON.stringify(log.newValue) : log.newValue}
                      </span>
                    </div>
                  ) : (
                    <span className="text-slate-400">{log.notes || 'Executed by Admin'}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AuditLogTable;
