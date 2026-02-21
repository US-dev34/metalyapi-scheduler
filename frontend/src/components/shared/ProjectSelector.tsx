import React, { useEffect } from 'react';
import { FolderKanban } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { projectsApi } from '@/lib/api';
import { useProjectStore } from '@/stores/projectStore';
import { DEMO_MODE, MOCK_PROJECTS } from '@/lib/mockData';

export const ProjectSelector: React.FC = () => {
  const activeProjectId = useProjectStore((s) => s.activeProjectId);
  const setActiveProjectId = useProjectStore((s) => s.setActiveProjectId);
  const setProjects = useProjectStore((s) => s.setProjects);
  const projects = useProjectStore((s) => s.projects);

  const { data: apiProjects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.getAll,
    staleTime: 1000 * 60 * 5,
    enabled: !DEMO_MODE,
  });

  // Sync projects to store
  useEffect(() => {
    if (DEMO_MODE) {
      if (projects.length === 0) {
        setProjects(MOCK_PROJECTS);
      }
    } else if (apiProjects) {
      setProjects(apiProjects);
    }
  }, [apiProjects, projects.length, setProjects]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveProjectId(e.target.value);
  };

  const displayLoading = !DEMO_MODE && isLoading;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-gray-400">
        <FolderKanban className="h-3.5 w-3.5" />
        Project
      </label>
      <select
        value={activeProjectId ?? ''}
        onChange={handleChange}
        disabled={displayLoading}
        className="w-full rounded-md border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-sm text-white focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {displayLoading && <option value="">Loading...</option>}
        {!displayLoading && projects.length === 0 && (
          <option value="">No projects</option>
        )}
        {projects.map((p) => (
          <option key={p.id} value={p.id}>
            {p.code} - {p.name}
          </option>
        ))}
      </select>
    </div>
  );
};
