"""Projects CRUD router.

Endpoints
---------
GET    /api/v1/projects/          List all projects
POST   /api/v1/projects/          Create a new project
GET    /api/v1/projects/{id}      Retrieve a single project
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from backend.models.schemas import ErrorResponse, ProjectCreate, ProjectResponse
from backend.services.schedule_service import ScheduleService

router = APIRouter(prefix="/api/v1/projects", tags=["projects"])
service = ScheduleService()


@router.get("/", response_model=list[ProjectResponse])
async def list_projects():
    """Return every project."""
    return service.list_projects()


@router.post(
    "/",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    responses={422: {"model": ErrorResponse}},
)
async def create_project(payload: ProjectCreate):
    """Create a project and return the newly created record."""
    try:
        return service.create_project(payload)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": str(exc), "code": "PRJ_DUPLICATE"},
        ) from exc


@router.get(
    "/{project_id}",
    response_model=ProjectResponse,
    responses={404: {"model": ErrorResponse}},
)
async def get_project(project_id: UUID):
    """Retrieve a single project by its UUID."""
    project = service.get_project(project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": f"Project {project_id} not found", "code": "PRJ_NOT_FOUND"},
        )
    return project
