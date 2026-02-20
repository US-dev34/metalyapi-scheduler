# Coding Conventions

**Analysis Date:** 2026-02-20

## Naming Patterns

**Files:**
- Components: PascalCase with `.tsx` extension (e.g., `Sidebar.tsx`, `MessageInput.tsx`)
- Utilities: camelCase with `.ts` extension (e.g., `utils.ts`, `supabase.ts`, `api.ts`)
- Stores: descriptive name with `Store` suffix in camelCase (e.g., `projectStore.ts`, `uiStore.ts`)
- Hooks: descriptive name with `use` prefix in camelCase (e.g., `useAllocations.ts`, `useWBS.ts`)
- Types: `index.ts` in types directory (e.g., `types/index.ts`)

**Functions:**
- Exported functions: camelCase (e.g., `formatDateDisplay()`, `getWeekRange()`, `useAllocationMatrix()`)
- API client methods: camelCase grouped in objects (e.g., `projectsApi.getAll()`, `wbsApi.create()`)
- React component functions: PascalCase (e.g., `SidebarItem()`, `MessageInput()`)
- Event handlers: prefix with `handle` in camelCase (e.g., `handleSubmit()`, `handleImportFile()`, `handleKeyDown()`)
- Query key generators: grouped with `KEYS` suffix (e.g., `ALLOC_KEYS`, `WBS_KEYS`)

**Variables:**
- State variables: camelCase (e.g., `activeProjectId`, `chatPanelOpen`, `sidebarCollapsed`)
- Constants: UPPER_SNAKE_CASE for truly immutable constants (e.g., `SUPABASE_URL`, `API_BASE`)
- React hook calls: camelCase (e.g., `const [value, setValue]`, `const queryClient`)

**Types:**
- Interfaces: PascalCase prefixed with context (e.g., `ProjectState`, `UIState`, `MessageInputProps`, `SidebarItemProps`)
- Type aliases: PascalCase (e.g., `ViewMode`, `CellStatus`, `DateRange`)
- Enum-like types: PascalCase (e.g., `ViewMode = 'daily' | 'weekly' | 'summary'`)

## Code Style

**Formatting:**
- Tool: Prettier (configured but no explicit `.prettierrc` file found in root)
- Line length: No explicit limit observed
- Indentation: 2 spaces
- Quotes: Single quotes for strings (observed in all source files)
- Semicolons: Present (TypeScript convention)
- Trailing commas: Used in multi-line structures

**Linting:**
- Tool: ESLint (version 9.16.0)
- Config: Modern flat config (no legacy `.eslintrc` found)
- Strict checks: Enabled in TypeScript compiler
  - `strict: true`
  - `noUnusedLocals: true`
  - `noUnusedParameters: true`
  - `noFallthroughCasesInSwitch: true`
  - `forceConsistentCasingInFileNames: true`
- Build validation: `npm run lint` enforces `--max-warnings 0`

## Import Organization

**Order:**
1. External libraries (React, third-party packages)
2. Tanstack React Query hooks
3. Internal utilities and helpers
4. Type imports (always explicit `import type`)
5. Store imports
6. API client imports

**Example from `App.tsx`:**
```typescript
import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { MainContent } from '@/components/layout/MainContent';
import { Header } from '@/components/layout/Header';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { AIPanel } from '@/components/ai/AIPanel';
import { useUIStore } from '@/stores/uiStore';
```

**Path Aliases:**
- `@/*` → `src/*` (configured in `tsconfig.json`)
- Used consistently throughout codebase for relative imports

## Error Handling

**Patterns:**
- Try-catch blocks with `finally` for cleanup (e.g., in `Header.tsx` for export/import operations)
- Error logging via `console.error()` and `console.warn()` for debugging
- Graceful fallbacks: disabled UI states during async operations
- React Query mutation error states exposed via query objects (e.g., `parseError`, `confirmError` in useAI hook)
- Error types defined in types file: `ApiError` interface with `error`, `code`, `details` fields

**Example from `Header.tsx`:**
```typescript
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
```

## Logging

**Framework:** `console` object (native browser/Node.js)

**Patterns:**
- `console.error()` for error conditions
- `console.warn()` for warnings (e.g., when Supabase credentials missing)
- `console.log()` for informational messages (e.g., import counts)
- No centralized logging service observed
- Logs include context strings (e.g., `'Export failed:'`, `'Import failed:'`)

## Comments

**When to Comment:**
- JSDoc-style comments for public exported functions and types
- Section dividers using `// -----` format for file organization
- Inline comments for complex logic or non-obvious behavior
- File-level comments for context and alignment with specs

**JSDoc/TSDoc:**
- Used in hooks to document purpose and return type
- Example from `useAllocations.ts`:
```typescript
/**
 * Fetch the daily allocation matrix (IC-002 DailyMatrixResponse).
 */
export function useAllocationMatrix(...)

/**
 * Batch update allocation cells (grid edit → debounce → this mutation).
 */
export function useBatchUpdate(projectId: string) {
```

- File-level documentation in `types/index.ts`:
```typescript
// ============================================================
// MetalYapi Construction Scheduling - TypeScript Type Definitions
// Aligned with INTERFACE_CONTRACTS.md IC-001, IC-002, IC-003
//
// Note: API uses snake_case, frontend uses camelCase.
// API client layer transforms between the two.
// ============================================================
```

## Function Design

**Size:** Functions are kept focused and concise
- Component functions: 50-200 lines including JSX
- Hook functions: 10-50 lines
- Utility functions: 5-20 lines

**Parameters:**
- Props interfaces defined separately (e.g., `MessageInputProps`, `SidebarItemProps`)
- Callbacks passed as props with explicit typing
- Query keys as tuple constants to enable type-safe invalidation

**Return Values:**
- Components return JSX or `React.ReactNode`
- Hooks return query results or mutation objects
- API calls return typed responses from type definitions
- Utility functions return typed values (string, number, DateRange, etc.)

## Module Design

**Exports:**
- Named exports for all components and utilities
- Default export for React components (e.g., `export default App;`)
- Grouped API exports as named objects (e.g., `projectsApi`, `wbsApi`)
- Type exports always use `import type` pattern

**Barrel Files:**
- Not heavily used; most imports are direct
- `types/index.ts` serves as main type export point
- Each feature directory imports directly from its files

## React Patterns

**Hooks:**
- `React.FC<PropsType>` type annotation on functional components
- `useState` for local state
- Zustand stores for global state (`useUIStore`, `useProjectStore`)
- React Query hooks for server state (`useQuery`, `useMutation`)
- `useCallback` for stable function references in event handlers
- `useRef` for accessing DOM elements directly

**Props:**
- Props interfaces named `[ComponentName]Props`
- Default values specified directly in destructuring
- Type-safe prop handling with explicit unions (e.g., `disabled?: boolean`)

**State Management:**
- Zustand stores for UI state: `uiStore.ts`, `projectStore.ts`
- React Query for server-sourced data
- Local `useState` for transient UI state (modals, loading flags)

---

*Convention analysis: 2026-02-20*
