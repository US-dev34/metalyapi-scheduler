-- =====================================================
-- COPY THIS ENTIRE FILE AND PASTE IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/tfcmfbfnvrtsfqevwsko/sql
-- Then click "Run"
-- =====================================================

-- Utility function
CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    start_date date NOT NULL,
    end_date date,
    status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- WBS Items
CREATE TABLE IF NOT EXISTS wbs_items (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    parent_id uuid REFERENCES wbs_items(id) ON DELETE SET NULL,
    wbs_code text NOT NULL,
    wbs_name text NOT NULL,
    qty numeric(12,2) DEFAULT 0,
    unit text DEFAULT 'pcs',
    sort_order integer DEFAULT 0,
    level integer DEFAULT 0,
    is_summary boolean DEFAULT false,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(project_id, wbs_code)
);
CREATE INDEX IF NOT EXISTS idx_wbs_items_project ON wbs_items(project_id);
CREATE INDEX IF NOT EXISTS idx_wbs_items_parent ON wbs_items(parent_id);
CREATE TRIGGER trg_wbs_items_updated BEFORE UPDATE ON wbs_items FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Daily Allocations
CREATE TABLE IF NOT EXISTS daily_allocations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    wbs_item_id uuid NOT NULL REFERENCES wbs_items(id) ON DELETE CASCADE,
    date date NOT NULL,
    planned_manpower numeric(8,2) DEFAULT 0,
    actual_manpower numeric(8,2) DEFAULT 0,
    qty_done numeric(12,2) DEFAULT 0,
    notes text,
    source text DEFAULT 'grid' CHECK (source IN ('grid', 'chat')),
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(wbs_item_id, date)
);
CREATE INDEX IF NOT EXISTS idx_allocations_date ON daily_allocations(date);
CREATE INDEX IF NOT EXISTS idx_allocations_wbs ON daily_allocations(wbs_item_id);
CREATE TRIGGER trg_allocations_updated BEFORE UPDATE ON daily_allocations FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Baselines
CREATE TABLE IF NOT EXISTS baselines (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    version integer NOT NULL,
    name text NOT NULL,
    approved_at timestamptz,
    approved_by text,
    notes text,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(project_id, version)
);
CREATE TRIGGER trg_baselines_updated BEFORE UPDATE ON baselines FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Baseline Snapshots
CREATE TABLE IF NOT EXISTS baseline_snapshots (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    baseline_id uuid NOT NULL REFERENCES baselines(id) ON DELETE CASCADE,
    wbs_item_id uuid NOT NULL REFERENCES wbs_items(id) ON DELETE CASCADE,
    total_manday numeric(10,2) DEFAULT 0,
    start_date date,
    end_date date,
    daily_plan jsonb DEFAULT '{}',
    manpower_per_day numeric(8,2) DEFAULT 0,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);
CREATE TRIGGER trg_snapshots_updated BEFORE UPDATE ON baseline_snapshots FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- AI Forecasts
CREATE TABLE IF NOT EXISTS ai_forecasts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    wbs_item_id uuid NOT NULL REFERENCES wbs_items(id) ON DELETE CASCADE,
    forecast_date date NOT NULL DEFAULT CURRENT_DATE,
    predicted_end_date date,
    predicted_manday numeric(10,2),
    confidence numeric(3,2) CHECK (confidence >= 0 AND confidence <= 1),
    reasoning text,
    parameters jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now() NOT NULL
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text,
    message text NOT NULL,
    parsed_actions jsonb DEFAULT '[]',
    applied boolean DEFAULT false,
    timestamp timestamptz DEFAULT now() NOT NULL
);

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name text NOT NULL,
    record_id uuid NOT NULL,
    action text NOT NULL CHECK (action IN ('insert', 'update', 'delete')),
    old_values jsonb,
    new_values jsonb,
    user_id text,
    timestamp timestamptz DEFAULT now() NOT NULL
);

-- View: WBS Progress
CREATE OR REPLACE VIEW vw_wbs_progress AS
SELECT
    w.id, w.project_id, w.wbs_code, w.wbs_name, w.qty, w.unit,
    w.sort_order, w.level, w.is_summary, w.parent_id,
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
    END AS productivity_rate
FROM wbs_items w
LEFT JOIN daily_allocations da ON da.wbs_item_id = w.id
GROUP BY w.id, w.project_id, w.wbs_code, w.wbs_name, w.qty, w.unit,
         w.sort_order, w.level, w.is_summary, w.parent_id;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Project
