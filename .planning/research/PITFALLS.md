# Pitfalls Research

**Domain:** Construction scheduling / facade manpower tracking -- existing app stabilization, auth retrofit, deployment, AI pipeline wiring
**Researched:** 2026-02-21
**Confidence:** HIGH (based on codebase audit of 15+ source files + official docs + community sources)

---

## Critical Pitfalls

### Pitfall 1: Silent Exception Swallowing Masks Cascading Failures

**What goes wrong:**
The codebase has at minimum 5 locations using bare `except Exception: pass` or `except Exception` without logging (chat.py:47, chat.py:103, schedule_service.py:234, forecast.py:177, db.py:42). When bug fixes touch these areas, the fixed code may throw new, different exceptions that get silently swallowed by adjacent catch blocks. The developer believes the fix works because no error surfaces, but data is silently lost or corrupted.

Concrete example: `chat.py:47` catches the DB storage failure with `pass`. If the bug fix changes the insert payload shape but introduces a new Pydantic validation error, the user sees "success" while no chat message is stored. The apply endpoint later fails with "Message not found" and nobody can trace why.

**Why it happens:**
During a bug-fix sprint, developers focus on the specific bug (e.g., BUG-01 wrong column names) and miss that the surrounding error handling is also broken. The "fix one bug, hide three others" pattern is especially dangerous in Python because bare except catches even `KeyboardInterrupt` and `SystemExit`.

**How to avoid:**
1. Before fixing any bug, audit the entire function's error handling -- not just the buggy line
2. Replace every `except Exception: pass` with specific exception types + `logger.error()` with traceback BEFORE fixing the actual bugs
3. Add a linter rule (ruff: `E722` bare-except, `S110` try-except-pass) to CI so new instances are caught immediately
4. Apply the fix pattern from CLAUDE.md BUG-04 systematically: touch all 5 files in one pass, not scattered across other fixes

**Warning signs:**
- Operations "succeed" but data is missing from the database
- `chat_messages` table has fewer rows than expected
- `ai_forecasts` inserts silently fail but forecast endpoint returns 200
- No error entries in application logs despite user-reported issues

**Phase to address:**
Tier 0 (Bug Fixes) -- this MUST be the very first fix applied before any other BUG-01 through BUG-10 work, because fixing other bugs while silent swallowing remains active will create invisible regressions.

---

### Pitfall 2: Unsafe `.data[0]` Access Causes IndexError Under Real Conditions

**What goes wrong:**
Six locations in the codebase access Supabase response `.data[0]` without checking if data is empty (schedule_service.py:53,80; forecast.py:60; baseline_service.py:54,71; wbs.py:102). During bug fixes and feature additions, new code paths will hit these locations with empty result sets -- especially when auth is added (RLS may filter out rows the old code assumed would exist) or when the database is freshly deployed with no seed data.

The failure mode is an `IndexError` crash that returns a 500 to the frontend with no useful error message.

**Why it happens:**
During local development with MockDB and seed data, `.data[0]` always works because the seed data guarantees results. Once deployed to Supabase with RLS policies, or when a new user creates a new project, these queries return empty results and crash.

**How to avoid:**
1. Create the `safe_first()` and `require_first()` utility functions from CLAUDE.md BUG-02 as the FIRST commit
2. Apply them systematically via search-and-replace across all files -- do not fix them one-by-one as other bugs are addressed
3. Add a grep check in CI: flag any new occurrence of `.data[0]` that does not use `safe_first`/`require_first`
4. When adding RLS policies later, re-test EVERY endpoint with a user who has no project memberships to verify graceful handling

**Warning signs:**
- 500 errors on any endpoint when database tables are empty
- Frontend shows "Internal Server Error" on first use (no projects yet)
- Errors spike immediately after deploying RLS policies
- Tests pass locally (MockDB has seed data) but fail in staging

**Phase to address:**
Tier 0 (Bug Fixes) -- second fix after exception handling, because all subsequent work depends on database access not crashing.

---

### Pitfall 3: RLS Policies Lock Out the Application After Auth Retrofit

