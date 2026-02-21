# MetalYapi Façade Scheduling Platform

AI-powered construction scheduling system for façade production and installation tracking.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript, AG Grid, Tailwind CSS, shadcn/ui |
| State | Zustand (client), TanStack Query (server) |
| Backend | FastAPI (Python 3.12) |
| Database | Supabase (PostgreSQL 15) |
| AI | Claude API (Sonnet) |
| Deploy | Vercel (FE) + Railway/Supabase (BE+DB) |

## Quick Start

```bash
# 1. Clone and setup
./scripts/setup.sh

# 2. Configure environment
cp .env.example .env
# Edit .env with your credentials

# 3. Start with Docker
docker compose up

# Or start individually:
# Backend
cd backend && uvicorn backend.main:app --reload --port 8000

# Frontend
cd frontend && npm run dev
```

## Project Structure

```
construction-scheduler/
├── AGENTS.md                 # Agent definitions
├── CONVENTIONS.md            # Code standards
├── ARCHITECTURE.md           # Full architecture doc
├── supabase/migrations/      # Database schema
├── backend/                  # FastAPI backend
│   ├── routers/              # API endpoints
│   ├── services/             # Business logic
│   ├── services/ai/          # AI integration
│   └── models/               # Pydantic schemas
├── frontend/                 # React frontend
│   ├── src/components/       # UI components
│   ├── src/hooks/            # Custom hooks
│   ├── src/stores/           # State management
│   └── src/lib/              # Utilities
└── tests/                    # All tests
```

## API Endpoints

- `GET /health` — Health check
- `/api/v1/projects/` — Project CRUD
- `/api/v1/wbs/` — WBS tree management
- `/api/v1/allocations/` — Daily matrix, batch update
- `/api/v1/baselines/` — Baseline management
- `/api/v1/chat/` — NLP message parsing
- `/api/v1/ai/` — Forecast, optimization
- `/api/v1/reports/` — PDF/Excel export

## Development

See [CONVENTIONS.md](CONVENTIONS.md) for code standards and [ARCHITECTURE.md](.claude/ARCHITECTURE.md) for full architecture documentation.
