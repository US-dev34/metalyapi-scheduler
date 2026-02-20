# External Integrations

**Analysis Date:** 2026-02-20

## APIs & External Services

**Anthropic Claude AI:**
- Service: Anthropic Claude API (NLP parsing & forecasting)
- Purpose: Parse Turkish natural-language messages into structured allocation actions; generate forecasts
- SDK/Client: `anthropic>=0.40.0,<1.0` (Python)
- Auth: `CLAUDE_API_KEY` environment variable
- Implementation: `backend/services/ai/nlp_parser.py` (NLPParser class), `backend/services/ai/forecast.py`
- Endpoints:
  - `/api/v1/chat/{project_id}/message` - POST - Parse user message via Claude
  - `/api/v1/ai/{project_id}/forecast` - POST - Generate AI forecast

**Supabase (Database + Auth):**
- Service: Supabase PostgreSQL + Auth (managed backend)
- Purpose: Primary database for projects, WBS items, allocations, baselines, audit logs
- SDK/Client: `supabase>=2.10.0,<3.0` (Python backend), `@supabase/supabase-js@2.47.0` (TypeScript frontend)
- Auth:
  - Backend: `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
  - Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- Implementation:
  - Backend: `backend/models/db.py` (get_db() factory, Supabase client initialization)
  - Frontend: `frontend/src/lib/supabase.ts` (createClient with auto-refresh)
- Connection:
  - Production: Real Supabase REST API
  - Development: Falls back to MockDB (in-memory) if Supabase unavailable
- Tables accessed:
  - `projects` - Project metadata
  - `wbs_items` - Work breakdown structure
  - `daily_allocations` - Manpower/quantity allocations by date
  - `baselines` - Baseline snapshots for comparison
  - `baseline_snapshots` - Historical baseline versions
  - `chat_messages` - Chat history and parsed actions
  - `ai_forecasts` - AI-generated forecasts
  - `audit_log` - Audit trail of changes

## Data Storage

**Databases:**
- PostgreSQL (Supabase-managed)
  - Connection: Via Supabase REST client
  - Client: `supabase` Python package (backend), `@supabase/supabase-js` (frontend)
  - URL: `SUPABASE_URL` env var (e.g., `https://tfcmfbfnvrtsfqevwsko.supabase.co`)
  - No traditional ORM (Supabase Python client provides table-based API)
  - Fallback: MockDB (in-memory) at `backend/models/db.py` for local dev

**File Storage:**
- Local filesystem only (no cloud storage integration)
- Excel import/export via `openpyxl>=3.1.0,<4.0`
- Files downloaded directly to browser (client-side blob handling in `frontend/src/lib/api.ts`)
- Export endpoints:
  - `/api/v1/reports/{project_id}/excel` - GET - Excel export
  - `/api/v1/reports/{project_id}/sample` - GET - WBS import template

**Caching:**
- TanStack React Query 5.62.0 (frontend) - HTTP response caching with stale-while-revalidate
- No explicit Redis/Memcached integration
- Browser localStorage via Supabase (session persistence enabled in `frontend/src/lib/supabase.ts`)

## Authentication & Identity

**Auth Provider:**
- Supabase Auth (managed)
  - Session auto-refresh enabled
  - Session persisted to localStorage
  - Session URL detection (deep linking support)
- Currently no explicit user login UI visible; API assumes authenticated context via Supabase

**Implementation:**
- Backend: Supabase service key (server-side, full access)
- Frontend: Supabase anon key + session tokens (client-side, row-level security via Supabase policies)

## Monitoring & Observability

**Error Tracking:**
- No external error tracking (Sentry, Datadog, etc.)
- Errors logged to stdout/stderr by FastAPI & Python logging
- Frontend errors not explicitly tracked

**Logs:**
- Python backend: Standard logging to console via `logging` module
  - Log level: Configurable via `LOG_LEVEL` env var (default: INFO)
  - Format: `%(asctime)s | %(levelname)-8s | %(name)s | %(message)s`
  - Logger setup: `backend/main.py` (lines 19-22)
- Frontend: No explicit logging framework; console.warn for Supabase credential warnings

**Observability:**
- Health check endpoint: `GET /health` returns JSON with status, version, environment
- No metrics collection (Prometheus, CloudWatch, etc.)

## CI/CD & Deployment

**Hosting:**
- Docker Compose locally (development)
- Backend: Python 3.12 + Uvicorn on port 8000
- Frontend: Node 20 + Vite dev server on port 5173
- No production deployment pipeline detected (no GitHub Actions, GitLab CI, etc.)

**CI Pipeline:**
- None detected
- Tests run manually with `npm test` (frontend) and pytest (backend - not configured)

**Docker Setup:**
- `Dockerfile.backend` - Python 3.12-slim with pip install requirements.txt
- `frontend/Dockerfile` - Node 20-alpine with npm install + vite dev server
- `docker-compose.yml` - Orchestrates both services
- Environment passed via `.env` file at runtime

## Environment Configuration

**Required env vars (backend):**
- `SUPABASE_URL` - PostgreSQL REST endpoint
- `SUPABASE_KEY` - Anon key (frontend also needs this)
- `SUPABASE_SERVICE_KEY` - Service role key (backend use only)
- `CLAUDE_API_KEY` - Anthropic API key (for NLP/AI)
- `CORS_ORIGINS` - Allowed origins (default: `http://localhost:5173`)
- `ENVIRONMENT` - Deployment env (default: `development`)
- `LOG_LEVEL` - Logging level (default: `INFO`)

**Required env vars (frontend):**
- `VITE_API_BASE_URL` - Backend API base URL (default: `http://localhost:8000`, production: `/api`)
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Anon key (same as backend's `SUPABASE_KEY`)

**Secrets location:**
- `.env` file at project root (loaded by both backend and frontend via `.env` file and `VITE_*` convention)
- Docker Compose: `env_file: .env` directive
- Frontend: Vite loads `VITE_*` prefixed vars from `.env` at build time
- DO NOT commit `.env` to git (listed in `.gitignore`)

## Webhooks & Callbacks

**Incoming:**
- None detected (no webhook endpoints)

**Outgoing:**
- None detected (no external webhooks triggered by backend)

## API Integration Points

**Internal REST API:**
- Base: `/api/v1/` (FastAPI routes)
- Routers defined in `backend/routers/`:
  - `projects.py` - `/api/v1/projects/`
  - `wbs.py` - `/api/v1/wbs/`
  - `allocations.py` - `/api/v1/allocations/`
  - `baselines.py` - `/api/v1/baselines/`
  - `chat.py` - `/api/v1/chat/` (NLP via Claude)
  - `ai.py` - `/api/v1/ai/` (forecast, optimize, whatif, report)
  - `reports.py` - `/api/v1/reports/` (Excel export/import)
- Frontend client: `frontend/src/lib/api.ts` (axios-based)
- CORS enabled: Whitelist via `CORS_ORIGINS` config

**Frontend API Client:**
- Axios instance: `api` with 30s timeout
- Request interceptors: None
- Response interceptors: None
- Type-safe API functions in `frontend/src/lib/api.ts`:
  - `projectsApi.*` - Project CRUD
  - `wbsApi.*` - WBS management
  - `allocationsApi.*` - Daily matrix & batch updates
  - `baselinesApi.*` - Baseline management
  - `chatApi.*` - Chat message parsing
  - `aiApi.*` - Forecast & reports
  - `reportsApi.*` - Excel export/import

---

*Integration audit: 2026-02-20*
