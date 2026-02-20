# Codebase Concerns

**Analysis Date:** 2026-02-20

## Tech Debt

**Bare Exception Handling Throughout Backend:**
- Issue: Multiple services and routers catch generic `Exception` without logging or differentiation, hiding actual error causes
- Files: `backend/routers/chat.py:47-48`, `backend/routers/wbs.py:121-122`, `backend/services/ai/forecast.py:177-178`, `backend/services/schedule_service.py:234`, `backend/models/db.py:42-43`
- Impact: Silent failures in chat storage (`pass # Chat storage failure shouldn't block response`), unclear error messages to clients, difficult debugging in production
- Fix approach: Replace `except Exception` with specific exception types (`ValueError`, `KeyError`, `DatabaseError`). Log before silently failing. Return meaningful error codes to clients.

**Unsafe Array Access on Supabase Responses:**
- Issue: Code accesses `.data[0]` without bounds checking on multiple critical queries
- Files: `backend/services/schedule_service.py:53,80`, `backend/services/ai/forecast.py:60`, `backend/services/baseline_service.py:54,71`, `backend/routers/wbs.py:102`
- Impact: IndexError crashes if queries return empty results, crashes cascade to API endpoints
- Fix approach: Implement helper method `get_first(response)` that safely extracts first result or raises `ValueError("Not found")`. Use pattern: `response.data[0] if response.data else None` consistently across all database access.

**Missing Null/None Checks After Database Lookups:**
- Issue: Parent ID resolution in `backend/routers/wbs.py:102-103` and `backend/services/ai/optimizer.py:16-17` assume data exists without verification
- Files: `backend/routers/wbs.py:95-103`, `backend/services/ai/optimizer.py:62`, `backend/services/baseline_service.py:54`
- Impact: Silent failures when parent codes don't exist, orphaned allocations, computation with missing WBS items
- Fix approach: Add assertions after lookups. Return clearer errors: `if not parent_resp.data: raise ValueError(f"Parent {parent_code} not found in project {project_id}")`

**Implicit Type Coercion in Database Values:**
- Issue: Code uses `float(a.get("actual_manpower", 0))` and `str(r.get(key, ""))` repeatedly, masking type conversion failures
- Files: `backend/services/ai/forecast.py:90-92`, `backend/services/ai/optimizer.py:61-62`, `backend/models/db.py:174,178-180`
- Impact: Silent failures if database returns unexpected types, statistical calculations use wrong values
- Fix approach: Validate types on database load with Pydantic schemas. Use `TypedDict` for raw responses. Test with malformed data.

## Known Bugs

**Chat Message Storage Failure Silently Ignored:**
- Symptoms: If `chat_messages` table insert fails, user doesn't know their message wasn't logged
- Files: `backend/routers/chat.py:40-48`
- Trigger: Insert fails due to constraint violation, network issue, or table missing
- Workaround: Current code swallows error with `except Exception: pass`. User receives normal response but message is lost.
- Fix: Return 207 Multi-Status response or add retry logic with exponential backoff

**MockDB Does Not Implement Full Supabase Query API:**
- Symptoms: MockDB works for happy path but fails on complex filters (`.gte()`, `.lte()` used but not fully implemented), ordering bugs
- Files: `backend/models/db.py:170-181` - MockTable._apply_filters uses string comparison for numeric fields
- Trigger: Sorting dates or numbers in MockDB produces incorrect order; date range queries fail
- Workaround: Tests pass because they use simple `.eq()` filters
- Fix: Implement proper type-aware filtering. Parse dates and numbers correctly. Add test coverage for MockDB with date/numeric filters.

**Export Table References Wrong Column Names:**
- Symptoms: Excel export refers to non-existent columns: `item_type`, `planned_qty`, `actual_qty`, `work_date`, `crew_count` but database has `wbs_name`, `qty`, `qty_done`, `date`, `actual_manpower`
- Files: `backend/services/import_export.py:65,89-97`, references table `allocations` which doesn't exist (it's `daily_allocations`)
- Trigger: Call `export_to_excel()` - will raise KeyError or return empty columns
- Workaround: None - export is broken
- Fix: Update column references to match schema. Test end-to-end.

