# Technology Stack

**Analysis Date:** 2026-02-20

## Languages

**Primary:**
- Python 3.12 - Backend API (FastAPI/Uvicorn)
- TypeScript 5.7.2 - Frontend (React with TSX)
- JavaScript - Frontend runtime/build tooling

**Secondary:**
- SQL - Database schema and queries (Supabase PostgreSQL)

## Runtime

**Environment:**
- Python 3.12-slim (Docker base image)
- Node.js 20-alpine (Docker base image)
- Uvicorn (ASGI server for Python)

**Package Manager:**
- npm - JavaScript/TypeScript dependencies
- pip - Python dependencies
- Lockfile: package-lock.json (npm exists), no lock file for Python (requirements.txt pinned)

## Frameworks

**Core:**
- FastAPI 0.115.0 - REST API framework (Python backend)
- React 18.3.1 - UI library (TypeScript frontend)
- Vite 6.0.5 - Frontend build tool and dev server

**UI Components:**
- ag-grid-react 32.3.3 - Data grid for daily allocations matrix
- ag-grid-community 32.3.3 - Grid engine (free tier)
- Tailwind CSS 3.4.16 - Utility-first CSS framework
- Lucide React 0.468.0 - Icon library

**State Management:**
- Zustand 5.0.2 - Lightweight state store
- TanStack React Query 5.62.0 - Server state management & caching

**Testing:**
- Vitest 2.1.8 - Unit/integration test runner (Node-based, Vite-native)
- Testing Library React 16.1.0 - React component testing utilities
- jsdom 25.0.1 - DOM implementation for Node.js testing
- Chai (via Vitest) - Assertion library

**Build/Dev:**
- Vite React Plugin 4.3.4 - React HMR support
- TypeScript 5.7.2 - Type checking and compilation
- ESLint 9.16.0 - Code linting
- PostCSS 8.4.49 - CSS processing (used by Tailwind)
- Autoprefixer 10.4.20 - Browser vendor prefixes
- Tailwind CSS 3.4.16 - Compiled via PostCSS

## Key Dependencies

**Critical:**
- FastAPI 0.115.0 - Async REST API with auto-generated OpenAPI docs
- Uvicorn 0.30.0 - ASGI server to run FastAPI
- Pydantic 2.9.0 - Data validation and settings management
- Pydantic Settings 2.5.0 - Environment variable management (extends Pydantic)
- Supabase (Python) 2.10.0 - Database client and auth integration
- Anthropic SDK 0.40.0 - Claude AI API client for NLP parsing

**Infrastructure:**
- httpx 0.27.0 - Async HTTP client (FastAPI dependency for API calls)
- python-dotenv 1.0.0 - Load `.env` files in Python
- openpyxl 3.1.0 - Excel file parsing/generation for WBS import/export
- python-multipart 0.0.12 - Multipart form data handling for FastAPI

**Frontend:**
- axios 1.7.9 - HTTP client for REST API calls
- Supabase JS 2.47.0 - JavaScript client for database & auth
- date-fns 4.1.0 - Date utility library (timezone-aware scheduling)
- zod 3.24.1 - Schema validation for API responses
- clsx 2.1.1 - Conditional CSS class merging
- tailwind-merge 2.6.0 - Merge Tailwind classes without conflicts

## Configuration

**Environment:**
- Backend loads from `.env` file using Pydantic Settings (`backend/config.py`)
- Frontend loads from `VITE_*` prefixed vars (Vite convention)
- Configuration sources: `.env` file at project root → environment variables → defaults

**Key Environment Variables:**
- `SUPABASE_URL` - Supabase project URL (backend)
- `SUPABASE_KEY` - Supabase anon key (backend, frontend uses `VITE_SUPABASE_ANON_KEY`)
- `SUPABASE_SERVICE_KEY` - Supabase service role key (backend, not exposed to frontend)
- `CLAUDE_API_KEY` - Anthropic Claude API key for NLP/AI features
- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins (default: `http://localhost:5173`)
- `ENVIRONMENT` - Deployment target (development/production)
- `LOG_LEVEL` - Python logging level (default: INFO)

**Build:**
- `vite.config.ts` - Vite build config with React plugin, dev server proxy to backend
- `tsconfig.json` - TypeScript compiler options (ES2020 target, path aliases @/*)
- `frontend/Dockerfile` - Node 20 Alpine multi-stage build

## Platform Requirements

**Development:**
- Python 3.12+
- Node.js 20+ (npm 10+)
- Supabase account with project (or mock mode fallback)
- OpenAI/Anthropic API key for Claude integration
- Docker & Docker Compose (optional, for containerized development)

**Production:**
- Python 3.12 runtime
- Node.js 20 runtime
- Supabase PostgreSQL instance
- Anthropic API (for Claude calls)
- CORS-enabled hosting (frontend origin must be in `CORS_ORIGINS`)

**Database:**
- PostgreSQL (managed by Supabase)
- No ORM in use (direct Supabase client API)

**Docker Deployment:**
- Backend: Python 3.12-slim with pip dependencies
- Frontend: Node 20-alpine with npm/vite build output
- Frontend runs `vite --host` in dev mode, should use `vite build` for production

---

*Stack analysis: 2026-02-20*
