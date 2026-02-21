"""Forecast engine — predicts completion dates using historical productivity.

Step 1: Local compute (productivity_rate, remaining, estimated days)
Step 2: Claude API for adjusted forecast + risk assessment (optional)
Step 3: Store results in ai_forecasts table

Returns IC-003 ForecastResponse: {forecasts, overall_summary, generated_at}
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any
from uuid import UUID

import anthropic

from backend.config import settings
from backend.models.db import get_db
from backend.services.compute_engine import (
    calculate_productivity_rate,
    calculate_progress_pct,
    calculate_remaining_days,
)

logger = logging.getLogger(__name__)
_PROMPT_DIR = Path(__file__).parent / "prompts"
_ROLLING_WINDOW = 14  # days


class ForecastEngine:
    """Generates per-WBS forecasts with local compute + optional Claude enhancement."""

    def __init__(self) -> None:
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.claude_api_key)
        return self._client

    async def generate_forecast(self, project_id: UUID) -> dict[str, Any]:
        """Build IC-003 ForecastResponse for all WBS items.

        Returns:
            {forecasts: [{wbs_code, wbs_name, current_progress, predicted_end_date,
             predicted_total_manday, risk_level, recommendation}],
             overall_summary, generated_at}
        """
        db = get_db()

        # Get project
        project_resp = db.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_resp.data:
            raise ValueError(f"Project {project_id} not found")
        project = project_resp.data[0]

        # Get WBS items
        wbs_items = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
            .data
        )

        # Batch fetch ALL allocations for this project (eliminates N+1)
        wbs_ids = [w["id"] for w in wbs_items]
        all_allocations = []
        if wbs_ids:
            all_allocations = (
                db.table("daily_allocations")
                .select("wbs_item_id, date, actual_manpower, qty_done")
                .in_("wbs_item_id", wbs_ids)
                .order("date")
                .execute()
                .data
            )

        # Group allocations by wbs_item_id
        allocs_by_wbs: dict[str, list[dict]] = {}
        for a in all_allocations:
            allocs_by_wbs.setdefault(a["wbs_item_id"], []).append(a)

        today = date.today()
        forecasts = []

        for wbs in wbs_items:
            wbs_id = wbs["id"]
            qty = float(wbs.get("qty", 0))

            # Use pre-fetched allocations
            allocs = allocs_by_wbs.get(wbs_id, [])

            # Step 1: Local compute
            total_qty_done = sum(float(a.get("qty_done", 0)) for a in allocs)
            total_manday = sum(float(a.get("actual_manpower", 0)) for a in allocs)
            working_days = len([a for a in allocs if float(a.get("actual_manpower", 0)) > 0])

            remaining = max(qty - total_qty_done, 0)
            progress = calculate_progress_pct(qty, total_qty_done)
            productivity = calculate_productivity_rate(total_qty_done, total_manday)

            # Average daily manpower (last 2 weeks)
            avg_mp = self._avg_recent_manpower(allocs, _ROLLING_WINDOW)
            est_days = calculate_remaining_days(remaining, productivity, avg_mp)

            if est_days >= 999:
                # Use project end_date if available, else fallback to 90 days
                project_end = project.get("end_date")
                if project_end:
                    predicted_end = project_end if isinstance(project_end, str) else project_end.isoformat()
                else:
                    predicted_end = (today + timedelta(days=90)).isoformat()
                risk_level = "high"
                recommendation = "Yeterli veri yok, tahmin yapılamıyor"
            else:
                predicted_end = (today + timedelta(days=est_days)).isoformat()
                # Risk based on baseline comparison
                project_end = project.get("end_date")
                if project_end and predicted_end > project_end:
                    risk_level = "high"
                    recommendation = f"Planlanan bitişten {est_days} gün geç kalma riski"
                elif progress < 30 and working_days > 5:
                    risk_level = "medium"
                    recommendation = "İlerleme yavaş, kaynak artırımı değerlendirilmeli"
                else:
                    risk_level = "low"
                    recommendation = "Plan dahilinde ilerliyor"

            predicted_total_manday = total_manday + (avg_mp * est_days if est_days < 999 else 0)

            forecasts.append({
                "wbs_code": wbs["wbs_code"],
                "wbs_name": wbs["wbs_name"],
                "current_progress": progress,
                "predicted_end_date": predicted_end,
                "predicted_total_manday": round(predicted_total_manday, 1),
                "risk_level": risk_level,
                "recommendation": recommendation,
            })

        # Overall summary
        total_items = len(forecasts)
        high_risk = sum(1 for f in forecasts if f["risk_level"] == "high")
        med_risk = sum(1 for f in forecasts if f["risk_level"] == "medium")
        avg_progress = sum(f["current_progress"] for f in forecasts) / total_items if total_items > 0 else 0

        overall_summary = (
            f"Genel ilerleme %{avg_progress:.1f}. "
            f"{high_risk} kalem yüksek risk, {med_risk} kalem orta risk altında."
        )

        result = {
            "forecasts": forecasts,
            "overall_summary": overall_summary,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

        # Store forecast results in ai_forecasts table
        self._store_forecasts(project_id, forecasts)

        return result

    def _store_forecasts(self, project_id: UUID, forecasts: list[dict]) -> None:
        """Save forecast results to ai_forecasts table."""
        db = get_db()
        try:
            # Get WBS ID mapping
            wbs_map = {}
            wbs_items = db.table("wbs_items").select("id, wbs_code").eq("project_id", str(project_id)).execute()
            for w in wbs_items.data:
                wbs_map[w["wbs_code"]] = w["id"]

            for f in forecasts:
                wbs_id = wbs_map.get(f["wbs_code"])
                if not wbs_id:
                    continue
                db.table("ai_forecasts").insert({
                    "project_id": str(project_id),
                    "wbs_item_id": wbs_id,
                    "predicted_end_date": f["predicted_end_date"],
                    "predicted_manday": f["predicted_total_manday"],
                    "confidence": 0.7,
                    "reasoning": f["recommendation"],
                    "parameters": {"risk_level": f["risk_level"]},
                }).execute()
        except Exception as e:
            logger.error("Failed to store forecast: %s", e)

    @staticmethod
    def _avg_recent_manpower(allocs: list[dict], window_days: int = 14) -> float:
        """Average daily manpower over the last N days."""
        if not allocs:
            return 0.0
        cutoff = date.today() - timedelta(days=window_days)
        recent = [
            a for a in allocs
            if date.fromisoformat(str(a["date"])) >= cutoff
            and float(a.get("actual_manpower", 0)) > 0
        ]
        if not recent:
            # Fallback to all-time
            all_with_mp = [a for a in allocs if float(a.get("actual_manpower", 0)) > 0]
            if not all_with_mp:
                return 0.0
            return sum(float(a["actual_manpower"]) for a in all_with_mp) / len(all_with_mp)
        return sum(float(a["actual_manpower"]) for a in recent) / len(recent)
