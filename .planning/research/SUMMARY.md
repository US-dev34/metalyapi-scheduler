# Project Research Summary

**Project:** MetalYapi Facade Construction Scheduler
**Domain:** Construction scheduling / facade manpower tracking
**Researched:** 2026-02-21
**Confidence:** HIGH

## Executive Summary

MetalYapi is a specialized facade manpower tracking tool built on an existing three-tier stack (React + TypeScript + Vite frontend, FastAPI Python backend, Supabase PostgreSQL). The product occupies a narrow but real niche: no existing tool combines facade-specific WBS x date allocation grids with NLP data entry and AI-powered forecasting. Procore and Primavera P6 are too generic and heavyweight. CrewTracks is crew-time-card focused (not manpower allocation). SmartPM analyzes schedules but does not do daily tracking. The codebase is functionally substantial — the core grid, WBS CRUD, baseline management, AI chat, and export endpoints all exist — but significant portions are broken, incomplete, or untested. The foundational problem is not missing features; it is that existing features do not reliably work.

The recommended approach is a repair-first, expand-second strategy. Before any new feature work, six systemic bugs must be fixed: silent exception swallowing (5 bare `except` blocks), unsafe `.data[0]` access (6 crash points), broken Excel import/export column names, missing input validation, broken NLP chat pipeline wiring, and forecast N+1 queries. Only after the core is stable should authentication (Supabase Auth + PyJWT + RLS), PDF export (fpdf2), and the alert service be added. The stack additions needed are minimal: only two new pip dependencies (fpdf2 for PDF generation, PyJWT for JWT verification), both pure Python with no system dependencies.

The key risk is not technical complexity — all required patterns are well-documented and the existing architecture is sound. The risk is execution order. Applying auth and RLS before fixing the unsafe `.data[0]` crashes guarantees a wave of 500 errors that are hard to distinguish from RLS misconfiguration. Fixing individual bugs while silent exception swallowing is still active creates invisible regressions. The pitfall research is unusually strong here: it identifies the exact files and line numbers for each risk, giving the roadmap a precise sequence of safe operations.

---

## Key Findings

### Recommended Stack

The existing stack needs no major additions. Two new pip packages cover all missing functionality: **fpdf2 2.8.6** (pure Python, no system dependencies, purpose-built table API for schedule grids — avoids the Railway/Docker system-library failures that WeasyPrint triggers) and **PyJWT 2.11.0** (lighter than python-jose, matches FastAPI official docs pattern, required for Supabase JWT verification with `audience="authenticated"`). Everything else — `@supabase/supabase-js`, openpyxl, Pydantic v2, React Query — is already installed and working.

For deployment: Vercel (frontend SPA, zero-config Vite detection, requires `vercel.json` rewrites for client-side routing) and Railway (FastAPI backend via `python:3.12-slim` Docker image with single Uvicorn process — no Gunicorn needed at this scale). Frontend auth uses `@supabase/supabase-js` directly; do NOT add `@supabase/ssr` (it is designed for SSR frameworks, still in beta). Backend auth uses PyJWT with local JWT verification — do NOT call `supabase.auth.get_user()` per-request (adds 100–300ms latency unnecessarily).

**Core technologies:**
- **fpdf2 2.8.6**: PDF schedule export — pure Python, zero system deps, direct FastAPI `StreamingResponse` integration
- **PyJWT 2.11.0**: Supabase JWT verification in FastAPI — lighter than python-jose, faster than remote verification
- **@supabase/supabase-js 2.47.0** (existing): SPA auth — already installed, handles token refresh automatically
- **openpyxl 3.1.5 + Pydantic v2** (existing): Excel import/export with row-by-row validation — no pandas needed
- **Vercel + Railway**: Static SPA + Docker FastAPI deployment — $5/month Railway Hobby tier sufficient for <50 users

### Expected Features

