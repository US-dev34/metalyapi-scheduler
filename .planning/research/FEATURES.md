# Feature Research

**Domain:** Construction scheduling / facade manpower tracking
**Researched:** 2026-02-21
**Confidence:** MEDIUM (domain well-understood from competitor analysis + existing codebase; specifics for facade niche based on training data + web research)

## Context: What Already Exists

The MetalYapi Facade Construction Scheduler already has:
- Grid-based daily/weekly allocation view (AG Grid)
- WBS CRUD with hierarchical structure
- Baseline management (create, snapshot, compare)
- Chat-based NLP data entry (buggy, not wired end-to-end)
- AI forecast, optimizer, report generator (all buggy or incomplete)
- Summary/Gantt view (exists, untested)
- Excel export (broken), PDF export (not built), Excel import (broken)
- No authentication at all
- No alerts or monitoring
- Audit logging is a placeholder

This research focuses on what features are **expected vs. differentiating** for the next milestone, scoped to: export/import, auth/authz, AI-assisted data entry, and schedule monitoring/alerts.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features construction managers assume exist. Missing these means the tool feels broken or untrustworthy.

#### Export/Import

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Excel export of allocation matrix** | Construction managers live in Excel. The first thing they do is export to share with stakeholders who will never log in. Every competitor (Procore, Primavera, SmartPM) exports to Excel. | LOW | Already exists but broken (BUG-01). Fix = table stakes. Must produce a clean .xlsx with WBS rows x date columns, totals, and project header. |
| **Excel import of WBS structure** | Projects start with WBS lists in Excel. Manual re-entry is a dealbreaker. MS Project, Primavera P6, and every scheduling tool supports Excel import. | MEDIUM | Exists but broken. Needs: file upload, header detection, column mapping (auto-detect common patterns like "WBS Code", "Menge", "Einheit"), validation preview, confirm/cancel flow. |
| **Excel import of allocation data** | Site engineers often collect daily data in Excel on-site (especially when offline). They need to bulk-upload days of data. | MEDIUM | Related to WBS import but separate workflow. Must handle date columns as allocation entries. Detect MATRIX format (WBS rows x date columns) vs LIST format (one row per entry). |
| **PDF report export** | Weekly/monthly progress reports go to clients, general contractors, and building owners as PDF. Always PDF. Non-negotiable. | MEDIUM | Not yet built. Needs: landscape layout, project header, WBS progress table, baseline comparison, KPI summary. WeasyPrint or ReportLab on backend. |
| **CSV fallback export** | Some systems (ERP, payroll) need CSV. Users expect at least one non-Excel tabular export. | LOW | Simple derivative of Excel export logic. |

#### Authentication & Authorization

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **User login (email/password)** | No construction manager will use a tool with no login. Data is project-critical. Every tool from Procore to Fieldwire requires auth. | LOW | Supabase Auth handles this out of the box. Frontend: LoginPage, session check. Backend: JWT middleware. |
| **Project-scoped access** | Users should only see projects they are assigned to. A facade contractor working on 3 projects must not see data from projects they are not on. | MEDIUM | Requires `project_members` table + RLS policies. Supabase RLS with `auth.uid()` checks. This is standard multi-tenant pattern. |
| **Role-based permissions (Admin/Editor/Viewer)** | Site managers need full edit access. Client representatives need read-only views. Head office needs cross-project visibility. Three roles minimum. | MEDIUM | Admin (full CRUD + settings), Editor (edit allocations + WBS), Viewer (read-only + export). Store role in `project_members.role`. Enforce in RLS + API middleware. |
| **Session persistence** | Users should not have to re-login every time they open the browser. Standard web app expectation. | LOW | Supabase Auth handles refresh tokens automatically. Frontend: check session on mount. |

