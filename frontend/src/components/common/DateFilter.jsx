import React, { useState, useEffect } from 'react';
import { Calendar, X, Filter } from 'lucide-react';
import { DATE_FILTER_PRESETS, DEFAULT_DATE_FILTER } from '../../utils/dateFilterHelper';

export const DateFilter = ({
  dateFilter = DEFAULT_DATE_FILTER,
  onDateFilterChange,
  className = '',
  compact = false,
}) => {
  const currentPreset = dateFilter?.preset || 'all';
  const [customStart, setCustomStart] = useState(dateFilter?.startDate || '');
  const [customEnd, setCustomEnd] = useState(dateFilter?.endDate || '');

  // Keep local draft in sync if external filter changes
  useEffect(() => {
    setCustomStart(dateFilter?.startDate || '');
    setCustomEnd(dateFilter?.endDate || '');
  }, [dateFilter?.startDate, dateFilter?.endDate, dateFilter?.preset]);

  const handlePresetChange = (e) => {
    const val = e.target.value;
    if (val === 'custom') {
      onDateFilterChange?.({
        preset: 'custom',
        startDate: customStart,
        endDate: customEnd,
      });
    } else {
      onDateFilterChange?.({
        preset: val,
        startDate: '',
        endDate: '',
      });
    }
  };

  const handleApplyCustom = () => {
    onDateFilterChange?.({
      preset: 'custom',
      startDate: customStart,
      endDate: customEnd,
    });
  };

  const handleReset = () => {
    setCustomStart('');
    setCustomEnd('');
    onDateFilterChange?.(DEFAULT_DATE_FILTER);
  };

  const isFiltered = currentPreset !== 'all' || Boolean(dateFilter?.startDate) || Boolean(dateFilter?.endDate);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Preset Dropdown */}
      <div className="relative inline-flex items-center">
        <Calendar className="w-3.5 h-3.5 text-purple-400 absolute left-3 pointer-events-none" />
        <select
          value={currentPreset}
          onChange={handlePresetChange}
          className="bg-slate-900 border border-slate-700/80 hover:border-slate-600 focus:border-purple-500 rounded-xl pl-8 pr-8 py-2 text-xs font-medium text-slate-200 transition appearance-none cursor-pointer focus:outline-none"
          title="Filter records by date"
        >
          {DATE_FILTER_PRESETS.map((p) => (
            <option key={p.value} value={p.value} className="bg-slate-900 text-slate-200">
              {p.label}
            </option>
          ))}
        </select>
        <span className="absolute right-2.5 pointer-events-none text-slate-500 text-[10px]">▼</span>
      </div>

      {/* Custom Range Inputs */}
      {currentPreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 border border-purple-500/40 p-1.5 rounded-xl shadow-inner">
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400 pl-1">From:</span>
            <div className="relative flex items-center">
              <input
                type="text"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-28 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg pl-2 pr-6 py-1 text-xs text-white"
              />
              <input
                type="date"
                tabIndex={-1}
                aria-label="Pick start date"
                className="absolute right-0 w-6 h-6 opacity-0 cursor-pointer"
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 pointer-events-none" />
            </div>
          </div>

          <div className="flex items-center gap-1">
            <span className="text-[11px] text-slate-400">To:</span>
            <div className="relative flex items-center">
              <input
                type="text"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                placeholder="YYYY-MM-DD"
                className="w-28 bg-slate-950 border border-slate-800 focus:border-purple-500 rounded-lg pl-2 pr-6 py-1 text-xs text-white"
              />
              <input
                type="date"
                tabIndex={-1}
                aria-label="Pick end date"
                className="absolute right-0 w-6 h-6 opacity-0 cursor-pointer"
                onChange={(e) => setCustomEnd(e.target.value)}
              />
              <Calendar className="w-3.5 h-3.5 text-slate-500 absolute right-1.5 pointer-events-none" />
            </div>
          </div>

          <button
            type="button"
            onClick={handleApplyCustom}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-medium rounded-lg text-xs transition shadow-sm"
          >
            Apply
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs transition"
          >
            Reset
          </button>
        </div>
      )}

      {/* Active Filter Clear Icon Button (when preset != 'all' and not custom or custom applied) */}
      {isFiltered && currentPreset !== 'custom' && (
        <button
          type="button"
          onClick={handleReset}
          className="flex items-center gap-1 px-2 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs transition"
          title="Clear date filter"
        >
          <X className="w-3.5 h-3.5 text-slate-400 hover:text-white" />
          <span className="text-[11px] hidden sm:inline">Clear</span>
        </button>
      )}
    </div>
  );
};

export default DateFilter;
