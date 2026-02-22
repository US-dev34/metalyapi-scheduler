import React, { useMemo, useCallback, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type {
  ColDef,
  ColGroupDef,
  CellValueChangedEvent,
  CellClassParams,
  ValueFormatterParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Settings2 } from 'lucide-react';
import { format, parseISO, getISOWeek } from 'date-fns';

import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAllocationMatrix, useBatchUpdate } from '@/hooks/useAllocations';
import { wbsApi } from '@/lib/api';
import { GridToolbar } from '@/components/grid/GridToolbar';
import { ColumnSettings } from '@/components/grid/ColumnSettings';
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
  building: string;
  unit: string;
  qty_ext: number;
  done_ext: number;
  rem_ext: number;
  qty_int: number;
  done_int: number;
  rem_int: number;
  budget_eur: number;
  target_kw: string;
  status: string;
  scope: string;
  nta_ref: string;
  notes: string;
  [key: string]: unknown;
}

export const DailyGridView: React.FC = () => {
  const programRange = useUIStore((s) => s.programRange);
  const wbsColumns = useUIStore((s) => s.wbsColumns);
  const columnSettingsOpen = useUIStore((s) => s.columnSettingsOpen);
  const toggleColumnSettings = useUIStore((s) => s.toggleColumnSettings);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const pendingUpdates = useRef<AllocationCell[]>([]);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Fetch full program range
  const { data: matrixData, isLoading, error } = useAllocationMatrix(activeProjectId, programRange);
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

  // Build rows with hierarchy + date cell data + extended fields
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
            building: item.building || '', unit: item.unit || '',
            qty_ext: item.qty_ext || 0, done_ext: item.done_ext || 0, rem_ext: item.rem_ext || 0,
            qty_int: item.qty_int || 0, done_int: item.done_int || 0, rem_int: item.rem_int || 0,
            budget_eur: item.budget_eur || 0, target_kw: item.target_kw || '',
            status: item.status || '', scope: item.scope || '',
            nta_ref: item.nta_ref || '', notes: item.notes || '',
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
        building: info?.building || '', unit: info?.unit || '',
        qty_ext: info?.qty_ext || 0, done_ext: info?.done_ext || 0, rem_ext: info?.rem_ext || 0,
        qty_int: info?.qty_int || 0, done_int: info?.done_int || 0, rem_int: info?.rem_int || 0,
        budget_eur: info?.budget_eur || 0, target_kw: info?.target_kw || '',
        status: info?.status || '', scope: info?.scope || '',
        nta_ref: info?.nta_ref || '', notes: info?.notes || '',
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

    // Compute hierarchical numbering
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

  // Build configurable left columns based on user settings
  const leftColumns: ColDef[] = useMemo(() => {
    const cols: ColDef[] = [];
    const visibleCols = wbsColumns.filter((c) => c.visible);

    for (const col of visibleCols) {
      switch (col.key) {
        case 'wbs_number':
          cols.push({
            headerName: '#', field: 'wbs_number', width: col.width,
            pinned: 'left', lockPinned: true,
            cellStyle: (params: CellClassParams) => ({
              fontWeight: params.data?.is_summary ? 700 : 400,
              color: '#6b7280', fontSize: '12px',
              ...sumBg(params),
            }),
          });
          break;
        case 'wbs_code':
          cols.push({
            headerName: 'Code', field: 'wbs_code', width: col.width,
            pinned: 'left', lockPinned: true, sortable: true, filter: true,
            valueFormatter: (params: ValueFormatterParams) => {
              if (!params.data) return '';
              const { is_summary, wbs_code } = params.data as GridRow;
              const arrow = is_summary ? (collapsedGroups.has(params.data.id) ? '\u25B6 ' : '\u25BC ') : '';
              return `${arrow}${wbs_code}`;
            },
            cellStyle: (params: CellClassParams) => ({
              fontFamily: 'monospace', fontSize: '13px',
              fontWeight: params.data?.is_summary ? 700 : 500,
              cursor: params.data?.is_summary ? 'pointer' : 'default',
              paddingLeft: `${(params.data?.level || 0) * 12 + 4}px`,
              ...sumBg(params),
            }),
            onCellClicked: (params) => {
              if (params.data?.is_summary) toggleGroup(params.data.id);
            },
          });
          break;
        case 'wbs_name':
          cols.push({
            headerName: 'Activity', field: 'wbs_name', width: col.width,
            pinned: 'left', lockPinned: true,
            cellStyle: (params: CellClassParams) => ({
              fontWeight: params.data?.is_summary ? 700 : 400,
              fontSize: '13px',
              ...sumBg(params),
            }),
          });
          break;
        case 'progress_pct':
          cols.push({
            headerName: '%', field: 'progress_pct', width: col.width,
            pinned: 'left', lockPinned: true, type: 'numericColumn',
            valueFormatter: (p: ValueFormatterParams) => {
              const v = p.value as number;
              return v === 0 ? '' : `${v.toFixed(0)}%`;
            },
            cellStyle: (p: CellClassParams) => {
              const v = p.value as number;
              const base = sumBg(p);
              return v >= 100 ? { ...base, color: '#16a34a', fontWeight: 700 }
                   : v >= 50 ? { ...base, color: '#2563eb', fontWeight: 600 }
                   : { ...base, color: '#6b7280' };
            },
          });
          break;
        case 'total_actual_manday':
          cols.push({
            headerName: 'MD', field: 'total_actual_manday', width: col.width,
            pinned: 'left', lockPinned: true, type: 'numericColumn',
            valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number),
            cellStyle: sumBg,
          });
          break;
        case 'qty':
          cols.push({
            headerName: 'QTY', field: 'qty', width: col.width,
            pinned: 'left', lockPinned: true, type: 'numericColumn',
            valueFormatter: (p: ValueFormatterParams) => formatQuantity(p.value as number),
            cellStyle: sumBg,
          });
          break;
        case 'budget_eur':
          cols.push({
            headerName: 'Budget', field: 'budget_eur', width: col.width,
            pinned: 'left', lockPinned: true, type: 'numericColumn',
            valueFormatter: (p: ValueFormatterParams) => {
              const v = p.value as number;
              return v > 0 ? v.toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '';
            },
            cellStyle: sumBg,
          });
          break;
        default:
          // Generic text/numeric columns from extended fields
          cols.push({
            headerName: col.label, field: col.key, width: col.width,
            pinned: 'left', lockPinned: true,
            valueFormatter: (p: ValueFormatterParams) => {
              const v = p.value;
              if (v === null || v === undefined || v === '' || v === 0) return '';
              if (typeof v === 'number') return formatQuantity(v);
              return String(v);
            },
            cellStyle: sumBg,
          });
          break;
      }
    }
    return cols;
  }, [wbsColumns, collapsedGroups, toggleGroup]);

  // Group date columns by month for a clean header structure
  const dateColumnGroups = useMemo<(ColDef | ColGroupDef)[]>(() => {
    if (!matrixData) return [];
    const dateRange = (matrixData as DailyMatrixResponse).date_range;
    if (!dateRange.length) return [];

    // Group dates by month
    const monthGroups = new Map<string, string[]>();
    for (const d of dateRange) {
      const monthKey = d.substring(0, 7); // "2026-01"
      if (!monthGroups.has(monthKey)) monthGroups.set(monthKey, []);
      monthGroups.get(monthKey)!.push(d);
    }

    const groups: ColGroupDef[] = [];
    for (const [monthKey, dates] of monthGroups) {
      const monthDate = parseISO(monthKey + '-01');
      const monthLabel = format(monthDate, 'MMMM yyyy');

      const children: ColDef[] = dates.map((d) => ({
        headerName: formatDayHeader(d),
        field: d,
        width: 52,
        editable: (params: CellClassParams) => !params.data?.is_summary,
        type: 'numericColumn',
        headerClass: isToday(d) ? 'ag-header-cell-today' : '',
        headerTooltip: format(parseISO(d), 'EEEE, d MMMM yyyy'),
        valueFormatter: (params: ValueFormatterParams) => {
          const actual = (params.value as number) || 0;
          const planned = (params.data?.[`_p_${d}`] as number) || 0;
          if (actual > 0) return String(actual);
          if (planned > 0) return `[${planned}]`;
          return '';
        },
        cellStyle: (params: CellClassParams) => {
          if (params.data?.is_summary) return { backgroundColor: '#F0F0F0' };
          const actual = (params.value as number) || 0;
          const planned = (params.data?.[`_p_${d}`] as number) || 0;
          const isFuture = (params.data?.[`_f_${d}`] as number) === 1;
          const bg = getCellColor(getCellStatus({ planned, actual, qty_done: 0, is_future: isFuture }));
          // Weekend columns get a subtle striped look
          const dayOfWeek = parseISO(d).getDay();
          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
          return {
            backgroundColor: isWeekend && !actual && !planned ? '#ECECEC' : bg,
            fontWeight: actual > 0 ? 600 : 400,
            color: actual > 0 ? '#111827' : planned > 0 ? '#9ca3af' : '#d1d5db',
            textAlign: 'center' as const, fontSize: '11px',
            ...(isToday(d) ? { borderLeft: '2px solid #2563eb', borderRight: '2px solid #2563eb' } : {}),
          };
        },
      }));

      groups.push({
        headerName: monthLabel,
        headerClass: 'ag-header-group-month',
        children,
      });
    }

    return groups;
  }, [matrixData]);

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => [...leftColumns, ...dateColumnGroups],
    [leftColumns, dateColumnGroups],
  );
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
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <GridToolbar />
        </div>
        <div className="relative pr-2">
          <button
            onClick={toggleColumnSettings}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            title="Configure columns"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Columns
          </button>
          {columnSettingsOpen && <ColumnSettings />}
        </div>
      </div>
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
          headerHeight={32}
          rowHeight={28}
          suppressScrollOnNewData
          stopEditingWhenCellsLoseFocus
          groupHeaderHeight={28}
        />
      </div>
    </div>
  );
};
