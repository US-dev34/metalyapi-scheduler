import React from 'react';
import { BarChart3, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { useProjectStore } from '@/stores/projectStore';
import { useUIStore } from '@/stores/uiStore';
import { useAllocationMatrix } from '@/hooks/useAllocations';
import { formatPercent, formatQuantity } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { WBSProgress } from '@/types';

export const SummaryView: React.FC = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const dateRange = useUIStore((s) => s.dateRange);
  const { data: matrixData, isLoading } = useAllocationMatrix(activeProjectId, dateRange);

  if (!activeProjectId) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <p>Select a project to view the summary.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-gray-500">
        <p>Loading summary data...</p>
      </div>
    );
  }

  const wbsItems: WBSProgress[] = matrixData?.wbs_items ?? [];
  const totalItems = wbsItems.length;
  const completedItems = wbsItems.filter((w) => w.progress_pct >= 100).length;
  const behindItems = wbsItems.filter((w) => w.progress_pct < 30 && w.done > 0).length;
  const overallProgress = totalItems > 0
    ? wbsItems.reduce((acc, w) => acc + w.progress_pct, 0) / totalItems
    : 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={<BarChart3 className="h-5 w-5 text-blue-600" />}
          label="Overall Progress"
          value={formatPercent(overallProgress)}
          bgColor="bg-blue-50"
        />
        <StatCard
          icon={<CheckCircle className="h-5 w-5 text-green-600" />}
          label="Completed"
          value={`${completedItems} / ${totalItems}`}
          bgColor="bg-green-50"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5 text-indigo-600" />}
          label="On Track"
          value={`${totalItems - completedItems - behindItems}`}
          bgColor="bg-indigo-50"
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5 text-red-600" />}
          label="Behind"
          value={`${behindItems}`}
          bgColor="bg-red-50"
        />
      </div>

      {/* Progress table */}
      <div className="flex-1 overflow-auto rounded-lg border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-gray-50">
            <tr className="border-b border-gray-200">
              <th className="px-4 py-2.5 text-left font-medium text-gray-700">Code</th>
              <th className="px-4 py-2.5 text-left font-medium text-gray-700">Name</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">QTY</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">Done</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">Remaining</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">Progress</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">TMD</th>
              <th className="px-4 py-2.5 text-right font-medium text-gray-700">Productivity</th>
            </tr>
          </thead>
          <tbody>
            {wbsItems.map((item) => (
              <tr key={item.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-2 font-mono text-xs font-medium text-gray-700">
                  {item.wbs_code}
                </td>
                <td className="px-4 py-2 text-gray-800">{item.wbs_name}</td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {formatQuantity(item.qty)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-gray-800">
                  {formatQuantity(item.done)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {formatQuantity(item.remaining)}
                </td>
                <td className="px-4 py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-gray-200">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          item.progress_pct >= 100 ? 'bg-green-500' :
                          item.progress_pct >= 50 ? 'bg-blue-500' : 'bg-amber-500',
                        )}
                        style={{ width: `${Math.min(100, item.progress_pct)}%` }}
                      />
                    </div>
                    <span className="text-xs tabular-nums font-medium">
                      {formatPercent(item.progress_pct)}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {formatQuantity(item.total_actual_manday)}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-gray-600">
                  {item.productivity_rate.toFixed(3)}
                </td>
              </tr>
            ))}
            {wbsItems.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-gray-400">
                  No WBS data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  bgColor: string;
}> = ({ icon, label, value, bgColor }) => (
  <div className={cn('rounded-lg border border-gray-200 p-4', bgColor)}>
    <div className="flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="text-xl font-bold text-gray-900">{value}</p>
      </div>
    </div>
  </div>
);
