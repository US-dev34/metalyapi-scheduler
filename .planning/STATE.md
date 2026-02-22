# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Construction managers can see today's manpower allocation across all facade work items, edit it in real-time, and instantly know which items are behind schedule
**Current focus:** Post-deployment enhancements — full-program grid views, configurable columns

## Current Position

Phase: 5 of 5 (Production Deployment) + Post-deploy enhancements
Plan: All phases executed, now iterating on user feedback
Status: App live in production, grid views enhanced
Last activity: 2026-02-22 -- Full-program grid views (Jan-Jul 2026), configurable columns, 126 WBS items with extended fields

Progress: [██████████] 100% (core) + iterating

## Performance Metrics

**Velocity:**
- Total plans completed: 5 phases + post-deploy enhancements
- Total execution time: ~3 hours across sessions

**By Phase:**

| Phase | Status | Commit |
|-------|--------|--------|
| 1. Foundation Stabilization | Done | fc2e0e0 |
| 2. Auth & Access Control | Done | 6c6b25c |
| 3. Export & Import Pipeline | Done | b0c1975 |
| 4. AI Intelligence Layer | Done | e2fa7e3 |
| 5. Production Deployment | Done | 9c9f5a2 |
| Post-deploy: WBS extended fields | Done | e04aef7 |
| Post-deploy: Full-program grid views | Done | f9b5df1 |

## Accumulated Context

### Decisions

- Fix-first over rewrite: Substantial working code exists, fixing bugs faster than starting over
- xhtml2pdf for PDF generation (pure Python, cross-platform) with HTML fallback
- Auth conditional: enforced in production, optional in development
- Forecast batch optimization: 2 queries + Python grouping instead of N+1
- Railway for backend, Vercel for frontend
- Backend db.py uses service_role key to bypass RLS
- Full program range: Jan 1, 2026 - Jul 31, 2026 (hardcoded in uiStore)
- WBS columns configurable via ColumnSettings panel (shared Daily/Weekly)
- Month group headers for date/week columns

### Completed Todos

- [x] Run ALL migrations (001-006) via Supabase
- [x] Get SUPABASE_SERVICE_KEY from dashboard
- [x] Create admin user (admin@metalyapi.com / MetalYapi2026!)
- [x] Add admin to project_members for E2NS
- [x] Import 126 WBS items with full extended data
- [x] Smoke test: Login, Grid, Cell Edit, Save, Views, Export
- [x] Deploy backend to Railway
- [x] Deploy frontend to Vercel
- [x] Production smoke test (all endpoints 200)
- [x] Add 13 extended WBS fields (migration 006 + schemas)
- [x] Full-program daily grid view (Jan-Jul 2026, grouped by month)
- [x] Full-program weekly grid view (KW01-KW31, grouped by month)
- [x] Configurable WBS columns (ColumnSettings panel)

### Pending Todos

- Set CLAUDE_API_KEY in Railway env vars for Chat/AI features
- Monitor daily view performance with 212-day range

### Key Identifiers

- Supabase project ref: tfcmfbfnvrtsfqevwsko
- Admin user ID: 90b03855-ce4d-445d-bb92-4f383eb68634
- Admin email: admin@metalyapi.com / MetalYapi2026!
- E2NS project ID: 5f0fc90a-00b7-4cf7-aaba-22dde8118fa1
- GitHub: US-dev34/metalyapi-scheduler (public)
- Backend: https://backend-api-production-d0fb.up.railway.app
- Frontend: https://frontend-delta-ebon-85.vercel.app
- Railway project: cd05cfa5-f4ba-42c8-8fc9-cbaca3d6f35b
- Railway service: c6c5815b-8a5e-4c4b-95c6-bbd0f6fd2fc4
- Railway token: [REDACTED - see .env]
- Vercel token: [REDACTED - see .env]
- Vercel team: us-dev34s-projects
- Vercel project: prj_qZAilzqGsZVz39BmIuFcs4wROkQx

## Session Continuity

Last session: 2026-02-22
Stopped at: Full-program grid views deployed, user may request further refinements
Resume file: .planning/phases/05-production-deployment/.continue-here.md
