# Requirements: MetalYapi Facade Construction Scheduler

**Defined:** 2026-02-21
**Core Value:** Construction managers can see today's manpower allocation across all facade work items, edit it in real-time, and instantly know which items are behind schedule

## v1 Requirements

Requirements for production deployment. Each maps to roadmap phases.

### Bug Fixes

- [ ] **FIX-01**: All bare `except Exception: pass` blocks replaced with specific exception types and logging
- [ ] **FIX-02**: All unsafe `.data[0]` accesses replaced with `safe_first()`/`require_first()` utility functions
- [ ] **FIX-03**: import_export.py column names corrected (wbs_code, qty, qty_done, date, actual_manpower, daily_allocations table)
- [ ] **FIX-04**: optimizer.py column names and table name corrected (same class of bug as FIX-03)
- [ ] **FIX-05**: AllocationCell input validation enforced (actual_manpower >= 0, <= 200; qty_done >= 0)
- [ ] **FIX-06**: Forecast fallback uses project end_date instead of hardcoded timedelta(days=90)
- [ ] **FIX-07**: Optimizer caps suggestions to top 10 instead of N*M cartesian product
- [ ] **FIX-08**: MockDB applies numeric/date coercion in filter comparisons
- [ ] **FIX-09**: Baseline version numbering uses UNIQUE constraint + IntegrityError retry
- [ ] **FIX-10**: Claude model string loaded from CLAUDE_MODEL env var across all AI service files

### Authentication

- [ ] **AUTH-01**: User can log in with email and password via Supabase Auth
- [ ] **AUTH-02**: User session persists across browser refresh (Supabase token refresh)
- [ ] **AUTH-03**: User can log out from the header bar
- [ ] **AUTH-04**: All API endpoints (except /health) require valid JWT via FastAPI middleware
- [ ] **AUTH-05**: Backend verifies JWT locally using PyJWT with audience="authenticated"
- [ ] **AUTH-06**: Backend uses supabase_service_key for all server-side DB operations

### Access Control

- [ ] **ACCS-01**: User can only see projects they are assigned to (project_members table + RLS)
- [ ] **ACCS-02**: RLS policies enforce project-scoped data isolation on all tables
- [ ] **ACCS-03**: Admin user can manage project membership

### Export

- [ ] **EXPRT-01**: User can download Excel export of allocation matrix (.xlsx with WBS rows x date columns)
- [ ] **EXPRT-02**: User can download PDF daily report (landscape, project header, WBS progress table)
- [ ] **EXPRT-03**: User can download PDF progress report (KPIs, top-5 risk items, top-5 ahead items)

### Import

- [ ] **IMPRT-01**: User can upload Excel file and see import preview before confirming
- [ ] **IMPRT-02**: System auto-detects Excel format (MATRIX vs LIST layout)
- [ ] **IMPRT-03**: System auto-maps common column headers (DE: Menge/Einheit, EN: QTY/Unit, TR: Miktar)
- [ ] **IMPRT-04**: Import validation shows per-row errors and warnings before confirmation
- [ ] **IMPRT-05**: Confirmed import upserts WBS items and allocations with audit log entry

### AI Services

- [ ] **AI-01**: Forecast runs in batch mode (2 DB queries + 1 Claude call instead of N+1)
- [ ] **AI-02**: Optimizer returns top-10 ranked suggestions with natural language explanations
- [ ] **AI-03**: Weekly report agent collects metrics and generates professional narrative via Claude
- [ ] **AI-04**: Daily digest agent summarizes today's KPIs, trends, highlights, and concerns
- [ ] **AI-05**: AI panel in frontend has tabs for Forecast, Optimization, Report, and Digest

### Chat Pipeline

- [ ] **CHAT-01**: NLP chat parses natural language into structured allocation actions with per-action validation
- [ ] **CHAT-02**: Chat validator checks WBS code existence, date sanity, capacity limits, and overwrite warnings
- [ ] **CHAT-03**: ParsedPreview shows validation status (pass/warning) per action before user confirms
- [ ] **CHAT-04**: Apply endpoint batch-upserts allocations and returns per-action success/failure
- [ ] **CHAT-05**: Post-apply alert checks updated WBS items against baseline and surfaces deviations

### Alerts

