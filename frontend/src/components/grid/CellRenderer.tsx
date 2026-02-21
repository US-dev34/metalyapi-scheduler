import React from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import type { CellData, CellStatus } from '@/types';
import { getCellStatus, getCellColor } from '@/types';
import { formatQuantity } from '@/lib/utils';

/**
 * Custom cell renderer for allocation grid cells.
 * Color coding: green (over plan), red (under plan), blue (future), gray (empty), white (equal)
 */
export const CellRenderer: React.FC<ICellRendererParams> = (props) => {
  const { value, data, colDef } = props;
  if (!data || !colDef?.field) return null;

  const dateField = colDef.field;
  const actual = (value as number) || 0;
  const planned = (data[`_planned_${dateField}`] as number) || 0;
  const isFuture = (data[`_future_${dateField}`] as number) === 1;

  const cell: CellData = { planned, actual, qty_done: 0, is_future: isFuture };
  const status = getCellStatus(cell);
  const bgColor = getCellColor(status);

  if (actual === 0 && !isFuture) {
    return (
      <div className="flex h-full items-center justify-end px-1 text-xs text-gray-300" style={{ backgroundColor: bgColor }}>
        -
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-end px-1 text-xs font-medium" style={{ backgroundColor: bgColor }}>
      {formatQuantity(actual)}
    </div>
  );
};

/**
 * Progress bar renderer for the % column.
 */
export const ProgressRenderer: React.FC<ICellRendererParams> = (props) => {
  const progress = (props.value as number) ?? 0;

  let barColor = 'bg-gray-300';
  if (progress >= 100) barColor = 'bg-green-500';
  else if (progress >= 75) barColor = 'bg-blue-500';
  else if (progress >= 50) barColor = 'bg-amber-500';
  else if (progress > 0) barColor = 'bg-orange-400';

  return (
    <div className="flex h-full items-center gap-2 px-1">
      <div className="h-1.5 flex-1 rounded-full bg-gray-200">
        <div className={`h-full rounded-full ${barColor}`} style={{ width: `${Math.min(100, progress)}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-600">{progress.toFixed(0)}%</span>
    </div>
  );
};
