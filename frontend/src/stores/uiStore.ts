import { create } from 'zustand';
import type { ViewMode, DateRange, FilterState } from '@/types';
import { getWeekRange, shiftDateRange } from '@/lib/utils';

// Full program range: Jan 2026 - Jul 2026
const PROGRAM_RANGE: DateRange = { from: '2026-01-01', to: '2026-07-31' };

// Column visibility config for WBS metadata columns
export interface ColumnConfig {
  key: string;
  label: string;
  visible: boolean;
  width: number;
}

const DEFAULT_WBS_COLUMNS: ColumnConfig[] = [
  { key: 'wbs_number', label: '#', visible: true, width: 55 },
  { key: 'wbs_code', label: 'Code', visible: true, width: 100 },
  { key: 'wbs_name', label: 'Activity', visible: true, width: 240 },
  { key: 'building', label: 'Building', visible: false, width: 80 },
  { key: 'unit', label: 'Unit', visible: false, width: 60 },
  { key: 'qty', label: 'QTY', visible: true, width: 65 },
  { key: 'qty_ext', label: 'QTY Ext', visible: false, width: 70 },
  { key: 'done_ext', label: 'Done Ext', visible: false, width: 70 },
  { key: 'rem_ext', label: 'Rem Ext', visible: false, width: 70 },
  { key: 'qty_int', label: 'QTY Int', visible: false, width: 70 },
  { key: 'done_int', label: 'Done Int', visible: false, width: 70 },
  { key: 'rem_int', label: 'Rem Int', visible: false, width: 70 },
  { key: 'budget_eur', label: 'Budget', visible: false, width: 90 },
  { key: 'target_kw', label: 'Target KW', visible: false, width: 80 },
  { key: 'status', label: 'Status', visible: false, width: 80 },
  { key: 'scope', label: 'Scope', visible: false, width: 80 },
  { key: 'nta_ref', label: 'NTA Ref', visible: false, width: 80 },
  { key: 'notes', label: 'Notes', visible: false, width: 120 },
  { key: 'tp_pos', label: 'TP Pos', visible: false, width: 80 },
  { key: 'pkg', label: 'Package', visible: true, width: 70 },
  { key: 'manpower', label: 'MP', visible: false, width: 55 },
  { key: 'duration', label: 'Dur', visible: false, width: 55 },
  { key: 'total_md', label: 'TMD', visible: false, width: 60 },
  { key: 'responsible', label: 'Resp', visible: false, width: 90 },
  { key: 'pmt_ref', label: 'Pmt', visible: false, width: 70 },
  { key: 'progress_pct', label: '%', visible: true, width: 55 },
  { key: 'total_actual_manday', label: 'MD', visible: true, width: 55 },
];

interface UIState {
  // View
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  // Date Range (for daily navigation within the program)
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  navigateWeek: (direction: 'prev' | 'next') => void;
  goToToday: () => void;

  // Full program range
  programRange: DateRange;

  // Column configuration
  wbsColumns: ColumnConfig[];
  setColumnVisible: (key: string, visible: boolean) => void;
  reorderColumns: (columns: ColumnConfig[]) => void;
  columnSettingsOpen: boolean;
  toggleColumnSettings: () => void;

  // Filters
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;

  // Panels
  chatPanelOpen: boolean;
  toggleChatPanel: () => void;
  setChatPanelOpen: (open: boolean) => void;

  aiPanelOpen: boolean;
  toggleAIPanel: () => void;
  setAIPanelOpen: (open: boolean) => void;

  // Sidebar
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

const defaultFilters: FilterState = {
  search: '',
  wbsLevels: [],
  showOnlyActive: true,
  buildings: [],
  statuses: [],
  targetKw: '',
  progressMin: null,
  progressMax: null,
};

const todayRange = getWeekRange(new Date());

export const useUIStore = create<UIState>((set, get) => ({
  // View
  activeView: 'daily',
  setActiveView: (view) => set({ activeView: view }),

  // Date Range
  dateRange: todayRange,
  setDateRange: (range) => set({ dateRange: range }),
  navigateWeek: (direction) => {
    const { dateRange } = get();
    const days = direction === 'next' ? 7 : -7;
    set({ dateRange: shiftDateRange(dateRange, days) });
  },
  goToToday: () => set({ dateRange: getWeekRange(new Date()) }),

  // Full program range
  programRange: PROGRAM_RANGE,

  // Column configuration
  wbsColumns: DEFAULT_WBS_COLUMNS,
  setColumnVisible: (key, visible) =>
    set((state) => ({
      wbsColumns: state.wbsColumns.map((c) =>
        c.key === key ? { ...c, visible } : c,
      ),
    })),
  reorderColumns: (columns) => set({ wbsColumns: columns }),
  columnSettingsOpen: false,
  toggleColumnSettings: () =>
    set((state) => ({ columnSettingsOpen: !state.columnSettingsOpen })),

  // Filters
  filters: defaultFilters,
  setFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),
  resetFilters: () => set({ filters: defaultFilters }),

  // Panels
  chatPanelOpen: false,
  toggleChatPanel: () =>
    set((state) => ({
      chatPanelOpen: !state.chatPanelOpen,
      aiPanelOpen: state.chatPanelOpen ? state.aiPanelOpen : false,
    })),
  setChatPanelOpen: (open) =>
    set({ chatPanelOpen: open, ...(open ? { aiPanelOpen: false } : {}) }),

  aiPanelOpen: false,
  toggleAIPanel: () =>
    set((state) => ({
      aiPanelOpen: !state.aiPanelOpen,
      chatPanelOpen: state.aiPanelOpen ? state.chatPanelOpen : false,
    })),
  setAIPanelOpen: (open) =>
    set({ aiPanelOpen: open, ...(open ? { chatPanelOpen: false } : {}) }),

  // Sidebar
  sidebarCollapsed: false,
  toggleSidebar: () =>
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
}));
