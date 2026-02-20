# Architecture

**Analysis Date:** 2026-02-20

## Pattern Overview

**Overall:** Layered three-tier architecture (Frontend → Backend API → Database)

**Key Characteristics:**
- Monolithic FastAPI backend with Supabase PostgreSQL database
- React 18 frontend with TypeScript, state management via Zustand, data fetching via React Query
- Clear separation of concerns: UI stores (state), API client (HTTP), hooks (query management), components (rendering)
- API-first design with strict interface contracts (IC-001, IC-002, IC-003)
- Computed metrics layer (compute_engine.py) for all schedule calculations
- Service layer pattern for business logic isolation (ScheduleService, BaselineService, etc.)

## Layers

**Presentation Layer (Frontend):**
- Purpose: Render UI, manage local state, handle user interactions
- Location: `frontend/src/`
- Contains: React components, Zustand stores, React Query hooks, utility functions
- Depends on: Backend API (`frontend/src/lib/api.ts`)
- Used by: Browser clients

**API Layer (Backend):**
- Purpose: Request routing, validation, business logic orchestration, response formatting
- Location: `backend/routers/`
- Contains: FastAPI routers for projects, WBS, allocations, baselines, chat, AI, reports
- Depends on: Services layer, database layer, Pydantic schemas
- Used by: Frontend, external tools

**Service Layer (Backend):**
- Purpose: Core business logic, data transformations, external service integration
- Location: `backend/services/`
- Contains: ScheduleService, BaselineService, ComputeEngine, AI services (optimizer, forecast, NLP)
- Depends on: Database layer, compute_engine.py, AI integrations
- Used by: Routers

**Data Access Layer (Backend):**
- Purpose: Database interaction via Supabase client, mock DB for testing
- Location: `backend/models/db.py`
- Contains: MockDB (in-memory), Supabase client initialization, connection pooling
- Depends on: Supabase Python SDK, database config
- Used by: Services layer

**Database (Supabase PostgreSQL):**
- Purpose: Persistent data storage with views for aggregated metrics
- Location: `supabase/migrations/`
- Contains: 7 base tables + views, RLS policies, triggers for timestamp management
- Key tables: projects, wbs_items, daily_allocations, baselines, baseline_snapshots, ai_forecasts, chat_history

## Data Flow

**User View Daily Allocations (Happy Path):**

1. User clicks date range in sidebar → `UIStore.setDateRange()`
2. `DailyGridView` renders, calls `useAllocationMatrix(projectId, dateRange)` via React Query
3. React Query calls `allocationsApi.getDailyMatrix(projectId, from, to)` → HTTP GET `/api/v1/allocations/{project_id}/daily`
4. Backend router receives request, calls `ScheduleService.get_daily_matrix()`
5. ScheduleService executes SQL query on vw_wbs_progress view + joins daily_allocations table
6. ScheduleService calls `ComputeEngine.calculate_*()` for metrics (productivity_rate, progress_pct, etc.)
7. ScheduleService builds `DailyMatrixResponse` object with matrix structure: `{wbs_id: {date: {planned, actual, qty_done, is_future}}}`
8. Response serialized via Pydantic schema `DailyMatrixResponse` and returned
9. Frontend receives data, React Query caches it with 30s staleTime
10. DailyGridView renders ag-Grid with fetched data, cells use `getCellColor()` and `getCellStatus()` utilities

**User Edits Cell and Saves:**

1. User modifies cell in grid (actual_manpower or qty_done)
2. `CellValueChangedEvent` triggers, cell added to `pendingUpdates` Ref
3. Debounce timer (500ms) collects all pending changes
4. `useBatchUpdate` mutation fires with `AllocationBatchUpdate` payload
5. HTTP PUT `/api/v1/allocations/{project_id}/daily` with `{updates: [{wbs_id, date, actual_manpower, qty_done, notes}], source: "grid"}`
6. Backend validates via Pydantic, calls `ScheduleService.batch_update_allocations()`
7. ScheduleService performs UPSERT on daily_allocations table (unique constraint on wbs_item_id, date)
8. Returns `AllocationBatchResponse` with updated_count and any errors
9. React Query invalidates `['allocations']` queryKey, triggers re-fetch
10. Grid re-renders with latest values from server

**User Sends Chat Message and Applies Allocations:**

1. User types "2 people on E2NS-1 on 2026-02-17, qty_done 50" in ChatPanel
2. `ChatPanel` calls `useChat().sendMessage(text)`
3. HTTP POST `/api/v1/chat/{project_id}/message` with `{message: "..."}`
4. Backend `chat.py` router calls `ChatParseResponse = AI.parse_message(message)`
5. NLP parser (Claude API) returns structured `ChatParseResponse` with actions: `[{wbs_code, date, actual_manpower, qty_done, note}]`
6. Backend returns response, frontend stores in `pendingParsed` state
7. `ParsedPreview` component renders preview of parsed actions
8. User clicks "Confirm" → `useChat().confirmAllocations()`
9. HTTP POST `/api/v1/chat/{project_id}/apply` with `{message_id: "..."}`
10. Backend applies actions as batch update via ScheduleService (same flow as step 6-9 above)
11. Returns 200 OK, frontend invalidates allocations cache, grid updates

