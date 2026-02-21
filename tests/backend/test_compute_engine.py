"""Tests for compute_engine.py — pure arithmetic, no DB needed."""

from datetime import date

from backend.services.compute_engine import (
    calculate_productivity_rate,
    calculate_remaining_days,
    calculate_progress_pct,
    calculate_variance,
    calculate_remaining_qty,
    estimate_completion_date,
    schedule_performance_index,
    weighted_progress,
)


class TestProductivityRate:
    def test_normal(self):
        assert calculate_productivity_rate(10, 5) == 2.0

    def test_zero_manday(self):
        assert calculate_productivity_rate(10, 0) == 0.0

    def test_negative_manday(self):
        assert calculate_productivity_rate(10, -1) == 0.0

    def test_fractional(self):
        assert calculate_productivity_rate(7, 3) == 2.333


class TestRemainingDays:
    def test_normal(self):
        # remaining=10, productivity=2, avg_mp=5 -> 10/(2*5)=1
        assert calculate_remaining_days(10, 2.0, 5) == 1

    def test_zero_productivity(self):
        assert calculate_remaining_days(10, 0, 5) == 999

    def test_zero_manpower(self):
        assert calculate_remaining_days(10, 2, 0) == 999

    def test_rounds_up(self):
        # 10 / (1.5 * 3) = 2.22 -> ceil = 3
        assert calculate_remaining_days(10, 1.5, 3) == 3


class TestProgressPct:
    def test_normal(self):
        assert calculate_progress_pct(100, 35) == 35.0

    def test_zero_qty_zero_done(self):
        assert calculate_progress_pct(0, 0) == 0.0

    def test_zero_qty_with_done(self):
        assert calculate_progress_pct(0, 10) == 100.0

    def test_complete(self):
        assert calculate_progress_pct(100, 100) == 100.0

    def test_over_100(self):
        assert calculate_progress_pct(100, 120) == 100.0

    def test_partial(self):
        assert calculate_progress_pct(150, 45) == 30.0


class TestVariance:
    def test_positive(self):
        assert calculate_variance(7, 5) == 2.0

    def test_negative(self):
        assert calculate_variance(3, 5) == -2.0

    def test_zero(self):
        assert calculate_variance(5, 5) == 0.0


class TestRemainingQty:
    def test_normal(self):
        assert calculate_remaining_qty(100, 35) == 65.0

    def test_complete(self):
        assert calculate_remaining_qty(100, 100) == 0.0

    def test_over_done(self):
        assert calculate_remaining_qty(100, 120) == 0.0


class TestEstimateCompletion:
    def test_normal(self):
        result = estimate_completion_date(10, 2.0, 5, from_date=date(2026, 2, 20))
        assert result == date(2026, 2, 21)  # 10/(2*5)=1 day

    def test_zero_remaining(self):
        result = estimate_completion_date(0, 2.0, 5, from_date=date(2026, 2, 20))
        assert result == date(2026, 2, 20)

    def test_impossible(self):
        result = estimate_completion_date(10, 0, 5)
        assert result is None


class TestSPI:
    def test_on_track(self):
        assert schedule_performance_index(100, 100) == 1.0

    def test_ahead(self):
        assert schedule_performance_index(100, 120) == 1.2

    def test_behind(self):
        assert schedule_performance_index(100, 80) == 0.8

    def test_zero_planned(self):
        assert schedule_performance_index(0, 50) == 0.0


class TestWeightedProgress:
    def test_normal(self):
        items = [
            {"qty": 100, "done": 50},
            {"qty": 200, "done": 100},
        ]
        # (50/100)*100 + (100/200)*200 = 50 + 100 = 150 / 300 = 50%
        assert weighted_progress(items) == 50.0

    def test_empty(self):
        assert weighted_progress([]) == 0.0

    def test_all_done(self):
        items = [{"qty": 100, "done": 100}, {"qty": 50, "done": 50}]
        assert weighted_progress(items) == 100.0