**What goes wrong:**
The existing codebase uses `supabase_key` (anon key) for ALL database operations through the Python Supabase client. When RLS policies are added in migration `005_auth_rls.sql`, existing endpoints that do not pass a user JWT will suddenly get zero results or permission errors. The app appears to work during testing (SQL editor bypasses RLS as superuser) but breaks completely for real users.

83% of Supabase security incidents involve RLS misconfigurations. The most common pattern: enable RLS, deploy, and then discover that the backend service key and anon key are confused, locking out all authenticated users while leaving service-key endpoints wide open.

**Why it happens:**
Three-way confusion between Supabase keys:
- `anon` key: respects RLS, used by frontend
- `service_role` key: bypasses RLS entirely, used by trusted backend
- No key: blocked by default

The existing `config.py` has both `supabase_key` and `supabase_service_key` but the code uses `supabase_key` for everything. When RLS goes live, the backend suddenly respects RLS but has no user context (no JWT forwarded), so RLS denies everything.

**How to avoid:**
1. Backend must use `supabase_service_key` for server-side operations, NOT `supabase_key` (anon)
2. OR: Backend must extract the user JWT from the request header and create a per-request Supabase client with that JWT
3. Add RLS policies incrementally: start with permissive policies that log violations, then tighten
4. Test RLS through the Supabase client SDK (not SQL editor, which runs as superuser and bypasses RLS)
5. Index all columns used in RLS policy WHERE clauses (e.g., `user_id`, `project_id`) -- missing indexes cause query timeouts at scale
6. Always include both `USING` (for SELECT/UPDATE/DELETE) AND `WITH CHECK` (for INSERT/UPDATE) in policies -- missing `WITH CHECK` on INSERT lets users create rows with arbitrary `user_id` values

**Warning signs:**
- All endpoints return empty arrays after RLS migration
- API works from SQL editor / Supabase dashboard but not from the app
- Performance degrades after RLS (missing index on policy columns)
- Users can see other users' projects (policy too permissive) or no projects (policy too restrictive)

**Phase to address:**
Tier 2 (Auth + RLS) -- this is the single most dangerous phase. Deploy auth and RLS together, not separately. Test with at least two users who each own different projects.

---

### Pitfall 4: CORS Misconfiguration Between Railway Backend and Vercel Frontend

**What goes wrong:**
The current CORS config is `allow_origins=["http://localhost:5173"]`. When deploying to Railway (backend) and Vercel (frontend), the frontend URL changes to something like `https://metalyapi.vercel.app`. If the CORS origin is not updated, every API call from the deployed frontend fails with a CORS error. The browser shows no useful error message -- it simply blocks the request.

A subtler variant: the developer sets `allow_origins=["*"]` to "fix" CORS quickly, but this disables `allow_credentials=True` (browsers reject `Access-Control-Allow-Origin: *` when credentials are included). Since auth requires cookies/JWTs, auth requests silently fail while non-auth requests work, making the bug intermittent and hard to diagnose.

**Why it happens:**
CORS is a browser-enforced policy, not a server-enforced one. The backend never sees the error -- it happily responds, but the browser blocks the response. This makes debugging from server logs impossible. The error is also invisible in `curl` testing (curl does not enforce CORS).

**How to avoid:**
1. Use environment variables for CORS origins: `CORS_ORIGINS=https://metalyapi.vercel.app` in Railway config
2. Never use `allow_origins=["*"]` with `allow_credentials=True` -- they are mutually exclusive per the CORS spec
3. Support multiple origins via the env var (the existing `cors_origins: list[str]` in config.py already handles this)
4. Set `CORS_ORIGINS` in Railway env vars BEFORE the first deployment, not after
5. Include both the production URL and any preview/staging URLs Vercel generates (Vercel creates unique preview URLs per commit)
6. Test CORS by opening browser dev tools > Network tab and checking the `Access-Control-Allow-Origin` response header

**Warning signs:**
- Frontend deployed to Vercel shows loading spinner forever
- Browser console shows "has been blocked by CORS policy"
- `curl` to the API works fine but browser requests fail
- Auth-related requests fail while other requests succeed (the `*` + credentials conflict)

**Phase to address:**
Tier 5 (Deploy) -- but CORS env vars must be configured as part of deployment, not as a post-deployment fix.

