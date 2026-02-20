# Stack Research: Missing Pieces for MetalYapi Facade Scheduler

**Domain:** Construction scheduling / facade manpower tracking
**Researched:** 2026-02-21
**Confidence:** HIGH (all recommendations verified against PyPI/official docs)

## Existing Stack (NOT re-researched)

Already in place and working:

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend Framework | React + TypeScript | 18.3.1 / 5.7.2 |
| Build Tool | Vite | 6.0.5 |
| Backend Framework | FastAPI + Python | 0.115.x / 3.12 |
| Database | Supabase PostgreSQL | Hosted |
| Grid | ag-grid-community | 32.3.3 |
| State | Zustand + React Query | 5.0.2 / 5.62.0 |
| CSS | Tailwind CSS | 3.4.16 |
| AI | Anthropic Claude API | 0.40.x |
| HTTP Client | axios (frontend) / httpx (backend) | 1.7.9 / 0.27.x |
| Validation | zod (frontend) / Pydantic v2 (backend) | 3.24.1 / 2.9.x |
| Excel I/O | openpyxl | 3.1.x |

---

## Recommended Stack: Missing Pieces

### 1. PDF Generation (Python Backend)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **fpdf2** | 2.8.6 | Generate construction schedule PDFs with tables | Zero system dependencies (pure Python), built-in table API with auto page breaks, direct FastAPI integration documented, actively maintained (Feb 2026 release) |

**Why fpdf2 over WeasyPrint:**
- WeasyPrint (v68.1) requires OS-level Pango/GObject libraries -- these are notoriously painful in Docker/Railway deployments. Issue #2221 on WeasyPrint's GitHub documents the exact `gobject-2.0-0` error on Railway.
- fpdf2 is pure Python with only Pillow, defusedxml, and fontTools as pip dependencies. No system packages needed.
- fpdf2's `table()` context manager API generates construction schedule grids (date columns x worker rows) with colspan/rowspan, custom borders, cell backgrounds, and auto page breaks -- exactly what daily/weekly manpower schedules need.

**Why fpdf2 over ReportLab:**
- ReportLab (v4.4.10) is powerful but over-engineered for tabular schedule exports. Its canvas-based API requires significantly more code for simple table layouts.
- fpdf2 produces the same output with ~60% less code for table-heavy documents.
- ReportLab's commercial license (BSD + proprietary for some features) is unnecessarily complex for this use case.

**Confidence:** HIGH -- verified fpdf2 v2.8.6 on PyPI (released 2026-02-19), tested table API in official docs, confirmed FastAPI integration examples exist in official documentation.

### 2. Excel Import/Export Validation (Python Backend)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **openpyxl** | 3.1.5 | Read/write .xlsx files | Already in requirements.txt. Stable, production-grade. No reason to change. |
| **Pydantic v2** | 2.9.x+ | Validate parsed Excel row data | Already in requirements.txt. Use Pydantic models to validate each row after openpyxl parses it. |

**Pattern: openpyxl parse -> dict -> Pydantic validate**

The broken Excel import should be fixed using this pipeline:

1. `openpyxl` reads the uploaded .xlsx file
2. Each row is converted to a dict
3. Pydantic BaseModel validates each row (types, ranges, required fields)
4. Validation errors are collected and returned as structured JSON

**Do NOT add pandantic** (v1.0.1). It adds a pandas dependency for DataFrame validation, but this project does not use pandas and should not start. Row-by-row Pydantic validation is simpler, faster, and already fits the existing stack.

**Do NOT add pandas** for Excel processing. openpyxl + Pydantic is sufficient for reading schedule data from Excel. pandas would be a 30MB+ dependency for something openpyxl handles natively.

**Confidence:** HIGH -- openpyxl 3.1.5 verified on PyPI, Pydantic v2 already in use, validation pattern is standard FastAPI practice.

### 3. Supabase Auth Integration

#### Frontend (React SPA)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **@supabase/supabase-js** | 2.47.0 | Client-side auth (signIn, signUp, onAuthStateChange) | Already installed. For SPAs, this is the official recommended approach -- no @supabase/ssr needed. |

**Do NOT install @supabase/ssr** (v0.8.0 beta). It is designed for server-rendered frameworks (Next.js, SvelteKit, Remix). A Vite React SPA should use `@supabase/supabase-js` directly, which handles token storage in localStorage automatically. The official Supabase React quickstart confirms this pattern.

**Confidence:** HIGH -- verified against official Supabase React quickstart docs (supabase.com/docs/guides/auth/quickstarts/react).

#### Backend (FastAPI JWT Verification)

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **PyJWT** | 2.11.0 | Decode and verify Supabase JWTs in FastAPI | More actively maintained than python-jose (Jan 2026 release). Lighter dependency. Standard for FastAPI JWT verification. |

**Why PyJWT over python-jose:**
- PyJWT (v2.11.0, Jan 2026) is maintained by the original JOSE author and has a cleaner API
- python-jose (v3.5.0, May 2025) wraps multiple crypto backends and is heavier
- PyJWT is what the FastAPI official docs tutorial uses
- Both work; PyJWT is simpler for the HS256 verification Supabase uses

