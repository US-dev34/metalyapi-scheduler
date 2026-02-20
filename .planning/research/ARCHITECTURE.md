# Architecture Research: Auth, Alerts, Chat Validation & Deployment Integration

**Domain:** Construction scheduling / facade manpower tracking (MetalYapi)
**Researched:** 2026-02-21
**Confidence:** HIGH (existing codebase examined + official docs verified)

## Current Architecture Baseline

The existing three-tier system is well-structured:

```
Frontend (React 18 + TS)     Backend (FastAPI)          Database (Supabase PG)
 Zustand + React Query        7 routers                  RLS enabled
 Supabase client (anon key)   Service facade             Views + triggers
 No auth guard                No auth middleware          Policies require 'authenticated'
 No realtime subscriptions    No WebSocket endpoints      Realtime publication not configured
 Chat UI exists               NLP parser works            chat_messages table exists
 AI panel stub                Forecast engine works       ai_forecasts table exists
```

Key gap: The database already requires `authenticated` role via RLS policies, but neither the frontend nor backend actually enforce authentication. This means the system currently only works in mock/dev mode or with service_key bypassing RLS.

---

## Standard Architecture (Target State)

```
                      +---------------------------+
                      |       Browser (User)       |
                      +------+------+------+------+
                             |      |      |
                  +----------+  +---+---+  +---------+
                  |             |       |             |
           Supabase Auth   REST API   Supabase      WebSocket
           (login/signup)  (CRUD)     Realtime      (future)
                  |             |       |             |
                  v             v       v             v
         +--------+----+ +-----+-------+-----+ +-----+-----+
         | Auth State   | | FastAPI Backend   | | Supabase  |
         | (Frontend)   | |                   | | Realtime  |
         | onAuthState  | | Auth Middleware    | | Server    |
         | Change       | | (JWT verify)      | |           |
         | Session Mgmt | |                   | |           |
         +--------------+ | +---------------+ | +-----------+
                           | | Auth Dep      | |
                           | | get_current_  | |
                           | | user()        | |
                           | +-------+-------+ |
                           |         |         |
                           | +-------v-------+ |
                           | | Service Layer | |
                           | | Schedule Svc  | |
                           | | Baseline Svc  | |
                           | | AI Services   | |
                           | | Alert Service | | <-- NEW
                           | | Chat Validate | | <-- ENHANCED
                           | +-------+-------+ |
                           |         |         |
                           +----+----+---------+
                                |
                           +----v----+
                           | Supabase|
                           | PG + RLS|
                           +---------+
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **Auth Provider (FE)** | Session lifecycle, token refresh, login/logout UI, route guards | Supabase Auth API, Backend (sends JWT) |
| **Auth Middleware (BE)** | JWT verification, user extraction, request decoration | Every incoming request, Supabase JWKS endpoint |
| **Auth Dependency (BE)** | FastAPI `Depends()` for route-level auth enforcement | Router handlers, Auth Middleware |
| **Alert Service (BE)** | Threshold monitoring, deviation detection, alert generation | Compute engine, Database, Frontend (via query/realtime) |
| **Chat Validation Pipeline (BE)** | Message parse, Pydantic validation, confidence gating, retry logic | NLP Parser (Claude API), Schedule Service, Database |
| **Realtime Subscriptions (FE)** | Live grid updates when other users edit, alert notifications | Supabase Realtime, React Query cache |
| **Deployment Config** | Dockerfiles, CI/CD, env management, health checks | Railway/Render (BE), Vercel (FE), Supabase (DB) |

---

## Recommended Project Structure (New/Modified Files)

```
backend/
  middleware/
    audit.py                   # EXISTS - audit logging
    auth.py                    # NEW - JWT verification middleware
  dependencies/
    __init__.py                # NEW
    auth.py                    # NEW - get_current_user() Depends
  services/
    alert_service.py           # NEW - threshold alerts + deviation detection
    chat_validation.py         # NEW - validation pipeline wrapping NLP parser
    ai/
      nlp_parser.py            # EXISTS - needs retry + structured output
      forecast.py              # EXISTS - has N+1 bug, needs fix
      optimizer.py             # EXISTS
      report_gen.py            # EXISTS

