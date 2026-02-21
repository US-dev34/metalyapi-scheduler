import React, { useState } from 'react';
import {
  X, Brain, RefreshCcw, Loader2, TrendingUp,
  Lightbulb, FileText, CalendarCheck,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { useGenerateForecast } from '@/hooks/useAI';
import { ForecastView } from '@/components/ai/ForecastView';
import { aiApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ForecastResponse } from '@/types';

type TabId = 'forecast' | 'optimize' | 'report' | 'digest';

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'forecast', label: 'Forecast', icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: 'optimize', label: 'Optimize', icon: <Lightbulb className="h-3.5 w-3.5" /> },
  { id: 'report', label: 'Report', icon: <FileText className="h-3.5 w-3.5" /> },
  { id: 'digest', label: 'Digest', icon: <CalendarCheck className="h-3.5 w-3.5" /> },
];

export const AIPanel: React.FC = () => {
  const setAIPanelOpen = useUIStore((s) => s.setAIPanelOpen);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const [activeTab, setActiveTab] = useState<TabId>('forecast');
  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [optimizeData, setOptimizeData] = useState<any>(null);
  const [reportData, setReportData] = useState<any>(null);
  const [digestData, setDigestData] = useState<any>(null);
  const [loading, setLoading] = useState<TabId | null>(null);

  const generateForecast = useGenerateForecast(activeProjectId ?? '');

  const handleGenerate = async () => {
    if (!activeProjectId) return;
    setLoading(activeTab);

    try {
      switch (activeTab) {
        case 'forecast':
          generateForecast.mutate(undefined, {
            onSuccess: (data) => {
              setForecastData(data as ForecastResponse);
              setLoading(null);
            },
            onError: () => setLoading(null),
          });
          return;
        case 'optimize': {
          const opt = await aiApi.getOptimization(activeProjectId);
          setOptimizeData(opt);
          break;
        }
        case 'report': {
          const rpt = await aiApi.getReport(activeProjectId);
          setReportData(rpt);
          break;
        }
        case 'digest': {
          const dig = await aiApi.getDailyDigest(activeProjectId);
          setDigestData(dig);
          break;
        }
      }
    } catch (e) {
      console.error(`${activeTab} generation failed:`, e);
    } finally {
      setLoading(null);
    }
  };

  const isLoading = loading === activeTab || (activeTab === 'forecast' && generateForecast.isPending);

  return (
    <div className="flex w-[480px] flex-col border-l border-gray-200 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-800">AI Assistant</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleGenerate}
            disabled={!activeProjectId || isLoading}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            title="Generate"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setAIPanelOpen(false)}
            className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium transition-colors',
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!activeProjectId ? (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Select a project first.
          </div>
        ) : (
          <>
            {activeTab === 'forecast' && (
              <>
                <ForecastView forecast={forecastData} isLoading={generateForecast.isPending} />
                {!forecastData && !generateForecast.isPending && (
                  <GenerateButton onClick={handleGenerate} label="Generate Forecast" />
                )}
              </>
            )}

            {activeTab === 'optimize' && (
              <OptimizeView data={optimizeData} isLoading={isLoading} onGenerate={handleGenerate} />
            )}

            {activeTab === 'report' && (
              <ReportView data={reportData} isLoading={isLoading} onGenerate={handleGenerate} />
            )}

            {activeTab === 'digest' && (
              <DigestView data={digestData} isLoading={isLoading} onGenerate={handleGenerate} />
            )}
          </>
        )}
      </div>
    </div>
  );
};

const GenerateButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <div className="mt-4 text-center">
    <button
      onClick={onClick}
      className="rounded-md bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700"
    >
      {label}
    </button>
  </div>
);