#### Schedule Monitoring & Alerts

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Baseline vs. actual variance display** | Construction scheduling fundamentally revolves around "are we on plan?" The grid already color-codes cells (red = behind, green = ahead). But explicit variance numbers are table stakes. | LOW | Compute engine already calculates variance. Need to surface it clearly: variance column in grid, percentage behind/ahead per WBS, overall project health indicator. |
| **Progress dashboard / KPI summary** | Every competitor shows: total progress %, planned vs actual mandays, items at risk, items on track. SmartPM, Procore, Primavera all have dashboards. | MEDIUM | Frontend component: overall progress bar, planned vs actual chart, top-5 risk items, productivity trend. Backend: aggregate queries (most data exists in `vw_wbs_progress`). |
| **Manual milestone tracking** | Facade projects have hard deadlines (building handover dates, zone completions). Users need to mark and track these. | LOW | Simple `milestones` table (name, date, status). Show on Gantt/summary view. Already in architecture docs but not built. |

#### Data Entry Reliability

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Undo/revert last edit** | Construction data entry errors happen constantly ("put 50 instead of 5"). Users need a way back. | MEDIUM | Two approaches: (1) simple undo buffer in frontend for last N edits, (2) audit log-based revert. Option 1 is table stakes; option 2 is a differentiator. Audit log table exists but is a placeholder. |
| **Input validation with clear feedback** | Negative manpower, unreasonable values (500 workers on one item), dates outside project range -- all must be caught with clear messages. | LOW | Pydantic validation on backend (BUG-05 fix). Frontend: inline cell validation in AG Grid. Show red border + tooltip on invalid input. |
| **Bulk edit (copy/paste rows/columns)** | Site engineers often have the same crew size for a week. They need to paste a value across multiple cells/dates. | MEDIUM | AG Grid supports clipboard operations. Need: copy cell, paste to range; fill down; fill right. Standard spreadsheet UX that construction users expect. |

---

### Differentiators (Competitive Advantage)

Features that set MetalYapi apart from generic construction scheduling tools. These are not expected, but they create real value for facade installation teams.

#### AI-Assisted Data Entry

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **NLP chat-to-grid data entry** | Facade foremen report verbally: "Today on CW-01 we had 5 guys, finished 3 units." Parsing natural language (Turkish or English) into structured grid updates eliminates manual data entry. No competitor does this for manpower tracking. | HIGH | Already partially built (nlp_parser.py, chat endpoints). Needs: end-to-end wiring, robust WBS code fuzzy matching, confidence thresholds, clear preview-before-apply UX. This is THE key differentiator. |
| **AI-suggested corrections** | When a user enters data that looks anomalous (e.g., 0 workers but 10 qty done, or 50% more workers than any previous day), the AI flags it: "This looks unusual. Did you mean X?" | MEDIUM | Post-entry validation pass using Claude Haiku. Compare against historical patterns per WBS item. Low-cost API call (Haiku). Alert only on high-confidence anomalies. |
| **Voice-to-text data entry** | Foremen on facade scaffolding cannot type easily. Voice input via browser Speech-to-Text API, then NLP parse, is a powerful workflow. | MEDIUM | Browser `SpeechRecognition` API (Chrome/Edge) for transcription. Feed transcript to existing NLP parser. No additional backend work. Frontend-only addition to MessageInput component. |
| **Photo-based daily reporting** | Attach progress photos to daily entries. Not AI-analyzed (that is anti-feature territory), just stored as evidence alongside allocation data. | LOW | File upload to Supabase Storage. Link to `daily_allocations` or `chat_messages`. Display in grid tooltip or sidebar. |

