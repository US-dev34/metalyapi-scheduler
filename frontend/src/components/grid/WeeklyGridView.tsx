import React, { useMemo, useState, useCallback } from 'react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef, ValueFormatterParams, CellClassParams } from 'ag-grid-community';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { Calendar } from 'lucide-react';
import { parseISO, addWeeks, startOfISOWeek, endOfISOWeek, getISOWeek, getISOWeekYear, format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';

import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useAllocationMatrix } from '@/hooks/useAllocations';
import { wbsApi } from '@/lib/api';
import { formatQuantity, cn } from '@/lib/utils';
import type { WBSProgress, DailyMatrixResponse, WBSItem } from '@/types';
import { DEMO_MODE, MOCK_WBS_ITEMS } from '@/lib/mockData';

interface WeekColumn {
  key: string;
  label: string;
  startDate: string;
  endDate: string;
}

interface WeeklyRow {
  id: string;
  wbs_code: string;
  wbs_name: string;
  wbs_number: string;
  qty: number;
  progress_pct: number;
  parent_id: string | null;
  level: number;
  is_summary: boolean;
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
    columns.push({ key, label, startDate: format(weekStart, 'yyyy-MM-dd'), endDate: format(weekEnd, 'yyyy-MM-dd') });
    weekStart = addWeeks(weekStart, 1);
  }
  return columns;
}

function getWeekKey(dateStr: string): string {
  const d = parseISO(dateStr);
  return `${getISOWeekYear(d)}-KW${String(getISOWeek(d)).padStart(2, '0')}`;
}