**State Management:**

- `useUIStore` (Zustand): Manages global UI state (activeView, dateRange, panels open/closed, filters)
- `useProjectStore` (Zustand): Manages active project selection, cached project list
- React Query: Manages server state with automatic caching and re-fetching
- Component-level state (useState): Short-lived UI state (debounce timers, grid collapse state)

## Key Abstractions

**DailyMatrixResponse (IC-002):**
- Purpose: Standardized response format for allocation matrix
- Examples: `frontend/src/types/index.ts` line 115, `backend/models/schemas.py` line 147
- Pattern: Aggregates WBS progress + cell data matrix, matches both BE schema and FE type definition
- Structure: `{wbs_items: WBSProgress[], date_range: string[], matrix: Record<wbs_id, Record<date, CellData>>, totals}`

**ComputeEngine (Stateless Utilities):**
- Purpose: Pure functions for all mathematical formulas (productivity, progress, variance, remaining days)
- Examples: `backend/services/compute_engine.py` lines 19-92
- Pattern: No side effects, no DB access, all inputs/outputs typed, formulas documented
- Usage: Called by ScheduleService when building responses

**Service Facade Pattern:**
- Purpose: ScheduleService and BaselineService encapsulate DB queries and business logic
- Examples: `backend/services/schedule_service.py`, `backend/services/baseline_service.py`
- Pattern: Router calls service method → service queries DB → service transforms data → returns response
- Lazy loading: BaselineService imported at runtime to avoid circular imports

**API Client Abstraction:**
- Purpose: Centralize all HTTP calls with consistent error handling and request formatting
- Example: `frontend/src/lib/api.ts`
- Pattern: Grouped by resource (projectsApi, wbsApi, allocationsApi, etc.), each with typed methods
- Base URL configurable via `VITE_API_BASE_URL` env var

**Custom Hooks for Query Management:**
- Purpose: Encapsulate React Query logic separate from component rendering
- Examples: `useAllocationMatrix()`, `useBatchUpdate()`, `useAI()` hooks
- Pattern: Hook manages queryKey lifecycle, enables/disables queries, handles loading/error states
- Benefits: Reusable across multiple components, testable in isolation

**UI Store (Zustand):**
- Purpose: Global UI state accessible from any component without prop drilling
- Examples: `useUIStore` (view mode, date range, filters, panel states)
- Pattern: Each store has getters, setters, and derived selectors (e.g., activeProject())
- Benefits: Minimal re-renders (component selects only needed fields)

## Entry Points

**Backend:**
- Location: `backend/main.py`
- Triggers: `uvicorn backend.main:app --reload` or equivalent in production
- Responsibilities: FastAPI app initialization, CORS middleware setup, router registration, health endpoint, logging setup
- Routers included: projects, wbs, allocations, baselines, chat, ai, reports

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: `npm run dev` (Vite dev server) or browser loads index.html
- Responsibilities: ReactDOM.createRoot(), QueryClient setup (staleTime, retry policies), App component mount
- Root component: `frontend/src/App.tsx` renders layout with Sidebar, Header, MainContent, ChatPanel, AIPanel

**Database:**
- Location: `supabase/migrations/`
- Initialization: Supabase CLI migrations run in order (001_initial_schema, 002_views, 003_rls_policies)
- On-demand fallback: If Supabase unavailable, `backend/models/db.py` switches to MockDB with seed data

## Error Handling

**Strategy:** Explicit error responses with structured error codes

**Patterns:**

- Backend routes catch exceptions and return HTTP errors with `ErrorResponse` schema (error, code, details)
- Frontend API client uses Axios interceptors (not yet visible, but pattern setup with axios instance)
- React Query mutation errors stored in state (useChat, useBatchUpdate return `parseError`, `confirmError`)
- UI components check `isLoading` / `error` states and render error UI or loading spinners
- Services raise `ValueError` or `HTTPException` with descriptive messages
- Validation done at Pydantic schema level (field constraints, patterns, min/max)

## Cross-Cutting Concerns

**Logging:** Python logging in backend with configurable level via `LOG_LEVEL` env var, structured format with timestamp, level, module name

**Validation:** Pydantic V2 schemas on all API inputs (ProjectCreate, AllocationBatchUpdate, ChatMessageRequest, etc.) with field constraints

**Authentication:** Not implemented (Phase 0-1); when added will use Supabase Auth via `@supabase/supabase-js` client

**Database Transactions:** Supabase handles via implicit transactions per request; complex multi-step operations (baseline creation) may need explicit transaction support

**Caching:** React Query client-side with 30s staleTime for allocations, 60s for WBS items, 2min default for other queries

**API Versioning:** All endpoints prefixed with `/api/v1/` for future versioning support

**CORS:** Configured in `backend/main.py` to allow requests from `CORS_ORIGINS` env var (defaults to localhost:5173)

---

*Architecture analysis: 2026-02-20*
