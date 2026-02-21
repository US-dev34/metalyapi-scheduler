import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { formatDateDisplay } from '@/lib/utils';

export const DateNavigator: React.FC = () => {
  const dateRange = useUIStore((s) => s.dateRange);
  const navigateWeek = useUIStore((s) => s.navigateWeek);
  const goToToday = useUIStore((s) => s.goToToday);

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-gray-400">
        Date Range
      </span>

      {/* Navigation buttons */}
      <div className="flex items-center gap-1">
        <button
          onClick={() => navigateWeek('prev')}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-sidebar-hover hover:text-white"
          title="Previous week"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <button
          onClick={goToToday}
          className="flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium text-gray-300 transition-colors hover:bg-sidebar-hover hover:text-white"
          title="Go to today"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          Today
        </button>

        <button
          onClick={() => navigateWeek('next')}
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-sidebar-hover hover:text-white"
          title="Next week"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Date range display */}
      <div className="text-center text-xs text-gray-400">
        <span>{formatDateDisplay(dateRange.from)}</span>
        <span className="mx-1">-</span>
        <span>{formatDateDisplay(dateRange.to)}</span>
      </div>
    </div>
  );
};
