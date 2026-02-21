import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { allocationsApi } from '@/lib/api';
import { DEMO_MODE, getMockDailyMatrix } from '@/lib/mockData';
import type { DateRange, AllocationCell, AllocationBatchUpdate } from '@/types';

const ALLOC_KEYS = {
  all: ['allocations'] as const,
  matrix: (projectId: string, dateRange: DateRange) =>
    ['allocations', 'matrix', projectId, dateRange.from, dateRange.to] as const,
};

/**
 * Fetch the daily allocation matrix (IC-002 DailyMatrixResponse).
 */
export function useAllocationMatrix(
  projectId: string | null,
  dateRange: DateRange,
) {
  return useQuery({
    queryKey: ALLOC_KEYS.matrix(projectId ?? '', dateRange),
    queryFn: () => {
      if (DEMO_MODE) {
        return getMockDailyMatrix(dateRange.from, dateRange.to);
      }
      return allocationsApi.getDailyMatrix(projectId!, dateRange);
    },
    enabled: !!projectId,
    staleTime: 1000 * 30, // 30s
  });
}

/**
 * Batch update allocation cells (grid edit -> debounce -> this mutation).
 */
export function useBatchUpdate(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (cells: AllocationCell[]) => {
      if (DEMO_MODE) {
        return Promise.resolve({ updated_count: cells.length, errors: [] });
      }
      const payload: AllocationBatchUpdate = { updates: cells, source: 'grid' };
      return allocationsApi.batchUpdate(projectId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allocations'] });
    },
  });
}
