"""Daily digest — summarises today's activity with KPIs and trends.

Gathers today's data (4 queries), computes KPIs, compares to yesterday,
optionally calls Claude for narrative summary.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Any
from uuid import UUID

import anthropic

from backend.config import settings
from backend.models.db import get_db

logger = logging.getLogger(__name__)


class DailyDigestEngine:
    """Generates a daily digest for a project."""

    def __init__(self) -> None:
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.claude_api_key)
        return self._client

    async def generate_digest(self, project_id: UUID) -> dict[str, Any]:
        """Generate daily digest for the project.

        Returns: {date, summary, kpi, highlights, concerns}
        """
        db = get_db()
        today = date.today()
        yesterday = today - timedelta(days=1)

        # Query 1: Project info
        project_resp = db.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_resp.data:
            raise ValueError(f"Project {project_id} not found")
        project = project_resp.data[0]

        # Query 2: All WBS items
        wbs_items = (
            db.table("wbs_items")
            .select("id, wbs_code, wbs_name, qty, is_summary")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
            .data
        )
        wbs_ids = [w["id"] for w in wbs_items]
        wbs_map = {w["id"]: w for w in wbs_items}

        # Query 3: Today's allocations
        today_allocs = []
        if wbs_ids:
            today_allocs = (
                db.table("daily_allocations")
                .select("wbs_item_id, actual_manpower, qty_done")
                .in_("wbs_item_id", wbs_ids)
                .eq("date", today.isoformat())
                .execute()
                .data
            )

        # Query 4: Yesterday's allocations (for trend)
        yesterday_allocs = []
        if wbs_ids:
            yesterday_allocs = (
                db.table("daily_allocations")
                .select("wbs_item_id, actual_manpower, qty_done")
                .in_("wbs_item_id", wbs_ids)
                .eq("date", yesterday.isoformat())
                .execute()
                .data
            )

        # Compute KPIs
        today_workers = sum(float(a.get("actual_manpower", 0)) for a in today_allocs)
        today_qty = sum(float(a.get("qty_done", 0)) for a in today_allocs)
        active_items_today = len(set(a["wbs_item_id"] for a in today_allocs if float(a.get("actual_manpower", 0)) > 0))

        yesterday_workers = sum(float(a.get("actual_manpower", 0)) for a in yesterday_allocs)
        yesterday_qty = sum(float(a.get("qty_done", 0)) for a in yesterday_allocs)

        worker_trend = today_workers - yesterday_workers
        qty_trend = today_qty - yesterday_qty

        # Overall progress
        total_qty = sum(float(w.get("qty", 0)) for w in wbs_items if not w.get("is_summary"))

        # Need cumulative qty_done — fetch all allocations for this
        all_allocs = []
        if wbs_ids:
            all_allocs = (
                db.table("daily_allocations")
                .select("wbs_item_id, qty_done")
                .in_("wbs_item_id", wbs_ids)
                .execute()
                .data
            )
        cumulative_done = sum(float(a.get("qty_done", 0)) for a in all_allocs)
        overall_progress = min(100, (cumulative_done / total_qty * 100)) if total_qty > 0 else 0

        # Highlights: items with most progress today
        today_by_wbs: dict[str, dict] = {}
        for a in today_allocs:
            wbs_id = a["wbs_item_id"]
            today_by_wbs.setdefault(wbs_id, {"manpower": 0, "qty": 0})
            today_by_wbs[wbs_id]["manpower"] += float(a.get("actual_manpower", 0))
            today_by_wbs[wbs_id]["qty"] += float(a.get("qty_done", 0))

        highlights = []
        concerns = []
        for wbs_id, data in sorted(today_by_wbs.items(), key=lambda x: -x[1]["qty"]):
            wbs = wbs_map.get(wbs_id, {})
            if data["qty"] > 0:
                highlights.append({
                    "wbs_code": wbs.get("wbs_code", "?"),
                    "wbs_name": wbs.get("wbs_name", "?"),
                    "qty_today": round(data["qty"], 1),
                    "workers": round(data["manpower"], 0),
                })
            elif data["manpower"] > 0 and data["qty"] == 0:
                concerns.append({
                    "wbs_code": wbs.get("wbs_code", "?"),
                    "wbs_name": wbs.get("wbs_name", "?"),
                    "issue": "Workers assigned but no quantity recorded",
                    "workers": round(data["manpower"], 0),
                })

        highlights = highlights[:5]
        concerns = concerns[:5]

        # Generate narrative summary (optional — use Claude if available)
        summary = self._generate_summary(
            project, today, today_workers, today_qty, active_items_today,
            worker_trend, qty_trend, overall_progress, highlights, concerns,
        )

        return {
            "date": today.isoformat(),
            "summary": summary,
            "kpi": {
                "total_workers": round(today_workers),
                "active_items": active_items_today,
                "qty_today": round(today_qty, 1),
                "overall_progress": round(overall_progress, 1),
                "worker_trend": round(worker_trend),
                "qty_trend": round(qty_trend, 1),
            },
            "highlights": highlights,
            "concerns": concerns,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def _generate_summary(
        self, project: dict, today: date,
        workers: float, qty: float, active_items: int,
        worker_trend: float, qty_trend: float, overall_progress: float,
        highlights: list[dict], concerns: list[dict],
    ) -> str:
        """Use Claude to generate a narrative summary, with fallback."""
        data = {
            "project": project.get("name", "Unknown"),
            "date": today.isoformat(),
            "workers": workers,
            "qty_done_today": qty,
            "active_items": active_items,
            "worker_trend": worker_trend,
            "qty_trend": qty_trend,
            "overall_progress": overall_progress,
            "highlights": highlights[:3],
            "concerns": concerns[:3],
        }

        try:
            if not settings.claude_api_key:
                return self._fallback_summary(data)

            message = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=512,
                system=(
                    "You are a construction project assistant. Write a brief daily digest "
                    "(3-4 sentences) summarizing today's activity. Be concise and professional. "
                    "Include key numbers. Write in Turkish."
                ),
                messages=[{
                    "role": "user",
                    "content": f"Generate daily digest:\n```json\n{json.dumps(data, default=str)}\n```",
                }],
            )
            return message.content[0].text  # type: ignore[union-attr]
        except Exception as e:
            logger.warning("Claude digest failed, using fallback: %s", e)
            return self._fallback_summary(data)

    @staticmethod
    def _fallback_summary(data: dict) -> str:
        """Generate a simple summary without Claude."""
        trend_worker = "+" if data["worker_trend"] > 0 else ""
        trend_qty = "+" if data["qty_trend"] > 0 else ""
        return (
            f"Bugün {data['workers']:.0f} işçi ({trend_worker}{data['worker_trend']:.0f}) "
            f"ile {data['active_items']} kalemde çalışıldı. "
            f"Toplam {data['qty_done_today']:.1f} birim üretim ({trend_qty}{data['qty_trend']:.1f}). "
            f"Genel ilerleme: %{data['overall_progress']:.1f}."
        )
