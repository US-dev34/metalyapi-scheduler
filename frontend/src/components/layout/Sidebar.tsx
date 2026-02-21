import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  MessageSquare,
  Brain,
  Settings,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { ProjectSelector } from '@/components/shared/ProjectSelector';
import { ViewToggle } from '@/components/shared/ViewToggle';
import { DateNavigator } from '@/components/shared/DateNavigator';
import { useUIStore } from '@/stores/uiStore';
import { cn } from '@/lib/utils';

export const Sidebar: React.FC = () => {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const toggleChatPanel = useUIStore((s) => s.toggleChatPanel);
  const toggleAIPanel = useUIStore((s) => s.toggleAIPanel);
  const activeView = useUIStore((s) => s.activeView);
  const setActiveView = useUIStore((s) => s.setActiveView);

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-gray-200 bg-sidebar-bg text-white transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64',
      )}
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-between border-b border-gray-700 px-4">
        {!sidebarCollapsed && (
          <span className="text-lg font-bold tracking-tight">MetalYapi</span>
        )}
        <button
          onClick={toggleSidebar}
          className="rounded p-1 text-gray-400 hover:bg-sidebar-hover hover:text-white"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Project Selector */}
      {!sidebarCollapsed && (
        <div className="border-b border-gray-700 p-3">
          <ProjectSelector />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        <SidebarItem
          icon={<LayoutDashboard className="h-5 w-5" />}
          label="Daily View"
          active={activeView === 'daily'}
          collapsed={sidebarCollapsed}
          onClick={() => setActiveView('daily')}
        />
        <SidebarItem
          icon={<Calendar className="h-5 w-5" />}
          label="Weekly View"
          active={activeView === 'weekly'}
          collapsed={sidebarCollapsed}
          onClick={() => setActiveView('weekly')}
        />
        <SidebarItem
          icon={<BarChart3 className="h-5 w-5" />}
          label="Summary"
          active={activeView === 'summary'}
          collapsed={sidebarCollapsed}
          onClick={() => setActiveView('summary')}
        />

        <div className="my-3 border-t border-gray-700" />

        <SidebarItem
          icon={<MessageSquare className="h-5 w-5" />}
          label="Chat Input"
          collapsed={sidebarCollapsed}
          onClick={toggleChatPanel}
        />
        <SidebarItem
          icon={<Brain className="h-5 w-5" />}
          label="AI Forecast"
          collapsed={sidebarCollapsed}
          onClick={toggleAIPanel}
        />
      </nav>

      {/* Date Navigator */}
      {!sidebarCollapsed && (
        <div className="border-t border-gray-700 p-3">
          <DateNavigator />
        </div>
      )}

      {/* View Toggle */}
      {!sidebarCollapsed && (
        <div className="border-t border-gray-700 p-3">
          <ViewToggle />
        </div>
      )}

      {/* Settings */}
      <div className="border-t border-gray-700 p-2">
        <SidebarItem
          icon={<Settings className="h-5 w-5" />}
          label="Settings"
          collapsed={sidebarCollapsed}
          onClick={() => {}}
        />
      </div>
    </aside>
  );
};

// ----- Sidebar Item -----

interface SidebarItemProps {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  collapsed: boolean;
  onClick: () => void;
}

const SidebarItem: React.FC<SidebarItemProps> = ({
  icon,
  label,
  active = false,
  collapsed,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-sidebar-active text-white'
          : 'text-gray-300 hover:bg-sidebar-hover hover:text-white',
        collapsed && 'justify-center px-2',
      )}
      title={collapsed ? label : undefined}
    >
      {icon}
      {!collapsed && <span>{label}</span>}
    </button>
  );
};
