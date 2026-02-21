"""Database client — supports Supabase (production) and mock mode (local Docker dev).

When SUPABASE_URL is not set or starts with "http://db", falls back to mock mode
which returns seed data from memory. This lets the app run in Docker without
a real Supabase project.
"""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import uuid4

from backend.config import settings

logger = logging.getLogger(__name__)

_client = None
_mock_mode = False


def get_db():
    """Return the DB client (Supabase or MockDB).

    Tests if tables exist on first call. Falls back to MockDB if not.
    """
    global _client, _mock_mode
    if _client is not None:
        return _client

    url = settings.supabase_url
    # Prefer service key (bypasses RLS) for server-side operations
    key = settings.supabase_service_key or settings.supabase_key
    if url and url.startswith("https://") and key:
        try:
            from supabase import create_client
            client = create_client(url, key)
            # Test if tables exist
            result = client.table("projects").select("id").limit(1).execute()
            _client = client
            key_type = "service_role" if settings.supabase_service_key else "anon"
            logger.info("Connected to Supabase: %s (%d projects, %s key)", url, len(result.data), key_type)
            return _client
        except Exception as e:
            logger.warning("Supabase tables not ready: %s — using MockDB", e)

    # Fall back to mock DB
    logger.info("Running in MOCK DB mode")
    _mock_mode = True
    _client = MockDB()
    return _client


def is_mock_mode() -> bool:
    return _mock_mode


class MockDB:
    """In-memory mock that mimics the Supabase Python client API.

    Supports: .table(name).select("*").eq(k,v).order(k).execute()
    and .table(name).insert(data).execute() / .upsert(data).execute()
    """

    def __init__(self):
        self._data: dict[str, list[dict]] = _build_seed_data()

    def table(self, name: str) -> MockTable:
        if name not in self._data:
            self._data[name] = []
        return MockTable(self._data[name])


class MockTable:
    def __init__(self, rows: list[dict]):
        self._rows = rows
        self._filters: list[tuple[str, str, Any]] = []
        self._order_key: str | None = None
        self._order_desc: bool = False
        self._limit_n: int | None = None
        self._select_cols: str = "*"

    def select(self, cols: str = "*") -> MockTable:
        self._select_cols = cols
        return self

    def eq(self, key: str, value: Any) -> MockTable:
        self._filters.append((key, "eq", value))
        return self

    def in_(self, key: str, values: list) -> MockTable:
        self._filters.append((key, "in", values))
        return self

    def gte(self, key: str, value: Any) -> MockTable:
        self._filters.append((key, "gte", value))
        return self

    def lte(self, key: str, value: Any) -> MockTable:
        self._filters.append((key, "lte", value))
        return self

    def order(self, key: str, desc: bool = False) -> MockTable:
        self._order_key = key
        self._order_desc = desc
        return self

    def limit(self, n: int) -> MockTable:
        self._limit_n = n
        return self

    def insert(self, data: dict | list) -> MockTable:
        rows = data if isinstance(data, list) else [data]
        for row in rows:
            if "id" not in row:
                row["id"] = str(uuid4())
            row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            row.setdefault("updated_at", datetime.now(timezone.utc).isoformat())
            self._rows.append(row)
        self._last_inserted = rows
        return self

    def upsert(self, data: dict | list, on_conflict: str = "") -> MockTable:
        rows = data if isinstance(data, list) else [data]
        conflict_keys = on_conflict.split(",") if on_conflict else []
        for row in rows:
            if "id" not in row:
                row["id"] = str(uuid4())
            # Check for existing row by conflict keys
            if conflict_keys:
                existing = None
                for r in self._rows:
                    if all(r.get(k) == row.get(k) for k in conflict_keys):
                        existing = r
                        break
                if existing:
                    existing.update(row)
                    continue
            row.setdefault("created_at", datetime.now(timezone.utc).isoformat())
            row.setdefault("updated_at", datetime.now(timezone.utc).isoformat())
            self._rows.append(row)
        self._last_inserted = rows
        return self

    def update(self, data: dict) -> MockTable:
        self._update_data = data
        return self

    def execute(self) -> MockResponse:
        # Handle update
        if hasattr(self, "_update_data"):
            filtered = self._apply_filters(self._rows)
            for row in filtered:
                row.update(self._update_data)
            return MockResponse(filtered)

        # Handle insert/upsert
        if hasattr(self, "_last_inserted"):
            return MockResponse(self._last_inserted)

        # Handle select
        result = self._apply_filters(self._rows)

        if self._order_key:
            result = sorted(result, key=lambda r: r.get(self._order_key, ""), reverse=self._order_desc)

        if self._limit_n:
            result = result[:self._limit_n]

        return MockResponse(result)

    @staticmethod
    def _coerce_for_compare(a: Any, b: Any) -> tuple[Any, Any]:
        """Coerce two values to comparable types (numeric if possible, else string)."""
        try:
            return float(a), float(b)
        except (ValueError, TypeError):
            return str(a), str(b)

    def _apply_filters(self, rows: list[dict]) -> list[dict]:
        result = list(rows)
        for key, op, value in self._filters:
            if op == "eq":
                result = [r for r in result if str(r.get(key, "")) == str(value)]
            elif op == "in":
                result = [r for r in result if r.get(key) in value]
            elif op == "gte":
                result = [
                    r for r in result
                    if self._coerce_for_compare(r.get(key, ""), value)[0]
                    >= self._coerce_for_compare(r.get(key, ""), value)[1]
                ]
            elif op == "lte":
                result = [
                    r for r in result
                    if self._coerce_for_compare(r.get(key, ""), value)[0]
                    <= self._coerce_for_compare(r.get(key, ""), value)[1]
                ]
        return result