#### Smart Monitoring & Forecasting

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **AI-generated schedule alerts** | Instead of manual dashboard checking, the system proactively warns: "CW-03 is 15% behind baseline, projected to miss deadline by 8 days. Consider adding 2 workers." No facade-specific tool does this. | MEDIUM | Already in architecture (AlertList component, forecast engine). Needs: post-update trigger, baseline comparison logic, configurable thresholds (5%, 10%, 15% behind), email/in-app notification. |
| **Predictive completion dates** | Using productivity rate history, forecast when each WBS item will complete. Show on Gantt as "forecast bar" alongside baseline bar. | MEDIUM | Forecast engine exists (forecast.py) but is buggy. Local compute (productivity rate x remaining qty / avg crew) is straightforward. Claude API call adds narrative explanation and risk assessment. |
| **What-if scenario planning** | "What happens if I add 5 workers to CW-01 starting next week?" Show projected impact on completion date. | HIGH | Already in architecture (whatif endpoint, WhatIfModal). Complex because it needs to model resource reallocation across WBS items. Claude API does the heavy lifting but needs good context. |
| **Weekly AI-generated progress report** | Auto-generate a professional weekly report (in German or English) summarizing progress, risks, and recommendations. Export as PDF for client distribution. | MEDIUM | Report generator exists (report_gen.py). Needs: structured data collection, Claude prompt for professional narrative, PDF rendering, language selection. High value for construction managers who spend hours writing reports manually. |

#### Advanced Export/Import

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Smart column mapping on import** | Auto-detect columns from any Excel layout (German headers like "Menge", "Einheit" or English "QTY", "Unit"). Show mapping preview, let user adjust, remember mapping for future imports. | MEDIUM | Header fuzzy matching against known patterns. Store successful mappings per project. Reduces friction from "your Excel must match our exact template" to "upload any Excel, we will figure it out." |
| **Import validation report** | After import, show: "45 rows imported, 3 skipped (reasons), 2 warnings." Downloadable as CSV. | LOW | Already in import architecture. Just needs proper implementation with error aggregation. |
| **Branded PDF reports** | Company logo, project name, date range, professional formatting. Construction reports go to external stakeholders; branding matters. | LOW | HTML template with logo placeholder. WeasyPrint renders to PDF. Low effort, high perceived value. |
| **Primavera P6 / MS Project import** | Import .xer or .mpp schedule files to seed WBS structure and baseline dates. | HIGH | Requires parsing proprietary formats. XER (XML-based) is feasible; MPP is hard without libraries. Defer to v2+. |

---

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for a facade manpower tracking tool.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| **Full Gantt chart editor (drag-to-reschedule)** | "We want to drag tasks on the Gantt to reschedule." | Facade manpower tracking is NOT project scheduling. WBS items do not have dependencies or critical path in the traditional sense. Workers move between facade zones based on site conditions, not dependency chains. Adding a full Gantt editor conflates two different tools (Primavera P6 vs. manpower tracker). | Read-only Gantt for visualization. Baseline vs. actual/forecast bars. No drag-to-edit. Dates are derived from allocation data, not manually set on Gantt. |
| **GPS/geofencing crew tracking** | "Track where our workers are on site." | Facade workers are on one building site. GPS tracking adds surveillance concerns, privacy issues (GDPR in Germany), and significant mobile app complexity. Not relevant when all workers are at the same building. | Simple daily headcount per WBS item. If multi-site tracking is needed, it is per-project, not per-worker GPS. |
| **AI-powered image analysis of progress** | "Use computer vision to detect how many facade panels are installed from photos." | Extremely complex, unreliable for facade installations (panels look similar, angles vary, occlusion from scaffolding). False positives would undermine trust in the tool. No construction AI tool has reliably solved this for facade specifically. | Manual photo attachment to daily entries. Let the human report quantities; attach photos as evidence. |
| **Real-time collaborative editing (Google Docs style)** | "Multiple people editing the grid simultaneously." | Facade teams have 1-2 people entering data per project. Real-time collaboration adds massive complexity (OT/CRDT, conflict resolution) for a use case that rarely occurs. Supabase Realtime already broadcasts changes. | Optimistic updates with Supabase Realtime subscription. If two users edit simultaneously, last-write-wins with toast notification "Data updated by another user." Sufficient for 5-10 concurrent users. |
| **Full ERP integration (SAP, Oracle)** | "Connect to our ERP for payroll and cost tracking." | ERP integrations are bottomless pits of scope. Each customer has different ERP config. This is a manpower tracker, not an ERP module. | Excel export in formats that ERP systems can import. Standardized CSV export with configurable columns. Let the ERP team handle their side. |
| **Offline-first PWA** | "Workers need to enter data without internet." | PWA with offline sync requires service workers, IndexedDB, conflict resolution, sync queues. Huge complexity. Facade sites typically have mobile data coverage. | Responsive web design that works on mobile browsers. If offline is truly needed, simple "save locally and upload later" with a basic form -- not full offline grid editing. |
| **Multi-language UI (TR/DE/EN)** | "Support Turkish, German, and English." | i18n adds complexity to every string, every component, every error message. Metal Yapi team operates in German business context with Turkish-speaking foremen. | Start with English UI (international standard in construction). AI chat parser already handles Turkish and German input. Add i18n only if user feedback demands it. Use AI to generate reports in the user's preferred language. |