frontend/
  src/
    lib/
      supabase.ts              # EXISTS - needs auth config review
      api.ts                   # EXISTS - needs Authorization header injection
    providers/
      AuthProvider.tsx          # NEW - React context for auth state
    hooks/
      useAuth.ts               # NEW - auth state, login, logout, session
      useRealtimeAlerts.ts     # NEW - subscribe to alert changes
      useRealtimeAllocations.ts # NEW - subscribe to allocation changes
    components/
      auth/
        LoginPage.tsx          # NEW
        ProtectedRoute.tsx     # NEW
      ai/
        AlertList.tsx          # EXISTS - needs realtime data source

supabase/
  migrations/
    004_alert_tables.sql       # NEW - alerts table + notification preferences
    005_realtime_publication.sql # NEW - enable realtime for key tables

.github/
  workflows/
    ci.yml                     # EXISTS - needs deploy steps
    deploy.yml                 # NEW - production deploy workflow

docker-compose.yml             # NEW (or update existing)
Dockerfile (backend)           # EXISTS - needs review
```

### Structure Rationale

- **`backend/dependencies/auth.py`** separated from `middleware/auth.py` because middleware processes every request (extracts token if present), while the dependency is opt-in per route (raises 401 if no valid token). This lets health check and public endpoints remain unauthenticated.
- **`frontend/providers/AuthProvider.tsx`** is a React context provider because auth state must be accessible throughout the component tree (route guards, API header injection, user display), not just in individual components.
- **`services/chat_validation.py`** wraps the existing `nlp_parser.py` rather than modifying it, adding Pydantic validation, confidence thresholds, and retry logic as a pipeline layer.
- **Alert tables** get their own migration (004) because they introduce new schema not covered by existing migrations.

---

## Architectural Patterns

### Pattern 1: JWT Auth Dependency Chain

**What:** Two-layer auth: middleware extracts token optionally, dependency enforces auth requirement per-route.

**When to use:** Every protected API endpoint.

**Trade-offs:** Slightly more complexity than middleware-only, but allows mixing public and protected routes cleanly.

**Example:**

```python
# backend/middleware/auth.py
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import jwt

class AuthMiddleware(BaseHTTPMiddleware):
    """Extract and verify JWT from Authorization header. Non-blocking."""

    async def dispatch(self, request: Request, call_next):
        token = self._extract_token(request)
        if token:
            try:
                # Verify with Supabase JWT secret (HS256)
                payload = jwt.decode(
                    token,
                    settings.supabase_jwt_secret,
                    algorithms=["HS256"],
                    audience="authenticated",
                )
                request.state.user = payload
                request.state.user_id = payload.get("sub")
            except jwt.InvalidTokenError:
                request.state.user = None
                request.state.user_id = None
        else:
            request.state.user = None
            request.state.user_id = None
        return await call_next(request)

    @staticmethod
    def _extract_token(request: Request) -> str | None:
        auth = request.headers.get("authorization", "")
        if auth.startswith("Bearer "):
            return auth[7:]
        return None
```

```python
# backend/dependencies/auth.py
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer(auto_error=False)

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> dict:
    """FastAPI dependency — raises 401 if no valid user."""
    user = getattr(request.state, "user", None)
    if user is None:
        raise HTTPException(status_code=401, detail={
            "error": "Authentication required",
            "code": "AUTH_UNAUTHORIZED",
        })
    return user

async def get_current_user_id(user: dict = Depends(get_current_user)) -> str:
    """Convenience: extract just the user UUID."""
    return user["sub"]
```

```python
# Usage in routers (e.g., backend/routers/allocations.py)
from backend.dependencies.auth import get_current_user

@router.put("/{project_id}/daily")
async def batch_update(
    project_id: UUID,
    payload: AllocationBatchUpdate,
    user: dict = Depends(get_current_user),  # Enforces auth
):
    ...
