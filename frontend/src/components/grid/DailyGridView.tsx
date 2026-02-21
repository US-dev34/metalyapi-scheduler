import React, { useMemo, useCallback, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  CellValueChangedEvent,
  CellClassParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';

import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAllocationMatrix, useBatchUpdate } from '@/hooks/useAllocations';
import { wbsApi } from '@/lib/api';
import { GridToolbar } from '@/components/grid/GridToolbar';
import { formatDayHeader, formatQuantity, isToday } from '@/lib/utils';
import type { AllocationCell, CellData, WBSProgress, DailyMatrixResponse, WBSItem } from '@/types';
import { getCellStatus, getCellColor } from '@/types';
import { useQuery } from '@tanstack/react-query';

const DEBOUNCE_MS = 500;

interface GridRow {
  id: string;
  wbs_code: string;
  wbs_name: string;
  qty: number;
  done: number;
  remaining: number;
  progress_pct: number;
  total_actual_manday: number;
  working_days: number;
  parent_id: string | null;
  level: number;
  is_summary: boolean;
  [key: string]: unknown;
}

export const DailyGridView: React.FC = () => {
  const dateRange = useUIStore((s) => s.dateRange);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const pendingUpdates = useRef<AllocationCell[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: matrixData, isLoading, error } = useAllocationMatrix(activeProjectId, dateRange);
  const batchMutation = useBatchUpdate(activeProjectId ?? '');

  const { data: wbsItems } = useQuery({
    queryKey: ['wbs', activeProjectId],
    queryFn: () => wbsApi.getByProject(activeProjectId!),
    enabled: !!activeProjectId,
    staleTime: 60000,
  });

  const wbsLookup = useMemo(() => {
    const map = new Map<string, WBSItem>();
    if (wbsItems) for (const w of wbsItems) map.set(w.id, w);
    return map;
  }, [wbsItems]);

  const wbsCodeById = useMemo(() => {
    const map = new Map<string, string>();
    if (wbsItems) for (const w of wbsItems) map.set(w.id, w.wbs_code);
    return map;
  }, [wbsItems]);

  // Build rows with hierarchy + date cell data
  const allRows = useMemo<GridRow[]>(() => {
    if (!matrixData) return [];
    const { wbs_items: progressItems, date_range, matrix } = matrixData as DailyMatrixResponse;
    const rows: GridRow[] = [];
    const progressIds = new Set(progressItems.map((w: WBSProgress) => w.id));

    // Summary rows not in progress
    if (wbsItems) {
      for (const item of wbsItems) {
        if (item.is_summary && !progressIds.has(item.id)) {
          rows.push({
            id: item.id, wbs_code: item.wbs_code, wbs_name: item.wbs_name,
            qty: item.qty, done: 0, remaining: item.qty, progress_pct: 0,
            total_actual_manday: 0, working_days: 0,
            parent_id: item.parent_id, level: item.level, is_summary: true,
          });
        }
      }
    }

    for (const wbs of progressItems) {
      const info = wbsLookup.get(wbs.id);
      const row: GridRow = {
        id: wbs.id, wbs_code: wbs.wbs_code, wbs_name: wbs.wbs_name,
        qty: wbs.qty, done: wbs.done, remaining: wbs.remaining,
        progress_pct: wbs.progress_pct, total_actual_manday: wbs.total_actual_manday,
        working_days: wbs.working_days,
        parent_id: info?.parent_id ?? null, level: info?.level ?? 2,
        is_summary: info?.is_summary ?? false,
      };
      const wbsMatrix = matrix[wbs.id] || {};
      for (const d of date_range) {
        const cell: CellData = wbsMatrix[d] || { planned: 0, actual: 0, qty_done: 0, is_future: false };
        row[d] = cell.actual;
        row[`_p_${d}`] = cell.planned;
        row[`_f_${d}`] = cell.is_future ? 1 : 0;
      }
      rows.push(row);
    }

    // Sort children under parents
    rows.sort((a, b) => {
      const ap = a.parent_id ? wbsCodeById.get(a.parent_id) || '' : '';
      const bp = b.parent_id ? wbsCodeById.get(b.parent_id) || '' : '';
      const ak = a.is_summary ? `${a.wbs_code}/` : `${ap}/${a.wbs_code}`;
      const bk = b.is_summary ? `${b.wbs_code}/` : `${bp}/${b.wbs_code}`;
      return ak.localeCompare(bk);
    });

    // Compute hierarchical numbering: 1, 1.1, 1.2, 2, 2.1, etc.
    let parentNum = 0;
    const childCounters: Record<string, number> = {};
    for (const row of rows) {
      if (row.is_summary || !row.parent_id) {
        parentNum++;
        row.wbs_number = String(parentNum);
        childCounters[row.id] = 0;
      } else {
        const pid = row.parent_id;
        childCounters[pid] = (childCounters[pid] || 0) + 1;
        const parentRow = rows.find(r => r.id === pid);
        const pNum = parentRow?.wbs_number || String(parentNum);
        row.wbs_number = `${pNum}.${childCounters[pid]}`;
      }
    }

    return rows;
  }, [matrixData, wbsItems, wbsLookup, wbsCodeById]);

  const rowData = useMemo(() =>
    allRows.filter(row => !row.parent_id || !collapsedGroups.has(row.parent_id)),
    [allRows, collapsedGroups]
  );

  const toggleGroup = useCallback((id: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const sumBg = (p: CellClassParams) =>
    p.data?.is_summary ? { backgroundColor: '#F0F0F0', fontWeight: 700 } : {};

  // Pinned WBS columns
  const wbsColumns: ColDef[] = useMemo(() => [
    {
      headerName: '#', field: 'wbs_number', width: 70,
      pinned: 'left', lockPinned: true,
      cellStyle: (params: CellClassParams) => ({
        fontWeight: params.data?.is_summary ? 700 : 400,
        color: '#6b7280',
        ...sumBg(params),
      }),
    },
    {
      headerName: 'Code', field: 'wbs_code', width: 120,
      pinned: 'left', lockPinned: true, sortable: true, filter: true,
      valueFormatter: (params: ValueFormatterParams) => {
        if (!params.data) return '';
        const { is_summary, wbs_code } = params.data as GridRow;
        const arrow = is_summary ? (collapsedGroups.has(params.data.id) ? '▶ ' : '▼ ') : '  ';
        return `${arrow}${wbs_code}`;
      },
      cellStyle: (params: CellClassParams) => ({
        fontFamily: 'monospace', fontSize: '13px',
        fontWeight: params.data?.is_summary ? 700 : 500,
        cursor: params.data?.is_summary ? 'pointer' : 'default',
        paddingLeft: `${(params.data?.level || 0) * 16 + 4}px`,
        ...sumBg(params),
      }),
      onCellClicked: (params) => {
        if (params.data?.is_summary) toggleGroup(params.data.id);
      },
    },
    { headerName: 'Activity', field: 'wbs_name', width: 200, pinned: 'left', lockPinned: true,
      cellStyle: (params: CellClassParams) => ({ fontWeight: params.data?.is_summary ? 700 : 400, ...sumBg(params) }) },
    { headerName: 'QTY', field: 'qty', width: 75, pinned: 'left', lockPinned: true, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number), cellStyle: sumBg },
    { headerName: 'Done', field: 'done', width: 70, pinned: 'left', lockPinned: true, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number), cellStyle: sumBg },
    { headerName: 'Rem', field: 'remaining', width: 70, pinned: 'left', lockPinned: true, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number), cellStyle: sumBg },
    { headerName: 'Progress', field: 'progress_pct', width: 80, pinned: 'left', lockPinned: true, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => `${(p.value as number).toFixed(1)}%`,
      cellStyle: (p: CellClassParams) => {
        const v = p.value as number;
        const base = sumBg(p);
        return v >= 100 ? { ...base, color: '#16a34a', fontWeight: 700 }
             : v >= 50 ? { ...base, color: '#2563eb', fontWeight: 600 }
             : { ...base, color: '#6b7280' };
      },
    },
    { headerName: 'Total MD', field: 'total_actual_manday', width: 80, pinned: 'left', lockPinned: true, type: 'numericColumn',
      valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number), cellStyle: sumBg },
    { headerName: 'Days', field: 'working_days', width: 55, pinned: 'left', lockPinned: true, type: 'numericColumn', cellStyle: sumBg },
  ], [collapsedGroups, toggleGroup]);

  // Date columns — scrollable
  const dateColumns: ColDef[] = useMemo(() => {
    if (!matrixData) return [];
    return (matrixData as DailyMatrixResponse).date_range.map((d: string) => ({
      headerName: formatDayHeader(d),
      field: d,
      width: 75,
      editable: (params: CellClassParams) => !params.data?.is_summary,
      type: 'numericColumn',
      headerClass: isToday(d) ? 'ag-header-cell-today' : '',
      valueFormatter: (params: ValueFormatterParams) => {
        const v = params.value as number;
        return v > 0 ? String(v) : '';
      },
      cellStyle: (params: CellClassParams) => {
        if (params.data?.is_summary) return { backgroundColor: '#F0F0F0' };
        const actual = (params.value as number) || 0;
        const planned = (params.data?.[`_p_${d}`] as number) || 0;
        const isFuture = (params.data?.[`_f_${d}`] as number) === 1;
        const bg = getCellColor(getCellStatus({ planned, actual, qty_done: 0, is_future: isFuture }));
        return {
          backgroundColor: bg, fontWeight: actual > 0 ? 600 : 400,
          textAlign: 'center' as const, fontSize: '13px',
          ...(isToday(d) ? { borderLeft: '2px solid #2563eb', borderRight: '2px solid #2563eb' } : {}),
        };
      },
    }));
  }, [matrixData]);

  const columnDefs = useMemo(() => [...wbsColumns, ...dateColumns], [wbsColumns, dateColumns]);
  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, suppressMovable: true }), []);

  const onCellValueChanged = useCallback((event: CellValueChangedEvent) => {
    if (!activeProjectId) return;
    const field = event.colDef.field;
    if (!field?.match(/^\d{4}-\d{2}-\d{2}$/)) return;
    if ((event.data as GridRow).is_summary) return;
    pendingUpdates.current.push({ wbs_id: (event.data as GridRow).id, date: field, actual_manpower: Number(event.newValue) || 0 });
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (pendingUpdates.current.length > 0) {
        batchMutation.mutate([...pendingUpdates.current]);
        pendingUpdates.current = [];
      }
    }, DEBOUNCE_MS);
  }, [activeProjectId, batchMutation]);

  if (!activeProjectId) return <div className="flex h-full items-center justify-center text-gray-500">Select a project to view the daily allocation matrix.</div>;
  if (error) return <div className="flex h-full items-center justify-center text-red-500">Error: {(error as Error).message}</div>;

  return (
    <div className="flex h-full flex-col">
      <GridToolbar />
      <div className="ag-theme-alpine flex-1" style={{ width: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          onCellValueChanged={onCellValueChanged}
          animateRows={false}
          enableCellTextSelection
          loading={isLoading}
          getRowId={(params) => params.data.id}
          headerHeight={36}
          rowHeight={32}
          suppressScrollOnNewData
          stopEditingWhenCellsLoseFocus
        />
      </div>
    </div>
  );
};
