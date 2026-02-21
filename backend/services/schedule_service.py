"""Core schedule service — Supabase CRUD for projects, WBS items, and allocations.

Table names match the DB schema exactly:
- projects
- wbs_items  (columns: wbs_code, wbs_name, qty, unit, sort_order, level, is_summary)
- daily_allocations (columns: wbs_item_id, date, planned_manpower, actual_manpower, qty_done, notes, source)

DailyMatrixResponse matches IC-002:
- wbs_items: list[WBSProgress] from vw_wbs_progress
- date_range: list[str] of YYYY-MM-DD
- matrix: {wbs_id: {date: {planned, actual, qty_done, is_future}}}
- totals: {date: {planned, actual}}
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from backend.models.db import get_db
from backend.models.schemas import AllocationBatchUpdate, ProjectCreate, WBSItemCreate, WBSItemUpdate
from backend.utils import require_first

logger = logging.getLogger(__name__)

# Lazy import to avoid circular dependency
_baseline_service = None
def _get_baseline_service():
    global _baseline_service
    if _baseline_service is None:
        from backend.services.baseline_service import BaselineService
        _baseline_service = BaselineService()
    return _baseline_service


class ScheduleService:
    """Facade over Supabase tables: projects, wbs_items, daily_allocations."""

    # ------------------------------------------------------------------
    # Projects
    # ------------------------------------------------------------------

    def list_projects(self) -> list[dict[str, Any]]:
        db = get_db()
        response = db.table("projects").select("*").order("created_at", desc=True).execute()
        return response.data

    def create_project(self, payload: ProjectCreate) -> dict[str, Any]:
        db = get_db()
        data = payload.model_dump(mode="json")
        response = db.table("projects").insert(data).execute()
        return require_first(response, "project")

    def get_project(self, project_id: UUID) -> dict[str, Any] | None:
        db = get_db()
        response = db.table("projects").select("*").eq("id", str(project_id)).execute()
        return response.data[0] if response.data else None

    # ------------------------------------------------------------------
    # WBS Items
    # ------------------------------------------------------------------

    def list_wbs_items(self, project_id: UUID) -> list[dict[str, Any]]:
        db = get_db()
        response = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
        )
        return response.data

    def create_wbs_item(self, project_id: UUID, payload: WBSItemCreate) -> dict[str, Any]:
        db = get_db()
        data = payload.model_dump(mode="json")
        data["project_id"] = str(project_id)
        response = db.table("wbs_items").insert(data).execute()
        return require_first(response, "WBS item")

    def update_wbs_item(self, project_id: UUID, item_id: UUID, payload: WBSItemUpdate) -> dict[str, Any] | None:
        db = get_db()
        data = payload.model_dump(mode="json", exclude_none=True)
        if not data:
            return self._get_wbs_item(project_id, item_id)
        response = (
            db.table("wbs_items")
            .update(data)
            .eq("id", str(item_id))
            .eq("project_id", str(project_id))
            .execute()
        )
        return response.data[0] if response.data else None

    def _get_wbs_item(self, project_id: UUID, item_id: UUID) -> dict[str, Any] | None:
        db = get_db()
        response = (
            db.table("wbs_items")
            .select("*")
            .eq("id", str(item_id))
            .eq("project_id", str(project_id))
            .execute()
        )
        return response.data[0] if response.data else None

    # ------------------------------------------------------------------
    # Daily Allocations — IC-002 DailyMatrixResponse
    # ------------------------------------------------------------------

    def get_daily_matrix(
        self,
        project_id: UUID,
        from_date: date,
        to_date: date,
    ) -> dict[str, Any]:
        """Build DailyMatrixResponse matching IC-002.

        Returns:
            {
                wbs_items: [{id, wbs_code, wbs_name, qty, done, remaining, progress_pct, ...}],
                date_range: ["2026-02-17", "2026-02-18", ...],
                matrix: {wbs_id: {date: {planned, actual, qty_done, is_future}}},
                totals: {date: {planned, actual}}
            }
        """
        project = self.get_project(project_id)
        if project is None:
            raise ValueError(f"Project {project_id} not found")

        # Get WBS progress from view
        db = get_db()
        wbs_progress = (
            db.table("vw_wbs_progress")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order" if "sort_order" in {} else "wbs_code")
            .execute()
        )

        # Fallback: if view doesn't work, compute from tables
        if not wbs_progress.data:
            wbs_items = self.list_wbs_items(project_id)
            wbs_progress_data = self._compute_progress(project_id, wbs_items)
        else:
            wbs_progress_data = wbs_progress.data

        # Get allocations for date range
        allocations = self._fetch_allocations(project_id, from_date, to_date)

        # Get baseline planned data (from active baseline snapshots)
        baseline_plan = _get_baseline_service().get_active_baseline_plan(project_id)

        # Build date range
        date_range = self._build_date_range(from_date, to_date)
        today = date.today()

        # Build matrix and totals
        matrix: dict[str, dict[str, dict]] = {}
        totals: dict[str, dict[str, float]] = {}

        # Initialize totals
        for d in date_range:
            totals[d] = {"planned": 0.0, "actual": 0.0}

        # Index allocations by (wbs_item_id, date)
        alloc_index: dict[tuple[str, str], dict] = {}
        for a in allocations:
            key = (str(a["wbs_item_id"]), str(a["date"]))
            alloc_index[key] = a

        # Build matrix with baseline comparison
        for wbs in wbs_progress_data:
            wbs_id = str(wbs["id"])
            wbs_baseline = baseline_plan.get(wbs_id, {})
            matrix[wbs_id] = {}
            for d in date_range:
                key = (wbs_id, d)
                alloc = alloc_index.get(key)
                is_future = date.fromisoformat(d) > today

                # Planned comes from baseline snapshot (if exists), else from allocation
                planned = wbs_baseline.get(d, 0.0)
                if planned == 0 and alloc:
                    planned = float(alloc.get("planned_manpower", 0))

                cell = {
                    "planned": planned,
                    "actual": float(alloc.get("actual_manpower", 0)) if alloc else 0.0,
                    "qty_done": float(alloc.get("qty_done", 0)) if alloc else 0.0,
                    "is_future": is_future,
                }
                matrix[wbs_id][d] = cell

                # Accumulate totals
                totals[d]["planned"] += cell["planned"]
                totals[d]["actual"] += cell["actual"]

        return {
            "wbs_items": wbs_progress_data,
            "date_range": date_range,
            "matrix": matrix,
            "totals": totals,
        }

    def batch_update_allocations(
        self,
        project_id: UUID,
        payload: AllocationBatchUpdate,
    ) -> dict[str, Any]:
        """Upsert allocation cells. Returns {updated_count, errors}."""
        db = get_db()
        updated = 0
        errors = []

        for cell in payload.updates:
            try:
                row = {
                    "wbs_item_id": cell.wbs_id,
                    "date": cell.date.isoformat(),
                    "source": payload.source,
                }
                if cell.actual_manpower is not None:
                    row["actual_manpower"] = cell.actual_manpower
                if cell.qty_done is not None:
                    row["qty_done"] = cell.qty_done
                if cell.notes is not None:
                    row["notes"] = cell.notes

                db.table("daily_allocations").upsert(
                    row, on_conflict="wbs_item_id,date"
                ).execute()
                updated += 1
            except Exception as e:
                logger.warning("Allocation upsert failed wbs=%s date=%s: %s", cell.wbs_id, cell.date, e)
                errors.append({
                    "wbs_id": cell.wbs_id,
                    "date": cell.date.isoformat(),
                    "error": str(e),
                })

        return {"updated_count": updated, "errors": errors}

    def get_weekly_data(self, project_id: UUID) -> dict[str, Any]:
        """Weekly aggregated view — Phase 2 stub."""
        return {"message": "Weekly view not yet implemented"}

    def get_summary_data(self, project_id: UUID) -> dict[str, Any]:
        """Summary with Gantt data — Phase 2 stub."""
        return {"message": "Summary view not yet implemented"}

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_date_range(start: date, end: date) -> list[str]:
        days = (end - start).days + 1
        return [(start + timedelta(days=i)).isoformat() for i in range(max(days, 0))]

    def _fetch_allocations(
        self, project_id: UUID, from_date: date, to_date: date
    ) -> list[dict[str, Any]]:
        """Fetch daily_allocations for WBS items in this project within date range."""
        db = get_db()
        # Get WBS item IDs for this project
        wbs_ids_resp = (
            db.table("wbs_items")
            .select("id")
            .eq("project_id", str(project_id))
            .execute()
        )
        wbs_ids = [w["id"] for w in wbs_ids_resp.data]
        if not wbs_ids:
            return []

        response = (
            db.table("daily_allocations")
            .select("*")
            .in_("wbs_item_id", wbs_ids)
            .gte("date", from_date.isoformat())
            .lte("date", to_date.isoformat())
            .execute()
        )
        return response.data

    def _compute_progress(
        self, project_id: UUID, wbs_items: list[dict]
    ) -> list[dict[str, Any]]:
        """Compute progress when vw_wbs_progress is not available."""
        db = get_db()
        progress = []

        for item in wbs_items:
            wbs_id = str(item["id"])
            # Get all allocations for this WBS item
            allocs = (
                db.table("daily_allocations")
                .select("actual_manpower, qty_done, date")
                .eq("wbs_item_id", wbs_id)
                .execute()
            )

            total_qty_done = sum(float(a.get("qty_done", 0)) for a in allocs.data)
            total_manday = sum(float(a.get("actual_manpower", 0)) for a in allocs.data)
            working_days = len([a for a in allocs.data if float(a.get("actual_manpower", 0)) > 0])

            qty = float(item.get("qty", 0))
            remaining = max(qty - total_qty_done, 0)
            progress_pct = round(total_qty_done / qty * 100, 1) if qty > 0 else 0.0
            productivity = round(total_qty_done / total_manday, 3) if total_manday > 0 else 0.0

            progress.append({
                "id": wbs_id,
                "wbs_code": item["wbs_code"],
                "wbs_name": item["wbs_name"],
                "qty": qty,
                "done": total_qty_done,
                "remaining": remaining,
                "progress_pct": progress_pct,
                "total_actual_manday": total_manday,
                "working_days": working_days,
                "productivity_rate": productivity,
            })

        return progress