```

### Pattern 2: Alert Service (Event-Driven Threshold Detection)

**What:** After allocation updates, check thresholds and generate alerts. Store alerts in DB, deliver via query polling or Supabase Realtime.

**When to use:** Post-write hook in allocation and baseline services.

**Trade-offs:** Synchronous check adds ~50ms to write operations. Could be made async with background tasks, but for 5-10 users the synchronous approach is simpler and more reliable.

**Example:**

```python
# backend/services/alert_service.py
from datetime import date
from backend.models.db import get_db
from backend.services.compute_engine import calculate_variance, schedule_performance_index

class AlertService:
    """Detects threshold violations and generates alerts."""

    # Configurable thresholds
    MANPOWER_DEVIATION_PCT = 20.0  # Alert if actual differs from planned by >20%
    PROGRESS_LAG_PCT = 15.0       # Alert if behind schedule by >15%
    SPI_WARNING = 0.85            # Schedule Performance Index below this

    def check_after_update(self, project_id: str, wbs_item_ids: list[str]) -> list[dict]:
        """Run threshold checks after allocation updates. Returns new alerts."""
        alerts = []
        alerts.extend(self._check_manpower_deviation(project_id, wbs_item_ids))
        alerts.extend(self._check_progress_lag(project_id, wbs_item_ids))
        self._persist_alerts(alerts)
        return alerts

    def _check_manpower_deviation(self, project_id, wbs_ids):
        # Compare today's actual vs baseline planned for each WBS
        ...

    def _check_progress_lag(self, project_id, wbs_ids):
        # Compare actual progress % vs expected progress % (time-based)
        ...

    def _persist_alerts(self, alerts):
        db = get_db()
        for alert in alerts:
            db.table("alerts").upsert(
                alert, on_conflict="project_id,wbs_item_id,alert_type,date"
            ).execute()
```

### Pattern 3: Chat Validation Pipeline

**What:** Multi-stage pipeline: raw message -> NLP parse -> Pydantic validation -> confidence gate -> WBS code resolution -> preview response.

**When to use:** Every chat message submission.

**Trade-offs:** Adds validation overhead but catches hallucinated WBS codes, invalid dates, and impossible manpower values before they reach the database.

**Example:**

```python
# backend/services/chat_validation.py
from pydantic import BaseModel, field_validator
from datetime import date

class ValidatedAction(BaseModel):
    """Validated parse action — catches LLM hallucinations."""
    wbs_code: str
    date: date
    actual_manpower: float
    qty_done: float
    note: str | None = None

    @field_validator("actual_manpower")
    @classmethod
    def manpower_must_be_reasonable(cls, v):
        if v < 0 or v > 100:
            raise ValueError(f"Manpower {v} outside valid range 0-100")
        return v

    @field_validator("qty_done")
    @classmethod
    def qty_must_be_non_negative(cls, v):
        if v < 0:
            raise ValueError(f"qty_done cannot be negative: {v}")
        return v


class ChatValidationPipeline:
    """Wraps NLP parser with validation and confidence gating."""

    CONFIDENCE_THRESHOLD = 0.7
    MAX_RETRIES = 1

    def __init__(self, nlp_parser, schedule_service):
        self.nlp = nlp_parser
        self.schedule = schedule_service

    async def process_message(self, message: str, project_id: str) -> dict:
        wbs_items = self.schedule.list_wbs_items(project_id)
        wbs_codes = {w["wbs_code"] for w in wbs_items}

        result = await self.nlp.parse_message(message, wbs_items)

        # Stage 1: Confidence gate
        if result["confidence"] < self.CONFIDENCE_THRESHOLD:
            result["warning"] = "Low confidence parse - review carefully"

        # Stage 2: Validate each action with Pydantic
        validated = []
        rejected = []
        for action in result.get("actions", []):
            try:
                v = ValidatedAction(**action)
                # Stage 3: WBS code resolution
                if v.wbs_code not in wbs_codes:
                    rejected.append({**action, "reason": f"Unknown WBS code: {v.wbs_code}"})
                else:
                    validated.append(v.model_dump(mode="json"))
            except Exception as e:
                rejected.append({**action, "reason": str(e)})

        result["actions"] = validated
        result["rejected_actions"] = rejected
        return result
