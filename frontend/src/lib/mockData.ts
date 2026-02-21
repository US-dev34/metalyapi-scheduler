/**
 * Mock data for frontend preview / demo mode.
 * Provides realistic MetalYapi construction scheduling data
 * so the UI can be previewed without a backend or Supabase.
 */
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
import type {
  Project,
  WBSItem,
  WBSProgress,
  DailyMatrixResponse,
  CellData,
  ChatParseResponse,
  ForecastResponse,
} from '@/types';

// ─── Demo mode flag ─────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
export const DEMO_MODE = !supabaseUrl || !supabaseKey;

// ─── Projects ───────────────────────────────────────────────────
export const MOCK_PROJECTS: Project[] = [
  {
    id: 'proj-001',
    name: 'Hamburg Office Tower - Facade',
    code: 'HH-2026',
    start_date: '2026-01-05',
    end_date: '2026-07-31',
    status: 'active',
    created_at: '2025-12-15T10:00:00Z',
    updated_at: '2026-02-20T08:00:00Z',
  },
  {
    id: 'proj-002',
    name: 'Berlin Residential Complex',
    code: 'BER-2026',
    start_date: '2026-03-01',
    end_date: '2026-12-31',
    status: 'active',
    created_at: '2026-01-10T10:00:00Z',
    updated_at: '2026-02-18T08:00:00Z',
  },
];

// ─── WBS Items ──────────────────────────────────────────────────
export const MOCK_WBS_ITEMS: WBSItem[] = [
  // Summary groups
  { id: 'grp-cw', project_id: 'proj-001', parent_id: null, wbs_code: 'CW', wbs_name: 'Curtain Wall', qty: 0, unit: 'm2', sort_order: 1, level: 0, is_summary: true },
  { id: 'grp-dr', project_id: 'proj-001', parent_id: null, wbs_code: 'DR', wbs_name: 'Doors', qty: 0, unit: 'pcs', sort_order: 2, level: 0, is_summary: true },
  { id: 'grp-gl', project_id: 'proj-001', parent_id: null, wbs_code: 'GL', wbs_name: 'Glazing', qty: 0, unit: 'm2', sort_order: 3, level: 0, is_summary: true },
  { id: 'grp-st', project_id: 'proj-001', parent_id: null, wbs_code: 'ST', wbs_name: 'Steel Frame', qty: 0, unit: 'pcs', sort_order: 4, level: 0, is_summary: true },
  { id: 'grp-cl', project_id: 'proj-001', parent_id: null, wbs_code: 'CL', wbs_name: 'Cladding', qty: 0, unit: 'm2', sort_order: 5, level: 0, is_summary: true },
  // Leaf items
  { id: 'wbs-cw01', project_id: 'proj-001', parent_id: 'grp-cw', wbs_code: 'CW-01', wbs_name: 'Curtain Wall Tip-1', qty: 100, unit: 'm2', sort_order: 10, level: 2, is_summary: false },
  { id: 'wbs-cw02', project_id: 'proj-001', parent_id: 'grp-cw', wbs_code: 'CW-02', wbs_name: 'Curtain Wall Tip-2', qty: 150, unit: 'm2', sort_order: 11, level: 2, is_summary: false },
  { id: 'wbs-cw03', project_id: 'proj-001', parent_id: 'grp-cw', wbs_code: 'CW-03', wbs_name: 'Curtain Wall Tip-3', qty: 80, unit: 'm2', sort_order: 12, level: 2, is_summary: false },
  { id: 'wbs-dr01', project_id: 'proj-001', parent_id: 'grp-dr', wbs_code: 'DR-01', wbs_name: 'Door Type-A', qty: 50, unit: 'pcs', sort_order: 20, level: 2, is_summary: false },
  { id: 'wbs-dr02', project_id: 'proj-001', parent_id: 'grp-dr', wbs_code: 'DR-02', wbs_name: 'Door Type-B', qty: 30, unit: 'pcs', sort_order: 21, level: 2, is_summary: false },
  { id: 'wbs-gl01', project_id: 'proj-001', parent_id: 'grp-gl', wbs_code: 'GL-01', wbs_name: 'Glazing Panel', qty: 200, unit: 'm2', sort_order: 30, level: 2, is_summary: false },
  { id: 'wbs-st01', project_id: 'proj-001', parent_id: 'grp-st', wbs_code: 'ST-01', wbs_name: 'Steel Frame Tip-1', qty: 120, unit: 'pcs', sort_order: 40, level: 2, is_summary: false },
  { id: 'wbs-cl01', project_id: 'proj-001', parent_id: 'grp-cl', wbs_code: 'CL-01', wbs_name: 'Cladding Panel Tip-1', qty: 180, unit: 'm2', sort_order: 50, level: 2, is_summary: false },
];

