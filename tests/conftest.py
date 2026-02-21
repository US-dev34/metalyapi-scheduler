"""
Shared test configuration for MetalYapi Scheduling Platform.
"""
import pytest


@pytest.fixture
def sample_project():
    """Test project fixture."""
    return {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "E2NS Facade Project",
        "code": "E2NS-001",
        "start_date": "2026-02-17",
        "end_date": "2026-06-30",
        "status": "active",
    }


@pytest.fixture
def sample_wbs_items():
    """Test WBS items fixture."""
    return [
        {"id": "10000000-0000-0000-0000-000000000001", "wbs_code": "CW-01", "wbs_name": "Curtain Wall Tip-1", "qty": 100, "unit": "m2", "level": 2},
        {"id": "10000000-0000-0000-0000-000000000002", "wbs_code": "CW-02", "wbs_name": "Curtain Wall Tip-2", "qty": 150, "unit": "m2", "level": 2},
        {"id": "10000000-0000-0000-0000-000000000003", "wbs_code": "CW-03", "wbs_name": "Curtain Wall Tip-3", "qty": 80, "unit": "m2", "level": 2},
        {"id": "10000000-0000-0000-0000-000000000004", "wbs_code": "DR-01", "wbs_name": "Door Type-A", "qty": 50, "unit": "pcs", "level": 2},
        {"id": "10000000-0000-0000-0000-000000000005", "wbs_code": "DR-02", "wbs_name": "Door Type-B", "qty": 30, "unit": "pcs", "level": 2},
        {"id": "10000000-0000-0000-0000-000000000006", "wbs_code": "GL-01", "wbs_name": "Glazing Panel", "qty": 200, "unit": "m2", "level": 2},
    ]


@pytest.fixture
def sample_allocations():
    """Test allocations fixture."""
    return [
        {"wbs_item_id": "10000000-0000-0000-0000-000000000001", "date": "2026-02-17", "actual_manpower": 6, "qty_done": 4},
        {"wbs_item_id": "10000000-0000-0000-0000-000000000001", "date": "2026-02-18", "actual_manpower": 5, "qty_done": 3.5},
        {"wbs_item_id": "10000000-0000-0000-0000-000000000001", "date": "2026-02-19", "actual_manpower": 4, "qty_done": 3},
    ]
