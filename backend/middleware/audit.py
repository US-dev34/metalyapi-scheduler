"""Audit middleware -- logs every mutating request for traceability.

Captures request metadata (method, path, user, timestamp, body hash) and
persists it to the ``audit_log`` Supabase table.  Read-only requests
(GET, HEAD, OPTIONS) are skipped to reduce noise.
"""

from __future__ import annotations

import hashlib
import logging
import time
from datetime import datetime, timezone
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint

from backend.models.db import get_db

logger = logging.getLogger(__name__)

# HTTP methods that mutate state
_MUTATING_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


class AuditMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that records an audit trail for write operations."""

    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        """Intercept the request, call the next handler, then log the event."""
        if request.method not in _MUTATING_METHODS:
            return await call_next(request)

        start = time.perf_counter()

        # Read body bytes (we need to cache them so downstream can also read)
        body_bytes = await request.body()
        body_hash = hashlib.sha256(body_bytes).hexdigest()[:16]

        response = await call_next(request)

        elapsed_ms = round((time.perf_counter() - start) * 1000, 2)

        audit_record = {
            "method": request.method,
            "path": str(request.url.path),
            "query": str(request.url.query) if request.url.query else None,
            "body_hash": body_hash,
            "status_code": response.status_code,
            "elapsed_ms": elapsed_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "client_ip": self._get_client_ip(request),
            "user_agent": request.headers.get("user-agent"),
        }

        # Persist asynchronously (best-effort -- don't block the response)
        try:
            self._persist(audit_record)
        except Exception:
            logger.debug("Audit persistence skipped (DB may not be configured)")

        logger.info(
            "AUDIT %s %s -> %s (%.1fms)",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
        )

        return response

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _persist(record: dict) -> None:
        """Insert an audit row into Supabase.

        Fails silently when the database is not configured (e.g. in local dev
        without Supabase credentials).
        """
        try:
            db = get_db()
            db.table("audit_log").insert(record).execute()
        except RuntimeError:
            # Supabase not configured -- skip
            pass

    @staticmethod
    def _get_client_ip(request: Request) -> str:
        """Extract the originating IP, respecting X-Forwarded-For."""
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"
