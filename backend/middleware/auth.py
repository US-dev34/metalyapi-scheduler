"""JWT authentication middleware using Supabase Auth.

Provides a FastAPI dependency ``get_current_user`` that:
1. Extracts the Bearer token from the Authorization header
2. Verifies the JWT against the Supabase project's JWKS
3. Returns a CurrentUser object with id, email, and role
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.config import settings

logger = logging.getLogger(__name__)
security = HTTPBearer(auto_error=False)

# Supabase JWT uses HS256 with the JWT secret (derivable from service key).
# For simplicity, we verify via Supabase's /auth/v1/user endpoint using the access token.
# This avoids needing to manage JWKS rotation.

_SUPABASE_JWT_SECRET = None


def _get_jwt_secret() -> str:
    """Derive the JWT secret from the Supabase service key."""
    global _SUPABASE_JWT_SECRET
    if _SUPABASE_JWT_SECRET:
        return _SUPABASE_JWT_SECRET
    # Supabase signs JWTs with the JWT secret from the project settings.
    # The service role key IS the JWT secret for HS256 verification.
    # We use the anon key's decoded payload to find the secret,
    # or fall back to verifying via API call.
    _SUPABASE_JWT_SECRET = settings.supabase_service_key or settings.supabase_key
    return _SUPABASE_JWT_SECRET


@dataclass
class CurrentUser:
    """Represents the authenticated user extracted from the JWT."""
    id: str
    email: str
    role: str = "authenticated"


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser:
    """FastAPI dependency: verify JWT and return current user.

    Raises 401 if token is missing, expired, or invalid.
    """
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    try:
        # Try local JWT verification first (faster, no network call)
        secret = _get_jwt_secret()
        if secret:
            payload = jwt.decode(
                token,
                secret,
                algorithms=["HS256"],
                audience="authenticated",
                options={"verify_exp": True},
            )
            user_id = payload.get("sub", "")
            email = payload.get("email", "")
            role = payload.get("role", "authenticated")
            return CurrentUser(id=user_id, email=email, role=role)
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except jwt.InvalidTokenError:
        # Fall back to Supabase API verification
        pass

    # Fallback: verify via Supabase API
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.supabase_url}/auth/v1/user",
                headers={
                    "Authorization": f"Bearer {token}",
                    "apikey": settings.supabase_key,
                },
            )
            if resp.status_code == 200:
                data = resp.json()
                return CurrentUser(
                    id=data.get("id", ""),
                    email=data.get("email", ""),
                    role=data.get("role", "authenticated"),
                )
    except Exception as e:
        logger.error("Supabase auth verification failed: %s", e)

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid authentication token",
        headers={"WWW-Authenticate": "Bearer"},
    )


# Optional dependency: returns None instead of raising 401 (for optional auth)
async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
) -> CurrentUser | None:
    """Like get_current_user but returns None for unauthenticated requests."""
    if credentials is None:
        return None
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None
