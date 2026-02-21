"""Compute engine — pure arithmetic for schedule metrics.

Formulas match ARCHITECTURE.md Section 6.3:
- productivity_rate = total_qty_done / total_actual_manday
- remaining_qty = qty - done
- remaining_days = remaining_qty / (productivity_rate * avg_daily_manpower)
- progress_pct = done / qty * 100
- variance = actual - planned

All functions are stateless — no DB access.
"""

from __future__ import annotations

import math
from datetime import date, timedelta


def calculate_productivity_rate(total_qty_done: float, total_actual_manday: float) -> float:
    """Productivity rate = total_qty_done / total_actual_manday."""
    if total_actual_manday <= 0:
        return 0.0
    return round(total_qty_done / total_actual_manday, 3)


def calculate_remaining_days(
    remaining_qty: float,
    productivity_rate: float,
    avg_daily_manpower: float,
) -> int:
    """remaining_days = remaining_qty / (productivity_rate * avg_daily_manpower).

    Returns 999 when estimation is impossible.
    """
    if productivity_rate <= 0 or avg_daily_manpower <= 0:
        return 999
    return math.ceil(remaining_qty / (productivity_rate * avg_daily_manpower))


def calculate_progress_pct(qty: float, done: float) -> float:
    """progress = done / qty * 100, clamped to [0, 100]."""
    if qty <= 0:
        return 0.0 if done <= 0 else 100.0
    return round(min(done / qty * 100, 100.0), 1)


def calculate_variance(actual: float, planned: float) -> float:
    """variance = actual - planned. Positive = over, negative = under."""
    return round(actual - planned, 2)


def calculate_remaining_qty(qty: float, done: float) -> float:
    """remaining = qty - done, minimum 0."""
    return max(round(qty - done, 3), 0.0)


def estimate_completion_date(
    remaining_qty: float,
    productivity_rate: float,
    avg_daily_manpower: float,
    from_date: date | None = None,
) -> date | None:
    """Project completion date from current rate. Returns None when rate is zero."""
    if remaining_qty <= 0:
        return from_date or date.today()
    if productivity_rate <= 0 or avg_daily_manpower <= 0:
        return None
    days = calculate_remaining_days(remaining_qty, productivity_rate, avg_daily_manpower)
    if days >= 999:
        return None
    base = from_date or date.today()
    return base + timedelta(days=days)


def schedule_performance_index(planned: float, actual: float) -> float:
    """SPI = actual / planned. >1 = ahead, <1 = behind."""
    if planned <= 0:
        return 0.0
    return round(actual / planned, 3)


def weighted_progress(items: list[dict]) -> float:
    """Weighted overall progress. Items: [{qty, done}]."""
    total_qty = sum(float(i.get("qty", 0)) for i in items)
    if total_qty <= 0:
        return 0.0
    weighted_sum = sum(
        min(float(i.get("done", 0)) / float(i["qty"]), 1.0) * float(i["qty"])
        for i in items
        if float(i.get("qty", 0)) > 0
    )
    return round((weighted_sum / total_qty) * 100, 1)


class ComputeEngine:
    """Class wrapper around module-level compute functions for backwards compatibility."""

    calculate_productivity_rate = staticmethod(calculate_productivity_rate)
    calculate_remaining_days = staticmethod(calculate_remaining_days)
    calculate_progress_pct = staticmethod(calculate_progress_pct)
    calculate_variance = staticmethod(calculate_variance)
    calculate_remaining_qty = staticmethod(calculate_remaining_qty)
    estimate_completion_date = staticmethod(estimate_completion_date)
    schedule_performance_index = staticmethod(schedule_performance_index)
    weighted_progress = staticmethod(weighted_progress)
