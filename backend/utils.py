"""Shared utility functions for safe database access."""

from __future__ import annotations

from typing import Any


def safe_first(response, entity: str = "record") -> dict[str, Any] | None:
    """Return the first row from a Supabase response, or None if empty."""
    if response and response.data:
        return response.data[0]
    return None


def require_first(response, entity: str = "record") -> dict[str, Any]:
    """Return the first row from a Supabase response, or raise if empty."""
    if not response or not response.data:
        raise ValueError(f"{entity} not found")
    return response.data[0]


def safe_data(response) -> list[dict[str, Any]]:
    """Return the data list from a Supabase response, or empty list if None."""
    return response.data if response and response.data else []
