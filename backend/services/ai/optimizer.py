"""Schedule optimizer -- suggests resource re-allocations to improve the schedule.

The optimizer analyses current progress and productivity across all WBS items,
identifies bottlenecks, and proposes crew movements from ahead-of-schedule
items to behind-schedule items.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any
from uuid import UUID

from backend.models.db import get_db
from backend.services.compute_engine import ComputeEngine

logger = logging.getLogger(__name__)
compute = ComputeEngine()


class ScheduleOptimizer:
    """Generates optimisation suggestions for a project schedule."""

    async def optimize(self, project_id: UUID) -> list[dict[str, Any]]:
        """Analyse the project and return a ranked list of suggestions.

        Each suggestion is a dict with:
        - ``type``: e.g. "reallocate_crew", "extend_shift", "split_task"
        - ``wbs_code``: target WBS item
        - ``description``: human-readable explanation
        - ``impact_score``: estimated benefit (0-100)
        - ``details``: action-specific parameters

        Returns:
            List of suggestion dicts, sorted by ``impact_score`` descending.
        """
        db = get_db()

        wbs_items = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
            .data
        )
        # Get WBS item IDs, then fetch allocations from daily_allocations
        wbs_ids = [w["id"] for w in wbs_items]
        allocations = []
        if wbs_ids:
            allocations = (
                db.table("daily_allocations")
                .select("*")
                .in_("wbs_item_id", wbs_ids)
                .execute()
                .data
            )

        # Aggregate actuals per WBS
        actual_map: dict[str, float] = {}
        crew_map: dict[str, int] = {}
        for a in allocations:
            wid = a["wbs_item_id"]
            actual_map[wid] = actual_map.get(wid, 0.0) + float(a.get("qty_done", 0))
            crew_map[wid] = max(crew_map.get(wid, 0), int(a.get("actual_manpower", 0)))

        suggestions: list[dict[str, Any]] = []

        behind_schedule: list[dict[str, Any]] = []
        ahead_schedule: list[dict[str, Any]] = []

        for item in wbs_items:
            wid = item["id"]
            planned = float(item.get("qty", 0))
            actual = actual_map.get(wid, 0.0)
            spi = compute.schedule_performance_index(planned, actual)

            item_info = {
                "wbs_id": wid,
                "wbs_code": item["wbs_code"],
                "wbs_name": item["wbs_name"],
                "planned_qty": planned,
                "actual_qty": actual,
                "spi": spi,
                "crew_count": crew_map.get(wid, 0),
            }

            if planned > 0 and spi < 0.85:
                behind_schedule.append(item_info)
            elif planned > 0 and spi > 1.1:
                ahead_schedule.append(item_info)

        # Suggest crew reallocation from ahead -> behind (top 10 each to cap suggestions)
        behind_sorted = sorted(behind_schedule, key=lambda x: x["spi"])[:10]
        ahead_sorted = sorted(ahead_schedule, key=lambda x: x["spi"], reverse=True)[:10]
        for behind in behind_sorted:
            for ahead in ahead_sorted:
                if ahead["crew_count"] > 1:
                    impact = int(min((1.0 - behind["spi"]) * 100, 100))
                    suggestions.append(
                        {
                            "type": "reallocate_crew",
                            "wbs_code": behind["wbs_code"],
                            "description": (
                                f"Move 1 crew from {ahead['wbs_code']} "
                                f"({ahead['wbs_name']}, SPI={ahead['spi']:.2f}) "
                                f"to {behind['wbs_code']} "
                                f"({behind['wbs_name']}, SPI={behind['spi']:.2f})"
                            ),
                            "impact_score": impact,
                            "details": {
                                "from_wbs": ahead["wbs_code"],
                                "to_wbs": behind["wbs_code"],
                                "crew_delta": 1,
                            },
                        }
                    )

        # Suggest extended shifts for items significantly behind
        for behind in behind_schedule:
            if behind["spi"] < 0.7:
                impact = int(min((1.0 - behind["spi"]) * 80, 95))
                suggestions.append(
                    {
                        "type": "extend_shift",
                        "wbs_code": behind["wbs_code"],
                        "description": (
                            f"Consider overtime or extended shifts for "
                            f"{behind['wbs_code']} ({behind['wbs_name']}). "
                            f"Current SPI={behind['spi']:.2f}"
                        ),
                        "impact_score": impact,
                        "details": {
                            "current_spi": behind["spi"],
                            "target_spi": 1.0,
                        },
                    }
                )

        # Sort by impact descending, cap at top 10
        suggestions.sort(key=lambda s: s["impact_score"], reverse=True)
        return suggestions[:10]