class MockResponse:
    def __init__(self, data: list[dict]):
        self.data = data


def _build_seed_data() -> dict[str, list[dict]]:
    """Build in-memory seed data matching supabase/seed.sql."""
    project_id = "00000000-0000-0000-0000-000000000001"
    now = datetime.now(timezone.utc).isoformat()

    wbs = [
        # Summary/Parent items (level 0-1)
        ("20000000-0000-0000-0000-000000000001", None, "CW", "Curtain Wall", 0, "m2", 0, 0, True),
        ("20000000-0000-0000-0000-000000000002", None, "DR", "Doors", 0, "pcs", 0, 0, True),
        ("20000000-0000-0000-0000-000000000003", None, "GL", "Glazing", 0, "m2", 0, 0, True),
        # Children (level 2)
        ("10000000-0000-0000-0000-000000000001", "20000000-0000-0000-0000-000000000001", "CW-01", "Curtain Wall Type-1", 100, "m2", 1, 2, False),
        ("10000000-0000-0000-0000-000000000002", "20000000-0000-0000-0000-000000000001", "CW-02", "Curtain Wall Type-2", 150, "m2", 2, 2, False),
        ("10000000-0000-0000-0000-000000000003", "20000000-0000-0000-0000-000000000001", "CW-03", "Curtain Wall Type-3", 80, "m2", 3, 2, False),
        ("10000000-0000-0000-0000-000000000004", "20000000-0000-0000-0000-000000000002", "DR-01", "Door Type-A", 50, "pcs", 4, 2, False),
        ("10000000-0000-0000-0000-000000000005", "20000000-0000-0000-0000-000000000002", "DR-02", "Door Type-B", 30, "pcs", 5, 2, False),
        ("10000000-0000-0000-0000-000000000006", "20000000-0000-0000-0000-000000000003", "GL-01", "Glazing Panel", 200, "m2", 6, 2, False),
    ]

    allocs = [
        ("10000000-0000-0000-0000-000000000001", "2026-02-17", 5, 6, 4),
        ("10000000-0000-0000-0000-000000000001", "2026-02-18", 5, 5, 3.5),
        ("10000000-0000-0000-0000-000000000001", "2026-02-19", 5, 4, 3),
        ("10000000-0000-0000-0000-000000000002", "2026-02-17", 7, 7, 5),
        ("10000000-0000-0000-0000-000000000002", "2026-02-18", 7, 8, 6),
        ("10000000-0000-0000-0000-000000000004", "2026-02-17", 3, 3, 2),
        ("10000000-0000-0000-0000-000000000006", "2026-02-18", 4, 4, 8),
        ("10000000-0000-0000-0000-000000000006", "2026-02-19", 4, 5, 10),
    ]

    return {
        "projects": [{
            "id": project_id, "name": "E2NS Facade Project", "code": "E2NS-001",
            "start_date": "2026-02-17", "end_date": "2026-06-30", "status": "active",
            "created_at": now, "updated_at": now,
        }],
        "wbs_items": [
            {"id": wid, "project_id": project_id, "parent_id": pid,
             "wbs_code": code, "wbs_name": name, "qty": qty, "unit": unit,
             "sort_order": sort_ord, "level": lvl, "is_summary": is_sum,
             "created_at": now, "updated_at": now}
            for wid, pid, code, name, qty, unit, sort_ord, lvl, is_sum in wbs
        ],
        "daily_allocations": [
            {"id": str(uuid4()), "wbs_item_id": wid, "date": d,
             "planned_manpower": pm, "actual_manpower": am, "qty_done": qd,
             "notes": None, "source": "grid", "created_at": now, "updated_at": now}
            for wid, d, pm, am, qd in allocs
        ],
        "baselines": [],
        "baseline_snapshots": [],
        "ai_forecasts": [],
        "chat_messages": [],
        "audit_log": [],
        "vw_wbs_progress": [],  # computed on-the-fly by service
    }
