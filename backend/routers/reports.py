"""Reports router -- PDF and Excel export.

Endpoints
---------
GET    /api/v1/reports/{project_id}/pdf        PDF daily report
GET    /api/v1/reports/{project_id}/progress    PDF progress report
GET    /api/v1/reports/{project_id}/excel      Excel export (full)
GET    /api/v1/reports/{project_id}/sample     Download sample import template
"""

from uuid import UUID
from io import BytesIO

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import openpyxl

from backend.services.import_export import ImportExportService
from backend.services.pdf_generator import PDFGenerator
from backend.services.schedule_service import ScheduleService

router = APIRouter(prefix="/api/v1/reports", tags=["reports"])
service = ScheduleService()
ie_service = ImportExportService()
pdf_service = PDFGenerator()


@router.get("/{project_id}/pdf")
async def export_pdf(project_id: UUID):
    """Export daily allocation report as PDF."""
    try:
        stream, filename = pdf_service.generate_daily_report(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    media = "application/pdf"
    # If xhtml2pdf is not installed, HTML fallback uses text/html
    content = stream.read()
    stream.seek(0)
    if content[:5] == b"<!DOC":
        media = "text/html"
        filename = filename.replace(".pdf", ".html")

    return StreamingResponse(
        stream,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/progress")
async def export_progress_report(project_id: UUID):
    """Export progress summary report as PDF."""
    try:
        stream, filename = pdf_service.generate_progress_report(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    media = "application/pdf"
    content = stream.read()
    stream.seek(0)
    if content[:5] == b"<!DOC":
        media = "text/html"
        filename = filename.replace(".pdf", ".html")

    return StreamingResponse(
        stream,
        media_type=media,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/excel")
async def export_excel(project_id: UUID):
    """Export grid data as Excel (WBS + allocations)."""
    try:
        stream, filename = ie_service.export_to_excel(project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        stream,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{project_id}/sample")
async def download_sample(project_id: UUID):
    """Download a sample WBS import template."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "WBS Import Template"
    headers = ["wbs_code", "wbs_name", "qty", "unit", "parent_code", "level", "is_summary"]
    ws.append(headers)
    # Sample rows
    ws.append(["CW", "Curtain Wall", 0, "m2", "", 0, True])
    ws.append(["CW-01", "Curtain Wall Type 1", 100, "m2", "CW", 2, False])
    ws.append(["DR", "Doors", 0, "pcs", "", 0, True])
    ws.append(["DR-01", "Door Type A", 50, "pcs", "DR", 2, False])

    for col in ws.columns:
        max_len = max(len(str(cell.value or "")) for cell in col)
        ws.column_dimensions[col[0].column_letter].width = max_len + 2

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="WBS_Import_Template.xlsx"'},
    )
