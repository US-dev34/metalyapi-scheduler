import React from 'react';
import { LayoutGrid, Calendar, BarChart3 } from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';
import type { ViewMode } from '@/types';

interface ViewOption {
  mode: ViewMode;
  label: string;
  icon: React.ReactNode;
}

const viewOptions: ViewOption[] = [
  { mode: 'daily', label: 'Daily', icon: <LayoutGrid className="h-3.5 w-3.5" /> },
  { mode: 'weekly', label: 'Weekly', icon: <Calendar className="h-3.5 w-3.5" /> },
  { mode: 'summary', label: 'Summary', icon: <BarChart3 className="h-3.5 w-3.5" /> },
];

export const ViewToggle: React.FC = () => {
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <div className="flex flex-col gap-1">
      <span className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
        View
      </span>
      <div className="flex rounded-md bg-gray-800 p-0.5">
        {viewOptions.map((opt) => (
          <button
            key={opt.mode}
            onClick={() => setActiveView(opt.mode)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1.5 text-xs font-medium transition-colors',
              activeView === opt.mode
                ? 'bg-primary-600 text-white shadow-sm'
                : 'text-gray-400 hover:text-white',
            )}
          >
            {opt.icon}
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
};
