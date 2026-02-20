# MetalYapi Facade Construction Scheduler

## What This Is

A daily/weekly manpower tracking and progress management application for facade installation projects, built for Metal Yapi GmbH (Hamburg, Germany). Construction managers use a spreadsheet-like grid to allocate workers across WBS items by date, track quantities completed, monitor schedule variance against baselines, and get AI-powered forecasts and natural language data entry via chat.

## Core Value

Construction managers can see today's manpower allocation across all facade work items, edit it in real-time, and instantly know which items are behind schedule — without leaving the browser.

## Requirements

### Validated

- Grid displays daily allocation matrix (WBS items x dates) with actual_manpower and qty_done per cell — existing
- Grid supports inline cell editing with debounced batch save — existing
- Weekly aggregated view toggles from daily view — existing
- Project selector and date range navigation — existing
- WBS item CRUD operations — existing
- Baseline creation and snapshot versioning — existing
- Chat message parsing via Claude API (natural language to structured allocations) — existing
- Chat apply flow (parsed actions to database) — existing
- AI forecast endpoint (per-WBS completion predictions) — existing
- AI optimization suggestions endpoint — existing
- AI report generation endpoint — existing
- Excel export endpoint — existing (buggy)
- Supabase PostgreSQL with 7 tables, views, migrations — existing
- FastAPI backend with 7 routers, service layer, compute engine — existing
- React frontend with Zustand + React Query state management — existing
- ag-Grid integration for data grid rendering — existing

### Active

- [ ] Fix 10 known bugs (import columns, unsafe DB access, silent failures, missing validation, hardcoded values, race conditions)
- [ ] Fix and complete Excel export/import pipeline with validation and preview
- [ ] Add PDF export (daily reports, progress reports)
- [ ] Add Supabase Auth (login page, JWT middleware, RLS policies, project membership)
- [ ] Fix AI forecast (batch queries, remove N+1, dynamic date range)
- [ ] Fix AI optimizer (cap suggestions, remove cartesian product)
- [ ] Wire AI report generation end-to-end with PDF download
- [ ] Build daily digest agent (today's KPIs, trend detection, narrative summary)
- [ ] Wire chat pipeline end-to-end with validation, preview, alerts
- [ ] Build chat validation agent (WBS existence, date sanity, capacity checks)
- [ ] Build alert service (post-update schedule deviation monitoring)
- [ ] Deploy backend to Railway, frontend to Vercel
- [ ] Multi-project support (project switching, per-project data isolation)

### Out of Scope

- Real-time collaboration / multi-user concurrent editing — complexity too high for v1
- Mobile app — web-first, responsive later
- Gantt chart visualization — grid view is the core interaction
- Resource leveling / automatic scheduling — manual allocation is the workflow
- Integration with external ERP systems — standalone for now
- Offline mode — requires internet for Supabase and Claude API

## Context

- **Domain:** Facade construction (curtain wall systems). WBS items are physical building elements (panels, mullions, transoms) with planned quantities and daily crew allocations.
- **Real data:** E2NS project (first project) has real WBS data from `DATA/WBS_E2NS_D1D2_Restructured.xlsx` and baseline schedule from `DATA/260113_DRAFT_E2NS Terminplan.xlsx`.
- **Multi-project:** E2NS is the first project but the platform will serve other facade installation projects for Metal Yapi.
- **Existing codebase:** Substantial — ~40+ files across frontend/backend/migrations. Most features exist but have bugs or incomplete wiring. See `.planning/codebase/CONCERNS.md` for 10 known bugs and 6 missing feature areas.
- **AI integration:** Claude API used for NLP chat parsing, forecasting, optimization, and report generation. All AI services exist but need performance fixes and end-to-end wiring.

## Constraints

- **Stack:** React 18 + TypeScript + Vite | FastAPI + Python 3.12 | Supabase PostgreSQL | Claude API — locked, extensive code already written
- **Grid:** ag-grid-community (free tier) — already integrated, no enterprise features
- **Auth:** Supabase Auth — must use for consistency with database layer
- **Deploy:** Railway (backend) + Vercel (frontend) — decided
- **AI Model:** Claude via Anthropic SDK — already integrated, model configurable via env var

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase over raw PostgreSQL | Managed hosting, built-in auth, realtime potential, JS/Python SDKs | -- Pending |
| ag-grid-community over alternatives | Free, high-performance, spreadsheet-like UX matches domain | -- Pending |
| Zustand + React Query over Redux | Minimal boilerplate, clear server/client state separation | -- Pending |
| FastAPI over Django/Flask | Async support, auto OpenAPI, Pydantic native | -- Pending |
| Fix-first over rewrite | Substantial working code exists, fixing bugs faster than starting over | -- Pending |
| Railway + Vercel over self-hosted | Managed infrastructure, fast deploys, free tier sufficient for launch | -- Pending |

---
*Last updated: 2026-02-21 after initialization*