---

### Pitfall 5: Chat-to-Database Pipeline Loses Data at Validation Boundaries

**What goes wrong:**
The chat pipeline has four boundaries where data can silently vanish: (1) NLP parse returns empty actions because Claude's JSON extraction fails, (2) WBS code resolution fails because `wbs_code` from AI does not exactly match database codes, (3) upsert fails silently due to missing conflict constraints, (4) the `apply` endpoint swallows errors with `except Exception: pass` (chat.py:103).

The result: user says "5 people worked on CW-01 today", gets a preview, clicks Confirm, sees "Applied", but zero rows are written to `daily_allocations`. The grid never updates. The user loses trust in the chat feature.

**Why it happens:**
The pipeline has no end-to-end validation. Each step independently "succeeds" (returns 200) without verifying the downstream effect. The NLP parser returns `confidence: 0.95` but the WBS code might be `CW-1` instead of `CW-01`. The apply endpoint catches the resulting mismatch error and swallows it.

**How to avoid:**
1. Add a validation agent between parse and apply that verifies EVERY parsed action:
   - WBS code exists in project (exact match, then fuzzy match with suggestion)
   - Date is within a reasonable range (not 2024 or 2030)
   - Manpower value is sane (0-200 range)
   - Qty done does not exceed remaining qty for that WBS item
2. The apply endpoint must return PER-ACTION results: `{applied: [{wbs_code: "CW-01", success: true}, {wbs_code: "CW-1", success: false, error: "WBS code not found"}]}`
3. Never return `applied: True` unless you verify the database write succeeded (read-after-write confirmation)
4. Remove the bare except in `apply_actions` -- let failures surface as 400/422 errors with specific error codes
5. Add a `UNIQUE(wbs_item_id, date)` constraint on `daily_allocations` if it does not exist -- the upsert `on_conflict="wbs_item_id,date"` requires this constraint to function

**Warning signs:**
- Chat shows "Applied" but grid values do not change
- `daily_allocations` table row count does not increase after chat apply
- AI confidence is high (0.95) but actions array is empty
- WBS codes from Claude use slightly different formatting than database codes

**Phase to address:**
Tier 4 (Chat pipeline) -- but the prerequisite fixes from Tier 0 (BUG-03, BUG-04) must be done first to remove silent exception swallowing.

---

### Pitfall 6: Baseline Race Condition Corrupts Version History

**What goes wrong:**
`baseline_service.py` determines the next version number by reading the current max version, incrementing it, and then inserting. If two baseline creation requests arrive simultaneously (e.g., user double-clicks the "Create Baseline" button, or two users create baselines at the same time), both read version N, both try to insert version N+1, and either one overwrites the other's data or the database throws a constraint error that is caught and silently ignored.

**Why it happens:**
The version numbering is not atomic. There is no `UNIQUE(project_id, version)` constraint, no optimistic locking, and no retry logic. The existing code (line 54) does `existing.data[0]["version"] + 1` which is a classic TOCTOU (time-of-check-time-of-use) race.

**How to avoid:**
1. Add a `UNIQUE(project_id, version)` constraint via migration (as specified in CLAUDE.md BUG-09)
2. Wrap the version-read + insert in a database function or use PostgreSQL `INSERT ... ON CONFLICT DO NOTHING` + retry
3. Add a UI debounce: disable the "Create Baseline" button immediately on click and show a loading state
4. Catch `IntegrityError` (PostgreSQL unique violation) and retry with incremented version
5. Consider using PostgreSQL sequence or `COALESCE(MAX(version), 0) + 1` in a single INSERT...SELECT statement to make it atomic

**Warning signs:**
- Two baselines with the same version number in the `baselines` table
- Baseline snapshots referencing the wrong baseline ID
- "Baseline created" response but the version shown is unexpected
- Audit log showing two near-simultaneous baseline inserts

