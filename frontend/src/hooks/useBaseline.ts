import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { baselinesApi } from '@/lib/api';
import type { BaselineCreate } from '@/types';

const BASELINE_KEYS = {
  all: ['baselines'] as const,
  byProject: (projectId: string) => ['baselines', projectId] as const,
};

/**
 * Fetch all baselines for a project.
 */
export function useBaselines(projectId: string | null) {
  return useQuery({
    queryKey: BASELINE_KEYS.byProject(projectId ?? ''),
    queryFn: () => baselinesApi.getAll(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Create a new baseline snapshot.
 */
export function useCreateBaseline(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BaselineCreate) => baselinesApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BASELINE_KEYS.byProject(projectId) });
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
    },
  });
}
