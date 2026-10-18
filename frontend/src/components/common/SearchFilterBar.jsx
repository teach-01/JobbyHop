import React from 'react';
import { Search, X } from 'lucide-react';

/**
 * Reusable Search + Filter toolbar for Admin pages.
 *
 * Props:
 *   searchValue        – current search string (controlled)
 *   onSearchChange     – (value: string) => void
 *   placeholder        – search input placeholder text
 *   filterValue        – current selected filter value (controlled)
 *   onFilterChange     – (value: string) => void
 *   filterOptions      – [{ value: string, label: string }, ...]
 *   filterLabel        – label shown before the dropdown (default: 'Status')
 *   totalCount         – total records before filtering (optional)
 *   filteredCount      – records after filtering (optional)
 *   countLabel         – noun for the count display, e.g. 'assignments' (optional)
 */
const SearchFilterBar = ({
  searchValue,
  onSearchChange,
  placeholder = 'Search...',
  filterValue,
  onFilterChange,
  filterOptions = [],
  filterLabel = 'Status',
  totalCount,
  filteredCount,
  countLabel = 'records',
  children,
}) => {
  const showCount =
    totalCount !== undefined &&
    filteredCount !== undefined &&
    totalCount > 0 &&
    filteredCount !== totalCount;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search input */}
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter dropdown */}
        {filterOptions.length > 0 && (
          <select
            value={filterValue}
            onChange={(e) => onFilterChange(e.target.value)}
            className="px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-semibold focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500/30 transition-colors appearance-none cursor-pointer sm:w-48 shrink-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 12px center',
              paddingRight: '36px',
            }}
          >
            {filterOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {children}
      </div>

      {/* Filtered count indicator */}
      {showCount && (
        <p className="text-xs text-slate-500 font-medium">
          Showing {filteredCount} of {totalCount} {countLabel}
        </p>
      )}
    </div>
  );
};

export default SearchFilterBar;