- [ ] **ALRT-01**: System detects schedule deviation >5% behind baseline after allocation updates
- [ ] **ALRT-02**: Alert includes severity (medium: 5-15% behind, high: >15% behind) and recommendation
- [ ] **ALRT-03**: Alert summary shown in chat response after apply ("FT07 is 12% behind baseline")

### Deployment

- [ ] **DEPL-01**: Backend deployed to Railway with Dockerfile, health check, environment variables
- [ ] **DEPL-02**: Frontend deployed to Vercel with vercel.json SPA rewrites
- [ ] **DEPL-03**: CORS_ORIGINS configured for production Vercel URL
- [ ] **DEPL-04**: All environment variables (Supabase, Claude, CORS) set in production

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Roles & Permissions

- **ROLE-01**: Role-based permissions (Admin/Editor/Viewer) enforced per project
- **ROLE-02**: Viewer role has read-only access with export capability

### Advanced AI

- **ADV-01**: What-if scenario planning ("What if I add 5 workers to CW-01 next week?")
- **ADV-02**: AI-suggested corrections for anomalous data entry
- **ADV-03**: Voice-to-text data entry via browser SpeechRecognition API

### UX Enhancements

- **UX-01**: Bulk edit (fill down/right) in allocation grid
- **UX-02**: Undo/revert last edit via audit log
- **UX-03**: Progress dashboard with overall % and risk items

### Advanced Import/Export

- **ADVIO-01**: Branded PDF reports with company logo
- **ADVIO-02**: Primavera P6 / MS Project file import (.xer, .mpp)
- **ADVIO-03**: Photo attachments to daily allocation entries

## Out of Scope

| Feature | Reason |
|---------|--------|
| Full Gantt chart editor (drag-to-reschedule) | Facade manpower tracking, not project scheduling. WBS items have no dependency chains. |
| GPS/geofencing crew tracking | Single building site, GDPR concerns in Germany, surveillance optics |
| Real-time collaborative editing | 1-2 data entry users per project; Supabase Realtime last-write-wins sufficient |
| Full ERP integration (SAP, Oracle) | Bottomless scope pit; Excel export covers interop needs |
| Offline-first PWA | Disproportionate complexity; facade sites have mobile data coverage |
| Multi-language UI (i18n) | English UI standard in construction; AI chat already handles TR/DE input |
| Mobile native app | Web-first; responsive design later |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| FIX-01 | Phase 1 | Pending |
| FIX-02 | Phase 1 | Pending |
| FIX-03 | Phase 1 | Pending |
| FIX-04 | Phase 1 | Pending |
| FIX-05 | Phase 1 | Pending |
| FIX-06 | Phase 1 | Pending |
| FIX-07 | Phase 1 | Pending |
| FIX-08 | Phase 1 | Pending |
| FIX-09 | Phase 1 | Pending |
| FIX-10 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| ACCS-01 | Phase 2 | Pending |
| ACCS-02 | Phase 2 | Pending |
| ACCS-03 | Phase 2 | Pending |
| EXPRT-01 | Phase 3 | Pending |
| EXPRT-02 | Phase 3 | Pending |
| EXPRT-03 | Phase 3 | Pending |
| IMPRT-01 | Phase 3 | Pending |
| IMPRT-02 | Phase 3 | Pending |
| IMPRT-03 | Phase 3 | Pending |
| IMPRT-04 | Phase 3 | Pending |
| IMPRT-05 | Phase 3 | Pending |
| AI-01 | Phase 4 | Pending |
| AI-02 | Phase 4 | Pending |
| AI-03 | Phase 4 | Pending |
| AI-04 | Phase 4 | Pending |
| AI-05 | Phase 4 | Pending |
| CHAT-01 | Phase 4 | Pending |
| CHAT-02 | Phase 4 | Pending |
| CHAT-03 | Phase 4 | Pending |
| CHAT-04 | Phase 4 | Pending |
| CHAT-05 | Phase 4 | Pending |
| ALRT-01 | Phase 4 | Pending |
| ALRT-02 | Phase 4 | Pending |
| ALRT-03 | Phase 4 | Pending |
| DEPL-01 | Phase 5 | Pending |
| DEPL-02 | Phase 5 | Pending |
| DEPL-03 | Phase 5 | Pending |
| DEPL-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 43 total
- Mapped to phases: 43
- Unmapped: 0

---
*Requirements defined: 2026-02-21*
*Last updated: 2026-02-21 after initial definition*