INSERT INTO projects (id, name, code, start_date, end_date)
VALUES ('00000000-0000-0000-0000-000000000001', 'E2NS Facade Project', 'E2NS-001', '2026-02-17', '2026-06-30')
ON CONFLICT (code) DO NOTHING;

-- WBS Parent (summary) items
INSERT INTO wbs_items (id, project_id, parent_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES
    ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', NULL, 'CW', 'Curtain Wall', 0, 'm2', 0, 0, true),
    ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', NULL, 'DR', 'Doors', 0, 'pcs', 10, 0, true),
    ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', NULL, 'GL', 'Glazing', 0, 'm2', 20, 0, true)
ON CONFLICT (project_id, wbs_code) DO NOTHING;

-- WBS Child items
INSERT INTO wbs_items (id, project_id, parent_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CW-01', 'Curtain Wall Type-1', 100, 'm2', 1, 2, false),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CW-02', 'Curtain Wall Type-2', 150, 'm2', 2, 2, false),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'CW-03', 'Curtain Wall Type-3', 80, 'm2', 3, 2, false),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'DR-01', 'Door Type-A', 50, 'pcs', 11, 2, false),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'DR-02', 'Door Type-B', 30, 'pcs', 12, 2, false),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000003', 'GL-01', 'Glazing Panel', 200, 'm2', 21, 2, false)
ON CONFLICT (project_id, wbs_code) DO NOTHING;

-- Sample allocations
INSERT INTO daily_allocations (wbs_item_id, date, planned_manpower, actual_manpower, qty_done, source) VALUES
    ('10000000-0000-0000-0000-000000000001', '2026-02-17', 5, 6, 4, 'grid'),
    ('10000000-0000-0000-0000-000000000001', '2026-02-18', 5, 5, 3.5, 'grid'),
    ('10000000-0000-0000-0000-000000000001', '2026-02-19', 5, 4, 3, 'grid'),
    ('10000000-0000-0000-0000-000000000002', '2026-02-17', 7, 7, 5, 'grid'),
    ('10000000-0000-0000-0000-000000000002', '2026-02-18', 7, 8, 6, 'grid'),
    ('10000000-0000-0000-0000-000000000004', '2026-02-17', 3, 3, 2, 'grid'),
    ('10000000-0000-0000-0000-000000000006', '2026-02-18', 4, 4, 8, 'grid'),
    ('10000000-0000-0000-0000-000000000006', '2026-02-19', 4, 5, 10, 'grid')
ON CONFLICT (wbs_item_id, date) DO NOTHING;

-- Enable RLS
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wbs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Allow anon/authenticated access (development)
CREATE POLICY "anon_select_projects" ON projects FOR SELECT USING (true);
CREATE POLICY "anon_insert_projects" ON projects FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_projects" ON projects FOR UPDATE USING (true);
CREATE POLICY "anon_select_wbs" ON wbs_items FOR SELECT USING (true);
CREATE POLICY "anon_insert_wbs" ON wbs_items FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_wbs" ON wbs_items FOR UPDATE USING (true);
CREATE POLICY "anon_delete_wbs" ON wbs_items FOR DELETE USING (true);
CREATE POLICY "anon_select_alloc" ON daily_allocations FOR SELECT USING (true);
CREATE POLICY "anon_insert_alloc" ON daily_allocations FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_alloc" ON daily_allocations FOR UPDATE USING (true);
CREATE POLICY "anon_delete_alloc" ON daily_allocations FOR DELETE USING (true);
CREATE POLICY "anon_select_baselines" ON baselines FOR SELECT USING (true);
CREATE POLICY "anon_insert_baselines" ON baselines FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_baselines" ON baselines FOR UPDATE USING (true);
CREATE POLICY "anon_select_snapshots" ON baseline_snapshots FOR SELECT USING (true);
CREATE POLICY "anon_insert_snapshots" ON baseline_snapshots FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_forecasts" ON ai_forecasts FOR SELECT USING (true);
CREATE POLICY "anon_insert_forecasts" ON ai_forecasts FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_select_chat" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "anon_insert_chat" ON chat_messages FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_update_chat" ON chat_messages FOR UPDATE USING (true);
CREATE POLICY "anon_select_audit" ON audit_log FOR SELECT USING (true);
CREATE POLICY "anon_insert_audit" ON audit_log FOR INSERT WITH CHECK (true);

-- =====================================================
-- DONE! Tables created, seed data inserted, RLS enabled.
-- =====================================================
