import { create } from 'zustand';
import type { Project } from '@/types';

interface ProjectState {
  // Active project
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;

  // Projects list (cached from API)
  projects: Project[];
  setProjects: (projects: Project[]) => void;

  // Derived
  activeProject: () => Project | undefined;

  // Loading state
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  activeProjectId: null,
  setActiveProjectId: (id) => set({ activeProjectId: id }),

  projects: [],
  setProjects: (projects) => {
    set({ projects });
    // Auto-select first project if none is selected
    const { activeProjectId } = get();
    if (!activeProjectId && projects.length > 0) {
      set({ activeProjectId: projects[0].id });
    }
  },

  activeProject: () => {
    const { projects, activeProjectId } = get();
    return projects.find((p) => p.id === activeProjectId);
  },

  isLoading: false,
  setIsLoading: (loading) => set({ isLoading: loading }),
}));
