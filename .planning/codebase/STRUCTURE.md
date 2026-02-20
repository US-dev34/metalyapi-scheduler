# Codebase Structure

**Analysis Date:** 2026-02-20

## Directory Layout

```
Construction Schedule/
├── backend/                         # FastAPI application
│   ├── __init__.py
│   ├── main.py                      # App entry point, router registration
│   ├── config.py                    # Settings from environment
│   ├── models/
│   │   ├── __init__.py
│   │   ├── schemas.py               # Pydantic V2 request/response models
│   │   └── db.py                    # Database client (Supabase or MockDB)
│   ├── routers/                     # FastAPI routers, one per resource
│   │   ├── __init__.py
│   │   ├── projects.py              # GET/POST projects, health checks
│   │   ├── wbs.py                   # CRUD WBS items, import/export
│   │   ├── allocations.py           # GET daily/weekly/summary, batch update cells
│   │   ├── baselines.py             # GET/POST baselines, snapshots
│   │   ├── chat.py                  # POST message (parse), POST apply (execute)
│   │   ├── ai.py                    # POST forecast, GET report
│   │   └── reports.py               # GET excel, GET sample template, GET pdf
│   ├── services/                    # Business logic layer
│   │   ├── __init__.py
│   │   ├── schedule_service.py      # ScheduleService: CRUD projects/WBS/allocations, matrix building
│   │   ├── baseline_service.py      # BaselineService: Create/manage baselines, snapshots
│   │   ├── compute_engine.py        # Pure functions: productivity, progress, variance, ETC
│   │   ├── import_export.py         # Excel import/export helpers
│   │   └── ai/                      # AI integration services
│   │       ├── __init__.py
│   │       ├── nlp_parser.py        # NLP message parsing (Claude API)
│   │       ├── forecast.py          # Forecast generation (Claude API)
│   │       ├── optimizer.py         # Schedule optimization (Claude API)
│   │       ├── report_gen.py        # Report generation helpers
│   │       └── prompts/             # Prompt templates
│   │           ├── parse_message.txt
│   │           ├── generate_forecast.txt
│   │           ├── weekly_report.txt
│   │           └── whatif_analysis.txt
│   └── middleware/                  # Cross-cutting concerns
│       ├── __init__.py
│       └── audit.py                 # Audit logging (placeholder)
├── frontend/                        # React + TypeScript application (Vite)
│   ├── package.json                 # Dependencies, build scripts
│   ├── tsconfig.json                # TypeScript config
│   ├── tsconfig.node.json           # Vite-specific TypeScript config
│   ├── vite.config.ts               # Vite build config
│   ├── tailwind.config.js           # Tailwind CSS configuration
│   ├── postcss.config.js            # PostCSS plugins (autoprefixer, Tailwind)
│   ├── index.html                   # Entry point
│   ├── src/
│   │   ├── main.tsx                 # React entry point, QueryClient setup
│   │   ├── App.tsx                  # Root component, layout structure
│   │   ├── index.css                # Global styles
│   │   ├── types/
│   │   │   └── index.ts             # All TypeScript interfaces (Project, WBSItem, DailyAllocation, etc.)
│   │   ├── lib/
│   │   │   ├── api.ts               # Axios client, API methods grouped by resource
│   │   │   ├── supabase.ts          # Supabase client (for auth, future phases)
│   │   │   └── utils.ts             # Utility functions (formatDayHeader, isToday, date math)
│   │   ├── stores/                  # Zustand global state
│   │   │   ├── projectStore.ts      # Active project, projects list
│   │   │   └── uiStore.ts           # View mode, date range, filters, panel states
│   │   ├── hooks/                   # React Query hooks, custom logic
│   │   │   ├── useAllocations.ts    # useAllocationMatrix, useBatchUpdate
│   │   │   ├── useAI.ts             # useGenerateForecast, useChat
│   │   │   ├── useBaseline.ts       # Baseline operations
│   │   │   └── useWBS.ts            # WBS item operations
│   │   ├── components/              # React components by feature
│   │   │   ├── layout/              # Page layout (sidebar, header, main content)
│   │   │   │   ├── Sidebar.tsx      # Project selector, view toggles, date navigator
│   │   │   │   ├── Header.tsx       # Title, export buttons
│   │   │   │   └── MainContent.tsx  # Router for daily/weekly/summary views
│   │   │   ├── shared/              # Reusable UI components
│   │   │   │   ├── ViewToggle.tsx   # Daily/Weekly/Summary buttons
│   │   │   │   ├── ProjectSelector.tsx  # Dropdown to select active project
│   │   │   │   ├── DateNavigator.tsx    # Prev/Next/Today buttons
│   │   │   │   └── FilterPanel.tsx      # Search, WBS level filters
│   │   │   ├── grid/                # Data grid components
│   │   │   │   ├── DailyGridView.tsx    # Main grid with ag-Grid, daily detail
│   │   │   │   ├── WeeklyGridView.tsx   # Weekly aggregated view
│   │   │   │   ├── GridToolbar.tsx      # Toolbar above grid (search, export)
│   │   │   │   └── CellRenderer.tsx     # Custom ag-Grid cell renderers
│   │   │   ├── chat/                # Chat/AI input interface
│   │   │   │   ├── ChatPanel.tsx        # Chat input + history
│   │   │   │   ├── ChatHistory.tsx      # Displays previous messages
│   │   │   │   ├── MessageInput.tsx     # Text input, send button
│   │   │   │   └── ParsedPreview.tsx    # Preview of parsed actions before confirm
│   │   │   ├── gantt/               # Gantt chart view (Phase 2)
│   │   │   │   └── SummaryView.tsx      # Gantt summary, project timeline
│   │   │   └── ai/                  # AI features
│   │   │       ├── AIPanel.tsx          # Forecast display, what-if UI
│   │   │       └── ForecastView.tsx     # Forecast items, risk indicators
│   │   └── public/                  # Static assets
│   │       └── vite.svg
│   ├── node_modules/                # Installed dependencies (gitignored)
│   └── .env.example                 # Example environment variables
├── supabase/                        # Database migrations and config
│   ├── migrations/
│   │   ├── 001_initial_schema.sql   # Base tables: projects, wbs_items, daily_allocations, baselines, baseline_snapshots, ai_forecasts, chat_history
│   │   ├── 002_views.sql            # Materialized views: vw_wbs_progress, vw_daily_totals
│   │   └── 003_rls_policies.sql     # Row-level security policies (placeholder)
│   ├── seed.sql                     # Initial seed data
│   └── config.toml                  # Supabase project config
├── tests/                           # Test suite
│   ├── conftest.py                  # Pytest fixtures, mock setup
│   ├── backend/
│   │   ├── __init__.py
│   │   ├── test_compute_engine.py   # Unit tests for ComputeEngine functions
│   │   └── test_schemas.py          # Unit tests for Pydantic schemas
│   └── fixtures/                    # Test data
│       └── ai_responses/
│           ├── parse_message_response.json
│           └── forecast_response.json
├── scripts/                         # Utility scripts
│   ├── setup.sh                     # Install dependencies, DB setup
│   ├── seed.sh                      # Seed database with initial data
│   └── test.sh                      # Run test suite
├── DATA/                            # Data files (Excel exports, WBS backups)
│   ├── WBS_E2NS_D1D2_Restructured.xlsx
│   ├── 260113_DRAFT_E2NS Terminplan.xlsx
│   └── [other Excel backups]
├── .github/
│   └── workflows/
│       └── ci.yml                   # GitHub Actions CI pipeline
├── .gitignore                       # Git ignore rules
├── .env.example                     # Template for environment variables
├── .claude/
│   └── ARCHITECTURE.md              # Previous architecture notes
├── README.md                        # Project documentation
├── CONVENTIONS.md                   # Coding standards (separate doc)
├── INTERFACE_CONTRACTS.md           # API contract definitions (IC-001, IC-002, IC-003)
├── ORCHESTRATOR_PROMPT.md           # Agent orchestrator instructions
├── AGENTS.md                        # Agent descriptions
├── AGENT_*.md                       # Individual agent prompts
├── TASK_PHASE_*.md                  # Phase definitions
└── [Python utility scripts]
    ├── update_wbs.py                # WBS data transformation script
    ├── update_wbs_v3.py
    ├── update_wbs_v4.py
    └── verify_wbs.py
```