**Forecast Engine Hardcodes 90-Day Fallback:**
- Symptoms: When productivity data insufficient, predicts exactly 90 days out regardless of project duration
- Files: `backend/services/ai/forecast.py:102-105` hardcodes `timedelta(days=90)`
- Trigger: New WBS item with no allocations
- Impact: All at-risk items default to same end date, masking actual risk
- Fix: Use project.end_date as fallback, not a fixed offset

## Security Considerations

**Claude API Key Stored in Config Without Encryption:**
- Risk: API key read from `.env` and passed to NLPParser, ForecastEngine, ReportGenerator as plaintext in memory
- Files: `backend/config.py:16`, `backend/services/ai/nlp_parser.py:34`, `backend/services/ai/forecast.py:43`, `backend/services/ai/report_gen.py:51`
- Current mitigation: `.env` file in `.gitignore`, not committed to repo
- Recommendations: (1) Use Supabase Vault or AWS Secrets Manager for key storage; (2) Add key rotation logic; (3) Audit Claude API token usage regularly; (4) Implement rate limiting per user

**Supabase Credentials in Frontend Environment Variables:**
- Risk: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY exposed in client bundles, anyone can make requests as anon user
- Files: `frontend/src/lib/supabase.ts:3-4`, `frontend/.env.example`
- Current mitigation: RLS policies on Supabase tables limit anon user access
- Recommendations: (1) Verify RLS policies cover all sensitive tables; (2) Use row-level security strictly; (3) Do not expose service key to frontend; (4) Monitor for unusual API usage patterns

**No Input Validation on Allocation Updates:**
- Risk: Users can submit negative quantities, future dates, or enormous manpower values
- Files: `backend/routers/allocations.py:56-67`, `backend/models/schemas.py:95-100` - AllocationCell has no Field constraints
- Current mitigation: None
- Recommendations: (1) Add `ge=0` (greater than or equal to 0) constraints on `actual_manpower`, `qty_done`; (2) Validate dates are not in far future; (3) Cap manpower at realistic values (e.g., 100/day); (4) Add server-side validation in `ScheduleService.batch_update_allocations()`

**NLP Parser Best-Effort JSON Extraction**
- Risk: If Claude returns unexpected format, parser falls back to substring search and returns confidence 0.0 without warning user
- Files: `backend/services/ai/nlp_parser.py:126-144`
- Current mitigation: Confidence score set to 0.0 signals to UI to not auto-apply
- Recommendations: (1) Add explicit error field to ChatParseResponse; (2) Log when fallback parsing is used; (3) Require human confirmation when confidence < 0.5

## Performance Bottlenecks

**Weekly/Monthly Aggregations Computed on Every Request:**
- Problem: `get_daily_matrix()` fetches all allocations for date range and computes totals in memory on every call
- Files: `backend/services/schedule_service.py:111-200` (partial read showed line 150 incomplete)
- Cause: No materialized views or caching; large date ranges load thousands of rows
- Improvement path: (1) Create Supabase materialized view `vw_weekly_allocations`; (2) Add Redis caching with 1-hour TTL; (3) Index on (project_id, date) for faster scans

**Forecast Engine Loops Over All WBS Items Every Call:**
- Problem: `generate_forecast()` makes individual queries for each WBS item instead of batch query
- Files: `backend/services/ai/forecast.py:75-130`
- Cause: Sequential queries instead of `IN` filter; O(n) API calls
- Improvement path: Batch fetch allocations for all WBS items at once: `.in_("wbs_item_id", [w["id"] for w in wbs_items])`

**Optimizer Nested Loop Creates N*M Suggestions:**
- Problem: Double loop over behind_schedule vs ahead_schedule items creates Cartesian product of suggestions
- Files: `backend/services/ai/optimizer.py:91-112`
- Cause: `for behind in behind_schedule: for ahead in ahead_schedule:` generates suggestion for every pair
- Impact: 50 behind + 50 ahead = 2,500 suggestions returned
- Improvement path: Sort by impact, limit to top 10. Use more selective pairing logic (e.g., same phase/area).