```

### Pattern 4: Frontend Auth Context + Protected Routes

**What:** React context provider managing Supabase session, injecting JWT into all API calls, protecting routes.

**When to use:** Application shell wrapping all components.

**Trade-offs:** Simple context-based approach works for 5-10 users. No need for complex auth libraries.

**Example:**

```typescript
// frontend/src/providers/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // ... signIn, signOut methods

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be within AuthProvider');
  return ctx;
};
```

```typescript
// frontend/src/lib/api.ts — inject Authorization header
import { supabase } from './supabase';

async function apiFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (session?.access_token) {
    headers['Authorization'] = `Bearer ${session.access_token}`;
  }
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) throw new ApiError(response);
  return response.json();
}
```

---

## Data Flow

### Authentication Flow

```
User clicks Login
    |
    v
Supabase Auth API (email/password)
    |
    v
JWT issued (access_token + refresh_token)
    |
    v
Frontend stores session (localStorage via supabase-js)
    |
    v
Every API call: Authorization: Bearer <access_token>
    |
    v
FastAPI AuthMiddleware: jwt.decode() -> request.state.user
    |
    v
Route dependency: get_current_user() -> user dict or 401
    |
    v
Service uses user_id for audit trail
    |
    v
Supabase client uses service_key (backend is trusted)
    |
    |--- RLS still applies when frontend queries Supabase directly
    v    (anon key + JWT = authenticated role)
```

### Chat Message Validation Flow

```
User types: "Bugun CW-01'de 5 adam, 3 unite bitti"
    |
    v
POST /api/v1/chat/{project_id}/message
    |
    v
AuthMiddleware -> get_current_user() -> user verified
    |
    v
ChatValidationPipeline.process_message()
    |
    +---> NLP Parser (Claude Sonnet API)
    |         |
    |         v
    |     Raw JSON: {actions: [...], confidence: 0.95}
    |
    +---> Pydantic ValidatedAction (per action)
    |         |
    |         v
    |     Type check, range validation, date validation
    |
    +---> WBS Code Resolution
    |         |
    |         v
    |     Verify each wbs_code exists in project
    |
    +---> Confidence Gate (threshold: 0.7)
    |
    v
ChatParseResponse with validated actions + rejected actions
    |
    v
Frontend shows ParsedPreview
    |
    v
User clicks Confirm
    |
    v
POST /api/v1/chat/{project_id}/apply
    |
    v
Schedule Service: batch upsert daily_allocations
    |
    v
Alert Service: check_after_update() -> generate alerts if thresholds breached
    |
    v
React Query: invalidate allocations -> grid re-renders
    +
    v
Supabase Realtime: other clients receive update
```

### Alert Generation Flow

```
Allocation Update (grid edit or chat apply)
    |
    v
AlertService.check_after_update(project_id, wbs_item_ids)
    |
    +---> Manpower deviation check
    |         actual vs baseline planned
    |         threshold: +/- 20%
    |
    +---> Progress lag check
    |         actual progress vs time-based expected progress
    |         threshold: 15% behind
    |
    +---> SPI check (Schedule Performance Index)
    |         threshold: < 0.85
    |
    v
Insert/upsert alerts table
    |
    v
Frontend: React Query polls /api/v1/alerts/{project_id}
    or
Frontend: Supabase Realtime subscription on alerts table
    |
    v
AlertList component re-renders
```

### Realtime Data Sync Flow

```
User A edits cell in Daily Grid
    |
    v
PUT /api/v1/allocations/{project_id}/daily
    |
    v
Backend writes to daily_allocations table
    |
    v
Supabase Realtime detects INSERT/UPDATE
    |
    v
Broadcasts to subscribed channels
    |
    v
User B's frontend receives change event
    |
    v