**Phase to address:**
Tier 0 (Bug Fixes) BUG-09 -- the migration adding the UNIQUE constraint should be created before any baseline feature work in later tiers.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| MockDB fallback in db.py | App runs without Supabase | String comparison for dates/numbers (BUG-08), filters diverge from real PostgreSQL behavior, hides RLS issues | During initial development only -- should be replaced by test fixtures or Docker Supabase for testing |
| Hardcoded Claude model (`claude-sonnet-4-20250514`) | Works immediately | Model becomes unavailable when deprecated, no way to A/B test models, no cost controls | Never -- always use env var `CLAUDE_MODEL` |
| `timedelta(days=90)` forecast fallback | Returns a date instead of "unknown" | Misleads users into thinking there is a real forecast when data is insufficient, creates false risk assessments | Never -- return "insufficient data" explicitly |
| `allow_origins=["*"]` for CORS | Fixes CORS errors quickly | Breaks credential-bearing requests, opens API to any domain | Only during local development with no auth |
| Skipping `WITH CHECK` on INSERT RLS policies | Faster policy writing | Users can create rows with arbitrary `user_id` or `project_id`, data ownership is compromised | Never |
| Frontend `// @ts-ignore` to silence type errors | Unblocks deployment | Hides type mismatches between frontend and API contracts, causes runtime crashes | Only if the type system is genuinely wrong and a `TODO` is added |

## Integration Gotchas

Common mistakes when connecting to external services.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase from FastAPI | Using `supabase_key` (anon) instead of `supabase_service_key` for backend operations | Backend uses service key for admin ops; pass user JWT for user-scoped RLS operations |
| Claude API from FastAPI | Synchronous `anthropic.Anthropic` client used inside `async def` endpoint | Use `anthropic.AsyncAnthropic` client or run sync client in a thread pool via `asyncio.to_thread()` |
| Vercel frontend to Railway backend | Hardcoding `http://localhost:8000` as API base URL | Use `VITE_API_BASE_URL` env var set per environment, ensure HTTPS in production |
| Supabase Realtime subscriptions | Creating subscriptions without cleanup on component unmount | Always return cleanup function from `useEffect` that calls `supabase.removeChannel()` |
| Railway PORT binding | Binding to `127.0.0.1:8000` (localhost only) | Bind to `0.0.0.0:$PORT` -- Railway assigns a dynamic port via the `PORT` env var |
| AG Grid + React Query | Refetching entire matrix on every cell edit via React Query invalidation | Use optimistic updates: mutate local cache immediately, batch server writes with debounce, rollback on failure |
| Claude API rate limiting | No rate limiting on chat endpoint -- every keystroke could trigger an API call | Add server-side rate limiting (30 req/min per project as specified in env vars), frontend debounce on message send |

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| N+1 queries in forecast (BUG in forecast.py:75-87) | Forecast endpoint takes >10s for 50 WBS items | Batch-fetch all allocations in 1 query, group in Python | >20 WBS items (20 individual DB round-trips) |
| Optimizer cartesian product (BUG-07) | 50 behind + 50 ahead = 2500 suggestions, response timeout | Limit to top-10 behind + top-10 ahead, cap at 10 suggestions | >10 items in each category |
| `_compute_progress` fallback loops per WBS item | One DB query per WBS item when `vw_wbs_progress` view unavailable | Ensure view exists in migration; if fallback needed, batch-fetch all allocations once | >30 WBS items on a project |
| Missing index on `daily_allocations(wbs_item_id, date)` | Slow upserts and range queries | Add composite index in migration | >5000 allocation rows |
| RLS policy without index on `project_id` or `user_id` | Every query does sequential scan against policy columns | Index every column referenced in RLS `USING`/`WITH CHECK` clauses | >10000 rows in any RLS-protected table |
| Supabase Realtime broadcasting every cell edit | WebSocket traffic floods on rapid grid editing | Debounce grid changes (300ms), batch broadcast on server, use channel filtering | >3 concurrent users editing same project |

## Security Mistakes

Domain-specific security issues beyond general web security.

