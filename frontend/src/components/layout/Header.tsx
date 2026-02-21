import React, { useRef, useCallback, useState } from 'react';
import {
  Bell,
  Search,
  User,
  Download,
  Upload,
  MessageSquare,
  Brain,
  FileDown,
  ChevronDown,
  LogOut,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useProjectStore } from '@/stores/projectStore';
import { reportsApi, wbsApi } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export const Header: React.FC = () => {
  const activeView = useUIStore((s) => s.activeView);
  const toggleChatPanel = useUIStore((s) => s.toggleChatPanel);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const chatPanelOpen = useUIStore((s) => s.chatPanelOpen);
  const aiPanelOpen = useUIStore((s) => s.aiPanelOpen);
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const activeProject = useProjectStore((s) => s.activeProject);
  const project = activeProject();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUserMenuOpen(false);
  }, []);

  const viewLabels: Record<string, string> = {
    daily: 'Daily Allocation Matrix',
    weekly: 'Weekly Summary',
    summary: 'Project Summary',
  };

  const handleExportExcel = useCallback(async () => {
    if (!activeProjectId) return;
    setIsExporting(true);
    try {
      await reportsApi.exportExcel(activeProjectId);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [activeProjectId]);

  const handleImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !activeProjectId) return;

    setIsImporting(true);
    try {
      const result = await wbsApi.importWBS(activeProjectId, file);
      console.log(`Imported ${result.imported} items`, result.errors.length > 0 ? `with ${result.errors.length} errors` : '');
      if (result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
      }
      // Reload page to refresh data
      window.location.reload();
    } catch (err) {
      console.error('Import failed:', err);
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [activeProjectId]);

  const handleDownloadTemplate = useCallback(async () => {
    if (!activeProjectId) return;
    try {
      await reportsApi.downloadSample(activeProjectId);
    } catch (err) {
      console.error('Template download failed:', err);
    }
    setImportMenuOpen(false);
  }, [activeProjectId]);

  const handleOpenImportDialog = useCallback(() => {
    fileInputRef.current?.click();
    setImportMenuOpen(false);
  }, []);

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-6">
      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImportFile}
      />

      {/* Left: Title */}
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-gray-900">
          {viewLabels[activeView] ?? 'Schedule'}
        </h1>
        {project && (
          <span className="rounded-full bg-primary-100 px-3 py-0.5 text-xs font-medium text-primary-700">
            {project.code}
          </span>
        )}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Search */}
        <button className="btn-icon" title="Search">
          <Search className="h-4 w-4 text-gray-500" />
        </button>

        {/* Import with dropdown */}
        <div className="relative">
          <button
            className={cn(
              'btn-icon flex items-center gap-0.5',
              isImporting && 'opacity-50 cursor-not-allowed',
            )}
            title="Import data"
            onClick={() => setImportMenuOpen(!importMenuOpen)}
            disabled={isImporting}
          >
            <Upload className="h-4 w-4 text-gray-500" />
            <ChevronDown className="h-3 w-3 text-gray-400" />
          </button>
          {importMenuOpen && (
            <>
              {/* Backdrop to close menu */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setImportMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleOpenImportDialog}
                >
                  <Upload className="h-4 w-4" />
                  Import from Excel
                </button>
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleDownloadTemplate}
                >
                  <FileDown className="h-4 w-4" />
                  Download Template
                </button>
              </div>
            </>
          )}
        </div>

        {/* Export */}
        <button
          className={cn(
            'btn-icon',
            isExporting && 'opacity-50 cursor-not-allowed',
          )}
          title="Export data"
          onClick={handleExportExcel}
          disabled={isExporting || !activeProjectId}
        >
          <Download className="h-4 w-4 text-gray-500" />
        </button>

        <div className="mx-2 h-6 w-px bg-gray-200" />

        {/* Chat Toggle */}
        <button
          onClick={toggleChatPanel}
          className={cn(
            'rounded-md p-2 transition-colors',
            chatPanelOpen
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 hover:bg-gray-100',
          )}
          title="Chat input"
        >
          <MessageSquare className="h-4 w-4" />
        </button>

        {/* AI Toggle */}
        <button
          onClick={toggleAIPanel}
          className={cn(
            'rounded-md p-2 transition-colors',
            aiPanelOpen
              ? 'bg-primary-100 text-primary-700'
              : 'text-gray-500 hover:bg-gray-100',
          )}
          title="AI forecast"
        >
          <Brain className="h-4 w-4" />
        </button>

        <div className="mx-2 h-6 w-px bg-gray-200" />

        {/* Notifications */}
        <button className="btn-icon relative" title="Notifications">
          <Bell className="h-4 w-4 text-gray-500" />
          <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-red-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
          >
            <User className="h-5 w-5" />
          </button>
          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-md border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
