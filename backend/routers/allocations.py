"""Allocations router — daily matrix CRUD.

Endpoints
---------
GET    /api/v1/allocations/{project_id}/daily     Daily matrix (IC-002 DailyMatrixResponse)
PUT    /api/v1/allocations/{project_id}/daily     Batch update cells
GET    /api/v1/allocations/{project_id}/weekly    Weekly aggregated
GET    /api/v1/allocations/{project_id}/summary   Summary with Gantt data
"""

from datetime import date
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from backend.models.schemas import (
    AllocationBatchResponse,
    AllocationBatchUpdate,
    DailyMatrixResponse,
    ErrorResponse,
)
from backend.services.schedule_service import ScheduleService

router = APIRouter(prefix="/api/v1/allocations", tags=["allocations"])
service = ScheduleService()


@router.get(
    "/{project_id}/daily",
    response_model=DailyMatrixResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_daily_matrix(
    project_id: UUID,
    from_date: date = Query(..., alias="from", description="Start date inclusive"),
    to_date: date = Query(..., alias="to", description="End date inclusive"),
):
    """Return the full daily allocation matrix for the requested date window.

    Response matches IC-002 DailyMatrixResponse: wbs_items, date_range, matrix, totals.
    """
    try:
        return service.get_daily_matrix(project_id, from_date, to_date)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": str(exc), "code": "PRJ_NOT_FOUND"},
        ) from exc


@router.put(
    "/{project_id}/daily",
    response_model=AllocationBatchResponse,
    responses={422: {"model": ErrorResponse}},
)
async def batch_update_daily(project_id: UUID, payload: AllocationBatchUpdate):
    """Batch upsert allocation cells from grid or chat.

    Body: { updates: [{wbs_id, date, actual_manpower, qty_done}], source: "grid"|"chat" }
    """
    try:
        return service.batch_update_allocations(project_id, payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(exc), "code": "ALC_NEGATIVE_VALUE"},
        ) from exc


@router.get("/{project_id}/weekly")
async def get_weekly(project_id: UUID):
    """Weekly aggregated view (Phase 2)."""
    return service.get_weekly_data(project_id)


@router.get("/{project_id}/summary")
async def get_summary(project_id: UUID):
    """Summary with Gantt data (Phase 2)."""
    return service.get_summary_data(project_id)
