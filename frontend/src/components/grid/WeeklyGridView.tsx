import React, { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ColGroupDef, ValueFormatterParams, CellClassParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Calendar, Settings2 } from 'lucide-react';
import { parseISO, addWeeks, startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAllocationMatrix } from '@/hooks/useAllocations';
import { wbsApi } from '@/lib/api';
import { ColumnSettings } from '@/components/grid/ColumnSettings';
import { formatQuantity, cn } from '@/lib/utils';
import type { WBSProgress, DailyMatrixResponse, WBSItem } from '@/types';

interface WeekColumn {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
  monthKey: string;
}

interface WeeklyRow {
  id: string;
  wbs_code: string;
  wbs_name: string;
  wbs_number: string;
  qty: number;
  progress_pct: number;
  total_actual_manday: number;
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

function buildWeekColumns(projectStart: string, projectEnd: string): WeekColumn[] {
  const start = parseISO(projectStart);
  const end = parseISO(projectEnd);
  const columns: WeekColumn[] = [];
  let weekStart = startOfISOWeek(start);
  while (weekStart <= end) {
    const weekEnd = endOfISOWeek(weekStart);
    const weekNum = getISOWeek(weekStart);
    const year = getISOWeekYear(weekStart);
    const key = `${year}-KW${String(weekNum).padStart(2, '0')}`;
    const label = `KW${String(weekNum).padStart(2, '0')}`;
    const monthKey = format(weekStart, 'yyyy-MM');
    columns.push({ key, label, startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd'), monthKey });
    weekStart = addWeeks(weekStart, 1);
  }
  return columns;
}

function getWeekKey(dateStr: string): string {
  const d = parseISO(dateStr);
  return `${getISOWeekYear(d)}-KW${String(getISOWeek(d)).padStart(2, '0')}`;
}

export const WeeklyGridView: React.FC = () => {
  const programRange = useUIStore((s) => s.programRange);
  const wbsColumns = useUIStore((s) => s.wbsColumns);
  const columnSettingsOpen = useUIStore((s) => s.columnSettingsOpen);
  const toggleColumnSettings = useUIStore((s) => s.toggleColumnSettings);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const { data: matrixData, isLoading } = useAllocationMatrix(activeProjectId, programRange);
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

  const weekColumns = useMemo<WeekColumn[]>(
    () => buildWeekColumns(programRange.from, programRange.to),
    [programRange],
  );

  const { allRows, kpi } = useMemo(() => {
    if (!matrixData || !weekColumns.length) {
      return { allRows: [] as WeeklyRow[], kpi: { planned: 0, actual: 0, variance: 0, avgProductivity: 0 } };
    }

    const { wbs_items: progressItems, date_range, matrix } = matrixData as DailyMatrixResponse;
    const rows: WeeklyRow[] = [];
    const progressIds = new Set(progressItems.map((w: WBSProgress) => w.id));
    let totalPlanned = 0, totalActual = 0, totalQtyDone = 0;

    // Summary rows not in progress
    if (wbsItems) {
      for (const item of wbsItems) {
        if (item.is_summary && !progressIds.has(item.id)) {
          rows.push({
            id: item.id, wbs_code: item.wbs_code, wbs_name: item.wbs_name, wbs_number: '',
            qty: 0, progress_pct: 0, total_actual_manday: 0,
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
      const row: WeeklyRow = {
        id: wbs.id, wbs_code: wbs.wbs_code, wbs_name: wbs.wbs_name, wbs_number: '',
        qty: wbs.qty, progress_pct: wbs.progress_pct,
        total_actual_manday: wbs.total_actual_manday,
        parent_id: info?.parent_id ?? null, level: info?.level ?? 2, is_summary: info?.is_summary ?? false,
        building: info?.building || '', unit: info?.unit || '',
        qty_ext: info?.qty_ext || 0, done_ext: info?.done_ext || 0, rem_ext: info?.rem_ext || 0,
        qty_int: info?.qty_int || 0, done_int: info?.done_int || 0, rem_int: info?.rem_int || 0,
        budget_eur: info?.budget_eur || 0, target_kw: info?.target_kw || '',
        status: info?.status || '', scope: info?.scope || '',
        nta_ref: info?.nta_ref || '', notes: info?.notes || '',
      };

      // Aggregate daily data into weeks
      const wbsMatrix = matrix[wbs.id] || {};
      const weekSums: Record<string, { planned: number; actual: number }> = {};
      for (const wc of weekColumns) weekSums[wc.key] = { planned: 0, actual: 0 };

      for (const d of date_range) {
        const cell = wbsMatrix[d];
        if (cell) {
          const wk = getWeekKey(d);
          if (weekSums[wk]) {
            weekSums[wk].planned += cell.planned;
            weekSums[wk].actual += cell.actual;
            totalPlanned += cell.planned;
            totalActual += cell.actual;
            totalQtyDone += cell.qty_done;
          }
        }
      }

      for (const wc of weekColumns) {
        row[wc.key] = weekSums[wc.key].actual;
        row[`_p_${wc.key}`] = weekSums[wc.key].planned;
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

    // Compute numbering
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
        row.wbs_number = `${parentRow?.wbs_number || parentNum}.${childCounters[pid]}`;
      }
    }

    return {
      allRows: rows,
      kpi: {
        planned: totalPlanned, actual: totalActual,
        variance: totalActual - totalPlanned,
        avgProductivity: totalActual > 0 ? totalQtyDone / totalActual : 0,
      },
    };
  }, [matrixData, weekColumns, wbsItems, wbsLookup, wbsCodeById]);

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

  const currentWeekKey = getWeekKey(format(new Date(), 'yyyy-MM-dd'));

  // Build left columns from wbsColumns config (same as DailyGridView)
  const leftCols = useMemo<ColDef[]>(() => {
    const cols: ColDef[] = [];
    const visibleCols = wbsColumns.filter((c) => c.visible);

    for (const col of visibleCols) {
      switch (col.key) {
        case 'wbs_number':
          cols.push({
            headerName: '#', field: 'wbs_number', width: col.width,
            pinned: 'left', lockPinned: true,
            cellStyle: (p: CellClassParams) => ({ color: '#6b7280', fontWeight: p.data?.is_summary ? 700 : 400, ...sumBg(p) }),
          });
          break;
        case 'wbs_code':
          cols.push({
            headerName: 'Code', field: 'wbs_code', width: col.width,
            pinned: 'left', lockPinned: true, sortable: true, filter: true,
            valueFormatter: (p: ValueFormatterParams) => {
              if (!p.data) return '';
              const { is_summary, wbs_code } = p.data as WeeklyRow;
              const arrow = is_summary ? (collapsedGroups.has(p.data.id) ? '\u25B6 ' : '\u25BC ') : '';
              return `${arrow}${wbs_code}`;
            },
            cellStyle: (p: CellClassParams) => ({
              fontFamily: 'monospace', fontSize: '13px',
              fontWeight: p.data?.is_summary ? 700 : 500,
              cursor: p.data?.is_summary ? 'pointer' : 'default',
              paddingLeft: `${(p.data?.level || 0) * 12 + 4}px`,
              ...sumBg(p),
            }),
            onCellClicked: (p) => { if (p.data?.is_summary) toggleGroup(p.data.id); },
          });
          break;
        case 'wbs_name':
          cols.push({
            headerName: 'Activity', field: 'wbs_name', width: col.width,
            pinned: 'left', lockPinned: true,
            cellStyle: (p: CellClassParams) => ({ fontWeight: p.data?.is_summary ? 700 : 400, fontSize: '13px', ...sumBg(p) }),
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

  // Group week columns by month
  const weekColumnGroups = useMemo<ColGroupDef[]>(() => {
    const monthGroups = new Map<string, WeekColumn[]>();
    for (const wc of weekColumns) {
      if (!monthGroups.has(wc.monthKey)) monthGroups.set(wc.monthKey, []);
      monthGroups.get(wc.monthKey)!.push(wc);
    }

    const groups: ColGroupDef[] = [];
    for (const [monthKey, weeks] of monthGroups) {
      const monthDate = parseISO(monthKey + '-01');
      const monthLabel = format(monthDate, 'MMMM yyyy');

      const children: ColDef[] = weeks.map((wc) => ({
        headerName: wc.label, field: wc.key, width: 60, type: 'numericColumn',
        headerClass: wc.key === currentWeekKey ? 'ag-header-cell-today' : '',
        headerTooltip: `${wc.startDate} \u2014 ${wc.endDate}`,
        valueFormatter: (p: ValueFormatterParams) => { const v = p.value as number; return v > 0 ? v.toFixed(1) : ''; },
        cellStyle: (p: CellClassParams) => {
          if (p.data?.is_summary) return { backgroundColor: '#F0F0F0' };
          const actual = (p.value as number) || 0;
          const planned = (p.data?.[`_p_${wc.key}`] as number) || 0;
          let bg = '#FFFFFF';
          if (!actual && !planned) bg = '#F5F5F5';
          else if (actual > planned) bg = '#C8E6C9';
          else if (actual < planned && planned > 0) bg = '#FFCDD2';
          return {
            backgroundColor: bg, fontWeight: actual > 0 ? 600 : 400, fontSize: '11px',
            textAlign: 'center' as const,
            ...(wc.key === currentWeekKey ? { borderLeft: '2px solid #2563eb', borderRight: '2px solid #2563eb' } : {}),
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
  }, [weekColumns, currentWeekKey]);

  const columnDefs = useMemo<(ColDef | ColGroupDef)[]>(
    () => [...leftCols, ...weekColumnGroups],
    [leftCols, weekColumnGroups],
  );
  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, suppressMovable: true }), []);

  if (!activeProjectId) {
    return <div className="flex h-full items-center justify-center text-gray-500">Select a project to view the weekly summary.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800">Weekly Summary</h2>
          <span className="text-xs text-gray-500">
            Jan 2026 \u2014 Jul 2026 ({weekColumns.length} weeks)
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-4 gap-2">
            <KPIBadge label="Planned" value={formatQuantity(kpi.planned)} color="blue" />
            <KPIBadge label="Actual" value={formatQuantity(kpi.actual)} color="green" />
            <KPIBadge label="Variance" value={`${kpi.variance >= 0 ? '+' : ''}${formatQuantity(kpi.variance)}`} color={kpi.variance >= 0 ? 'green' : 'red'} />
            <KPIBadge label="Prod." value={kpi.avgProductivity.toFixed(3)} color="indigo" />
          </div>
          <div className="relative">
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
      </div>

      <div className="ag-theme-alpine flex-1" style={{ width: '100%' }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-500">Loading weekly data...</div>
        ) : (
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={false}
            enableCellTextSelection
            getRowId={(p) => p.data.id}
            headerHeight={32}
            rowHeight={28}
            suppressScrollOnNewData
            groupHeaderHeight={28}
          />
        )}
      </div>
    </div>
  );
};

const KPIBadge: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-green-50 text-green-700',
    red: 'bg-red-50 text-red-700',
    indigo: 'bg-indigo-50 text-indigo-700',
  };
  return (
    <div className={cn('rounded px-2 py-1 text-center', colors[color] ?? 'bg-gray-50 text-gray-700')}>
      <div className="text-[9px] font-medium uppercase">{label}</div>
      <div className="text-xs font-bold">{value}</div>
    </div>
  );
};
