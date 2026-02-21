import React from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';

export const FilterPanel: React.FC = () => {
  const filters = useUIStore((s) => s.filters);
  const setFilters = useUIStore((s) => s.setFilters);
  const resetFilters = useUIStore((s) => s.resetFilters);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.wbsLevels.length > 0 ||
    !filters.showOnlyActive;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
          {hasActiveFilters && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs text-primary-700">
              Active
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        )}
      </div>

      <div className="space-y-3">
        {/* Search */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Search WBS
          </label>
          <div className="relative">
            <input
              type="text"
              value={filters.search}
              onChange={(e) => setFilters({ search: e.target.value })}
              placeholder="Search by code or name..."
              className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            {filters.search && (
              <button
                onClick={() => setFilters({ search: '' })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* WBS Levels */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            WBS Levels
          </label>
          <div className="flex gap-1.5">
            {[1, 2, 3, 4].map((level) => (
              <button
                key={level}
                onClick={() => {
                  const current = filters.wbsLevels;
                  const updated = current.includes(level)
                    ? current.filter((l) => l !== level)
                    : [...current, level];
                  setFilters({ wbsLevels: updated });
                }}
                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                  filters.wbsLevels.includes(level)
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                L{level}
              </button>
            ))}
          </div>
        </div>

        {/* Show only active */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="showOnlyActive"
            checked={filters.showOnlyActive}
            onChange={(e) =>
              setFilters({ showOnlyActive: e.target.checked })
            }
            className="h-3.5 w-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <label
            htmlFor="showOnlyActive"
            className="text-xs font-medium text-gray-600"
          >
            Show only active items
          </label>
        </div>
      </div>
    </div>
  );
};
