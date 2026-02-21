"""PDF report generator using xhtml2pdf.

Generates HTML tables styled for A3 landscape, then converts to PDF.
"""

from __future__ import annotations

import io
import logging
from datetime import date, datetime, timezone
from typing import Any, BinaryIO
from uuid import UUID

from backend.models.db import get_db

logger = logging.getLogger(__name__)


class PDFGenerator:
    """Generates PDF reports from project data."""

    def generate_daily_report(self, project_id: UUID) -> tuple[BinaryIO, str]:
        """Generate a daily allocation report as PDF.

        Returns (stream, filename).
        """
        db = get_db()

        project_resp = db.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_resp.data:
            raise ValueError(f"Project {project_id} not found")
        project = project_resp.data[0]

        wbs_items = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
            .data
        )

        wbs_ids = [w["id"] for w in wbs_items]
        allocations = []
        if wbs_ids:
            allocations = (
                db.table("daily_allocations")
                .select("*")
                .in_("wbs_item_id", wbs_ids)
                .order("date")
                .execute()
                .data
            )

        # Group allocations by wbs_item_id
        alloc_by_wbs: dict[str, list[dict]] = {}
        all_dates: set[str] = set()
        for a in allocations:
            wbs_id = a["wbs_item_id"]
            alloc_by_wbs.setdefault(wbs_id, []).append(a)
            all_dates.add(a["date"])

        sorted_dates = sorted(all_dates)
        # Limit to most recent 14 days for readability
        if len(sorted_dates) > 14:
            sorted_dates = sorted_dates[-14:]

        html = self._build_daily_html(project, wbs_items, alloc_by_wbs, sorted_dates)
        pdf_bytes = self._html_to_pdf(html)

        stream = io.BytesIO(pdf_bytes)
        safe_name = project["name"].replace(" ", "_")[:40]
        filename = f"{safe_name}_daily_report_{date.today().isoformat()}.pdf"
        return stream, filename

    def generate_progress_report(self, project_id: UUID) -> tuple[BinaryIO, str]:
        """Generate a progress summary report as PDF.

        Includes KPIs, risk items, and progress overview.
        """
        db = get_db()

        project_resp = db.table("projects").select("*").eq("id", str(project_id)).execute()
        if not project_resp.data:
            raise ValueError(f"Project {project_id} not found")
        project = project_resp.data[0]

        # Get progress view data
        try:
            progress_data = db.table("vw_wbs_progress").select("*").eq("project_id", str(project_id)).execute().data
        except Exception:
            progress_data = []

        # Get WBS items with allocation summaries
        wbs_items = (
            db.table("wbs_items")
            .select("*")
            .eq("project_id", str(project_id))
            .order("sort_order")
            .execute()
            .data
        )

        wbs_ids = [w["id"] for w in wbs_items]
        allocations = []
        if wbs_ids:
            allocations = (
                db.table("daily_allocations")
                .select("wbs_item_id, actual_manpower, qty_done")
                .in_("wbs_item_id", wbs_ids)
                .execute()
                .data
            )

        # Compute per-WBS summaries
        wbs_summary = []
        total_qty = 0.0
        total_done = 0.0
        total_mandays = 0.0

        alloc_by_wbs: dict[str, list[dict]] = {}
        for a in allocations:
            alloc_by_wbs.setdefault(a["wbs_item_id"], []).append(a)

        for wbs in wbs_items:
            if wbs.get("is_summary"):
                continue
            qty = float(wbs.get("qty", 0))
            wbs_allocs = alloc_by_wbs.get(wbs["id"], [])
            done = sum(float(a.get("qty_done", 0)) for a in wbs_allocs)
            mandays = sum(float(a.get("actual_manpower", 0)) for a in wbs_allocs)
            progress = min(100, (done / qty * 100)) if qty > 0 else 0

            total_qty += qty
            total_done += done
            total_mandays += mandays

            wbs_summary.append({
                "code": wbs["wbs_code"],
                "name": wbs["wbs_name"],
                "qty": qty,
                "done": done,
                "unit": wbs.get("unit", ""),
                "progress": round(progress, 1),
                "mandays": round(mandays, 1),
                "risk": "high" if progress < 20 and mandays > 10 else ("medium" if progress < 50 else "low"),
            })

        overall_progress = min(100, (total_done / total_qty * 100)) if total_qty > 0 else 0

        # Sort for top risk and top progress
        risk_items = sorted([w for w in wbs_summary if w["risk"] in ("high", "medium")], key=lambda x: x["progress"])[:5]
        top_items = sorted(wbs_summary, key=lambda x: -x["progress"])[:5]

        html = self._build_progress_html(
            project, wbs_summary, overall_progress, total_mandays, risk_items, top_items,
        )
        pdf_bytes = self._html_to_pdf(html)

        stream = io.BytesIO(pdf_bytes)
        safe_name = project["name"].replace(" ", "_")[:40]
        filename = f"{safe_name}_progress_report_{date.today().isoformat()}.pdf"
        return stream, filename

    # ------------------------------------------------------------------
    # HTML builders
    # ------------------------------------------------------------------

    @staticmethod
    def _build_daily_html(
        project: dict,
        wbs_items: list[dict],
        alloc_by_wbs: dict[str, list[dict]],
        dates: list[str],
    ) -> str:
        """Build HTML for the daily allocation table."""
        date_headers = "".join(f'<th class="date-col">{d[-5:]}</th>' for d in dates)

        rows_html = ""
        for wbs in wbs_items:
            wbs_id = wbs["id"]
            is_summary = wbs.get("is_summary", False)
            row_class = "summary-row" if is_summary else ""
            allocs = {a["date"]: a for a in alloc_by_wbs.get(wbs_id, [])}

            cells = ""
            for d in dates:
                a = allocs.get(d, {})
                mp = float(a.get("actual_manpower", 0))
                cells += f'<td class="num">{mp if mp > 0 else ""}</td>'

            rows_html += f"""
            <tr class="{row_class}">
                <td class="code">{wbs["wbs_code"]}</td>
                <td class="name">{wbs["wbs_name"]}</td>
                {cells}
            </tr>"""

        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{ size: A3 landscape; margin: 1cm; }}