**MockDB Linear Filtering Not Indexed:**
- Problem: MockTable._apply_filters scans all rows sequentially for every filter
- Files: `backend/models/db.py:170-181`
- Cause: In-memory list scan; no indexing
- Impact: Slow with seed data (8 allocations), breaks with realistic data (100k allocations)
- Fix: Acceptable for test/dev. For production, use actual Supabase (which indexes queries).

## Fragile Areas

**Daily Matrix Response Construction (Incomplete Read):**
- Files: `backend/services/schedule_service.py:111-200` (line 150 cuts off mid-function)
- Why fragile: Response structure matches IC-002 interface contract. Schema changes break frontend. Logic to compute `matrix` dict unclear from partial read.
- Safe modification: (1) Add unit tests for DailyMatrixResponse structure; (2) Use strict TypedDict for response shape; (3) Document `matrix` format with examples
- Test coverage: Unknown - need to check test_schedule_service.py

**NLP Parse → Apply Flow with Unconfirmed Actions:**
- Files: `backend/routers/chat.py:22-50` (parse) and `backend/routers/chat.py:53-100` (apply)
- Why fragile: User can parse a message, wait hours, then apply stale actions without re-parsing. No validation that actions match current WBS state.
- Safe modification: (1) Include WBS version/hash in parse response; (2) Re-validate on apply; (3) Add timeout to pending actions
- Test coverage: No unit tests for chat flow found

**Baseline Version Numbering with Race Condition:**
- Files: `backend/services/baseline_service.py:45-54`
- Why fragile: `SELECT version DESC LIMIT 1` → `version + 1` has race condition if two requests create baseline simultaneously
- Safe modification: Use database DEFAULT for auto-increment or SELECT FOR UPDATE + transaction
- Fix: Add UNIQUE constraint on (project_id, version) and let DB handle it

**WBS Parent-Child Relationships Not Validated:**
- Files: `backend/routers/wbs.py:91-103`, `backend/services/schedule_service.py:75-106`
- Why fragile: Code allows parent_id to be set without verifying: (1) parent exists; (2) parent belongs to same project; (3) no circular references
- Safe modification: (1) Add FK constraint on (project_id, parent_id); (2) Add before-insert trigger to validate parent project; (3) Check for cycles
- Test coverage: No tests for invalid parent scenarios

## Scaling Limits

**Supabase Free Tier Row Limits:**
- Current capacity: Supabase free tier limits to ~1M row operations/month
- Limit: 10+ users x 1,000 allocations/month = potential 10k rows/month (fine) but high concurrent access will hit rate limits
- Scaling path: (1) Upgrade to Supabase Pro ($25/month); (2) Implement client-side caching to reduce API calls; (3) Batch updates (currently batch_update_allocations supports this)

**In-Memory Seed Data Lost on Restart:**
- Current capacity: MockDB holds ~20 WBS items + 8 allocations
- Limit: Any real project data lost when backend restarts (no persistence)
- Scaling path: Remove MockDB from production. Require Supabase connection string.

**Frontend Grid (AG Grid) Performance with Large Allocations Matrix:**
- Current capacity: Daily matrix likely renders 1000+ cells (365 days x 10 WBS items)
- Limit: AG Grid will struggle with 10k+ cells without virtualization
- Scaling path: (1) Enable AG Grid virtual scrolling; (2) Paginate by date (week view instead of full month); (3) Lazy load columns

## Dependencies at Risk

**Python Pydantic V2 Migration Incomplete:**
- Risk: Code mixes Pydantic v1 and v2 patterns (`model_dump()`, `ConfigDict`)
- Files: `backend/models/schemas.py` uses both ConfigDict (v2) and mode="json" (v2 pattern)
- Impact: Potential breaking changes if dependency updates break compatibility
- Migration plan: Audit all schemas. Ensure consistent V2 usage. Test with pydantic==2.x

**Anthropic SDK Version Pinned:**
- Risk: Hardcoded model `"claude-sonnet-4-20250514"` in multiple files
- Files: `backend/services/ai/nlp_parser.py:65`, `backend/services/ai/report_gen.py:152`
- Impact: If Anthropic deprecates this model, services break
- Migration plan: Use `CLAUDE_MODEL` env var, default to latest stable model. Test model availability at startup.

