import React from 'react';
import { TrendingUp, AlertTriangle, CalendarCheck, Target } from 'lucide-react';
import type { ForecastResponse, ForecastItem } from '@/types';
import { cn, formatDateDisplay } from '@/lib/utils';

interface ForecastViewProps {
  forecast: ForecastResponse | null;
  isLoading?: boolean;
}

export const ForecastView: React.FC<ForecastViewProps> = ({ forecast, isLoading }) => {
  if (isLoading) {
    return <div className="p-4 text-center text-sm text-gray-500">Generating forecast...</div>;
  }

  if (!forecast || forecast.forecasts.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-gray-500">
        No forecast data available. Click "Generate Forecast" to create one.
      </div>
    );
  }

  const highRisk = forecast.forecasts.filter((f) => f.risk_level === 'high').length;
  const medRisk = forecast.forecasts.filter((f) => f.risk_level === 'medium').length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-blue-600" />
            <span className="text-[10px] font-medium uppercase text-gray-500">Items</span>
          </div>
          <p className="mt-1 text-sm font-bold text-gray-900">{forecast.forecasts.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-red-50 p-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-[10px] font-medium uppercase text-gray-500">High Risk</span>
          </div>
          <p className="mt-1 text-sm font-bold text-gray-900">{highRisk}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <span className="text-[10px] font-medium uppercase text-gray-500">Medium Risk</span>
          </div>
          <p className="mt-1 text-sm font-bold text-gray-900">{medRisk}</p>
        </div>
      </div>

      {/* Overall summary */}
      {forecast.overall_summary && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <p className="text-xs text-gray-700">{forecast.overall_summary}</p>
        </div>
      )}

      {/* Forecast table */}
      <div className="overflow-hidden rounded-lg border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left font-medium text-gray-600">WBS</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Progress</th>
              <th className="px-3 py-2 text-left font-medium text-gray-600">End Date</th>
              <th className="px-3 py-2 text-right font-medium text-gray-600">Manday</th>
              <th className="px-3 py-2 text-center font-medium text-gray-600">Risk</th>
            </tr>
          </thead>
          <tbody>
            {forecast.forecasts.map((item, i) => (
              <ForecastRow key={i} item={item} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Generated timestamp */}
      <div className="text-[10px] text-gray-400">
        Generated: {new Date(forecast.generated_at).toLocaleString('en-US')}
      </div>
    </div>
  );
};

const ForecastRow: React.FC<{ item: ForecastItem }> = ({ item }) => {
  const riskColors: Record<string, string> = {
    low: 'bg-green-100 text-green-700',
    medium: 'bg-amber-100 text-amber-700',
    high: 'bg-red-100 text-red-700',
  };

  return (
    <tr className="border-t border-gray-100 hover:bg-gray-50">
      <td className="px-3 py-1.5">
        <span className="font-mono font-medium text-gray-700">{item.wbs_code}</span>
        <span className="ml-1 text-gray-400">{item.wbs_name}</span>
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums font-medium">
        {item.current_progress.toFixed(1)}%
      </td>
      <td className="px-3 py-1.5 text-gray-600">
        {formatDateDisplay(item.predicted_end_date)}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-gray-600">
        {item.predicted_total_manday}
      </td>
      <td className="px-3 py-1.5 text-center">
        <span className={cn(
          'rounded-full px-2 py-0.5 text-[10px] font-medium',
          riskColors[item.risk_level] ?? 'bg-gray-100 text-gray-600',
        )}>
          {item.risk_level.toUpperCase()}
        </span>
      </td>
    </tr>
  );
};