---

## Feature Dependencies

```
[Excel Export Fix]
    (no dependencies, standalone fix)

[Excel Import - WBS]
    requires --> [WBS CRUD] (already exists)

[Excel Import - Allocations]
    requires --> [Excel Import - WBS] (must understand WBS structure first)
    requires --> [Column Mapping Logic] (shared with WBS import)

[PDF Export]
    requires --> [Progress Dashboard Data] (KPI calculations for report content)

[User Login]
    (no dependencies, standalone)

[Project-Scoped Access]
    requires --> [User Login]
    requires --> [project_members table + RLS]

[Role-Based Permissions]
    requires --> [Project-Scoped Access]

[NLP Chat-to-Grid]
    requires --> [Chat UI] (exists)
    requires --> [Allocation Batch Update API] (exists)
    requires --> [WBS fuzzy matching] (needs improvement)

[AI-Suggested Corrections]
    requires --> [NLP Chat-to-Grid] (runs after parse)
    requires --> [Historical allocation data] (needs sufficient data)

[Voice-to-Text]
    requires --> [NLP Chat-to-Grid] (voice feeds into NLP parser)

[Schedule Alerts]
    requires --> [Baseline Management] (already exists)
    requires --> [Variance Computation] (already exists in compute_engine)

[Predictive Completion]
    requires --> [Schedule Alerts] (shares baseline comparison logic)
    requires --> [Productivity Rate Calculation] (exists in compute_engine)

[What-If Scenarios]
    requires --> [Predictive Completion] (builds on forecast model)

[Weekly AI Report]
    requires --> [Progress Dashboard Data]
    requires --> [PDF Export] (for downloadable report)

[Undo/Revert]
    requires --> [Audit Log] (must be implemented, currently placeholder)
```

### Dependency Notes

- **Excel Import requires Column Mapping**: the mapping logic is shared infrastructure used by both WBS import and allocation import. Build it once, use twice.
- **Auth is a prerequisite for RLS and roles**: without login, project scoping and permissions cannot be enforced. Auth must come before any access control.
- **Schedule Alerts enhance Predictive Completion**: alerts use the same baseline comparison that forecasting needs. Build alert logic first, then extend to full forecasting.
- **What-If conflicts with simplicity**: it requires a resource allocation model that understands crew pool limits. Defer until forecast is solid.
- **Weekly AI Report depends on PDF Export**: the report must be downloadable as PDF. Build PDF infrastructure first.

---

## MVP Definition

### Launch With (v1) -- Fix What is Broken

These features must work before any new features are added. The app has significant existing code that is broken or incomplete.

- [x] **Fix Excel export** (BUG-01) -- currently crashes; users cannot share data
- [x] **Fix Excel import** (BUG-01) -- currently wrong columns; users cannot onboard
- [x] **Fix NLP chat pipeline** (BUG-03, BUG-04) -- parse -> preview -> apply must work end-to-end
- [x] **Fix AI forecast** (BUG-06, BUG-07) -- N+1 queries, hardcoded values
- [x] **Input validation** (BUG-05) -- negative values accepted, no constraints
- [x] **Safe database access** (BUG-02) -- IndexError on empty results throughout

