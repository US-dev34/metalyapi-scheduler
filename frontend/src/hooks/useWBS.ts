import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { wbsApi, allocationsApi } from '@/lib/api';
import type { WBSItem } from '@/types';

const WBS_KEYS = {
  all: ['wbs'] as const,
  byProject: (projectId: string) => ['wbs', projectId] as const,
  progress: (projectId: string) => ['wbs', 'progress', projectId] as const,
};

/**
 * Fetch all WBS items for a project.
 */
export function useWBSItems(projectId: string | null) {
  return useQuery({
    queryKey: WBS_KEYS.byProject(projectId ?? ''),
    queryFn: () => wbsApi.getByProject(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 5,
  });
}

/**
 * Fetch WBS progress from the allocation matrix summary endpoint.
 */
export function useWBSProgress(projectId: string | null) {
  return useQuery({
    queryKey: WBS_KEYS.progress(projectId ?? ''),
    queryFn: () => allocationsApi.getSummary(projectId!),
    enabled: !!projectId,
    staleTime: 1000 * 60 * 2,
  });
}

/**
 * Create a new WBS item.
 */
export function useCreateWBS(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<WBSItem>) => wbsApi.create(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WBS_KEYS.byProject(projectId) });
    },
  });
}

/**
 * Update a WBS item.
 */
export function useUpdateWBS(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ wbsId, data }: { wbsId: string; data: Partial<WBSItem> }) =>
      wbsApi.update(projectId, wbsId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: WBS_KEYS.byProject(projectId) });
    },
  });
}
