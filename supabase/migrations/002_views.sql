-- Migration 002: Views
-- MetalYapi Façade Scheduling Platform
-- Created: 2026-02-20

-- ============================================
-- View: vw_wbs_progress
-- Her WBS için anlık ilerleme durumu
-- ============================================

CREATE OR REPLACE VIEW vw_wbs_progress AS
SELECT
    w.id,
    w.project_id,
    w.wbs_code,
    w.wbs_name,
    w.qty,
    w.unit,
    w.sort_order,
    w.level,
    w.is_summary,
    COALESCE(SUM(da.qty_done), 0) AS done,
    w.qty - COALESCE(SUM(da.qty_done), 0) AS remaining,
    CASE WHEN w.qty > 0
        THEN ROUND(COALESCE(SUM(da.qty_done), 0) / w.qty * 100, 1)
        ELSE 0
    END AS progress_pct,
    COALESCE(SUM(da.actual_manpower), 0) AS total_actual_manday,
    COUNT(DISTINCT da.date) FILTER (WHERE da.actual_manpower > 0) AS working_days,
    CASE
        WHEN SUM(da.actual_manpower) > 0
        THEN ROUND(SUM(da.qty_done) / SUM(da.actual_manpower), 3)
        ELSE 0
    END AS productivity_rate,
    MIN(da.date) FILTER (WHERE da.actual_manpower > 0) AS first_working_day,
    MAX(da.date) FILTER (WHERE da.actual_manpower > 0) AS last_working_day
FROM wbs_items w
LEFT JOIN daily_allocations da ON da.wbs_item_id = w.id
GROUP BY w.id, w.project_id, w.wbs_code, w.wbs_name, w.qty, w.unit, w.sort_order, w.level, w.is_summary;

-- ============================================
-- View: vw_daily_totals
-- Günlük toplam adam sayısı (grid alt satır)
-- ============================================

CREATE OR REPLACE VIEW vw_daily_totals AS
SELECT
    w.project_id,
    da.date,
    SUM(da.planned_manpower) AS total_planned,
    SUM(da.actual_manpower) AS total_actual,
    SUM(da.qty_done) AS total_qty_done,
    COUNT(DISTINCT da.wbs_item_id) FILTER (WHERE da.actual_manpower > 0) AS active_wbs_count
FROM daily_allocations da
JOIN wbs_items w ON w.id = da.wbs_item_id
GROUP BY w.project_id, da.date;