The product already has most table-stakes functionality implemented, but broken. The P0 work is repairs, not new builds. After repairs, P1 adds auth (users expect login to exist before any external access), PDF export (first client report request triggers this), and progress dashboard (management's first question is always "how are we doing?").

**Must have — fix now (P0, table stakes that are broken):**
- Excel export (BUG-01) — crashes; users cannot share data with stakeholders
- Excel import (BUG-01) — wrong column names; users cannot onboard projects
- NLP chat pipeline (BUG-03, BUG-04) — parse→preview→apply chain is not wired end-to-end
- AI forecast (BUG-06, BUG-07) — N+1 queries and hardcoded fallback values mislead users
- Input validation (BUG-05) — negative manpower and out-of-range values accepted without error
- Safe database access (BUG-02) — IndexError crashes on empty result sets throughout

**Must have — add next (P1, table stakes missing entirely):**
- User authentication (email/password via Supabase Auth) — no construction manager will use a tool with no login
- Project-scoped access (RLS policies) — users must not see projects they are not assigned to
- PDF report export — weekly client reports always go as PDF; non-negotiable
- Progress dashboard — overall progress %, planned vs. actual mandays, items at risk
- Baseline variance display — explicit numbers, not just color coding

**Should have — competitive differentiators (P2):**
- Role-based permissions (Admin/Editor/Viewer) — needed when external stakeholders access the system
- AI schedule alerts — proactive deviation warnings; no facade tool does this
- Predictive completion dates — forecast bars on Gantt; requires 4+ weeks of data
- Smart column mapping on Excel import — handles any Excel layout (DE/EN headers)
- Voice-to-text input for NLP chat — critical for foremen on scaffolding
- Bulk edit (fill down/right) in grid — reduces repetitive data entry

**Defer to v2+:**
- What-if scenario planning — requires mature forecast model
- Weekly AI report generation — requires stable PDF and forecast
- Primavera P6 / MS Project import — proprietary formats, niche demand
- Photo attachments to daily entries — requires storage infrastructure setup

**Anti-features to avoid explicitly:**
- Full Gantt drag-to-reschedule editor — conflates scheduling tool with manpower tracker; facade WBS items have no dependency chains
- GPS/geofencing crew tracking — GDPR risk for German operations; irrelevant when all workers are at one building
- Real-time collaborative editing (Google Docs style) — facade teams have 1–2 data entry users; Supabase Realtime last-write-wins is sufficient

### Architecture Approach

The existing three-tier architecture is well-structured and does not need redesign — it needs four additions wired in: auth middleware + dependency injection, alert service, chat validation pipeline, and deployment configuration. The build order has a clear dependency chain: auth must come first (RLS policies already require the `authenticated` role; without auth nothing works in production), then alert service and chat validation can be built in parallel (they are independent), then deployment configuration last (requires all env vars finalized).

**Major components:**
1. **Auth Provider (FE) + Auth Middleware (BE)** — session lifecycle, JWT injection into all API calls, route guards; Supabase Auth issues JWTs, FastAPI verifies locally via PyJWT with `audience="authenticated"`
2. **Chat Validation Pipeline** — wraps existing `nlp_parser.py` with a multi-stage pipeline: NLP parse → Pydantic validation → WBS code resolution → confidence gate → preview response; prevents LLM hallucinations from reaching the database
3. **Alert Service** — post-write threshold detection (manpower deviation >20%, progress lag >15%, SPI <0.85); synchronous, part of write path; stores alerts in DB for polling or Supabase Realtime delivery
4. **Deployment Config** — Dockerfile (`python:3.12-slim`), `vercel.json` (SPA rewrites), Railway `railway.toml` (health check, restart policy), environment variable management

**Key patterns:**
- Two-layer auth: middleware extracts token silently (non-blocking), dependency enforces auth per-route (raises 401); keeps health check and public endpoints unauthenticated
- Backend uses `supabase_service_key` for all server-side DB operations — NOT the anon key
- Frontend uses `@supabase/supabase-js` for auth session; injects `Authorization: Bearer <token>` header via `api.ts` wrapper for all FastAPI calls
- Alerts are synchronous and part of the write path at current scale (<50 users); move to background tasks if user count grows beyond 50

### Critical Pitfalls

1. **Silent exception swallowing creates invisible regressions** — Five bare `except Exception: pass` blocks in chat.py, schedule_service.py, forecast.py, db.py. Fix these BEFORE touching any other bug. Fixing BUG-01 while these remain active will silently swallow new exceptions from the fix, making bugs appear resolved while data is still lost. Prevention: replace all five with specific exception types + `logger.error()` as the first commit.

2. **RLS lockout after auth retrofit** — The existing backend uses the `anon` key for all operations. When RLS policies go live, the backend loses access to all data (anon key respects RLS, has no user context). Prevention: switch backend to `supabase_service_key` BEFORE enabling RLS policies. Test RLS through the app SDK (not Supabase SQL editor, which runs as superuser and bypasses RLS). Always include both `USING` and `WITH CHECK` clauses in policies.

3. **CORS misconfiguration between Railway and Vercel** — Current CORS config hardcodes `localhost:5173`. In production, the Vercel URL is different. Using `allow_origins=["*"]` to "fix" CORS breaks credential-bearing requests (JWT auth fails silently). Prevention: configure `CORS_ORIGINS` as a Railway environment variable before first deployment; never combine `allow_origins=["*"]` with `allow_credentials=True`.

4. **Chat pipeline silently loses data** — Four boundaries where data vanishes without error: NLP parse returns empty actions, WBS code mismatch (AI returns `CW-1` vs database `CW-01`), upsert fails without a `UNIQUE(wbs_item_id, date)` constraint, and `apply` endpoint swallows errors. Prevention: full validation pipeline (Pydantic + WBS existence check + confidence gate), per-action apply results, read-after-write confirmation.

5. **Unsafe `.data[0]` access causes production crashes** — Six locations crash with `IndexError` on empty result sets; these are benign locally (MockDB has seed data) but fail immediately in production with RLS or empty projects. Prevention: create `safe_first()` / `require_first()` utility functions as the second commit, apply across all six locations before any other backend work.

---

## Implications for Roadmap

Based on the combined research, a 5-phase structure is strongly indicated. The phase order is driven by three constraints: (1) broken core functionality must be fixed before new functionality is added, (2) auth must precede all multi-user and RLS features, and (3) deployment must come after all env vars are finalized.

### Phase 1: Foundation Stabilization (Bug Fixes)
**Rationale:** The codebase has six systemic bugs that cause crashes, data loss, and incorrect outputs. Building any new feature on this foundation risks compounding failures. This phase has no external dependencies and produces immediate, demonstrable value. Order within phase is strict: exception handling first, then `.data[0]` safety, then business logic bugs.
**Delivers:** A stable, crash-free application that reliably reads/writes data; working Excel import/export; working NLP chat pipeline; accurate (not fabricated) AI forecasts.
**Addresses:** BUG-01 (Excel columns), BUG-02 (IndexError), BUG-03/04 (NLP pipeline), BUG-05 (input validation), BUG-06/07 (forecast N+1 + optimizer), BUG-08/09/10 (MockDB date handling, baseline race condition, column name audit).
**Avoids:** Silent exception swallowing, unsafe `.data[0]` access, optimizer wrong table/column names, baseline race condition.
**Research flag:** Standard patterns — no deeper research needed. Direct code fixes from CLAUDE.md bug inventory.

### Phase 2: Authentication and Access Control
**Rationale:** No external user can be given access until authentication exists. Auth must precede RLS because RLS policies require a user identity to evaluate. This is also the most dangerous phase (RLS misconfiguration lockout is the top security pitfall) and requires careful sequencing: service key switch before RLS enablement, test with real JWT before going live.
**Delivers:** Login/logout flow, session persistence, project-scoped data isolation, role-based permissions (Admin/Editor/Viewer).
**Uses:** `@supabase/supabase-js` (existing), PyJWT 2.11.0 (new), Supabase RLS, `AuthProvider.tsx`, `ProtectedRoute.tsx`, `get_current_user()` FastAPI dependency.
**Implements:** JWT Auth Dependency Chain pattern, Frontend Auth Context pattern.
**Avoids:** RLS lockout (backend uses service key), CORS misconfiguration (configure env vars before deployment), per-request remote JWT verification (use local PyJWT).
**Research flag:** Well-documented — official Supabase + FastAPI patterns apply directly. No deeper research needed.

### Phase 3: Export, Import, and Reporting
**Rationale:** Construction managers' first external use of the tool involves sharing data (Excel export to stakeholders, PDF reports to clients). These features are table stakes for any external-facing deployment. PDF infrastructure is also a prerequisite for the AI weekly report (v2+). This phase can run after auth (authenticated endpoints) but has no dependency on alerts or AI enhancements.
**Delivers:** Working Excel export (fixed in Phase 1; enhanced here with formatting), Excel import with smart column mapping (DE/EN/TR header auto-detection), PDF schedule reports via fpdf2.
**Uses:** fpdf2 2.8.6 (new), openpyxl 3.1.5 (existing), FastAPI `StreamingResponse` for PDF delivery.
**Avoids:** WeasyPrint system dependency hell (use fpdf2), pandas for Excel (use openpyxl + Pydantic), wrong column names in import/export (fixed in Phase 1).
**Research flag:** Standard patterns — fpdf2 table API and openpyxl + Pydantic row validation are well-documented.

### Phase 4: AI Pipeline Enhancement and Alerts
**Rationale:** The NLP chat pipeline is the key differentiator of this product ("type in Turkish and the grid fills itself"). After Phase 1 wires it end-to-end, this phase hardens it with full validation and adds proactive schedule intelligence. The alert service requires baseline management (already exists) and variance computation (already exists). Predictive completion builds on alert logic. Auth is prerequisite (alerts are project-scoped).
**Delivers:** Hardened chat validation pipeline (Pydantic validation + WBS fuzzy matching + confidence gating), AI schedule alerts (manpower deviation >20%, progress lag >15%, SPI <0.85), predictive completion dates on Gantt, voice-to-text input for mobile foremen.
**Uses:** Claude API (existing Anthropic SDK), `ChatValidationPipeline` service, `AlertService`, Supabase Realtime (alert delivery).
**Implements:** Chat Validation Pipeline pattern, Alert Service (Event-Driven Threshold Detection) pattern.
**Avoids:** Unvalidated LLM output to database, chat data loss at validation boundaries, N+1 queries in forecast (fixed Phase 1).
**Research flag:** Chat validation and alert service patterns are well-documented; the WBS fuzzy matching implementation (Levenshtein/phonetic for Turkish/German codes) may benefit from a focused research spike.

### Phase 5: Production Deployment
**Rationale:** Deployment is last because it requires all environment variables finalized, all services integrated, health checks working, and CORS origins known. Deploying incrementally (backend before frontend, staging before production) reduces risk.
**Delivers:** Production-deployed system on Vercel (frontend) + Railway (backend); CI/CD pipeline via GitHub Actions; health monitoring; environment variable management.
**Uses:** Vercel (Vite auto-detection, `vercel.json` rewrites), Railway (`python:3.12-slim` Dockerfile, `railway.toml` health check), GitHub Actions `deploy.yml`.
**Avoids:** CORS misconfiguration (set `CORS_ORIGINS` in Railway env vars before first deploy), wrong port binding (use `0.0.0.0:$PORT`), service key in frontend env vars.
**Research flag:** Standard patterns — Railway FastAPI guide and Vercel Vite guide are authoritative. No deeper research needed.

### Phase Ordering Rationale

- **Bugs before features:** Three of the six P0 bugs (exception swallowing, IndexError crashes, optimizer wrong table names) would cascade into any new feature work, creating phantom bugs that are extremely hard to diagnose. Fixing them first creates a stable baseline.
- **Auth before access control:** Supabase RLS policies require `auth.uid()` to evaluate. Without auth, RLS either blocks everything (useless) or must be left disabled (insecure). Auth creates the prerequisite for project scoping.
- **Export before AI enhancement:** PDF infrastructure is needed for the AI weekly report (v2+). Building it as standalone infrastructure in Phase 3 makes Phase 4 AI work cleaner.
- **Deployment last:** Environment variables for CORS, JWT secret, and API URLs are only finalized once all services are built. Deploying earlier causes repeated reconfigurations.
- **Parallel within phases:** Alert service and chat validation pipeline (both in Phase 4) can be developed in parallel — they share no code and have no mutual dependency.

### Research Flags

Phases needing deeper research during planning:
- **Phase 4 (AI Pipeline):** WBS fuzzy matching implementation — Turkish facade codes may have phonetic or numeric patterns that standard Levenshtein matching handles poorly. A targeted spike on fuzzy matching libraries (rapidfuzz, phonetic matching for mixed-language codes) is recommended before implementing.

Phases with standard patterns (skip research-phase):
- **Phase 1 (Bug Fixes):** All bugs are catalogued with file names and line numbers in CLAUDE.md. Direct fixes.
- **Phase 2 (Auth):** Official Supabase React + FastAPI PyJWT patterns are verified and documented in STACK.md and ARCHITECTURE.md.
- **Phase 3 (Export/Import):** fpdf2 table API and openpyxl + Pydantic validation are well-documented. Column mapping logic is standard fuzzy header matching.
- **Phase 5 (Deployment):** Railway and Vercel deployment guides are authoritative and directly applicable.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All recommendations verified on PyPI and official docs (Feb 2026). Only 2 new dependencies. Alternatives explicitly ruled out with documented reasons. |
| Features | MEDIUM | Table stakes verified via competitor analysis (Procore, Primavera, CrewTracks, SmartPM). Differentiator value (NLP data entry) is qualitative — no direct user research available. P0 bugs confirmed from codebase audit. |
| Architecture | HIGH | Existing codebase examined directly. All 4 new components (auth, alerts, chat validation, deployment) follow official FastAPI + Supabase patterns. Build order is deterministic from dependency analysis. |
| Pitfalls | HIGH | Based on direct codebase audit of 15+ source files. Six critical pitfalls identified with exact file names and line numbers. Prevention strategies are specific and actionable. |

**Overall confidence:** HIGH

### Gaps to Address

- **User research for feature prioritization:** The P2 feature order (alerts vs. smart column mapping vs. voice input) is based on inferred user value, not observed user behavior. First external user deployment will clarify actual priorities.
- **WBS fuzzy matching for Turkish/German codes:** No definitive research on best approach for matching facade zone codes (CW-01, A3-EG, etc.) with phonetic/numeric variation. Recommend a spike during Phase 4 planning.
- **Audit log implementation depth:** The audit log is currently a placeholder. The chat pipeline pitfall recovery depends on it. The scope (what to log, retention policy, query interface) needs to be defined before Phase 4.
- **Supabase Realtime performance at scale:** Alert delivery via Realtime is recommended, but Realtime broadcasting behavior under rapid grid editing (debounce strategy) needs validation during Phase 4 implementation.

---

## Sources

### Primary (HIGH confidence)
- [PyPI: fpdf2 2.8.6](https://pypi.org/project/fpdf2/) — version, dependencies, Python compatibility
- [PyPI: PyJWT 2.11.0](https://pypi.org/project/PyJWT/) — version, Python compatibility
- [Supabase React Auth Quickstart](https://supabase.com/docs/guides/auth/quickstarts/react) — SPA auth pattern
- [Supabase JWT Documentation](https://supabase.com/docs/guides/auth/jwts) — JWT verification
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) — alert delivery
- [FastAPI Security - Get Current User](https://fastapi.tiangolo.com/tutorial/security/get-current-user/) — dependency injection pattern
- [Railway FastAPI Deployment Guide](https://docs.railway.com/guides/fastapi) — deployment configuration
- [Vercel Vite Docs](https://vercel.com/docs/frameworks/frontend/vite) — SPA deployment, rewrites
- CLAUDE.md (project internal) — bug inventory, existing architecture, execution plan
- Direct codebase audit: chat.py, schedule_service.py, baseline_service.py, forecast.py, optimizer.py, import_export.py, db.py, schemas.py

### Secondary (MEDIUM confidence)
- [Supabase JWT Discussion #20763](https://github.com/orgs/supabase/discussions/20763) — `audience="authenticated"` requirement
- [Supabase RLS Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security) — 83% misconfiguration statistic
- [BuiltWorlds: 40 AI-Driven AEC Solutions 2026](https://builtworlds.com/news/40-ai-driven-aec-solutions-to-know-in-2026/) — AI in construction landscape
- [Frontiers: Conversational AI in Construction](https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2025.1713342/full) — NLP data entry research
- [Python Bare Except Antipattern](https://realpython.com/the-most-diabolical-python-antipattern/) — exception handling best practices
- [WeasyPrint Railway Issue #2221](https://github.com/Kozea/WeasyPrint/issues/2221) — system dependency failure on Railway

### Tertiary (LOW confidence)
- [Deployment Hell Guide: Vercel + Railway 2025](https://medium.com/codetodeploy/stop-fighting-deployment-hell-your-2025-guide-to-mern-on-vercel-railway-840453de0649) — CORS patterns (needs validation against project's specific config)

---
*Research completed: 2026-02-21*
*Ready for roadmap: yes*