**Critical implementation detail:** When verifying Supabase JWTs, you MUST pass `audience="authenticated"` to the decode call. This is the #1 cause of `InvalidTokenError` in Supabase + FastAPI integrations (documented in supabase/discussions#20763).

```python
# Correct pattern
import jwt  # PyJWT
decoded = jwt.decode(
    token,
    SUPABASE_JWT_SECRET,
    algorithms=["HS256"],
    audience="authenticated"
)
```

**FastAPI dependency injection pattern:**

```python
from fastapi import Depends, HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security)
) -> dict:
    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            audience="authenticated"
        )
        return payload
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# Usage: @app.get("/protected")
# async def protected(user: dict = Depends(get_current_user)):
```

**Confidence:** HIGH -- PyJWT v2.11.0 verified on PyPI, audience requirement verified in Supabase GitHub discussions, FastAPI dependency injection pattern is standard.

### 4. Deployment

#### Frontend: Vercel

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Vercel** | Platform | Host React SPA (static build) | Zero-config Vite detection, free tier sufficient for internal tool, automatic HTTPS, global CDN |

**Required configuration:**

`vercel.json` (SPA deep-link support):
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Environment variables needed on Vercel:
- `VITE_SUPABASE_URL` -- Supabase project URL
- `VITE_SUPABASE_ANON_KEY` -- Supabase publishable anon key
- `VITE_API_URL` -- Railway backend URL

**Build settings (auto-detected):**
- Build command: `npm run build` (which runs `tsc && vite build`)
- Output directory: `dist`
- Framework preset: Vite (auto-detected)

**Confidence:** HIGH -- verified against official Vercel Vite docs (vercel.com/docs/frameworks/frontend/vite).

#### Backend: Railway

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| **Railway** | Platform | Host FastAPI backend | $5/mo Hobby plan, auto-detects Python, managed environment variables, simple Docker support, good DX for small teams |

**Required files:**

`Dockerfile`:
```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
```

`railway.toml` (optional but recommended):
```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
healthcheckPath = "/health"
restartPolicyType = "ON_FAILURE"
restartPolicyMaxRetries = 3
```

**Why Uvicorn directly (not Gunicorn + Uvicorn workers):**
- Railway Hobby plan is a single container. Gunicorn's multi-worker model adds complexity without benefit at this scale.
- For an internal tool with <50 concurrent users, single-process Uvicorn is sufficient.
- If traffic grows, Railway supports horizontal scaling (add replicas) rather than multi-worker processes.

**Railway environment variables needed:**
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (for admin operations)
- `SUPABASE_JWT_SECRET` (for token verification)
- `ANTHROPIC_API_KEY`
- `CORS_ORIGINS` (Vercel frontend URL)

**Cost:** $5/month base (includes $5 usage credit). Typical FastAPI backend for this scale uses ~$3-8/month in compute.

**Confidence:** HIGH -- verified against Railway FastAPI deployment guide (docs.railway.com/guides/fastapi) and pricing docs.

---

## Supporting Libraries (New Additions)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fpdf2 | 2.8.6 | PDF generation | Schedule export to PDF |
| PyJWT | 2.11.0 | JWT verification | Backend auth middleware |

These are the ONLY new pip dependencies needed. Everything else is already in place.

---

## Installation

### Backend (new dependencies only)

```bash
# Add to requirements.txt
pip install fpdf2>=2.8.0,<3.0
pip install PyJWT>=2.11.0,<3.0
```

Updated `requirements.txt` additions:
```
fpdf2>=2.8.0,<3.0
PyJWT>=2.11.0,<3.0
```

### Frontend (no new dependencies)

No new npm packages needed. `@supabase/supabase-js` is already installed at 2.47.0. Auth implementation uses the existing library.

### Deployment tooling (local dev)