| Mistake | Risk | Prevention |
|---------|------|------------|
| Supabase `service_role` key in frontend env vars | Full DB access bypass -- attacker can read/write all data, all users | Only use service key server-side; frontend gets `anon` key only; Vercel env vars should NEVER contain service key |
| Claude API key in frontend code | API cost abuse -- attacker makes unlimited Claude API calls on your account | All Claude API calls go through FastAPI backend; frontend never touches Claude directly |
| No input validation on `AllocationCell` (BUG-05) | User submits `actual_manpower: 999999` or negative values, corrupting aggregations | Add Pydantic field constraints: `ge=0, le=200` for manpower, `ge=0` for qty_done |
| Chat `apply` endpoint does not verify ownership | Any user can apply any chat message's actions to any project | Verify that `project_id` in the URL matches the `project_id` of the retrieved chat message |
| RLS `INSERT` policy without `WITH CHECK` | Authenticated user can insert rows with another user's `user_id`, stealing data ownership | Always include `WITH CHECK (user_id = auth.uid())` on INSERT policies |
| No rate limiting on AI endpoints | Cost runaway -- malicious or buggy client triggers thousands of Claude API calls | Server-side rate limit (30 req/min), per-project token budget tracking |

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Chat shows "Applied" when data was not actually written | User believes data is saved, moves on, data is lost | Show per-action confirmation with checkmarks; show warning for failed actions; disable "Confirm" if validation fails |
| Grid does not refresh after chat apply | User must manually reload page to see chat-entered data | Invalidate React Query cache for `allocations` after successful apply; use Supabase Realtime for cross-tab sync |
| Forecast shows `timedelta(90)` fallback as a real prediction | User plans around a fabricated end date | Show "Insufficient data" with a suggestion to enter more daily records before requesting forecast |
| Login page appears after auth retrofit with no explanation | Existing users who bookmarked the grid URL see a login wall | Show a brief explanation: "Authentication has been added. Sign in with your email to continue." with clear instructions |
| Baseline creation with double-click creates duplicates | Two baselines with same version, confusing comparison | Disable button on click, show loading spinner, debounce API call |
| AI confidence below 0.7 presented without visual warning | User trusts low-confidence parse and applies incorrect data | Color-code confidence: green >0.8, yellow 0.5-0.8, red <0.5; require explicit confirmation for low confidence |

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **Bug fixes (Tier 0):** BUG-01 column names fixed, but the EXPORT still uses wrong column names (`code` instead of `wbs_code`, `planned_qty` instead of `qty`) in `import_export.py` -- there are TWO sets of wrong names: the import side AND the export side
- [ ] **Auth middleware:** JWT validation added to routers, but `/health` endpoint should remain public -- verify the exclude list
- [ ] **RLS policies:** Policies created and enabled, but tested only via SQL editor (superuser bypasses RLS) -- must test through app client with real JWT
- [ ] **CORS in production:** Environment variable set in Railway, but Vercel preview deployments use unique URLs (`*.vercel.app`) that are not in the allow list
- [ ] **Claude API fallback:** AI endpoints return error codes, but frontend does not handle `AI_UNAVAILABLE` gracefully -- verify toast/banner shows, not just console.error
- [ ] **Chat apply pipeline:** Apply returns `{applied: true}` but does not verify rows were actually written to `daily_allocations` -- add read-after-write confirmation
- [ ] **Baseline snapshots:** `daily_plan` JSONB populated from `actual_manpower`, but newly planned (future) allocations use `planned_manpower` -- verify which field the snapshot captures
- [ ] **Optimizer:** Fixed cartesian product limit, but still queries wrong table name `allocations` instead of `daily_allocations` and uses wrong column names (`actual_qty`, `crew_count`, `code`, `name`) -- the optimizer.py has the SAME column name bugs as import_export.py
- [ ] **Frontend env vars after deploy:** `VITE_API_BASE_URL` still points to `localhost:8000` -- must be set to Railway production URL in Vercel env config

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Silent data loss from swallowed exceptions | MEDIUM | Add comprehensive logging retroactively; audit `chat_messages` vs `daily_allocations` for missing applies; replay affected chat messages |
| RLS lockout after policy deployment | LOW | Temporarily revert migration; fix policies using service_role key in Supabase dashboard; redeploy |
| Duplicate baseline versions | MEDIUM | Delete the duplicate via SQL; add UNIQUE constraint; backfill version numbers if needed |
| CORS blocking all requests in production | LOW | Update `CORS_ORIGINS` env var in Railway; redeploy backend (takes ~2 min) |
| Chat pipeline applying wrong WBS data | HIGH | Audit `audit_log` entries for chat-sourced writes; manually revert incorrect `daily_allocations` rows; this is why audit logging (currently placeholder) matters |
| Forecast showing fabricated dates | LOW | Rerun forecast after adding data; explain to users that previous forecasts were based on insufficient data |
| IndexError (`.data[0]`) crash in production | LOW | Deploy the `safe_first()`/`require_first()` fix; no data corruption -- just temporary 500 errors |

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Silent exception swallowing | Tier 0 (Bug Fixes) -- FIRST fix | `grep -r "except.*pass\|except Exception:" backend/` returns zero results |
| Unsafe `.data[0]` access | Tier 0 (Bug Fixes) -- SECOND fix | `grep -r "\.data\[0\]" backend/` returns only `safe_first`/`require_first` wrapped calls |
| Wrong column names in import/export AND optimizer | Tier 0 (Bug Fixes) BUG-01 + separate optimizer fix | All table/column references match migration schema exactly |
| Missing input validation | Tier 0 (Bug Fixes) BUG-05 | Pydantic schema has `ge=0, le=200` constraints; test with negative values returns 422 |
| Baseline race condition | Tier 0 (Bug Fixes) BUG-09 | `UNIQUE(project_id, version)` constraint exists in DB; double-click test produces one baseline |
| N+1 forecast queries | Tier 3 (AI) | Forecast for 50 WBS items completes in <3s; DB query log shows 2-3 queries total |
| RLS lockout | Tier 2 (Auth + RLS) | Two test users with different project memberships see only their own projects |
| CORS misconfiguration | Tier 5 (Deploy) | Browser dev tools shows `Access-Control-Allow-Origin` matches Vercel domain |
| Chat data loss | Tier 4 (Chat) | Apply endpoint returns per-action status; grid auto-refreshes after apply |
| Optimizer wrong table/columns | Tier 0 or Tier 3 (AI) | Optimizer queries `daily_allocations` table with correct column names |