const OptimizeView: React.FC<{ data: any; isLoading: boolean; onGenerate: () => void }> = ({ data, isLoading, onGenerate }) => {
  if (isLoading) return <div className="p-4 text-center text-sm text-gray-500">Analyzing schedule...</div>;
  if (!data) return <GenerateButton onClick={onGenerate} label="Run Optimization" />;

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
        <p className="text-xs font-medium text-blue-800">{data.total} suggestions found</p>
      </div>
      {data.suggestions?.map((s: any, i: number) => (
        <div key={i} className="rounded-lg border border-gray-200 p-3">
          <div className="flex items-center justify-between">
            <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
              {s.type?.replace('_', ' ').toUpperCase()}
            </span>
            <span className="text-[10px] font-bold text-gray-600">Impact: {s.impact_score}</span>
          </div>
          <p className="mt-2 text-xs text-gray-700">{s.description}</p>
        </div>
      ))}
    </div>
  );
};

const ReportView: React.FC<{ data: any; isLoading: boolean; onGenerate: () => void }> = ({ data, isLoading, onGenerate }) => {
  if (isLoading) return <div className="p-4 text-center text-sm text-gray-500">Generating report...</div>;
  if (!data) return <GenerateButton onClick={onGenerate} label="Generate Report" />;

  return (
    <div className="space-y-3">
      <div className="prose prose-xs max-w-none rounded-lg border border-gray-200 bg-gray-50 p-4">
        <div
          className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: data.markdown?.replace(/\n/g, '<br/>') || 'No report content' }}
        />
      </div>
      <div className="text-[10px] text-gray-400">
        Generated: {data.generated_at ? new Date(data.generated_at).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
};

const DigestView: React.FC<{ data: any; isLoading: boolean; onGenerate: () => void }> = ({ data, isLoading, onGenerate }) => {
  if (isLoading) return <div className="p-4 text-center text-sm text-gray-500">Building daily digest...</div>;
  if (!data) return <GenerateButton onClick={onGenerate} label="Generate Daily Digest" />;

  const kpi = data.kpi || {};
  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="rounded-lg border border-gray-200 bg-blue-50 p-3">
        <p className="text-xs text-gray-800">{data.summary}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-2">
        <KpiCard label="Workers" value={kpi.total_workers} trend={kpi.worker_trend} />
        <KpiCard label="Active Items" value={kpi.active_items} />
        <KpiCard label="QTY Today" value={kpi.qty_today} trend={kpi.qty_trend} />
        <KpiCard label="Overall Progress" value={`${kpi.overall_progress}%`} />
      </div>

      {/* Highlights */}
      {data.highlights?.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-gray-700">Highlights</h4>
          {data.highlights.map((h: any, i: number) => (
            <div key={i} className="mb-1 rounded border border-green-200 bg-green-50 px-3 py-1.5 text-xs text-green-800">
              <span className="font-mono font-medium">{h.wbs_code}</span> — {h.qty_today} units, {h.workers} workers
            </div>
          ))}
        </div>
      )}

      {/* Concerns */}
      {data.concerns?.length > 0 && (
        <div>
          <h4 className="mb-1 text-xs font-semibold text-gray-700">Concerns</h4>
          {data.concerns.map((c: any, i: number) => (
            <div key={i} className="mb-1 rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-800">
              <span className="font-mono font-medium">{c.wbs_code}</span> — {c.issue}
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-gray-400">
        Generated: {data.generated_at ? new Date(data.generated_at).toLocaleString() : 'N/A'}
      </div>
    </div>
  );
};

const KpiCard: React.FC<{ label: string; value: any; trend?: number }> = ({ label, value, trend }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-2.5">
    <div className="text-[10px] font-medium uppercase text-gray-400">{label}</div>
    <div className="flex items-baseline gap-1">
      <span className="text-lg font-bold text-gray-900">{value ?? '-'}</span>
      {trend !== undefined && trend !== 0 && (
        <span className={cn('text-[10px] font-medium', trend > 0 ? 'text-green-600' : 'text-red-600')}>
          {trend > 0 ? '+' : ''}{trend}
        </span>
      )}
    </div>
  </div>
);