**AG Grid Community (Free) License Dependency:**
- Risk: Using free AG Grid Community edition; enterprise features (multi-row selection, cell range selection) not available
- Files: `frontend/package.json:16`
- Impact: If project later needs Enterprise features, major refactor needed
- Migration plan: Use AG Grid's row selection APIs carefully. Document feature boundaries. Keep upgrade path clear.

**Openpyxl for Excel I/O (Fragile Format Handling):**
- Risk: openpyxl doesn't validate Excel structure; malformed files can crash with unhelpful errors
- Files: `backend/services/import_export.py`, `backend/routers/wbs.py:75-83`
- Impact: User uploads corrupted Excel → 500 error instead of helpful message
- Improvement: (1) Wrap openpyxl calls in try/except with clear error messages; (2) Validate sheet names exist before accessing; (3) Test with corrupted files

## Missing Critical Features

**No User Authentication or Authorization:**
- Problem: Anyone with API URL can access/modify all projects
- Blocks: Multi-tenant setup, audit trails, role-based access control
- Fix approach: (1) Add Supabase Auth; (2) Create users table; (3) Add JWT validation middleware; (4) Implement RLS policies

**No Audit Logging for Data Changes:**
- Problem: Can't track who changed allocations or when
- Files: `backend/middleware/audit.py` exists but not implemented
- Blocks: Compliance, debugging, change rollback
- Fix: Implement audit trigger on daily_allocations, store to audit_log table with user_id, timestamp, old_value, new_value

**No Data Validation on Import:**
- Problem: Excel import accepts any value without schema validation
- Files: `backend/routers/wbs.py:84-123`
- Blocks: Data quality guarantees
- Fix: Use Pydantic to validate each row. Return structured import report with row-level errors.

**No Notification System:**
- Problem: When WBS falls behind schedule, no alert sent
- Blocks: Real-time risk monitoring, stakeholder notifications
- Fix: Implement Webhook system to notify on schedule variance, or add email integration

**No Offline Mode:**
- Problem: Frontend requires continuous backend connection; users in field with poor connectivity blocked
- Blocks: Mobile deployment, field use
- Fix: Add service worker, offline queue for allocation updates, sync when connection restored

## Test Coverage Gaps

**No Tests for Schedule Service Database Operations:**
- What's not tested: `get_daily_matrix()`, `batch_update_allocations()`, `list_wbs_items()` — core data flows
- Files: `backend/services/schedule_service.py` (no test file found; only `test_compute_engine.py` exists for math functions)
- Risk: Schema mismatches, null handling bugs not caught until production
- Priority: High - these are critical paths

**No Tests for NLP Parser Error Cases:**
- What's not tested: Claude API failure scenarios, JSON parsing fallback, empty WBS list handling
- Files: `backend/services/ai/nlp_parser.py` (no test file found)
- Risk: Edge cases crash silently or return bad data
- Priority: High - AI integration is critical

**No Tests for Baseline Service Concurrency:**
- What's not tested: Race conditions in version numbering, parallel baseline creates
- Files: `backend/services/baseline_service.py` (no test file found)
- Risk: Data corruption if two users create baseline simultaneously
- Priority: Medium - rare but severe

**No Tests for Chat Message Flow:**
- What's not tested: Parse → apply → confirmation flow, message persistence
- Files: `backend/routers/chat.py` (no test file found)
- Risk: Messages lost, stale actions applied silently
- Priority: Medium - user-facing feature

**No Frontend Component Tests:**
- What's not tested: AG Grid renders correctly, date selection works, allocation updates sync
- Files: `frontend/src/components/` (no .test.tsx files found)
- Risk: UI bugs not caught until user reports them
- Priority: Medium - but test setup exists (vitest, @testing-library/react in package.json)

**Frontend Hook Tests Minimal:**
- What's not tested: useChat pending state, useAllocations error handling, useAI loading states
- Files: `frontend/src/hooks/` (no test files found)
- Risk: State management bugs under async/error conditions
- Priority: Medium

---

*Concerns audit: 2026-02-20*
