import React, { useRef, useEffect } from 'react';
import { Trash2, RotateCcw, AlertTriangle, X } from 'lucide-react';

/**
 * BulkCheckbox — styled checkbox matching the JobbyHop dark theme.
 */
export function BulkCheckbox({ checked, indeterminate = false, onChange, disabled = false, label, id }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <label
      htmlFor={id}
      className={`inline-flex items-center gap-2 cursor-pointer select-none ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="relative flex items-center justify-center">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          onClick={(e) => e.stopPropagation()}
          className="sr-only peer"
        />
        <div
          className={`
            w-4 h-4 rounded border-2 flex items-center justify-center transition-all duration-150 shrink-0
            ${checked || indeterminate
              ? 'bg-brand-500 border-brand-500'
              : 'bg-slate-900 border-slate-600 hover:border-brand-400'}
            ${disabled ? '' : 'cursor-pointer'}
          `}
        >
          {checked && !indeterminate && (
            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {indeterminate && (
            <div className="w-2 h-0.5 bg-white rounded-full" />
          )}
        </div>
      </div>
      {label && <span className="text-xs font-semibold text-slate-300">{label}</span>}
    </label>
  );
}

/**
 * BulkActionToolbar — shown above the list when records are selected.
 *
 * Props:
 *  selectedCount     {number}
 *  onClear           {fn}
 *  actions           {Array<{ label, icon, onClick, variant, disabled }>}
 *                    variant: 'default' | 'danger'
 *  visible           {boolean}
 */
export function BulkActionToolbar({ selectedCount, onClear, actions = [], visible }) {
  if (!visible || selectedCount === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-2xl bg-slate-900 border border-brand-500/40 shadow-lg shadow-brand-500/10 animate-in fade-in duration-150">
      {/* Count badge */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-brand-500 text-white text-[11px] font-bold">
          {selectedCount}
        </span>
        <span className="text-xs font-semibold text-slate-300">
          {selectedCount === 1 ? '1 record selected' : `${selectedCount} records selected`}
        </span>
      </div>

      <div className="flex-1 h-px bg-slate-700/60 hidden sm:block" />

      {/* Action buttons */}
      <div className="flex flex-wrap items-center gap-2">
        {actions.map((action, idx) => {
          const Icon = action.icon;
          const isDanger = action.variant === 'danger';
          return (
            <button
              key={idx}
              onClick={action.onClick}
              disabled={action.disabled || selectedCount === 0}
              className={`
                inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all duration-150
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isDanger
                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 hover:border-rose-400'
                  : 'bg-brand-500/15 text-brand-300 border border-brand-500/30 hover:bg-brand-500/25 hover:border-brand-400'}
              `}
            >
              {Icon && <Icon className="w-3.5 h-3.5" />}
              {action.label}
            </button>
          );
        })}

        {/* Clear selection */}
        <button
          onClick={onClear}
          className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all duration-150 shrink-0"
          title="Clear selection"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

/**
 * BulkSelectAllRow — the "Select All / count" bar placed at the top of a list.
 *
 * Props:
 *  isAllSelected     {boolean}
 *  isIndeterminate   {boolean}
 *  selectedCount     {number}
 *  totalCount        {number}
 *  onSelectAll       {fn}
 *  onClear           {fn}
 *  disabled          {boolean}
 */
export function BulkSelectAllRow({ isAllSelected, isIndeterminate, selectedCount, totalCount, onSelectAll, onClear, disabled }) {
  if (totalCount === 0) return null;

  const handleChange = () => {
    if (isAllSelected) {
      onClear();
    } else {
      onSelectAll();
    }
  };

  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800 mb-2">
      <BulkCheckbox
        id="bulk-select-all"
        checked={isAllSelected}
        indeterminate={isIndeterminate}
        onChange={handleChange}
        disabled={disabled}
        label={isAllSelected ? 'Deselect All' : 'Select All'}
      />
      {selectedCount > 0 && (
        <span className="text-xs font-bold text-brand-400">
          {selectedCount} / {totalCount} selected
        </span>
      )}
    </div>
  );
}

/**
 * BulkConfirmModal — confirmation dialog for destructive bulk actions.
 *
 * Props:
 *  open            {boolean}
 *  onClose         {fn}
 *  onConfirm       {fn}
 *  count           {number}
 *  actionLabel     {string}   e.g. "Permanently Delete"
 *  description     {string}   warning message
 *  loading         {boolean}
 *  isDanger        {boolean}
 */
export function BulkConfirmModal({ open, onClose, onConfirm, count, actionLabel = 'Delete', description, loading = false, isDanger = true }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md glass-card border border-slate-700 rounded-2xl p-6 shadow-2xl space-y-5">
        <div className="flex items-start gap-4">
          <div className={`p-2.5 rounded-xl shrink-0 ${isDanger ? 'bg-rose-500/15' : 'bg-amber-500/15'}`}>
            <AlertTriangle className={`w-6 h-6 ${isDanger ? 'text-rose-400' : 'text-amber-400'}`} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              {actionLabel} {count} Record{count !== 1 ? 's' : ''}?
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              {description || (isDanger
                ? 'This action cannot be undone. The selected records will be permanently removed.'
                : 'Are you sure you want to perform this action on the selected records?')}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors disabled:opacity-50 flex items-center gap-2
              ${isDanger
                ? 'bg-rose-500 text-white hover:bg-rose-600'
                : 'bg-brand-500 text-white hover:bg-brand-600'}
            `}
          >
            {loading && (
              <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
            )}
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