React Query cache invalidated -> grid refetch
    (or optimistic update from realtime payload)
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| **Supabase Auth** | Frontend: supabase-js `signIn/signUp/signOut`. Backend: JWT decode via PyJWT with Supabase JWT secret | JWT secret available in Supabase dashboard. Use HS256 algorithm. Set `audience="authenticated"` |
| **Supabase Realtime** | Frontend: `supabase.channel().on('postgres_changes', ...).subscribe()` | Must enable realtime publication on tables: `daily_allocations`, `alerts`. Add table to `supabase_realtime` publication |
| **Claude API** | Backend: `anthropic` Python SDK, Sonnet for parse/forecast, Haiku for alert descriptions | Existing integration works. Add retry logic + Pydantic structured output validation |
| **Railway** | Docker deployment for FastAPI backend. Health check: `/health`. Env vars via Railway dashboard | Use `uvicorn` (not hypercorn) to match existing setup. Configure `PORT` env var |
| **Vercel** | Frontend SPA deployment. `vercel.json` with rewrites for SPA routing | Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_API_BASE_URL` env vars |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| **Frontend <-> Auth** | Supabase-js manages session, JWT passed in `Authorization` header to backend | Frontend never calls backend for login/signup -- goes directly to Supabase Auth |
| **Auth Middleware <-> Routes** | `request.state.user` set by middleware, read by `get_current_user()` dependency | Middleware is non-blocking (doesn't reject). Dependency rejects with 401 |
| **Chat Router <-> Chat Validation** | Router calls `ChatValidationPipeline.process_message()` instead of raw `NLPParser.parse_message()` | Validation pipeline wraps the parser, does not replace it |
| **Service Layer <-> Alert Service** | After write operations, service calls `AlertService.check_after_update()` | Alert generation is synchronous and part of the write path |
| **Frontend <-> Realtime** | Supabase-js Realtime channel subscriptions in custom hooks | Subscriptions scoped to authenticated user's session token for RLS |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 1-10 users (current) | Monolith FastAPI, polling for alerts, no realtime needed, single Railway instance |
| 10-50 users | Enable Supabase Realtime for live grid sync, add alerts table, consider background task for AI calls |
| 50-200 users | Move AI calls to background workers (FastAPI `BackgroundTasks` or Celery), add Redis for rate limiting, consider read replicas |
| 200+ users | This project is unlikely to reach this scale (niche construction domain). If needed: microservice AI, WebSocket server, CDN for frontend |

### Scaling Priorities

1. **First bottleneck: AI API calls** -- Claude API has rate limits (30/min configured). Multiple concurrent users triggering forecasts or chat parses will queue. Fix: background task queue with status polling.
2. **Second bottleneck: N+1 queries in forecast engine** -- Currently fetches allocations per-WBS-item in a loop. Fix: single bulk query with GROUP BY (already identified in project context).

---

## Anti-Patterns

### Anti-Pattern 1: Creating New Supabase Client Per Request for RLS

**What people do:** Instantiate a new `create_client(url, anon_key, headers={"Authorization": f"Bearer {user_jwt}"})` for every request so RLS applies per-user.

**Why it's wrong:** Connection overhead, no connection pooling, 50-100ms added per request. The MetalYapi system has only `authenticated` role policies (no per-user row ownership), so user-scoped RLS is unnecessary.

**Do this instead:** Use service_key on the backend (already the case). The backend is a trusted intermediary. RLS only matters for direct frontend-to-Supabase queries, which the frontend's anon_key + session JWT handle automatically.

### Anti-Pattern 2: Verifying JWT by Calling Supabase Auth API

**What people do:** Call `supabase.auth.get_user(jwt)` on every request, which makes an HTTP call to Supabase Auth server.

**Why it's wrong:** Adds 100-300ms latency per request, creates dependency on Supabase Auth server availability, and is unnecessary when you have the JWT secret.

**Do this instead:** Verify JWT locally using `PyJWT` with the JWT secret from Supabase dashboard. The secret is available at `Settings > API > JWT Secret`. Local verification is instant (<1ms). Only call `get_user()` when you need fresh user metadata, not for every request.

### Anti-Pattern 3: Putting All Auth Logic in Middleware

**What people do:** Reject unauthenticated requests in middleware, making every endpoint require auth.

**Why it's wrong:** Breaks health checks, public endpoints, and makes testing harder.

**Do this instead:** Middleware extracts token silently. Individual routes opt-in to auth via `Depends(get_current_user)`. Health check and public routes skip auth naturally.

### Anti-Pattern 4: Unvalidated LLM Output Directly to Database

**What people do:** Take Claude's JSON output and write it directly to the database without validation.

**Why it's wrong:** LLMs hallucinate -- they may generate non-existent WBS codes, impossible dates, or negative manpower values. Current codebase partially has this problem (chat.py applies actions without validating WBS codes exist beyond a basic check).

**Do this instead:** Full validation pipeline: Pydantic model validation -> WBS code existence check -> date range check -> confidence threshold. Reject or flag invalid actions before they reach the database.

---

## Build Order (Dependencies)

The four missing components have clear dependency ordering:

```
                     1. Auth Middleware + Dependency
                              |
                     (everything below needs auth)
                              |
              +---------------+---------------+
              |                               |
    2. Alert Service              3. Chat Validation Pipeline
    (needs: compute engine,       (needs: NLP parser already exists,
     alert DB tables,              Pydantic schemas, WBS resolution)
     threshold config)
              |                               |
              +---------------+---------------+
                              |
                     4. Deployment Config
                     (needs: all above working,
                      env vars finalized,
                      Docker + CI/CD)