### Add After Fixes (v1.1) -- Core Table Stakes

- [ ] **User authentication** (email/password via Supabase Auth) -- trigger: before any external user access
- [ ] **Project-scoped access** (RLS policies) -- trigger: when second project is added
- [ ] **PDF report export** -- trigger: first weekly report request from client
- [ ] **Progress dashboard** -- trigger: "how is the project doing?" from management
- [ ] **Baseline variance display** (explicit numbers, not just color) -- trigger: first baseline review meeting

### Add After Validation (v1.x) -- Differentiators

- [ ] **Role-based permissions** (Admin/Editor/Viewer) -- trigger: when external stakeholders need access
- [ ] **AI schedule alerts** -- trigger: when project has 2+ weeks of historical data
- [ ] **Smart column mapping for import** -- trigger: when users complain about import template rigidity
- [ ] **Predictive completion dates** -- trigger: when baseline is set and 4+ weeks of data exist
- [ ] **Voice-to-text input** -- trigger: feedback from foremen about mobile data entry
- [ ] **Bulk edit (fill down/right)** -- trigger: user feedback about repetitive data entry
- [ ] **Undo/revert** -- trigger: after audit logging is implemented

### Future Consideration (v2+)

- [ ] **What-if scenario planning** -- defer: needs mature forecast model
- [ ] **Weekly AI report generation** -- defer: needs PDF export + stable forecast
- [ ] **Branded PDF reports** -- defer: nice-to-have after basic PDF works
- [ ] **Primavera P6 / MS Project import** -- defer: proprietary formats, niche demand
- [ ] **Photo attachment to daily entries** -- defer: requires storage infrastructure
- [ ] **AI-suggested corrections** -- defer: needs sufficient historical data patterns

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Fix Excel export | HIGH | LOW | P0 |
| Fix Excel import | HIGH | LOW | P0 |
| Fix NLP chat pipeline | HIGH | MEDIUM | P0 |
| Fix AI forecast | MEDIUM | MEDIUM | P0 |
| Input validation | HIGH | LOW | P0 |
| Safe database access | HIGH | LOW | P0 |
| User authentication | HIGH | LOW | P1 |
| Project-scoped access (RLS) | HIGH | MEDIUM | P1 |
| PDF report export | HIGH | MEDIUM | P1 |
| Progress dashboard | MEDIUM | MEDIUM | P1 |
| Baseline variance display | MEDIUM | LOW | P1 |
| Role-based permissions | MEDIUM | MEDIUM | P2 |
| AI schedule alerts | HIGH | MEDIUM | P2 |
| Smart column mapping | MEDIUM | MEDIUM | P2 |
| Predictive completion dates | HIGH | MEDIUM | P2 |
| Bulk edit (fill down/right) | MEDIUM | LOW | P2 |
| Undo/revert | MEDIUM | MEDIUM | P2 |
| Voice-to-text input | MEDIUM | LOW | P2 |
| What-if scenarios | MEDIUM | HIGH | P3 |
| Weekly AI report | MEDIUM | MEDIUM | P3 |
| Branded PDF reports | LOW | LOW | P3 |
| Primavera/MS Project import | LOW | HIGH | P3 |
| Photo attachments | LOW | LOW | P3 |