body {{ font-family: Arial, sans-serif; font-size: 9px; }}
h1 {{ font-size: 16px; margin-bottom: 4px; }}
h2 {{ font-size: 12px; color: #555; margin-top: 0; }}
table {{ border-collapse: collapse; width: 100%; }}
th, td {{ border: 1px solid #ccc; padding: 3px 5px; }}
th {{ background: #2563eb; color: white; font-size: 8px; text-align: center; }}
.code {{ font-weight: bold; white-space: nowrap; }}
.name {{ max-width: 200px; overflow: hidden; text-overflow: ellipsis; }}
.num {{ text-align: center; font-size: 8px; }}
.summary-row {{ background: #f0f4ff; font-weight: bold; }}
.date-col {{ width: 45px; }}
.footer {{ margin-top: 10px; font-size: 8px; color: #888; }}
</style>
</head>
<body>
<h1>{project["name"]} — Daily Allocation Report</h1>
<h2>Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</h2>
<table>
<thead>
<tr>
    <th style="width:80px">WBS Code</th>
    <th style="width:200px">WBS Name</th>
    {date_headers}
</tr>
</thead>
<tbody>
{rows_html}
</tbody>
</table>
<div class="footer">MetalYapi Construction Scheduling Platform</div>
</body>
</html>"""

    @staticmethod
    def _build_progress_html(
        project: dict,
        wbs_summary: list[dict],
        overall_progress: float,
        total_mandays: float,
        risk_items: list[dict],
        top_items: list[dict],
    ) -> str:
        """Build HTML for the progress summary report."""
        # KPI section
        total_items = len(wbs_summary)
        high_risk = sum(1 for w in wbs_summary if w["risk"] == "high")
        med_risk = sum(1 for w in wbs_summary if w["risk"] == "medium")

        # Risk table
        risk_rows = ""
        for r in risk_items:
            color = "#dc2626" if r["risk"] == "high" else "#f59e0b"
            risk_rows += f"""<tr>
                <td>{r["code"]}</td><td>{r["name"]}</td>
                <td class="num">{r["progress"]}%</td>
                <td style="color:{color};font-weight:bold">{r["risk"].upper()}</td>
            </tr>"""

        # Top progress table
        top_rows = ""
        for t in top_items:
            top_rows += f"""<tr>
                <td>{t["code"]}</td><td>{t["name"]}</td>
                <td class="num">{t["progress"]}%</td>
                <td class="num">{t["mandays"]}</td>
            </tr>"""

        # Full WBS table
        wbs_rows = ""
        for w in wbs_summary:
            bar_width = min(100, w["progress"])
            bar_color = "#dc2626" if w["risk"] == "high" else ("#f59e0b" if w["risk"] == "medium" else "#22c55e")
            wbs_rows += f"""<tr>
                <td>{w["code"]}</td><td>{w["name"]}</td>
                <td class="num">{w["qty"]}</td>
                <td class="num">{w["done"]}</td>
                <td class="num">{w["unit"]}</td>
                <td>
                    <div style="background:#e5e7eb;border-radius:3px;height:12px;width:100px">
                        <div style="background:{bar_color};border-radius:3px;height:12px;width:{bar_width}px"></div>
                    </div>
                </td>
                <td class="num">{w["progress"]}%</td>
                <td class="num">{w["mandays"]}</td>
            </tr>"""

        return f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
@page {{ size: A3 landscape; margin: 1.5cm; }}
body {{ font-family: Arial, sans-serif; font-size: 10px; color: #333; }}
h1 {{ font-size: 18px; color: #1e40af; margin-bottom: 2px; }}
h2 {{ font-size: 14px; color: #555; margin-top: 0; }}
h3 {{ font-size: 13px; margin-top: 16px; margin-bottom: 6px; border-bottom: 2px solid #2563eb; padding-bottom: 3px; }}
.kpi-grid {{ display: flex; gap: 20px; margin: 12px 0; }}
.kpi-card {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px 20px; text-align: center; flex: 1; }}
.kpi-value {{ font-size: 24px; font-weight: bold; color: #1e40af; }}
.kpi-label {{ font-size: 10px; color: #64748b; margin-top: 4px; }}
table {{ border-collapse: collapse; width: 100%; margin-bottom: 12px; }}
th, td {{ border: 1px solid #ddd; padding: 4px 8px; }}
th {{ background: #2563eb; color: white; font-size: 9px; }}
.num {{ text-align: center; }}
.footer {{ margin-top: 16px; font-size: 8px; color: #94a3b8; text-align: center; }}
</style>
</head>
<body>
<h1>{project["name"]} — Progress Report</h1>
<h2>Generated: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}</h2>

<div class="kpi-grid">
    <div class="kpi-card">
        <div class="kpi-value">{overall_progress:.1f}%</div>
        <div class="kpi-label">Overall Progress</div>
    </div>
    <div class="kpi-card">
        <div class="kpi-value">{total_items}</div>
        <div class="kpi-label">WBS Items</div>
    </div>
    <div class="kpi-card">
        <div class="kpi-value">{total_mandays:.0f}</div>
        <div class="kpi-label">Total Man-Days</div>
    </div>
    <div class="kpi-card">
        <div class="kpi-value" style="color:#dc2626">{high_risk}</div>
        <div class="kpi-label">High Risk Items</div>
    </div>
    <div class="kpi-card">
        <div class="kpi-value" style="color:#f59e0b">{med_risk}</div>
        <div class="kpi-label">Medium Risk Items</div>
    </div>
</div>

<h3>Top Risk Items</h3>
<table>
<thead><tr><th>Code</th><th>Name</th><th>Progress</th><th>Risk</th></tr></thead>
<tbody>{risk_rows if risk_rows else "<tr><td colspan='4'>No risk items</td></tr>"}</tbody>
</table>

<h3>Top Progress Items</h3>
<table>
<thead><tr><th>Code</th><th>Name</th><th>Progress</th><th>Man-Days</th></tr></thead>
<tbody>{top_rows}</tbody>
</table>

<h3>Full WBS Summary</h3>
<table>
<thead><tr><th>Code</th><th>Name</th><th>QTY</th><th>Done</th><th>Unit</th><th>Progress Bar</th><th>%</th><th>Man-Days</th></tr></thead>
<tbody>{wbs_rows}</tbody>
</table>

<div class="footer">MetalYapi Construction Scheduling Platform — Confidential</div>
</body>
</html>"""

    @staticmethod
    def _html_to_pdf(html: str) -> bytes:
        """Convert HTML string to PDF bytes.

        Uses xhtml2pdf if available, otherwise falls back to returning
        the HTML as a downloadable file with PDF-like content type.
        """
        try:
            from xhtml2pdf import pisa

            result_stream = io.BytesIO()
            pisa_status = pisa.CreatePDF(io.StringIO(html), dest=result_stream)
            if pisa_status.err:
                logger.warning("xhtml2pdf conversion had errors, returning HTML fallback")
                return html.encode("utf-8")
            return result_stream.getvalue()
        except ImportError:
            logger.warning("xhtml2pdf not installed, returning raw HTML as PDF fallback")
            return html.encode("utf-8")
