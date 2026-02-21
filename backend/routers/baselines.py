"""Baselines router — snapshot management.

Endpoints
---------
GET    /api/v1/baselines/{project_id}/             List baselines
POST   /api/v1/baselines/{project_id}/             Create baseline + snapshot
GET    /api/v1/baselines/{project_id}/{version}    Specific baseline
POST   /api/v1/baselines/{project_id}/rebaseline   Re-baseline
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from backend.models.schemas import BaselineCreate, BaselineResponse, ErrorResponse
from backend.services.baseline_service import BaselineService

router = APIRouter(prefix="/api/v1/baselines", tags=["baselines"])
service = BaselineService()


@router.get("/{project_id}/", response_model=list[BaselineResponse])
async def list_baselines(project_id: UUID):
    """Return all baselines for a project."""
    return service.list_baselines(project_id)


@router.post(
    "/{project_id}/",
    response_model=BaselineResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_baseline(project_id: UUID, payload: BaselineCreate):
    """Create a new baseline snapshot of current allocations."""
    try:
        return service.create_baseline(project_id, payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(exc), "code": "BSL_VERSION_CONFLICT"},
        ) from exc


@router.get(
    "/{project_id}/{version}",
    responses={404: {"model": ErrorResponse}},
)
async def get_baseline(project_id: UUID, version: int):
    """Get a specific baseline version with snapshots."""
    result = service.get_baseline(project_id, version)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": f"Baseline v{version} not found", "code": "BSL_NO_ACTIVE"},
        )
    return result


@router.post("/{project_id}/rebaseline", response_model=BaselineResponse)
async def rebaseline(project_id: UUID, payload: BaselineCreate):
    """Archive old baseline and create a new one."""
    return service.rebaseline(project_id, payload)
