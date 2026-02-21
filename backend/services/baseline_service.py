"""Baseline service — snapshot creation and comparison.

Tables: baselines, baseline_snapshots
A baseline captures the current WBS allocations at a point in time.
Rebaseline deactivates the old baseline and creates a new one.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from backend.models.db import get_db
from backend.models.schemas import BaselineCreate
from backend.utils import safe_first

logger = logging.getLogger(__name__)


class BaselineService:
    """Manages baselines and baseline_snapshots."""

    def list_baselines(self, project_id: UUID) -> list[dict[str, Any]]:
        """Return all baselines for a project, newest first."""
        db = get_db()
        response = (
            db.table("baselines")
            .select("*")
            .eq("project_id", str(project_id))
            .order("version", desc=True)
            .execute()
        )
        return response.data

    def create_baseline(self, project_id: UUID, payload: BaselineCreate) -> dict[str, Any]:
        """Create a new baseline with snapshots for each WBS item.

        1. Determine next version number
        2. Insert baseline record
        3. For each WBS item, snapshot its daily_plan from daily_allocations
        """
        import random
        import time

        db = get_db()

        # Retry loop to handle race condition on version numbering
        for attempt in range(3):
            try:
                # Get next version
                existing = (
                    db.table("baselines")
                    .select("version")
                    .eq("project_id", str(project_id))
                    .order("version", desc=True)
                    .limit(1)
                    .execute()
                )
                latest = safe_first(existing)
                next_version = (latest["version"] + 1) if latest else 1

                # Deactivate previous baselines
                db.table("baselines").update({"is_active": False}).eq(
                    "project_id", str(project_id)
                ).eq("is_active", True).execute()

                # Insert new baseline
                baseline_row = {
                    "project_id": str(project_id),
                    "version": next_version,
                    "name": payload.name,
                    "notes": payload.notes,
                    "is_active": True,
                    "approved_at": datetime.now(timezone.utc).isoformat(),
                }
                baseline_resp = db.table("baselines").insert(baseline_row).execute()
                baseline = safe_first(baseline_resp)
                if not baseline:
                    raise ValueError("Failed to create baseline — insert returned no data")
                baseline_id = baseline["id"]
                break
            except Exception as e:
                if "unique" in str(e).lower() and attempt < 2:
                    logger.warning("Baseline version conflict, retrying: %s", e)
                    time.sleep(random.uniform(0.05, 0.2))
                    continue
                raise

        # Get all WBS items
        wbs_items = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .execute()
        )

        # For each WBS item, create a snapshot
        for item in wbs_items.data:
            wbs_id = item["id"]

            # Get all allocations for this WBS item
            allocs = (
                db.table("daily_allocations")
                .select("date, planned_manpower, actual_manpower, qty_done")
                .eq("wbs_item_id", wbs_id)
                .order("date")
                .execute()
            )

            # Build daily_plan JSONB: {"2026-02-17": 5, "2026-02-18": 7}
            daily_plan = {}
            total_manday = 0.0
            start_date = None
            end_date = None

            for a in allocs.data:
                mp = float(a.get("actual_manpower", 0))
                if mp > 0:
                    daily_plan[a["date"]] = mp
                    total_manday += mp
                    if start_date is None:
                        start_date = a["date"]
                    end_date = a["date"]

            avg_mp = total_manday / len(daily_plan) if daily_plan else 0

            snapshot_row = {
                "baseline_id": baseline_id,
                "wbs_item_id": wbs_id,
                "total_manday": total_manday,
                "start_date": start_date,
                "end_date": end_date,
                "daily_plan": daily_plan,
                "manpower_per_day": round(avg_mp, 2),
            }
            db.table("baseline_snapshots").insert(snapshot_row).execute()

        return baseline

    def get_baseline(self, project_id: UUID, version: int) -> dict[str, Any] | None:
        """Get a specific baseline by version with its snapshots."""
        db = get_db()
        baseline = (
            db.table("baselines")
            .select("*")
            .eq("project_id", str(project_id))
            .eq("version", version)
            .execute()
        )
        if not baseline.data:
            return None

        bl = baseline.data[0]

        # Get snapshots
        snapshots = (
            db.table("baseline_snapshots")
            .select("*")
            .eq("baseline_id", bl["id"])
            .execute()
        )
        bl["snapshots"] = snapshots.data
        return bl

    def get_active_baseline_plan(self, project_id: UUID) -> dict[str, dict[str, float]]:
        """Get the active baseline's daily_plan indexed by (wbs_item_id, date) -> manpower.

        Returns: {wbs_item_id: {date: planned_manpower}}
        Used by schedule_service to populate CellData.planned.
        """
        db = get_db()
        active = (
            db.table("baselines")
            .select("id")
            .eq("project_id", str(project_id))
            .eq("is_active", True)
            .limit(1)
            .execute()
        )
        if not active.data:
            return {}

        baseline_id = active.data[0]["id"]
        snapshots = (
            db.table("baseline_snapshots")
            .select("wbs_item_id, daily_plan")
            .eq("baseline_id", baseline_id)
            .execute()
        )

        result: dict[str, dict[str, float]] = {}
        for snap in snapshots.data:
            wbs_id = snap["wbs_item_id"]
            daily_plan = snap.get("daily_plan", {})
            if isinstance(daily_plan, dict):
                result[wbs_id] = {k: float(v) for k, v in daily_plan.items()}

        return result

    def rebaseline(self, project_id: UUID, payload: BaselineCreate) -> dict[str, Any]:
        """Archive current baseline and create a new one. Alias for create_baseline."""
        return self.create_baseline(project_id, payload)
