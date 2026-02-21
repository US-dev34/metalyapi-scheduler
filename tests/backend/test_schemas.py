"""Tests for Pydantic schema validation."""

import pytest
from datetime import date, datetime
from backend.models.schemas import (
    ProjectCreate,
    WBSItemCreate,
    AllocationCell,
    AllocationBatchUpdate,
    CellData,
    WBSProgressResponse,
    DailyMatrixResponse,
    ChatParseResponse,
    ParsedAction,
    ForecastItem,
    ForecastResponse,
    BaselineCreate,
    ErrorResponse,
)


class TestProjectCreate:
    def test_valid(self):
        p = ProjectCreate(name="Test", code="T-001", start_date=date(2026, 2, 17))
        assert p.name == "Test"
        assert p.code == "T-001"

    def test_missing_required(self):
        with pytest.raises(Exception):
            ProjectCreate(name="Test")

    def test_optional_end_date(self):
        p = ProjectCreate(name="Test", code="T-001", start_date=date(2026, 2, 17))
        assert p.end_date is None


class TestWBSItemCreate:
    def test_valid(self):
        w = WBSItemCreate(wbs_code="CW-01", wbs_name="Curtain Wall")
        assert w.qty == 0.0
        assert w.unit == "pcs"
        assert w.is_summary is False

    def test_custom_values(self):
        w = WBSItemCreate(wbs_code="DR-01", wbs_name="Door", qty=50, unit="pcs", level=2)
        assert w.qty == 50
        assert w.level == 2


class TestAllocationBatchUpdate:
    def test_valid_batch(self):
        batch = AllocationBatchUpdate(
            updates=[
                AllocationCell(wbs_id="uuid-1", date=date(2026, 2, 17), actual_manpower=5, qty_done=3),
                AllocationCell(wbs_id="uuid-2", date=date(2026, 2, 17), actual_manpower=7),
            ],
            source="grid",
        )
        assert len(batch.updates) == 2
        assert batch.source == "grid"

    def test_chat_source(self):
        batch = AllocationBatchUpdate(
            updates=[AllocationCell(wbs_id="uuid-1", date=date(2026, 2, 17))],
            source="chat",
        )
        assert batch.source == "chat"


class TestDailyMatrixResponse:
    def test_valid_structure(self):
        resp = DailyMatrixResponse(
            wbs_items=[
                WBSProgressResponse(
                    id="uuid-1", wbs_code="CW-01", wbs_name="Curtain Wall",
                    qty=100, done=35, remaining=65, progress_pct=35.0,
                    total_actual_manday=42, working_days=8, productivity_rate=0.833,
                )
            ],
            date_range=["2026-02-17", "2026-02-18"],
            matrix={
                "uuid-1": {
                    "2026-02-17": CellData(planned=5, actual=6, qty_done=4, is_future=False),
                    "2026-02-18": CellData(planned=5, actual=0, qty_done=0, is_future=True),
                }
            },
            totals={
                "2026-02-17": {"planned": 5, "actual": 6},
                "2026-02-18": {"planned": 5, "actual": 0},
            },
        )
        assert len(resp.wbs_items) == 1
        assert resp.matrix["uuid-1"]["2026-02-17"].actual == 6
        assert resp.totals["2026-02-17"]["planned"] == 5


class TestChatParseResponse:
    def test_valid(self):
        resp = ChatParseResponse(
            message_id="msg-001",
            actions=[
                ParsedAction(wbs_code="CW-01", date=date(2026, 2, 19), actual_manpower=5, qty_done=3),
            ],
            summary="1 WBS güncellendi",
            confidence=0.95,
        )
        assert resp.applied is False
        assert len(resp.actions) == 1
        assert resp.actions[0].wbs_code == "CW-01"


class TestForecastResponse:
    def test_valid(self):
        resp = ForecastResponse(
            forecasts=[
                ForecastItem(
                    wbs_code="CW-01", wbs_name="Curtain Wall",
                    current_progress=35.0, predicted_end_date=date(2026, 4, 15),
                    predicted_total_manday=120, risk_level="medium",
                    recommendation="KW12'den itibaren 2 ek adam gerekli",
                )
            ],
            overall_summary="Genel ilerleme %35",
            generated_at=datetime(2026, 2, 20, 14, 30),
        )
        assert resp.forecasts[0].risk_level == "medium"


class TestErrorResponse:
    def test_valid(self):
        err = ErrorResponse(error="Not found", code="PRJ_NOT_FOUND")
        assert err.details is None

    def test_with_details(self):
        err = ErrorResponse(error="Invalid", code="ALC_NEGATIVE_VALUE", details={"field": "manpower"})
        assert err.details["field"] == "manpower"
