"""Pydantic V2 schemas aligned with ARCHITECTURE.md and INTERFACE_CONTRACTS.md.

All field names match the database schema exactly:
- DB columns: snake_case (wbs_code, actual_manpower, qty_done)
- API bodies: snake_case (same as DB)
"""

from __future__ import annotations

from datetime import date, datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# ---------------------------------------------------------------------------
# Projects
# ---------------------------------------------------------------------------

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    code: str = Field(..., min_length=1, max_length=50, description="Unique project code e.g. E2NS-001")
    start_date: date
    end_date: date | None = None

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    code: str
    start_date: date
    end_date: date | None = None
    status: str = "active"
    created_at: datetime
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# WBS Items
# ---------------------------------------------------------------------------

class WBSItemCreate(BaseModel):
    wbs_code: str = Field(..., min_length=1, max_length=50)
    wbs_name: str = Field(..., min_length=1, max_length=255)
    parent_id: UUID | None = None
    qty: float = Field(0.0, ge=0)
    unit: str = Field("pcs", max_length=20)
    sort_order: int = Field(0, ge=0)
    level: int = Field(0, ge=0)
    is_summary: bool = False
    building: str | None = None
    nta_ref: str | None = None
    status: str | None = None
    budget_eur: float = 0.0
    target_kw: str | None = None
    scope: str | None = None
    notes: str | None = None
    qty_ext: float = 0.0
    done_ext: float = 0.0
    rem_ext: float = 0.0
    qty_int: float = 0.0
    done_int: float = 0.0
    rem_int: float = 0.0
    tp_pos: str | None = None
    pkg: str | None = None
    manpower: float = 0.0
    duration: float = 0.0
    total_md: float = 0.0
    responsible: str | None = None
    pmt_ref: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WBSItemUpdate(BaseModel):
    wbs_code: str | None = None
    wbs_name: str | None = None
    parent_id: UUID | None = None
    qty: float | None = None
    unit: str | None = None
    sort_order: int | None = None
    level: int | None = None
    is_summary: bool | None = None
    building: str | None = None
    nta_ref: str | None = None
    status: str | None = None
    budget_eur: float | None = None
    target_kw: str | None = None
    scope: str | None = None
    notes: str | None = None
    qty_ext: float | None = None
    done_ext: float | None = None
    rem_ext: float | None = None
    qty_int: float | None = None
    done_int: float | None = None
    rem_int: float | None = None
    tp_pos: str | None = None
    pkg: str | None = None
    manpower: float | None = None
    duration: float | None = None
    total_md: float | None = None
    responsible: str | None = None
    pmt_ref: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WBSItemResponse(BaseModel):
    id: UUID
    project_id: UUID
    parent_id: UUID | None = None
    wbs_code: str
    wbs_name: str
    qty: float
    unit: str
    sort_order: int
    level: int
    is_summary: bool
    building: str | None = None
    nta_ref: str | None = None
    status: str | None = None
    budget_eur: float = 0.0
    target_kw: str | None = None
    scope: str | None = None
    notes: str | None = None
    qty_ext: float = 0.0
    done_ext: float = 0.0
    rem_ext: float = 0.0
    qty_int: float = 0.0
    done_int: float = 0.0
    rem_int: float = 0.0
    tp_pos: str | None = None
    pkg: str | None = None
    manpower: float = 0.0
    duration: float = 0.0
    total_md: float = 0.0
    responsible: str | None = None
    pmt_ref: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    children: list[WBSItemResponse] = []

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Allocations (Daily Matrix) — aligned with IC-002
# ---------------------------------------------------------------------------

class AllocationCell(BaseModel):
    """Single cell update from grid or chat."""
    wbs_id: str = Field(..., description="wbs_item UUID")
    date: date
    actual_manpower: float | None = Field(None, ge=0, le=200)
    qty_done: float | None = Field(None, ge=0)
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class AllocationBatchUpdate(BaseModel):
    """Batch update: UI sends dirty cells."""
    updates: list[AllocationCell] = Field(..., min_length=1)
    source: str = Field("grid", pattern="^(grid|chat)$")

    model_config = ConfigDict(from_attributes=True)


class AllocationBatchResponse(BaseModel):
    updated_count: int
    errors: list[dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)


class CellData(BaseModel):
    """Single cell in the matrix response."""
    planned: float = 0.0
    actual: float = 0.0
    qty_done: float = 0.0
    is_future: bool = False

    model_config = ConfigDict(from_attributes=True)


class WBSProgressResponse(BaseModel):
    """Aggregated progress for a single WBS item — from vw_wbs_progress."""
    id: str
    wbs_code: str
    wbs_name: str
    qty: float
    done: float
    remaining: float
    progress_pct: float = Field(0.0, ge=0, le=100)
    total_actual_manday: float = 0.0
    working_days: int = 0
    productivity_rate: float = 0.0

    model_config = ConfigDict(from_attributes=True)


class DailyMatrixResponse(BaseModel):
    """Full daily matrix response — IC-002 contract."""
    wbs_items: list[WBSProgressResponse]
    date_range: list[str]  # ["2026-02-17", "2026-02-18", ...]
    matrix: dict[str, dict[str, CellData]]  # {wbs_id: {date: CellData}}
    totals: dict[str, dict[str, float]]  # {date: {planned: N, actual: N}}

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Baselines
# ---------------------------------------------------------------------------

class BaselineCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    notes: str | None = None

    model_config = ConfigDict(from_attributes=True)


class BaselineResponse(BaseModel):
    id: UUID
    project_id: UUID
    version: int
    name: str
    approved_at: datetime | None = None
    is_active: bool = True
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Chat / AI — aligned with IC-003
# ---------------------------------------------------------------------------

class ChatMessageRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)

    model_config = ConfigDict(from_attributes=True)


class ParsedAction(BaseModel):
    wbs_code: str
    date: date
    actual_manpower: float
    qty_done: float
    note: str | None = None

    model_config = ConfigDict(from_attributes=True)


class ChatParseResponse(BaseModel):
    message_id: str
    actions: list[ParsedAction] = []
    summary: str = ""
    confidence: float = Field(0.0, ge=0, le=1)
    applied: bool = False

    model_config = ConfigDict(from_attributes=True)


class ForecastItem(BaseModel):
    wbs_code: str
    wbs_name: str
    current_progress: float
    predicted_end_date: date
    predicted_total_manday: float
    risk_level: str = Field("low", pattern="^(low|medium|high)$")
    recommendation: str = ""

    model_config = ConfigDict(from_attributes=True)


class ForecastResponse(BaseModel):
    forecasts: list[ForecastItem] = []
    overall_summary: str = ""
    generated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Error
# ---------------------------------------------------------------------------

class ErrorResponse(BaseModel):
    error: str
    code: str
    details: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)