## Sources

- Codebase audit: `backend/routers/chat.py`, `backend/services/schedule_service.py`, `backend/services/baseline_service.py`, `backend/models/db.py`, `backend/services/ai/forecast.py`, `backend/services/ai/optimizer.py`, `backend/services/import_export.py`, `backend/models/schemas.py` -- direct code inspection (HIGH confidence)
- [Supabase Row Level Security docs](https://supabase.com/docs/guides/database/postgres/row-level-security) (HIGH confidence)
- [Supabase RLS Complete Guide 2026](https://vibeappscanner.com/supabase-row-level-security) -- 83% of exposed databases involve RLS misconfigurations (MEDIUM confidence)
- [Supabase Token Security and RLS](https://supabase.com/docs/guides/auth/oauth-server/token-security) (HIGH confidence)
- [Railway FastAPI Deployment Guide](https://docs.railway.com/guides/fastapi) (HIGH confidence)
- [Python Bare Except Antipattern](https://realpython.com/the-most-diabolical-python-antipattern/) (HIGH confidence)
- [Avoiding Silent Failures in Python](https://www.index.dev/blog/avoid-silent-failures-python) (MEDIUM confidence)
- [FastAPI + Supabase Auth Integration](https://grokipedia.com/page/Supabase_Auth_and_FastAPI_Integration) (MEDIUM confidence)
- [Deployment Hell Guide: Vercel + Railway 2025](https://medium.com/codetodeploy/stop-fighting-deployment-hell-your-2025-guide-to-mern-on-vercel-railway-840453de0649) (MEDIUM confidence)
- [Claude Agent SDK Best Practices](https://skywork.ai/blog/claude-agent-sdk-best-practices-ai-agents-2025/) -- validate structured outputs in code (MEDIUM confidence)
- [Supabase + FastAPI Discussion](https://github.com/orgs/supabase/discussions/33811) -- single client instance + admin key antipattern (MEDIUM confidence)
- CLAUDE.md (project internal documentation) -- bug inventory and execution plan (HIGH confidence)

---
*Pitfalls research for: MetalYapi Facade Construction Scheduler -- stabilization, auth, deployment, AI pipeline*
*Researched: 2026-02-21*
