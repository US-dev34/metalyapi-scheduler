"""MetalYapi Construction Scheduling API entry point.

Run with::

    uvicorn backend.main:app --reload
"""

import logging

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.middleware.auth import get_current_user, get_optional_user
from backend.middleware.audit import AuditMiddleware
from backend.routers import projects, wbs, allocations, baselines, chat, ai, reports

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="MetalYapi Scheduling API",
    version="1.0.0",
    description="Backend API for MetalYapi Construction Scheduling and Daily Allocation Matrix.",
)

# ---------------------------------------------------------------------------
# Middleware
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Audit logging middleware (records mutating API calls)
app.add_middleware(AuditMiddleware)

# ---------------------------------------------------------------------------
# Auth — enforce on all /api/ routes in production
# In development, auth is optional (still verifies if token present)
# ---------------------------------------------------------------------------
_AUTH_REQUIRED = settings.environment == "production"

# Auth-protected routers get the dependency
_auth_deps = [Depends(get_current_user)] if _AUTH_REQUIRED else []

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(projects.router, dependencies=_auth_deps)
app.include_router(wbs.router, dependencies=_auth_deps)
app.include_router(allocations.router, dependencies=_auth_deps)
app.include_router(baselines.router, dependencies=_auth_deps)
app.include_router(chat.router, dependencies=_auth_deps)
app.include_router(ai.router, dependencies=_auth_deps)
app.include_router(reports.router, dependencies=_auth_deps)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/health", tags=["health"])
async def health_check():
    """Liveness probe used by orchestrators and monitoring."""
    return {"status": "ok", "version": "1.0.0", "environment": settings.environment}


@app.on_event("startup")
async def on_startup():
    """Log a banner on application start."""
    logger.info("MetalYapi Scheduling API v1.0.0 starting (%s)", settings.environment)


@app.on_event("shutdown")
async def on_shutdown():
    """Clean-up hook (future: close DB pools, flush queues)."""
    logger.info("MetalYapi Scheduling API shutting down")
