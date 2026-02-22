// ============================================================
// MetalYapi Construction Scheduling - TypeScript Type Definitions
// Aligned with INTERFACE_CONTRACTS.md IC-001, IC-002, IC-003
//
// Note: API uses snake_case, frontend uses camelCase.
// API client layer transforms between the two.
// ============================================================

// ----- View & UI Types -----

export type ViewMode = 'daily' | 'weekly' | 'summary';

export interface DateRange {
  from: string; // YYYY-MM-DD
  to: string;   // YYYY-MM-DD
}

export interface FilterState {
  search: string;
  wbsLevels: number[];
  showOnlyActive: boolean;
  buildings: string[];
  statuses: string[];
  targetKw: string;
  progressMin: number | null;
  progressMax: number | null;
}

// ----- Project Types (IC-001: projects table) -----

export interface Project {
  id: string;
  name: string;
  code: string;
  start_date: string;
  end_date: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface ProjectCreate {
  name: string;
  code: string;
  start_date: string;
  end_date?: string;
}

// ----- WBS Types (IC-001: wbs_items table) -----

export interface WBSItem {
  id: string;
  project_id: string;
  parent_id: string | null;
  wbs_code: string;
  wbs_name: string;
  qty: number;
  unit: string;
  sort_order: number;
  level: number;
  is_summary: boolean;
  building: string | null;
  nta_ref: string | null;
  status: string | null;
  budget_eur: number;
  target_kw: string | null;
  scope: string | null;
  notes: string | null;
  qty_ext: number;
  done_ext: number;
  rem_ext: number;
  qty_int: number;
  done_int: number;
  rem_int: number;
  children?: WBSItem[];
}

// ----- Allocation Types (IC-001: daily_allocations table) -----

export interface DailyAllocation {
  id: string;
  wbs_item_id: string;
  date: string;           // YYYY-MM-DD
  planned_manpower: number;
  actual_manpower: number;
  qty_done: number;
  notes: string | null;
  source: 'grid' | 'chat';
}

// ----- IC-002: Backend API → Frontend Client -----

export interface AllocationCell {
  wbs_id: string;
  date: string;
  actual_manpower?: number;
  qty_done?: number;
  notes?: string;
}

export interface AllocationBatchUpdate {
  updates: AllocationCell[];
  source: 'grid' | 'chat';
}

export interface AllocationBatchResponse {
  updated_count: number;
  errors: Array<{ wbs_id: string; date: string; error: string }>;
}

export interface CellData {
  planned: number;     // baseline manpower
  actual: number;      // actual_manpower
  qty_done: number;
  is_future: boolean;
}

export type CellStatus = 'empty' | 'equal' | 'over' | 'under' | 'future';

export interface WBSProgress {
  id: string;
  wbs_code: string;
  wbs_name: string;
  qty: number;
  done: number;
  remaining: number;
  progress_pct: number;
  total_actual_manday: number;
  working_days: number;
  productivity_rate: number;
}

export interface DailyMatrixResponse {
  wbs_items: WBSProgress[];
  date_range: string[];        // ["2026-02-17", "2026-02-18", ...]
  matrix: Record<string, Record<string, CellData>>;  // {wbs_id: {date: CellData}}
  totals: Record<string, { planned: number; actual: number }>;
}

// ----- Baseline Types -----

export interface Baseline {
  id: string;
  project_id: string;
  version: number;
  name: string;
  approved_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface BaselineCreate {
  name: string;
  notes?: string;
}

// ----- IC-003: AI Service → Frontend -----

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  parsed?: ChatParseResponse;
}

export interface ParsedAction {
  wbs_code: string;
  date: string;
  actual_manpower: number;
  qty_done: number;
  note?: string;
}

export interface ChatParseResponse {
  message_id: string;
  actions: ParsedAction[];
  summary: string;
  confidence: number;
  applied: boolean;
}

export interface ForecastItem {
  wbs_code: string;
  wbs_name: string;
  current_progress: number;
  predicted_end_date: string;
  predicted_total_manday: number;
  risk_level: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface ForecastResponse {
  forecasts: ForecastItem[];
  overall_summary: string;
  generated_at: string;
}

// ----- Error Types -----

export interface ApiError {
  error: string;
  code: string;
  details?: Record<string, unknown>;
}

// ----- Utility -----

export function getCellStatus(cell: CellData): CellStatus {
  if (cell.is_future) return 'future';
  if (!cell.actual && !cell.planned) return 'empty';
  if (cell.actual === cell.planned) return 'equal';
  if (cell.actual > cell.planned) return 'over';
  return 'under';
}

export function getCellColor(status: CellStatus): string {
  switch (status) {
    case 'future': return '#E3F2FD';   // light blue
    case 'empty': return '#F5F5F5';     // gray
    case 'equal': return '#FFFFFF';     // white
    case 'over': return '#C8E6C9';      // green
    case 'under': return '#FFCDD2';     // red
    default: return '#FFFFFF';
  }
}