**Priority key:**
- P0: Fix immediately -- existing features that are broken
- P1: Must have for first external user deployment
- P2: Should have, add when P1 is stable
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Procore | Primavera P6 | CrewTracks | SmartPM | MetalYapi (Our Approach) |
|---------|---------|-------------|------------|---------|--------------------------|
| **Grid-based allocation** | Task lists, not manpower grids | Resource histograms | Crew time cards | Schedule analysis, no allocation | Purpose-built WBS x Date grid with inline editing -- this IS our core |
| **Excel import/export** | Yes, template-based | Yes, XER + Excel | CSV payroll export | P6/Excel import | Smart column mapping with auto-detect headers (DE/EN/TR) |
| **NLP data entry** | No | No | No | No | YES -- type "5 guys on CW-01 today" and it fills the grid. Unique differentiator. |
| **Baseline comparison** | Yes | Yes (industry standard) | No | Yes (deep analysis) | Color-coded cells + variance numbers + forecast overlay |
| **AI forecasting** | No | No (manual CPM) | No | Analytics (not AI) | Claude-powered predictive completion with natural language explanations |
| **PDF reports** | Yes | Yes | Daily crew reports | Schedule reports | AI-generated narrative + structured data. Auto-generated, not manual. |
| **Auth & RBAC** | Yes (enterprise) | Yes (enterprise) | Yes (admin/crew) | Yes | Supabase Auth + project-scoped RLS + 3 roles (Admin/Editor/Viewer) |
| **Alerts** | Yes (configurable) | Yes (schedule warnings) | Push notifications | Delay analysis | AI-powered deviation alerts with recommendations, not just warnings |
| **Mobile** | Full mobile app | No (desktop only) | Mobile-first | No | Responsive web (not native app). Voice input for mobile foremen. |
| **Offline** | Yes (sync) | No | Yes | No | No (not needed for facade sites with mobile data). Responsive web only. |

**Key competitive insight:** No existing tool combines facade-specific manpower grids with NLP data entry and AI-powered forecasting. Procore and Primavera are too generic and heavyweight. CrewTracks is crew-focused (time/GPS), not manpower-allocation-focused. SmartPM analyzes schedules but does not do daily tracking. Our niche is the daily manpower tracking workflow for specialty contractors.

---

## Sources

- [ProjectManager: 20 Best Construction Scheduling Software for 2026](https://www.projectmanager.com/blog/best-construction-scheduling-software) -- competitor landscape
- [BuildOps: Construction Manpower Scheduling Software](https://buildops.com/resources/construction-manpower-scheduling-software/) -- feature expectations
- [BuildOps: 8 Best Manpower Scheduling Software](https://buildops.com/resources/manpower-scheduling-software-construction/) -- table stakes features
- [CrewTracks Features](https://www.crewtracks.com/features/) -- competitor feature analysis
- [SmartPM: Construction Reporting Best Practices](https://smartpm.com/blog/construction-reporting-best-practices-essential-tools) -- reporting features
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security) -- auth implementation
- [WorkOS: RBAC for Multi-Tenant SaaS](https://workos.com/blog/how-to-design-multi-tenant-rbac-saas) -- auth patterns
- [BuiltWorlds: 40 AI-Driven AEC Solutions 2026](https://builtworlds.com/news/40-ai-driven-aec-solutions-to-know-in-2026/) -- AI in construction landscape
- [Mastt: AI Construction Tools](https://www.mastt.com/software/ai-construction-tools) -- AI features
- [Frontiers: Conversational AI in Construction](https://www.frontiersin.org/journals/built-environment/articles/10.3389/fbuil.2025.1713342/full) -- NLP research
- [ProCrewSchedule: Audit Trail in Construction](https://procrewschedule.com/audit-trail-in-construction-purpose-advantages-and-how-to-improve-it/) -- audit features
- [ProjectManager: Construction Monitoring](https://www.projectmanager.com/blog/construction-monitoring-tracking) -- monitoring best practices
- [Mastt: Project Schedule Control](https://www.mastt.com/blogs/project-schedule-control) -- variance tracking
- [PMI: Practical Calculation of Schedule Variance](https://www.pmi.org/learning/library/practical-calculation-schedule-variance-7028) -- EVM methodology
- Existing codebase: ARCHITECTURE.md, CONVENTIONS.md, INTERFACE_CONTRACTS.md, CLAUDE.md -- current state analysis

---
*Feature research for: MetalYapi Facade Construction Scheduler*
*Researched: 2026-02-21*
