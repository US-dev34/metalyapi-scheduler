# Roadmap: MetalYapi Facade Construction Scheduler

## Overview

This roadmap takes an existing but unstable facade manpower tracker from its current broken state to production deployment. The strategy is repair-first, expand-second: stabilize the crashing codebase, add authentication so real users can log in, build the data I/O pipeline construction managers need for stakeholder reporting, harden the AI intelligence layer that differentiates this product, and finally deploy to production. Every phase delivers a coherent, verifiable capability that the next phase depends on.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation Stabilization** - Fix 10 systemic bugs so the app stops crashing, swallowing errors, and producing wrong outputs
- [ ] **Phase 2: Authentication & Access Control** - Users can securely log in and only see projects they belong to
- [ ] **Phase 3: Export & Import Pipeline** - Users can get data out (Excel, PDF) and bring data in (Excel with validation and preview)
- [ ] **Phase 4: AI Intelligence Layer** - AI forecast, optimizer, chat pipeline, report generation, daily digest, and schedule alerts all work end-to-end
- [ ] **Phase 5: Production Deployment** - The application runs on Railway + Vercel with proper configuration and monitoring

## Phase Details

### Phase 1: Foundation Stabilization
**Goal**: The application reliably reads, writes, and computes data without crashes, silent failures, or incorrect outputs
**Depends on**: Nothing (first phase)
**Requirements**: FIX-01, FIX-02, FIX-03, FIX-04, FIX-05, FIX-06, FIX-07, FIX-08, FIX-09, FIX-10
**Success Criteria** (what must be TRUE):
  1. No bare `except Exception: pass` blocks remain anywhere in the codebase; all exceptions are caught by specific type and logged
  2. Every Supabase query result is accessed through safe utility functions; empty result sets return None or raise descriptive errors instead of crashing with IndexError
  3. User can export the allocation matrix to Excel and re-import it without data loss or column mismatch
  4. AI forecast returns predictions using batch queries (not N+1) and uses the project's actual end date for time horizon
  5. Allocation cell edits reject invalid values (negative manpower, manpower > 200, negative qty_done) with visible error messages
**Plans**: TBD

Plans:
- [ ] 01-01: TBD
- [ ] 01-02: TBD
- [ ] 01-03: TBD

### Phase 2: Authentication & Access Control
**Goal**: Users can securely access their accounts and only see projects they are assigned to
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, ACCS-01, ACCS-02, ACCS-03
**Success Criteria** (what must be TRUE):
  1. User can log in with email and password and sees only their assigned projects
  2. User session persists across browser refresh without requiring re-login (Supabase token refresh works)
  3. User can log out from the header bar and is redirected to the login page
  4. Unauthenticated API requests (except /health) receive 401 Unauthorized
  5. Admin user can add or remove members from a project, and membership changes immediately affect what that member can see
**Plans**: TBD

Plans:
- [ ] 02-01: TBD
- [ ] 02-02: TBD
- [ ] 02-03: TBD

### Phase 3: Export & Import Pipeline
**Goal**: Construction managers can share project data with stakeholders via Excel and PDF, and onboard new projects via Excel import with validation
**Depends on**: Phase 2
**Requirements**: EXPRT-01, EXPRT-02, EXPRT-03, IMPRT-01, IMPRT-02, IMPRT-03, IMPRT-04, IMPRT-05
**Success Criteria** (what must be TRUE):
  1. User can download an Excel file (.xlsx) of the allocation matrix with WBS rows and date columns
  2. User can download a PDF daily report (landscape layout, project header, WBS progress table) for any selected date
  3. User can download a PDF progress report showing KPIs, top-5 risk items, and top-5 ahead-of-schedule items
  4. User can upload an Excel file and see a preview of what will be imported (with per-row errors and warnings) before confirming
  5. Confirmed import correctly upserts WBS items and allocations regardless of whether the Excel uses German, English, or Turkish column headers
**Plans**: TBD

Plans:
- [ ] 03-01: TBD
- [ ] 03-02: TBD
- [ ] 03-03: TBD

### Phase 4: AI Intelligence Layer
**Goal**: The AI-powered features (forecast, optimizer, chat, reports, digest, alerts) work end-to-end with validation, producing reliable outputs that construction managers can trust
**Depends on**: Phase 2
**Requirements**: AI-01, AI-02, AI-03, AI-04, AI-05, CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, ALRT-01, ALRT-02, ALRT-03
**Success Criteria** (what must be TRUE):
  1. User can open the AI panel and see tabs for Forecast, Optimization, Report, and Digest, each returning formatted results from Claude
  2. User can type a natural language allocation command in the chat (including Turkish or German), see a validated preview with pass/warning status per action, and confirm to apply changes to the grid
  3. After applying chat actions, the system checks affected WBS items against baseline and surfaces deviation alerts with severity and recommendation (e.g., "FT07 is 12% behind baseline - consider adding 2 workers")
  4. AI forecast runs in under 5 seconds for a full project (batch mode, not N+1) and optimizer returns top-10 ranked suggestions with explanations
  5. Daily digest summarizes today's KPIs, trends, highlights, and concerns; weekly report generates a professional narrative suitable for client distribution
**Plans**: TBD

Plans:
- [ ] 04-01: TBD
- [ ] 04-02: TBD
- [ ] 04-03: TBD
- [ ] 04-04: TBD

### Phase 5: Production Deployment
**Goal**: The application is live on the internet, accessible to Metal Yapi construction managers, with proper environment configuration and health monitoring
**Depends on**: Phase 1, Phase 2, Phase 3, Phase 4
**Requirements**: DEPL-01, DEPL-02, DEPL-03, DEPL-04
**Success Criteria** (what must be TRUE):
  1. Backend is accessible at a Railway URL with /health returning 200 OK
  2. Frontend is accessible at a Vercel URL and serves the SPA with correct client-side routing (no 404 on refresh)
  3. User can log in on the production Vercel URL, and all API calls succeed through the Railway backend (CORS configured correctly)
  4. All environment variables (Supabase URL, Supabase keys, Claude API key, CORS origins, JWT secret) are set in production and not hardcoded in source
**Plans**: TBD

Plans:
- [ ] 05-01: TBD
- [ ] 05-02: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3 -> 4 -> 5

Note: Phase 3 and Phase 4 both depend on Phase 2 but not on each other. They could execute in parallel if desired, but sequential execution (3 then 4) is recommended because PDF infrastructure built in Phase 3 supports the AI report feature in Phase 4.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation Stabilization | 0/3 | Not started | - |
| 2. Authentication & Access Control | 0/3 | Not started | - |
| 3. Export & Import Pipeline | 0/3 | Not started | - |
| 4. AI Intelligence Layer | 0/4 | Not started | - |
| 5. Production Deployment | 0/2 | Not started | - |

---
*Roadmap created: 2026-02-21*
*Last updated: 2026-02-21*
