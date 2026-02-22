import React, { useCallback, useState, useMemo } from 'react';
import { X, Eye, EyeOff, ChevronUp, ChevronDown, Search } from 'lucide-react';
import { useUIStore, type ColumnConfig } from '@/stores/uiStore';

// Column categories for grouping
const COLUMN_CATEGORIES: Record<string, string[]> = {
  'Core': ['wbs_number', 'wbs_code', 'wbs_name', 'qty', 'unit'],
  'Progress': ['progress_pct', 'total_actual_manday', 'status'],
  'Quantities': ['qty_ext', 'done_ext', 'rem_ext', 'qty_int', 'done_int', 'rem_int'],
  'Details': ['building', 'budget_eur', 'target_kw', 'scope', 'nta_ref', 'notes'],
};

// Fixed columns that cannot be hidden
const FIXED_KEYS = new Set(['wbs_number', 'wbs_code', 'wbs_name']);

export const ColumnSettings: React.FC = () => {
  const wbsColumns = useUIStore((s) => s.wbsColumns);
  const setColumnVisible = useUIStore((s) => s.setColumnVisible);
  const reorderColumns = useUIStore((s) => s.reorderColumns);
  const toggleColumnSettings = useUIStore((s) => s.toggleColumnSettings);
  const [search, setSearch] = useState('');

  const visibleCount = wbsColumns.filter((c) => c.visible).length;
  const totalCount = wbsColumns.length;

  const filteredColumns = useMemo(() => {
    if (!search) return wbsColumns;
    const q = search.toLowerCase();
    return wbsColumns.filter(
      (c) => c.label.toLowerCase().includes(q) || c.key.toLowerCase().includes(q),
    );
  }, [wbsColumns, search]);

  // Group columns by category
  const categorized = useMemo(() => {
    const result: { category: string; columns: (ColumnConfig & { idx: number })[] }[] = [];
    const usedKeys = new Set<string>();

    for (const [category, keys] of Object.entries(COLUMN_CATEGORIES)) {
      const cols = keys
        .map((key) => {
          const idx = wbsColumns.findIndex((c) => c.key === key);
          if (idx === -1) return null;
          const col = filteredColumns.find((c) => c.key === key);
          if (!col) return null;
          usedKeys.add(key);
          return { ...col, idx };
        })
        .filter(Boolean) as (ColumnConfig & { idx: number })[];
      if (cols.length > 0) {
        result.push({ category, columns: cols });
      }
    }

    // Any uncategorized columns
    const uncategorized = filteredColumns
      .map((col, idx) => ({ ...col, idx: wbsColumns.indexOf(col) }))
      .filter((c) => !usedKeys.has(c.key));
    if (uncategorized.length > 0) {
      result.push({ category: 'Other', columns: uncategorized });
    }

    return result;
  }, [wbsColumns, filteredColumns]);

  const moveColumn = useCallback(
    (fromIdx: number, direction: 'up' | 'down') => {
      const toIdx = direction === 'up' ? fromIdx - 1 : fromIdx + 1;
      if (toIdx < 0 || toIdx >= wbsColumns.length) return;
      const next = [...wbsColumns];
      [next[fromIdx], next[toIdx]] = [next[toIdx], next[fromIdx]];
      reorderColumns(next);
    },
    [wbsColumns, reorderColumns],
  );

  const showAll = () => {
    const updated = wbsColumns.map((c) => ({ ...c, visible: true }));
    reorderColumns(updated);
  };

  const hideOptional = () => {
    const updated = wbsColumns.map((c) => ({
      ...c,
      visible: FIXED_KEYS.has(c.key),
    }));
    reorderColumns(updated);
  };

  return (
    <div className="absolute left-0 top-10 z-50 w-80 rounded-lg border border-gray-200 bg-white shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">Columns</span>
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            {visibleCount}/{totalCount}
          </span>
        </div>
        <button onClick={toggleColumnSettings} className="rounded p-1 hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      {/* Search + quick actions */}
      <div className="border-b border-gray-100 px-3 py-2">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full rounded-md border border-gray-200 py-1.5 pl-8 pr-3 text-xs focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={showAll}
            className="rounded bg-blue-50 px-2.5 py-1 text-[10px] font-medium text-blue-700 hover:bg-blue-100"
          >
            Show All
          </button>
          <button
            onClick={hideOptional}
            className="rounded bg-gray-50 px-2.5 py-1 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
          >
            Hide Optional
          </button>
        </div>
      </div>

      {/* Column list by category */}
      <div className="max-h-[400px] overflow-y-auto">
        {categorized.map(({ category, columns }) => (
          <div key={category}>
            <div className="sticky top-0 bg-gray-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
              {category}
            </div>
            {columns.map((col) => (
              <div
                key={col.key}
                className="flex items-center gap-1.5 px-3 py-1 hover:bg-gray-50"
              >
                {/* Reorder buttons */}
                <div className="flex flex-col">
                  <button
                    onClick={() => moveColumn(col.idx, 'up')}
                    disabled={col.idx === 0}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => moveColumn(col.idx, 'down')}
                    disabled={col.idx === wbsColumns.length - 1}
                    className="text-gray-300 hover:text-gray-500 disabled:opacity-30"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </div>

                {/* Toggle visibility */}
                <button
                  onClick={() => {
                    if (!FIXED_KEYS.has(col.key)) setColumnVisible(col.key, !col.visible);
                  }}
                  disabled={FIXED_KEYS.has(col.key)}
                  className={`rounded p-0.5 ${
                    FIXED_KEYS.has(col.key)
                      ? 'cursor-not-allowed text-gray-300'
                      : col.visible
                        ? 'text-blue-600 hover:bg-blue-50'
                        : 'text-gray-400 hover:bg-gray-100'
                  }`}
                  title={
                    FIXED_KEYS.has(col.key)
                      ? 'Required column'
                      : col.visible
                        ? 'Hide column'
                        : 'Show column'
                  }
                >
                  {col.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>

                {/* Label */}
                <span
                  className={`flex-1 text-xs ${col.visible ? 'font-medium text-gray-700' : 'text-gray-400'}`}
                >
                  {col.label}
                </span>

                {/* Fixed badge */}
                {FIXED_KEYS.has(col.key) && (
                  <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-400">
                    required
                  </span>
                )}

                {/* Width indicator */}
                <span className="text-[9px] text-gray-300">{col.width}px</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