export const WeeklyGridView: React.FC = () => {
  const dateRange = useUIStore((s) => s.dateRange);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.activeProject);
  const project = activeProject();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const fullRange = useMemo(() => {
    if (!project) return dateRange;
    return { from: project.start_date, to: project.end_date || '2026-07-31' };
  }, [project, dateRange]);

  const { data: matrixData, isLoading } = useAllocationMatrix(activeProjectId, fullRange);
  const { data: wbsItems } = useQuery({
    queryKey: ['wbs', activeProjectId],
    queryFn: () => {
      if (DEMO_MODE) return Promise.resolve(MOCK_WBS_ITEMS);
      return wbsApi.getByProject(activeProjectId!);
    },
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

  const weekColumns = useMemo<WeekColumn[]>(() => {
    if (!project) return [];
    return buildWeekColumns(project.start_date, project.end_date || '2026-07-31');
  }, [project]);

  const { allRows, kpi } = useMemo(() => {
    if (!matrixData || !weekColumns.length) {
      return { allRows: [] as WeeklyRow[], kpi: { planned: 0, actual: 0, variance: 0, avgProductivity: 0 } };
    }

    const { wbs_items: progressItems, date_range, matrix } = matrixData as DailyMatrixResponse;
    const rows: WeeklyRow[] = [];
    const progressIds = new Set(progressItems.map((w: WBSProgress) => w.id));
    let totalPlanned = 0, totalActual = 0, totalQtyDone = 0;

    // Add summary rows not in progress
    if (wbsItems) {
      for (const item of wbsItems) {
        if (item.is_summary && !progressIds.has(item.id)) {
          rows.push({
            id: item.id, wbs_code: item.wbs_code, wbs_name: item.wbs_name, wbs_number: '',
            qty: 0, progress_pct: 0, parent_id: item.parent_id, level: item.level, is_summary: true,
          });
        }
      }
    }

    for (const wbs of progressItems) {
      const info = wbsLookup.get(wbs.id);
      const row: WeeklyRow = {
        id: wbs.id, wbs_code: wbs.wbs_code, wbs_name: wbs.wbs_name, wbs_number: '',
        qty: wbs.qty, progress_pct: wbs.progress_pct,
        parent_id: info?.parent_id ?? null, level: info?.level ?? 2, is_summary: info?.is_summary ?? false,
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

  const columnDefs = useMemo<ColDef[]>(() => {
    const fixedCols: ColDef[] = [
      { headerName: '#', field: 'wbs_number', width: 60, pinned: 'left', lockPinned: true,
        cellStyle: (p: CellClassParams) => ({ color: '#6b7280', fontWeight: p.data?.is_summary ? 700 : 400, ...sumBg(p) }) },
      { headerName: 'Code', field: 'wbs_code', width: 120, pinned: 'left', lockPinned: true, sortable: true, filter: true,
        valueFormatter: (p: ValueFormatterParams) => {
          if (!p.data) return '';
          const { is_summary, wbs_code } = p.data as WeeklyRow;
          const arrow = is_summary ? (collapsedGroups.has(p.data.id) ? '▶ ' : '▼ ') : '  ';
          return `${arrow}${wbs_code}`;
        },
        cellStyle: (p: CellClassParams) => ({
          fontFamily: 'monospace', fontSize: '13px',
          fontWeight: p.data?.is_summary ? 700 : 500,
          cursor: p.data?.is_summary ? 'pointer' : 'default',
          paddingLeft: `${(p.data?.level || 0) * 16 + 4}px`,
          ...sumBg(p),
        }),
        onCellClicked: (p) => { if (p.data?.is_summary) toggleGroup(p.data.id); },
      },
      { headerName: 'Activity', field: 'wbs_name', width: 200, pinned: 'left', lockPinned: true,
        cellStyle: (p: CellClassParams) => ({ fontWeight: p.data?.is_summary ? 700 : 400, ...sumBg(p) }) },
      { headerName: 'QTY', field: 'qty', width: 75, pinned: 'left', lockPinned: true, type: 'numericColumn',
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
    ];

    const weekCols: ColDef[] = weekColumns.map((wc) => ({
      headerName: wc.label, field: wc.key, width: 65, type: 'numericColumn',
      headerClass: wc.key === currentWeekKey ? 'ag-header-cell-today' : '',
      headerTooltip: `${wc.startDate} — ${wc.endDate}`,
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
          ...(wc.key === currentWeekKey ? { borderLeft: '2px solid #2563eb', borderRight: '2px solid #2563eb' } : {}),
        };
      },
    }));

    return [...fixedCols, ...weekCols];
  }, [weekColumns, collapsedGroups, toggleGroup, currentWeekKey]);

  const defaultColDef = useMemo<ColDef>(() => ({ resizable: true, suppressMovable: true }), []);

  if (!activeProjectId) {
    return <div className="flex h-full items-center justify-center text-gray-500">Select a project to view the weekly summary.</div>;
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800">Weekly Summary</h2>
        </div>
        <span className="text-xs text-gray-500">
          {project?.start_date ?? ''} to {project?.end_date ?? '2026-07-31'} ({weekColumns.length} weeks)
        </span>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <KPICard label="Total Planned" value={formatQuantity(kpi.planned)} color="blue" />
        <KPICard label="Total Actual" value={formatQuantity(kpi.actual)} color="green" />
        <KPICard label="Variance" value={`${kpi.variance >= 0 ? '+' : ''}${formatQuantity(kpi.variance)}`} color={kpi.variance >= 0 ? 'green' : 'red'} />
        <KPICard label="Avg Productivity" value={kpi.avgProductivity.toFixed(3)} color="indigo" />
      </div>

      <div className="ag-theme-alpine flex-1" style={{ width: '100%' }}>
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-gray-500">Loading...</div>
        ) : (
          <AgGridReact
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            animateRows={false}
            enableCellTextSelection
            getRowId={(p) => p.data.id}
            headerHeight={36}
            rowHeight={32}
            suppressScrollOnNewData
          />
        )}
      </div>
    </div>
  );
};

const KPICard: React.FC<{ label: string; value: string; color: string }> = ({ label, value, color }) => {
  const bg: Record<string, string> = { blue: 'bg-blue-50', green: 'bg-green-50', red: 'bg-red-50', indigo: 'bg-indigo-50' };
  const txt: Record<string, string> = { blue: 'text-blue-700', green: 'text-green-700', red: 'text-red-700', indigo: 'text-indigo-700' };
  return (
    <div className={cn('rounded-lg border border-gray-200 p-3', bg[color] ?? 'bg-gray-50')}>
      <p className="text-[10px] font-medium uppercase text-gray-500">{label}</p>
      <p className={cn('mt-1 text-lg font-bold', txt[color] ?? 'text-gray-900')}>{value}</p>
    </div>
  );
};
