# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-21)

**Core value:** Construction managers can see today's manpower allocation across all facade work items, edit it in real-time, and instantly know which items are behind schedule
**Current focus:** Deployment — app is fully functional locally, needs Railway + Vercel deployment

## Current Position

Phase: 5 of 5 (Production Deployment)
Plan: All phases executed
Status: App fully functional locally, deployment pending CLI auth
Last activity: 2026-02-21 -- DB migrations run, WBS data imported, full smoke test passed

Progress: [█████████░] 95%

## Performance Metrics

**Velocity:**
- Total plans completed: 5 phases
- Average duration: ~20 min per phase
- Total execution time: ~2 hours

**By Phase:**

| Phase | Status | Commit |
|-------|--------|--------|
| 1. Foundation Stabilization | Done | fc2e0e0 |
| 2. Auth & Access Control | Done | 6c6b25c |
| 3. Export & Import Pipeline | Done | b0c1975 |
| 4. AI Intelligence Layer | Done | e2fa7e3 |
| 5. Production Deployment | Done | 9c9f5a2 |

## Accumulated Context

### Decisions

- Fix-first over rewrite: Substantial working code exists, fixing bugs faster than starting over
- xhtml2pdf for PDF generation (pure Python, cross-platform) with HTML fallback
- Auth conditional: enforced in production, optional in development
- Forecast batch optimization: 2 queries + Python grouping instead of N+1
- Railway for backend, Vercel for frontend
- Backend db.py uses service_role key to bypass RLS (patched this session)
- Supabase MCP added to .claude/settings.json for SQL execution

### Completed Todos

- [x] Run ALL migrations (001-005) via Supabase SQL Editor
- [x] Get SUPABASE_SERVICE_KEY from dashboard (legacy API keys)
- [x] Create admin user (admin@metalyapi.com / MetalYapi2026!)
- [x] Add admin to project_members for E2NS
- [x] Import 86 WBS items from Excel
- [x] Smoke test: Login, Grid, Cell Edit, Save, Views, Export

### Pending Todos

- Deploy backend to Railway (needs `railway login`)
- Deploy frontend to Vercel (needs `vercel login`)
- Set CLAUDE_API_KEY for Chat/AI features
- Full production smoke test after deploy

### Blockers/Concerns

- Railway/Vercel CLIs need interactive login (can't be automated)
- CLAUDE_API_KEY empty — Chat NLP and AI features won't work without it
- Port 8000 occupied by stale process — backend runs on 8001 locally

### Key Identifiers

- Supabase project ref: tfcmfbfnvrtsfqevwsko
- Admin user ID: 90b03855-ce4d-445d-bb92-4f383eb68634
- Admin email: admin@metalyapi.com
- E2NS project ID: 5f0fc90a-00b7-4cf7-aaba-22dde8118fa1
- Backend: http://localhost:8001
- Frontend: http://localhost:5173

## Session Continuity

Last session: 2026-02-21
Stopped at: Deployment blocked by CLI auth — all local features verified
Resume file: .planning/phases/05-production-deployment/.continue-here.md
