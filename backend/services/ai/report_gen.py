"""Report generator -- produces narrative progress reports via Claude.

Gathers project metrics, feeds them to the LLM, and returns a structured
human-readable report suitable for distribution to stakeholders.
"""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import Any
from uuid import UUID

import anthropic

from backend.config import settings
from backend.models.db import get_db
from backend.services.compute_engine import ComputeEngine

logger = logging.getLogger(__name__)
compute = ComputeEngine()

_REPORT_SYSTEM_PROMPT = """\
You are a professional construction project manager writing a progress report.

Given the project data below, produce a clear, concise report with:

1. **Executive Summary** (2-3 sentences)
2. **Overall Progress** (percentage, SPI)
3. **Key Highlights** (items ahead of schedule)
4. **Risk Areas** (items behind schedule, with SPI < 0.9)
5. **Recommended Actions** (prioritised list)
6. **Next Week Outlook**

Use professional but accessible language.  Include specific numbers.
Format as Markdown.
"""


class ReportGenerator:
    """Generates narrative reports powered by Claude."""

    def __init__(self) -> None:
        self._client: anthropic.Anthropic | None = None

    @property
    def client(self) -> anthropic.Anthropic:
        """Lazily initialise the Anthropic client."""
        if self._client is None:
            self._client = anthropic.Anthropic(api_key=settings.claude_api_key)
        return self._client

    async def generate(self, project_id: UUID) -> dict[str, Any]:
        """Collect project metrics and ask Claude to write a report.

        Args:
            project_id: The project to report on.

        Returns:
            A dict containing ``generated_at``, ``markdown``, and ``metrics``.
        """
        metrics = self._gather_metrics(project_id)
        markdown = self._generate_narrative(metrics)

        return {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "markdown": markdown,
            "metrics": metrics,
        }

    # ------------------------------------------------------------------
    # Data gathering
    # ------------------------------------------------------------------

    def _gather_metrics(self, project_id: UUID) -> dict[str, Any]:
        """Pull WBS + allocation data and compute aggregate KPIs."""
        db = get_db()

        project_resp = (
            db.table("projects")
            .select("*")
            .eq("id", str(project_id))
            .execute()
        )
        project = project_resp.data[0] if project_resp.data else {}

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

        # Aggregate per WBS
        actual_map: dict[str, float] = {}
        for a in allocations:
            wid = a["wbs_item_id"]
            actual_map[wid] = actual_map.get(wid, 0.0) + float(a.get("qty_done", 0))

        item_metrics: list[dict[str, Any]] = []
        for item in wbs_items:
            wid = item["id"]
            planned = float(item.get("qty", 0))
            actual = actual_map.get(wid, 0.0)
            pct = compute.calculate_progress_pct(planned, actual)
            spi = compute.schedule_performance_index(planned, actual)
            item_metrics.append(
                {
                    "code": item["wbs_code"],
                    "name": item["wbs_name"],
                    "planned_qty": planned,
                    "actual_qty": actual,
                    "progress_pct": round(pct, 1),
                    "spi": round(spi, 2),
                }
            )

        overall_progress = compute.weighted_progress(
            [{"qty": m["planned_qty"], "done": m["actual_qty"]} for m in item_metrics]
        )

        return {
            "project_name": project.get("name", "Unknown"),
            "report_date": date.today().isoformat(),
            "overall_progress_pct": round(overall_progress, 1),
            "total_wbs_items": len(wbs_items),
            "items": item_metrics,
        }

    # ------------------------------------------------------------------
    # Narrative generation
    # ------------------------------------------------------------------

    def _generate_narrative(self, metrics: dict[str, Any]) -> str:
        """Send metrics to Claude and return a Markdown report."""
        user_content = (
            f"Generate a progress report for the following project data:\n\n"
            f"```json\n{json.dumps(metrics, indent=2, default=str)}\n```"
        )

        try:
            message = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=2048,
                system=_REPORT_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_content}],
            )
            return message.content[0].text  # type: ignore[union-attr]
        except anthropic.APIError as exc:
            logger.error("Report generation failed: %s", exc)
            return self._fallback_report(metrics)

    @staticmethod
    def _fallback_report(metrics: dict[str, Any]) -> str:
        """Produce a basic Markdown report without the LLM."""
        lines = [
            f"# Progress Report -- {metrics.get('project_name', 'Unknown')}",
            f"**Date:** {metrics.get('report_date', 'N/A')}",
            "",
            "## Overall Progress",
            f"- **Completion:** {metrics.get('overall_progress_pct', 0)}%",
            f"- **WBS items tracked:** {metrics.get('total_wbs_items', 0)}",
            "",
            "## Per-Item Summary",
            "| Code | Name | Progress | SPI |",
            "|------|------|----------|-----|",
        ]
        for item in metrics.get("items", []):
            lines.append(
                f"| {item['code']} | {item['name']} | {item['progress_pct']}% | {item['spi']} |"
            )
        lines.append("")
        lines.append("---")
        lines.append("*Report generated automatically (LLM unavailable).*")
        return "\n".join(lines)