// ─── Progress data per WBS item ─────────────────────────────────
const progressData: Record<string, { done: number; totalMD: number; workDays: number }> = {
  'wbs-cw01': { done: 35, totalMD: 42, workDays: 8 },
  'wbs-cw02': { done: 22, totalMD: 28, workDays: 6 },
  'wbs-cw03': { done: 8, totalMD: 12, workDays: 3 },
  'wbs-dr01': { done: 30, totalMD: 18, workDays: 5 },
  'wbs-dr02': { done: 5, totalMD: 6, workDays: 2 },
  'wbs-gl01': { done: 60, totalMD: 35, workDays: 7 },
  'wbs-st01': { done: 45, totalMD: 30, workDays: 6 },
  'wbs-cl01': { done: 20, totalMD: 15, workDays: 4 },
};

export function getMockWBSProgress(): WBSProgress[] {
  return MOCK_WBS_ITEMS.filter((w) => !w.is_summary).map((w) => {
    const p = progressData[w.id] || { done: 0, totalMD: 0, workDays: 0 };
    const remaining = w.qty - p.done;
    const pct = w.qty > 0 ? (p.done / w.qty) * 100 : 0;
    const prodRate = p.totalMD > 0 ? p.done / p.totalMD : 0;
    return {
      id: w.id,
      wbs_code: w.wbs_code,
      wbs_name: w.wbs_name,
      qty: w.qty,
      done: p.done,
      remaining: Math.max(0, remaining),
      progress_pct: Math.round(pct * 10) / 10,
      total_actual_manday: p.totalMD,
      working_days: p.workDays,
      productivity_rate: Math.round(prodRate * 1000) / 1000,
    };
  });
}

