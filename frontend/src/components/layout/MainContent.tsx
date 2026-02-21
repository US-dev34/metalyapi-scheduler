import React from 'react';
import { useUIStore } from '@/stores/uiStore';
import { DailyGridView } from '@/components/grid/DailyGridView';
import { WeeklyGridView } from '@/components/grid/WeeklyGridView';
import { SummaryView } from '@/components/gantt/SummaryView';

export const MainContent: React.FC = () => {
  const activeView = useUIStore((s) => s.activeView);

  const renderView = () => {
    switch (activeView) {
      case 'daily':
        return <DailyGridView />;
      case 'weekly':
        return <WeeklyGridView />;
      case 'summary':
        return <SummaryView />;
      default:
        return <DailyGridView />;
    }
  };

  return (
    <main className="flex-1 overflow-auto bg-gray-50 p-4">
      {renderView()}
    </main>
  );
};
