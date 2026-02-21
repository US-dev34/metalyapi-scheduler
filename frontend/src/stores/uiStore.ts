import { create } from 'zustand';
import type { ViewMode, DateRange, FilterState } from '@/types';
import { getWeekRange, shiftDateRange } from '@/lib/utils';

interface UIState {
  // View
  activeView: ViewMode;
  setActiveView: (view: ViewMode) => void;

  // Date Range
  dateRange: DateRange;
  setDateRange: (range: DateRange) => void;
  navigateWeek: (direction: 'prev' | 'next') => void;
  goToToday: () => void;

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
