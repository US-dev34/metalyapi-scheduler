# Testing Patterns

**Analysis Date:** 2026-02-20

## Test Framework

**Runner:**
- Vitest 2.1.8
- Config: `vite.config.ts` includes test configuration
- Environment: jsdom (browser-like DOM environment)

**Assertion Library:**
- Chai (included via @testing-library/react)
- @testing-library/react 16.1.0 for component testing utilities

**Run Commands:**
```bash
npm run test              # Run all tests (vitest run)
# Note: Watch mode and coverage commands not configured in package.json
```

## Test File Organization

**Location:**
- No test files found in `src/` directory as of 2026-02-20
- Testing infrastructure is installed but not actively used
- Test files would follow co-located pattern based on setup

**Naming:**
- Convention: `*.test.ts` or `*.test.tsx` (vitest default)
- No test files currently present in source

**Structure:**
```
frontend/
├── src/
│   ├── components/
│   ├── hooks/
│   ├── stores/
│   └── lib/
└── vitest configuration in vite.config.ts
```

## Test Structure

**Suite Organization:**
No test suites currently exist. Expected pattern based on vitest config and dependencies:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('ComponentName', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('should render correctly', () => {
    // Test implementation
  });
});
```

**Patterns:**
- Setup: Create fresh `QueryClient` for each test to avoid state leakage
- Teardown: Clear queryClient and reset any mocks
- Assertion: Chai assertions via testing-library matchers (e.g., `expect(...).toBeTruthy()`)

## Mocking

**Framework:** Vitest provides built-in mocking via `vi` object (not yet imported in codebase)

**Patterns:**
Not yet established in codebase. Expected pattern:

```typescript
import { vi } from 'vitest';

// Mock API calls
vi.mock('@/lib/api', () => ({
  projectsApi: {
    getAll: vi.fn().mockResolvedValue([mockProject]),
  },
  wbsApi: {
    getByProject: vi.fn().mockResolvedValue([mockWBSItem]),
  },
}));

// Mock React Query
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi.fn(),
  };
});
```

**What to Mock:**
- External API calls (via `@/lib/api`)
- Zustand stores (via `vi.mock('@/stores/...')`)
- React Query mutations and queries
- Environment variables (via `vi.stubEnv()`)

**What NOT to Mock:**
- Utility functions from `@/lib/utils.ts` (date/formatting helpers)
- Type definitions
- React hooks (render via testing-library instead)
- Component children (unless they cause external side effects)

## Fixtures and Factories

**Test Data:**
Not yet implemented. Expected structure:

```typescript
// In __fixtures__/mockData.ts or similar
export const mockProject = {
  id: '1',
  name: 'Test Project',
  code: 'TEST',
  start_date: '2026-02-01',
  end_date: null,
  status: 'active',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

export const mockWBSItem = {
  id: 'wbs-1',
  project_id: '1',
  parent_id: null,
  wbs_code: '01',
  wbs_name: 'Foundation',
  qty: 100,
  unit: 'm3',
  sort_order: 1,
  level: 1,
  is_summary: false,
};

// Factory pattern for dynamic test data
export function createMockDailyAllocation(overrides = {}) {
  return {
    id: 'alloc-1',
    wbs_item_id: 'wbs-1',
    date: '2026-02-20',
    planned_manpower: 10,
    actual_manpower: 8,
    qty_done: 50,
    notes: null,
    source: 'grid',
    ...overrides,
  };
}
```

**Location:**
- Proposed: `frontend/src/__fixtures__/` or `frontend/src/__testUtils__/`
- Not yet established

## Coverage

**Requirements:** No coverage configuration in package.json
- No coverage threshold enforced
- Coverage reports not currently generated

**View Coverage:**
```bash
# Would require coverage configuration
# Recommended: npm run test -- --coverage
```

## Test Types

**Unit Tests:**
- Scope: Individual functions and utility helpers
- Approach: Test pure functions like `formatDateDisplay()`, `getWeekRange()`, `calcProgress()`
- Example targets: `src/lib/utils.ts`, `src/types/index.ts` utility functions

**Integration Tests:**
- Scope: Hooks with React Query, components with stores
- Approach: Render with `QueryClientProvider` and store context
- Example targets: `useAllocations()` with batch updates, `MessageInput` with submit handler

**E2E Tests:**
- Framework: Not configured (would require Playwright or Cypress)
- Status: Not currently used

## Common Patterns

**Async Testing:**
```typescript
// For async mutations and queries
it('should update allocation on batch update', async () => {
  const { result } = renderHook(() => useBatchUpdate('project-1'), {
    wrapper: QueryClientWrapper,
  });

  await act(async () => {
    await result.current.mutateAsync([
      { wbs_id: 'wbs-1', date: '2026-02-20', actual_manpower: 10 },
    ]);
  });

  expect(result.current.isSuccess).toBe(true);
});
```

**Error Testing:**
```typescript
// For error conditions
it('should handle allocation update error', async () => {
  vi.mocked(allocationsApi.batchUpdate).mockRejectedValueOnce(
    new Error('API error')
  );

  const { result } = renderHook(() => useBatchUpdate('project-1'), {
    wrapper: QueryClientWrapper,
  });

  await act(async () => {
    try {
      await result.current.mutateAsync([...]);
    } catch (err) {
      expect((err as Error).message).toBe('API error');
    }
  });
});
```

## Missing Test Coverage

**Critical gaps:**
- `frontend/src/components/` - No component tests (UI regression risk)
- `frontend/src/hooks/` - No hook tests (data fetching logic untested)
- `frontend/src/stores/` - No store tests (state management untested)
- `frontend/src/lib/api.ts` - No API client tests (integration points untested)

**Recommended priority:**
1. Hooks that handle mutations (`useBatchUpdate`, `useCreateWBS`)
2. Complex components with state (`DailyGridView`, `ChatPanel`)
3. Store selectors and state transitions
4. Error scenarios in API calls

---

*Testing analysis: 2026-02-20*