// ─── Daily allocation matrix ────────────────────────────────────
// Seed-based pseudo-random for stable mock data
function seededRandom(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

export function getMockDailyMatrix(fromStr: string, toStr: string): DailyMatrixResponse {
  const from = parseISO(fromStr);
  const to = parseISO(toStr);
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const allDays = eachDayOfInterval({ start: from, end: to });
  const workingDays = allDays.filter((d) => !isWeekend(d));
  const dateRange = workingDays.map((d) => format(d, 'yyyy-MM-dd'));

  const wbsItems = getMockWBSProgress();
  const leafItems = MOCK_WBS_ITEMS.filter((w) => !w.is_summary);

  const matrix: Record<string, Record<string, CellData>> = {};
  const totals: Record<string, { planned: number; actual: number }> = {};

  for (const date of dateRange) {
    totals[date] = { planned: 0, actual: 0 };
  }

  for (let i = 0; i < leafItems.length; i++) {
    const wbs = leafItems[i];
    const wbsRow: Record<string, CellData> = {};

    for (let j = 0; j < dateRange.length; j++) {
      const date = dateRange[j];
      const isFuture = date > todayStr;
      const seed = i * 1000 + j;
      const r = seededRandom(seed);

      // Planned manpower: 3-8 people per item per day
      const planned = Math.floor(r * 6) + 3;

      // Actual: 0 for future, varied for past
      let actual = 0;
      let qtyDone = 0;
      if (!isFuture) {
        const variance = seededRandom(seed + 1);
        actual = Math.max(0, planned + Math.floor(variance * 5) - 2);
        qtyDone = Math.max(0, Math.floor(actual * (0.5 + seededRandom(seed + 2) * 0.8)));
      }

      wbsRow[date] = { planned, actual, qty_done: qtyDone, is_future: isFuture };
      totals[date].planned += planned;
      totals[date].actual += actual;
    }
    matrix[wbs.id] = wbsRow;
  }

  return { wbs_items: wbsItems, date_range: dateRange, matrix, totals };
}

// ─── Chat mock responses ────────────────────────────────────────
export function getMockChatResponse(message: string): ChatParseResponse {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const lowerMsg = message.toLowerCase();

  // Parse simple patterns
  const actions: ChatParseResponse['actions'] = [];

  if (lowerMsg.includes('cw-01')) {
    actions.push({ wbs_code: 'CW-01', date: todayStr, actual_manpower: 5, qty_done: 3, note: undefined });
  }
  if (lowerMsg.includes('cw-02')) {
    actions.push({ wbs_code: 'CW-02', date: todayStr, actual_manpower: 7, qty_done: 5, note: undefined });
  }
  if (lowerMsg.includes('dr-01')) {
    actions.push({ wbs_code: 'DR-01', date: todayStr, actual_manpower: 4, qty_done: 6, note: undefined });
  }

  // Default response if no specific WBS detected
  if (actions.length === 0) {
    actions.push(
      { wbs_code: 'CW-01', date: todayStr, actual_manpower: 5, qty_done: 4, note: undefined },
      { wbs_code: 'CW-02', date: todayStr, actual_manpower: 7, qty_done: 5, note: undefined },
      { wbs_code: 'DR-01', date: todayStr, actual_manpower: 0, qty_done: 0, note: 'No work today' },
    );
  }

  return {
    message_id: `msg-${crypto.randomUUID().slice(0, 8)}`,
    actions,
    summary: `${actions.length} WBS items parsed from your message.`,
    confidence: 0.92,
    applied: false,
  };
}

// ─── Forecast mock data ─────────────────────────────────────────
export function getMockForecast(): ForecastResponse {
  return {
    forecasts: [
      {
        wbs_code: 'CW-01',
        wbs_name: 'Curtain Wall Tip-1',
        current_progress: 35.0,
        predicted_end_date: '2026-04-15',
        predicted_total_manday: 120,
        risk_level: 'medium',
        recommendation: 'At current pace, 1-week delay risk. Consider adding 2 workers from KW12.',
      },
      {
        wbs_code: 'CW-02',
        wbs_name: 'Curtain Wall Tip-2',
        current_progress: 14.7,
        predicted_end_date: '2026-05-10',
        predicted_total_manday: 95,
        risk_level: 'high',
        recommendation: 'Significantly behind schedule. Needs immediate resource reallocation.',
      },
      {
        wbs_code: 'CW-03',
        wbs_name: 'Curtain Wall Tip-3',
        current_progress: 10.0,
        predicted_end_date: '2026-04-30',
        predicted_total_manday: 60,
        risk_level: 'medium',
        recommendation: 'Recently started. Monitor closely over next 2 weeks.',
      },
      {
        wbs_code: 'DR-01',
        wbs_name: 'Door Type-A',
        current_progress: 60.0,
        predicted_end_date: '2026-03-20',
        predicted_total_manday: 45,
        risk_level: 'low',
        recommendation: 'Ahead of schedule. Can redistribute 1 worker to CW-02.',
      },
      {
        wbs_code: 'DR-02',
        wbs_name: 'Door Type-B',
        current_progress: 16.7,
        predicted_end_date: '2026-04-10',
        predicted_total_manday: 25,
        risk_level: 'low',
        recommendation: 'On track. No action needed.',
      },
      {
        wbs_code: 'GL-01',
        wbs_name: 'Glazing Panel',
        current_progress: 30.0,
        predicted_end_date: '2026-05-25',
        predicted_total_manday: 110,
        risk_level: 'low',
        recommendation: 'Progressing well. Productivity above average.',
      },
      {
        wbs_code: 'ST-01',
        wbs_name: 'Steel Frame Tip-1',
        current_progress: 37.5,
        predicted_end_date: '2026-04-20',
        predicted_total_manday: 80,
        risk_level: 'medium',
        recommendation: 'Slight delay possible. Monitor weather conditions for outdoor work.',
      },
      {
        wbs_code: 'CL-01',
        wbs_name: 'Cladding Panel Tip-1',
        current_progress: 11.1,
        predicted_end_date: '2026-06-15',
        predicted_total_manday: 90,
        risk_level: 'low',
        recommendation: 'Early stage. Current pace is adequate.',
      },
    ],
    overall_summary:
      'Overall progress at 26.9%. CW-02 is at high risk with significant delay. DR-01 and GL-01 are ahead of schedule. Total manpower allocation is balanced but CW-02 needs immediate attention. Recommended: redistribute 2 workers from DR-01 to CW-02 starting next week.',
    generated_at: new Date().toISOString(),
  };
}