## Directory Purposes

**backend/:**
- Purpose: FastAPI REST API server
- Contains: Router endpoints, service layer, database models, middleware
- Key files: `main.py` (entry), `routers/*.py` (endpoints), `services/*.py` (logic)

**frontend/src/**:
- Purpose: React application source code
- Contains: Components, hooks, state stores, API client, types, utilities
- Key files: `main.tsx` (entry), `App.tsx` (root), `lib/api.ts` (HTTP client)

**backend/models/**:
- Purpose: Data validation and database access
- Contains: Pydantic schemas (request/response validation), database client
- Key files: `schemas.py` (validation), `db.py` (DB client initialization)

**backend/services/**:
- Purpose: Business logic implementation
- Contains: ScheduleService, BaselineService, compute functions, AI integration
- Key files: `schedule_service.py` (core logic), `compute_engine.py` (pure math)

**frontend/components/**:
- Purpose: UI rendering organized by feature area
- Contains: Layout components, shared reusables, grid, chat, AI, Gantt
- Key files: `layout/Sidebar.tsx`, `grid/DailyGridView.tsx`, `chat/ChatPanel.tsx`

**frontend/hooks/**:
- Purpose: React Query and custom hook logic
- Contains: Data fetching, mutations, state management
- Key files: `useAllocations.ts`, `useAI.ts`, `useBaseline.ts`

**frontend/stores/**:
- Purpose: Global state management with Zustand
- Contains: Project selection, UI state, view mode, filters
- Key files: `projectStore.ts`, `uiStore.ts`

**supabase/migrations/**:
- Purpose: Database schema versioning
- Contains: DDL for tables, views, triggers, RLS policies
- Key files: `001_initial_schema.sql` (base), `002_views.sql` (aggregations), `003_rls_policies.sql`

## Key File Locations

**Entry Points:**
- `frontend/src/main.tsx`: React app initialization
- `backend/main.py`: FastAPI app initialization
- `supabase/migrations/001_initial_schema.sql`: Database schema

**Configuration:**
- `backend/config.py`: Environment settings
- `frontend/vite.config.ts`: Vite build config
- `frontend/tsconfig.json`: TypeScript compilation config
- `supabase/config.toml`: Supabase project config

**Core Logic:**
- `backend/services/schedule_service.py`: Primary business logic (projects, WBS, allocations)
- `backend/services/compute_engine.py`: All mathematical calculations
- `frontend/src/lib/api.ts`: HTTP client configuration and methods
- `frontend/src/stores/projectStore.ts` and `uiStore.ts`: Global state

**API Endpoints (Routers):**
- `backend/routers/projects.py`: `/api/v1/projects`
- `backend/routers/wbs.py`: `/api/v1/wbs`
- `backend/routers/allocations.py`: `/api/v1/allocations`
- `backend/routers/baselines.py`: `/api/v1/baselines`
- `backend/routers/chat.py`: `/api/v1/chat`
- `backend/routers/ai.py`: `/api/v1/ai`
- `backend/routers/reports.py`: `/api/v1/reports`

**Database:**
- `backend/models/db.py`: Database client (Supabase or MockDB)
- `supabase/migrations/`: All DDL and migrations

**Types & Validation:**
- `frontend/src/types/index.ts`: Frontend TypeScript types
- `backend/models/schemas.py`: Pydantic validation schemas

**Utilities:**
- `frontend/src/lib/utils.ts`: Date formatting, math, helper functions
- `backend/services/import_export.py`: Excel import/export logic
- `backend/services/ai/prompts/`: Claude prompt templates

**Testing:**
- `tests/backend/test_compute_engine.py`: ComputeEngine unit tests
- `tests/backend/test_schemas.py`: Schema validation tests
- `tests/conftest.py`: Pytest fixtures and mocks

## Naming Conventions

**Files:**
- React components: PascalCase + .tsx (e.g., `DailyGridView.tsx`, `ChatPanel.tsx`)
- Utilities/hooks: camelCase + .ts/.tsx (e.g., `useAllocations.ts`, `api.ts`)
- Python modules: snake_case + .py (e.g., `schedule_service.py`, `compute_engine.py`)
- Directories: lowercase, descriptive (e.g., `components/grid`, `services/ai`)

**Functions:**
- React components: PascalCase (e.g., `DailyGridView`, `ChatPanel`)
- JavaScript/TypeScript functions: camelCase (e.g., `sendMessage`, `getBatchUpdate`, `formatDayHeader`)
- Python functions: snake_case (e.g., `get_daily_matrix`, `calculate_productivity_rate`)

**Variables:**
- React/TypeScript: camelCase (e.g., `activeProjectId`, `pendingUpdates`, `dateRange`)
- Python: snake_case (e.g., `project_id`, `total_qty_done`, `from_date`)

**Types:**
- TypeScript interfaces: PascalCase with "I" prefix optional (e.g., `Project`, `DailyAllocation`, `ChatParseResponse`)
- Python Pydantic models: PascalCase + "Request"/"Response" suffix (e.g., `ProjectCreate`, `AllocationBatchUpdate`, `DailyMatrixResponse`)

**Directories:**
- Feature areas use lowercase plurals: `components`, `services`, `routers`, `hooks`, `stores`
- Sub-feature areas use lowercase with hyphens if multi-word: `grid/`, `chat/`, `ai/`

## Where to Add New Code

**New Feature (e.g., Task Management):**
- Backend endpoint: `backend/routers/tasks.py` (new router)
- Backend logic: `backend/services/task_service.py` (new service)
- Backend schema: Add types to `backend/models/schemas.py` (TaskCreate, TaskResponse)
- Frontend hook: `frontend/src/hooks/useTasks.ts`
- Frontend component: `frontend/src/components/tasks/` (new directory if major feature)
- Frontend types: Add to `frontend/src/types/index.ts`
- Tests: `tests/backend/test_task_service.py` (new test file)
- Database: Add tables/views to `supabase/migrations/004_tasks_schema.sql` (next migration number)

**New Component (in existing feature):**
- File: `frontend/src/components/{feature}/{NewComponent}.tsx`
- If component uses data: add hook in `frontend/src/hooks/` or inline useQuery call
- If component stores state: add selector to relevant Zustand store or create new one

**Utilities/Helpers:**
- Shared math: `backend/services/compute_engine.py` (add function here, no side effects)
- Frontend date/string helpers: `frontend/src/lib/utils.ts`
- Database queries: `backend/services/{service_name}.py` method

**AI Integrations:**
- New AI prompt: `backend/services/ai/prompts/{feature_name}.txt`
- New AI service: `backend/services/ai/{feature_name}.py` with function calling Claude API
- Router integration: Add POST endpoint to `backend/routers/ai.py` that calls new service

**Tests:**
- Unit tests for services: `tests/backend/test_{service_name}.py`
- Unit tests for compute functions: Add to `tests/backend/test_compute_engine.py`
- Frontend tests: `frontend/src/{path}/{Component}.test.tsx` (co-located with component)

**Database Changes:**
- Never modify existing migration files
- Create new migration file: `supabase/migrations/{NNN}_description.sql` (increment version number)
- Use IF NOT EXISTS in all CREATE statements for idempotency
- Add indexes for foreign keys and commonly-filtered columns
- Document table purpose at top of migration

## Special Directories

**node_modules/ (frontend):**
- Purpose: Installed npm dependencies
- Generated: Yes (by npm install)
- Committed: No (in .gitignore)
- Contents: React, Vite, TypeScript, ag-Grid, Zustand, React Query, Axios, Tailwind, etc.

**venv/ (Python):**
- Purpose: Python virtual environment
- Generated: Yes (by python -m venv)
- Committed: No (in .gitignore)
- Contents: Installed Python packages (FastAPI, Supabase, Pydantic, etc.)

**build/ (frontend):**
- Purpose: Compiled frontend application
- Generated: Yes (by `npm run build`)
- Committed: No (in .gitignore)
- Contents: Minified JS/CSS, static assets

**.env files:**
- Purpose: Environment-specific configuration (secrets, API keys)
- Generated: No (created manually or from .env.example)
- Committed: No (in .gitignore)
- Pattern: `.env` for dev, `.env.production` for prod

**DATA/ (Excel files):**
- Purpose: Project work breakdown structure exports and backups
- Generated: Yes (from WBS import/export endpoints)
- Committed: Mixed (some backups committed, current ones might be ignored)
- Format: XLSX with structure matching WBS schema

**.claude/ (planning docs):**
- Purpose: Architecture and planning documentation
- Generated: Yes (by GSD orchestrator)
- Committed: No (in .gitignore)
- Contents: Previous ARCHITECTURE.md, analysis docs

**.github/workflows/:**
- Purpose: CI/CD pipeline configuration
- Generated: No (manually created)
- Committed: Yes
- Contents: `ci.yml` defines GitHub Actions jobs (lint, test, build)

---

*Structure analysis: 2026-02-20*