```

**Phase ordering rationale:**
1. **Auth first** -- Every subsequent feature needs to know who the user is. RLS policies already expect `authenticated` role. Without auth, nothing works in production.
2. **Alerts and Chat Validation in parallel** -- These are independent services. Alerts need the compute engine (exists). Chat validation needs the NLP parser (exists). Neither depends on the other.
3. **Deployment last** -- Needs finalized environment variables, working health checks, and all services integrated before configuring production deployment.

**Migration dependency:**
- Migration 004 (alerts table) must run before Alert Service can work
- Migration 005 (realtime publication) can be applied independently
- Auth needs `SUPABASE_JWT_SECRET` added to `.env` and `Settings` class

---

## Environment Variable Additions

```bash
# NEW - Add to backend .env
SUPABASE_JWT_SECRET=your-jwt-secret-from-dashboard

# NEW - Alert thresholds (optional, with defaults)
ALERT_MANPOWER_DEVIATION_PCT=20.0
ALERT_PROGRESS_LAG_PCT=15.0
ALERT_SPI_WARNING=0.85

# NEW - Chat validation
CHAT_CONFIDENCE_THRESHOLD=0.7
CHAT_MAX_RETRIES=1

# DEPLOYMENT - Railway
PORT=8000
RAILWAY_ENVIRONMENT=production
```

---

## Sources

- [Supabase Auth React Quickstart](https://supabase.com/docs/guides/auth/quickstarts/react) -- HIGH confidence, official docs
- [Supabase JWT Documentation](https://supabase.com/docs/guides/auth/jwts) -- HIGH confidence, official docs
- [Supabase Realtime Postgres Changes](https://supabase.com/docs/guides/realtime/postgres-changes) -- HIGH confidence, official docs
- [Supabase Python auth.get_user() Reference](https://supabase.com/docs/reference/python/auth-getuser) -- HIGH confidence, official docs
- [FastAPI Security - Get Current User](https://fastapi.tiangolo.com/tutorial/security/get-current-user/) -- HIGH confidence, official docs
- [Railway FastAPI Deployment Guide](https://docs.railway.com/guides/fastapi) -- HIGH confidence, official docs
- [Supabase Auth Sessions](https://supabase.com/docs/guides/auth/sessions) -- HIGH confidence, official docs
- [Pydantic LLM Validation](https://pydantic.dev/articles/llm-validation) -- MEDIUM confidence, vendor blog
- [FastAPI Supabase Auth Discussion](https://github.com/orgs/supabase/discussions/33811) -- MEDIUM confidence, community discussion
- [FastAPI WebSockets](https://fastapi.tiangolo.com/advanced/websockets/) -- HIGH confidence, official docs
- [Vercel Supabase Integration](https://supabase.com/partners/integrations/vercel) -- HIGH confidence, official partnership page

---
*Architecture research for: MetalYapi Facade Construction Scheduler -- Auth, Alerts, Chat Validation, Deployment*
*Researched: 2026-02-21*
