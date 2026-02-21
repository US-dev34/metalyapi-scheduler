import React, { useRef, useState } from 'react';
import {
  Download,
  Upload,
  Filter,
  Save,
  RefreshCcw,
  Columns,
  FileText,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { FilterPanel } from '@/components/shared/FilterPanel';
import { reportsApi, wbsApi } from '@/lib/api';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

export const GridToolbar: React.FC = () => {
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dateRange = useUIStore((s) => s.dateRange);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const queryClient = useQueryClient();

  const handleExportExcel = async () => {
    if (!activeProjectId) return;
    setLoading('excel');
    setShowExportMenu(false);
    try {
      await reportsApi.exportExcel(activeProjectId);
    } catch (e) {
      console.error('Excel export failed:', e);
    } finally {
      setLoading(null);
    }
  };

  const handleExportPdf = async () => {
    if (!activeProjectId) return;
    setLoading('pdf');
    setShowExportMenu(false);
    try {
      await reportsApi.exportPdf(activeProjectId);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setLoading(null);
    }
  };

  const handleExportProgress = async () => {
    if (!activeProjectId) return;
    setLoading('progress');
    setShowExportMenu(false);
    try {
      await reportsApi.exportProgress(activeProjectId);
    } catch (e) {
      console.error('Progress report failed:', e);
    } finally {
      setLoading(null);
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeProjectId) return;
    setLoading('import');
    try {
      const result = await wbsApi.importWBS(activeProjectId, file);
      queryClient.invalidateQueries({ queryKey: ['wbs'] });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
      alert(`Imported ${result.imported} items. ${result.errors.length} errors.`);
    } catch (err) {
      console.error('Import failed:', err);
      alert('Import failed. Check console for details.');
    } finally {
      setLoading(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['wbs'] });
    queryClient.invalidateQueries({ queryKey: ['allocations'] });
  };

  const isLoading = loading !== null;

  return (
    <div className="mb-2 space-y-2">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Toolbar row */}
      <div className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-2">
        {/* Left actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              showFilters
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>

          <button className="flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200">
            <Columns className="h-3.5 w-3.5" />
            Columns
          </button>
        </div>

        {/* Date range indicator */}
        <div className="text-xs font-medium text-gray-500">
          {dateRange.from} to {dateRange.to}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={handleImport}
            disabled={isLoading}
            className="flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
          >
            {loading === 'import' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="h-3.5 w-3.5" />
            )}
            Import
          </button>

          {/* Export dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              disabled={isLoading}
              className="flex items-center gap-1.5 rounded-md bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200 disabled:opacity-50"
            >
              {loading && loading !== 'import' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Download className="h-3.5 w-3.5" />
              )}
              Export
            </button>

            {showExportMenu && (
              <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  onClick={handleExportExcel}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5 text-green-600" />
                  Excel (.xlsx)
                </button>
                <button
                  onClick={handleExportPdf}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="h-3.5 w-3.5 text-red-600" />
                  PDF — Daily Report
                </button>
                <button
                  onClick={handleExportProgress}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  PDF — Progress Report
                </button>
              </div>
            )}
          </div>

          <button className="flex items-center gap-1.5 rounded-md bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">
            <Save className="h-3.5 w-3.5" />
            Save
          </button>
        </div>
      </div>

      {/* Collapsible filter panel */}
      {showFilters && <FilterPanel />}
    </div>
  );
};