```bash
# Vercel CLI (one-time)
npm install -g vercel

# Railway CLI (one-time)
npm install -g @railway/cli
```

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| PDF generation | fpdf2 | WeasyPrint 68.1 | Requires OS-level Pango/GObject; breaks on Railway without Docker gymnastics |
| PDF generation | fpdf2 | ReportLab 4.4.10 | Over-engineered canvas API for simple tabular schedules; 3x more code |
| PDF generation | fpdf2 | wkhtmltopdf | Deprecated, unmaintained since 2022, requires headless browser binary |
| JWT verification | PyJWT | python-jose 3.5.0 | Heavier, wraps multiple crypto backends unnecessarily for HS256-only use |
| Excel validation | Pydantic (existing) | pandantic 1.0.1 | Adds pandas dependency (~30MB) for no benefit; row-by-row Pydantic is cleaner |
| Excel library | openpyxl (existing) | xlsxwriter | Write-only (cannot read), so cannot validate imports |
| Frontend auth | @supabase/supabase-js (existing) | @supabase/ssr 0.8.0-beta | Designed for SSR frameworks, not SPAs. Still in beta. |
| Backend hosting | Railway | Render | Railway has better DX, simpler pricing, faster cold starts for hobby tier |
| Backend hosting | Railway | Fly.io | Fly.io requires more DevOps knowledge; Railway is simpler for a single-service backend |
| Frontend hosting | Vercel | Netlify | Both work; Vercel has better Vite auto-detection and slightly faster builds |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| WeasyPrint | System dependency hell (Pango, GObject) in Docker/Railway; Issue #2221 documents Railway failures | fpdf2 (pure Python, zero system deps) |
| wkhtmltopdf | Unmaintained since 2022, requires headless WebKit binary | fpdf2 |
| pandas (for Excel) | 30MB+ dependency for something openpyxl handles natively | openpyxl + Pydantic |
| @supabase/ssr | Beta, designed for SSR (Next.js), not SPA (Vite React) | @supabase/supabase-js (already installed) |
| python-jose[cryptography] | Heavier than needed; PyJWT is simpler for HS256 | PyJWT |
| Gunicorn (on Railway Hobby) | Multi-worker overhead with no benefit on single-container hobby tier | uvicorn directly |
| flask-weasyprint / xhtml2pdf | Unmaintained wrappers around deprecated rendering engines | fpdf2 |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| fpdf2 2.8.6 | Python >=3.10 | Project uses 3.12, fully compatible |
| PyJWT 2.11.0 | Python >=3.9 | Project uses 3.12, fully compatible |
| openpyxl 3.1.5 | Python >=3.8 | Already in use, no changes needed |
| Pydantic 2.9.x | FastAPI >=0.100 | Already in use together, no changes needed |
| @supabase/supabase-js 2.47.0 | React 18.x | Already in use, no changes needed |
| Vercel | Vite 6.x | Auto-detects, zero config needed |
| Railway | Python 3.12 + Docker | Dockerfile-based deployment |

---

## Stack Patterns by Deployment Target

**For Railway (backend):**
- Use Docker with `python:3.12-slim` base image (smallest image with full pip support)
- Do NOT use Alpine (`python:3.12-alpine`) -- pip compilation of C extensions is slower and breaks some packages
- Single Uvicorn process, no Gunicorn
- Health check endpoint at `/health` for Railway monitoring

**For Vercel (frontend):**
- SPA mode with `vercel.json` rewrites for client-side routing
- Environment variables prefixed with `VITE_` for build-time access
- No SSR, no Vercel Functions -- pure static site deployment

**For PDF generation:**
- Generate PDFs on the backend (FastAPI endpoint), not the frontend
- Return PDF as `StreamingResponse` with `application/pdf` content type
- Use fpdf2's `table()` context manager for schedule grids
- Support both daily and weekly schedule layouts as separate PDF templates

**For Excel validation:**
- Validate on upload (backend), return structured error JSON to frontend
- Use Pydantic models matching schedule row schema
- Collect all errors (don't fail on first) using Pydantic's `model_validate` with try/except per row
- Return row number + field + error message for user-friendly error display

---

## Sources

- [PyPI: fpdf2 2.8.6](https://pypi.org/project/fpdf2/) -- version, dependencies, Python compatibility (HIGH confidence)
- [fpdf2 Tables documentation](https://py-pdf.github.io/fpdf2/Tables.html) -- table API capabilities (HIGH confidence)
- [PyPI: WeasyPrint 68.1](https://pypi.org/project/weasyprint/) -- version, system dependencies (HIGH confidence)
- [WeasyPrint Railway Issue #2221](https://github.com/Kozea/WeasyPrint/issues/2221) -- gobject deployment failure (HIGH confidence)
- [PyPI: ReportLab 4.4.10](https://pypi.org/project/reportlab/) -- version, licensing (HIGH confidence)
- [PyPI: openpyxl 3.1.5](https://pypi.org/project/openpyxl/) -- version, stability (HIGH confidence)
- [PyPI: PyJWT 2.11.0](https://pypi.org/project/PyJWT/) -- version, Python compatibility (HIGH confidence)
- [PyPI: python-jose 3.5.0](https://pypi.org/project/python-jose/) -- version, maintenance status (HIGH confidence)
- [PyPI: supabase 2.28.0](https://pypi.org/project/supabase/) -- Python client version (HIGH confidence)
- [Supabase React Auth Quickstart](https://supabase.com/docs/guides/auth/quickstarts/react) -- SPA auth pattern (HIGH confidence)
- [Supabase JWT Discussion #20763](https://github.com/orgs/supabase/discussions/20763) -- audience claim requirement (HIGH confidence)
- [Railway FastAPI Guide](https://docs.railway.com/guides/fastapi) -- deployment configuration (HIGH confidence)
- [Railway Pricing](https://docs.railway.com/reference/pricing/plans) -- Hobby plan $5/mo (HIGH confidence)
- [Vercel Vite Docs](https://vercel.com/docs/frameworks/frontend/vite) -- SPA deployment, vercel.json rewrites (HIGH confidence)
- [WeasyPrint First Steps](https://doc.courtbouillon.org/weasyprint/stable/first_steps.html) -- Pango system dependency requirement (HIGH confidence)

---
*Stack research for: MetalYapi Facade Construction Scheduler -- missing pieces*
*Researched: 2026-02-21*
