"""AI router — forecast, optimization, daily digest, report.

POST   /api/v1/ai/{project_id}/forecast        Generate forecast
POST   /api/v1/ai/{project_id}/optimize        Resource optimization suggestions
POST   /api/v1/ai/{project_id}/daily-digest    Daily activity digest
GET    /api/v1/ai/{project_id}/report          AI weekly report
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException

from backend.models.schemas import ForecastResponse, ErrorResponse
from backend.services.ai.forecast import ForecastEngine
from backend.services.ai.optimizer import ScheduleOptimizer
from backend.services.ai.report_gen import ReportGenerator
from backend.services.ai.daily_digest import DailyDigestEngine

router = APIRouter(prefix="/api/v1/ai", tags=["ai"])
forecast_engine = ForecastEngine()
optimizer = ScheduleOptimizer()
report_gen = ReportGenerator()
digest_engine = DailyDigestEngine()


@router.post(
    "/{project_id}/forecast",
    response_model=ForecastResponse,
    responses={503: {"model": ErrorResponse}},
)
async def generate_forecast(project_id: UUID):
    """Generate AI-powered forecast for all WBS items."""
    try:
        return await forecast_engine.generate_forecast(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail={"error": str(exc), "code": "PRJ_NOT_FOUND"}) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail={"error": f"Forecast generation failed: {str(exc)}", "code": "AI_UNAVAILABLE"},
        ) from exc


@router.post("/{project_id}/optimize")
async def optimize(project_id: UUID):
    """Resource optimization suggestions."""
    try:
        suggestions = await optimizer.optimize(project_id)
        return {"suggestions": suggestions, "total": len(suggestions)}
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Optimization failed: {exc}") from exc


@router.post("/{project_id}/daily-digest")
async def daily_digest(project_id: UUID):
    """Generate daily activity digest."""
    try:
        return await digest_engine.generate_digest(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Digest failed: {exc}") from exc


@router.get("/{project_id}/report")
async def weekly_report(project_id: UUID):
    """AI-generated narrative report."""
    try:
        return await report_gen.generate(project_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Report generation failed: {exc}") from exc
