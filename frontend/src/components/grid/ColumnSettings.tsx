import React, { useCallback } from 'react';
import { X, GripVertical, Eye, EyeOff } from 'lucide-react';
import { useUIStore, type ColumnConfig } from '@/stores/uiStore';

export const ColumnSettings: React.FC = () => {
  const wbsColumns = useUIStore((s) => s.wbsColumns);
  const setColumnVisible = useUIStore((s) => s.setColumnVisible);
  const reorderColumns = useUIStore((s) => s.reorderColumns);
  const toggleColumnSettings = useUIStore((s) => s.toggleColumnSettings);

  // Fixed columns that cannot be hidden
  const fixedKeys = new Set(['wbs_number', 'wbs_code', 'wbs_name']);

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

  return (
    <div className="absolute left-0 top-10 z-50 w-72 rounded-lg border border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <span className="text-sm font-semibold text-gray-800">Column Settings</span>
        <button onClick={toggleColumnSettings} className="rounded p-1 hover:bg-gray-100">
          <X className="h-4 w-4 text-gray-500" />
        </button>
      </div>
      <div className="max-h-80 overflow-y-auto p-1">
        {wbsColumns.map((col, idx) => (
          <div
            key={col.key}
            className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-gray-50"
          >
            <button
              className="cursor-grab text-gray-300 hover:text-gray-500"
              onClick={() => moveColumn(idx, 'up')}
              title="Move up"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                if (!fixedKeys.has(col.key)) setColumnVisible(col.key, !col.visible);
              }}
              disabled={fixedKeys.has(col.key)}
              className={`rounded p-0.5 ${
                fixedKeys.has(col.key)
                  ? 'cursor-not-allowed text-gray-300'
                  : col.visible
                    ? 'text-blue-600 hover:bg-blue-50'
                    : 'text-gray-400 hover:bg-gray-100'
              }`}
              title={col.visible ? 'Hide column' : 'Show column'}
            >
              {col.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <span
              className={`flex-1 text-xs ${col.visible ? 'font-medium text-gray-700' : 'text-gray-400'}`}
            >
              {col.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
