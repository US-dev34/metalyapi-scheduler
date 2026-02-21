-- Migration 003: Row Level Security Policies
-- MetalYapi Façade Scheduling Platform
-- Created: 2026-02-20

-- ============================================
-- Enable RLS on all tables
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wbs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Projects policies
-- ============================================

CREATE POLICY "Users can read projects"
    ON projects FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert projects"
    ON projects FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update projects"
    ON projects FOR UPDATE TO authenticated USING (true);

-- ============================================
-- WBS Items policies
-- ============================================

CREATE POLICY "Users can read wbs_items"
    ON wbs_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert wbs_items"
    ON wbs_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update wbs_items"
    ON wbs_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete wbs_items"
    ON wbs_items FOR DELETE TO authenticated USING (true);

-- ============================================
-- Daily Allocations policies
-- ============================================

CREATE POLICY "Users can read allocations"
    ON daily_allocations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert allocations"
    ON daily_allocations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update allocations"
    ON daily_allocations FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can delete allocations"
    ON daily_allocations FOR DELETE TO authenticated USING (true);

-- ============================================
-- Baselines policies
-- ============================================

CREATE POLICY "Users can read baselines"
    ON baselines FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert baselines"
    ON baselines FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update baselines"
    ON baselines FOR UPDATE TO authenticated USING (true);

-- ============================================
-- Baseline Snapshots policies
-- ============================================

CREATE POLICY "Users can read snapshots"
    ON baseline_snapshots FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert snapshots"
    ON baseline_snapshots FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- AI Forecasts policies
-- ============================================

CREATE POLICY "Users can read forecasts"
    ON ai_forecasts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert forecasts"
    ON ai_forecasts FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================
-- Chat Messages policies
-- ============================================

CREATE POLICY "Users can read chat"
    ON chat_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert chat"
    ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can update chat"
    ON chat_messages FOR UPDATE TO authenticated USING (true);

-- ============================================
-- Audit Log policies (read-only for users)
-- ============================================

CREATE POLICY "Users can read audit_log"
    ON audit_log FOR SELECT TO authenticated USING (true);

-- Service role can insert audit logs
CREATE POLICY "Service can insert audit_log"
    ON audit_log FOR INSERT TO service_role WITH CHECK (true);
