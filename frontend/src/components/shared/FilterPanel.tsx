import React, { useMemo } from 'react';
import { Filter, X, RotateCcw } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { wbsApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

export const FilterPanel: React.FC = () => {
  const filters = useUIStore((s) => s.filters);
  const setFilters = useUIStore((s) => s.setFilters);
  const resetFilters = useUIStore((s) => s.resetFilters);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);

  const { data: wbsItems } = useQuery({
    queryKey: ['wbs', activeProjectId],
    queryFn: () => wbsApi.getByProject(activeProjectId!),
    enabled: !!activeProjectId,
    staleTime: 60000,
  });

  // Extract unique buildings and statuses from WBS data
  const { buildings, statuses } = useMemo(() => {
    if (!wbsItems) return { buildings: [] as string[], statuses: [] as string[] };
    const bSet = new Set<string>();
    const sSet = new Set<string>();
    for (const item of wbsItems) {
      if (item.building) bSet.add(item.building);
      if (item.status) sSet.add(item.status);
    }
    return {
      buildings: Array.from(bSet).sort(),
      statuses: Array.from(sSet).sort(),
    };
  }, [wbsItems]);

  const hasActiveFilters =
    filters.search !== '' ||
    filters.wbsLevels.length > 0 ||
    !filters.showOnlyActive ||
    filters.buildings.length > 0 ||
    filters.statuses.length > 0 ||
    filters.targetKw !== '' ||
    filters.progressMin !== null ||
    filters.progressMax !== null;

  const activeCount = [
    filters.search !== '',
    filters.wbsLevels.length > 0,
    !filters.showOnlyActive,
    filters.buildings.length > 0,
    filters.statuses.length > 0,
    filters.targetKw !== '',
    filters.progressMin !== null || filters.progressMax !== null,
  ].filter(Boolean).length;

  const toggleArrayFilter = (key: 'buildings' | 'statuses', value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ [key]: updated });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-700">Filters</h3>
          {hasActiveFilters && (
            <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700">
              {activeCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-3 w-3" />
            Reset All
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-6 gap-y-3 lg:grid-cols-4">
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
              placeholder="Code or name..."
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

        {/* Building */}
        {buildings.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Building
            </label>
            <div className="flex flex-wrap gap-1">
              {buildings.map((b) => (
                <button
                  key={b}
                  onClick={() => toggleArrayFilter('buildings', b)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    filters.buildings.includes(b)
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status */}
        {statuses.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Status
            </label>
            <div className="flex flex-wrap gap-1">
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => toggleArrayFilter('statuses', s)}
                  className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                    filters.statuses.includes(s)
                      ? 'bg-emerald-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Target KW */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Target KW
          </label>
          <input
            type="text"
            value={filters.targetKw}
            onChange={(e) => setFilters({ targetKw: e.target.value })}
            placeholder="e.g. KW05"
            className="w-full rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Progress Range */}
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">
            Progress %
          </label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              max={100}
              value={filters.progressMin ?? ''}
              onChange={(e) =>
                setFilters({ progressMin: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Min"
              className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
            <span className="text-xs text-gray-400">-</span>
            <input
              type="number"
              min={0}
              max={100}
              value={filters.progressMax ?? ''}
              onChange={(e) =>
                setFilters({ progressMax: e.target.value ? Number(e.target.value) : null })
              }
              placeholder="Max"
              className="w-16 rounded-md border border-gray-300 px-2 py-1.5 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>

        {/* Show only active */}
        <div className="flex items-end pb-1">
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
              Active items only
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
