-- ============================================================
-- ALL MIGRATIONS COMBINED (001 through 005)
-- MetalYapi Façade Scheduling Platform
-- Run this in Supabase SQL Editor in one go
-- ============================================================

-- ============================================================
-- MIGRATION 001: Initial Schema
-- ============================================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Table: projects
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

CREATE TRIGGER trg_projects_updated
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Table: wbs_items
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
CREATE INDEX IF NOT EXISTS idx_wbs_items_code ON wbs_items(wbs_code);

CREATE TRIGGER trg_wbs_items_updated
    BEFORE UPDATE ON wbs_items
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Table: daily_allocations
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
CREATE INDEX IF NOT EXISTS idx_allocations_wbs_date ON daily_allocations(wbs_item_id, date);

CREATE TRIGGER trg_allocations_updated
    BEFORE UPDATE ON daily_allocations
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Table: baselines
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

CREATE INDEX IF NOT EXISTS idx_baselines_project ON baselines(project_id);

CREATE TRIGGER trg_baselines_updated
    BEFORE UPDATE ON baselines
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Table: baseline_snapshots
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

CREATE INDEX IF NOT EXISTS idx_snapshots_baseline ON baseline_snapshots(baseline_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_wbs ON baseline_snapshots(wbs_item_id);

CREATE TRIGGER trg_snapshots_updated
    BEFORE UPDATE ON baseline_snapshots
    FOR EACH ROW EXECUTE FUNCTION fn_update_timestamp();

-- Table: ai_forecasts
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

CREATE INDEX IF NOT EXISTS idx_forecasts_project ON ai_forecasts(project_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_wbs ON ai_forecasts(wbs_item_id);

-- Table: chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id text,
    message text NOT NULL,
    parsed_actions jsonb DEFAULT '[]',
    applied boolean DEFAULT false,
    timestamp timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_project ON chat_messages(project_id);

-- Table: audit_log
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

CREATE INDEX IF NOT EXISTS idx_audit_table ON audit_log(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_record ON audit_log(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);

-- ============================================================
-- MIGRATION 002: Views
-- ============================================================

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

-- ============================================================
-- MIGRATION 003: Row Level Security
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE wbs_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE baseline_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_forecasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read projects"
    ON projects FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert projects"
    ON projects FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update projects"
    ON projects FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read wbs_items"
    ON wbs_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert wbs_items"
    ON wbs_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update wbs_items"
    ON wbs_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete wbs_items"
    ON wbs_items FOR DELETE TO authenticated USING (true);

CREATE POLICY "Users can read allocations"
    ON daily_allocations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert allocations"
    ON daily_allocations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update allocations"
    ON daily_allocations FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Users can delete allocations"
    ON daily_allocations FOR DELETE TO authenticated USING (true);

CREATE POLICY "Users can read baselines"
    ON baselines FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert baselines"
    ON baselines FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update baselines"
    ON baselines FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read snapshots"
    ON baseline_snapshots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert snapshots"
    ON baseline_snapshots FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read forecasts"
    ON ai_forecasts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert forecasts"
    ON ai_forecasts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Users can read chat"
    ON chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert chat"
    ON chat_messages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update chat"
    ON chat_messages FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Users can read audit_log"
    ON audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Service can insert audit_log"
    ON audit_log FOR INSERT TO service_role WITH CHECK (true);

-- ============================================================
-- MIGRATION 004: Baseline Unique Version (already in 001, safe to skip)
-- ============================================================
-- UNIQUE(project_id, version) already exists in baselines from migration 001

-- ============================================================
-- MIGRATION 005: Authentication & Membership-Based RLS
-- ============================================================

-- Table: project_members
CREATE TABLE IF NOT EXISTS project_members (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    role text NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),
    created_at timestamptz DEFAULT now() NOT NULL,
    UNIQUE(project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Members can see their own memberships
CREATE POLICY "Users can read own memberships"
    ON project_members FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Admins can manage memberships
CREATE POLICY "Admins can insert members"
    ON project_members FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
              AND pm.user_id = auth.uid()
              AND pm.role = 'admin'
        )
    );

CREATE POLICY "Admins can delete members"
    ON project_members FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_members.project_id
              AND pm.user_id = auth.uid()
              AND pm.role = 'admin'
        )
    );

-- Helper function: check project membership
CREATE OR REPLACE FUNCTION fn_is_project_member(p_project_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_id = p_project_id
          AND user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Drop old permissive policies (from migration 003)
DROP POLICY IF EXISTS "Users can read projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;
DROP POLICY IF EXISTS "Users can read wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can insert wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can update wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can delete wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can read allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can insert allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can update allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can delete allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can read baselines" ON baselines;
DROP POLICY IF EXISTS "Users can insert baselines" ON baselines;
DROP POLICY IF EXISTS "Users can update baselines" ON baselines;
DROP POLICY IF EXISTS "Users can read snapshots" ON baseline_snapshots;
DROP POLICY IF EXISTS "Users can insert snapshots" ON baseline_snapshots;
DROP POLICY IF EXISTS "Users can read forecasts" ON ai_forecasts;
DROP POLICY IF EXISTS "Users can insert forecasts" ON ai_forecasts;
DROP POLICY IF EXISTS "Users can read chat" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat" ON chat_messages;
DROP POLICY IF EXISTS "Users can update chat" ON chat_messages;

-- New membership-based policies: Projects
CREATE POLICY "Members can read projects"
    ON projects FOR SELECT TO authenticated
    USING (fn_is_project_member(id));
CREATE POLICY "Authenticated can create projects"
    ON projects FOR INSERT TO authenticated
    WITH CHECK (true);
CREATE POLICY "Members can update projects"
    ON projects FOR UPDATE TO authenticated
    USING (fn_is_project_member(id));

-- New membership-based policies: WBS Items
CREATE POLICY "Members can read wbs_items"
    ON wbs_items FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));
CREATE POLICY "Members can insert wbs_items"
    ON wbs_items FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));
CREATE POLICY "Members can update wbs_items"
    ON wbs_items FOR UPDATE TO authenticated
    USING (fn_is_project_member(project_id));
CREATE POLICY "Members can delete wbs_items"
    ON wbs_items FOR DELETE TO authenticated
    USING (fn_is_project_member(project_id));

-- New membership-based policies: Daily Allocations
CREATE POLICY "Members can read allocations"
    ON daily_allocations FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM wbs_items w
            JOIN project_members pm ON pm.project_id = w.project_id
            WHERE w.id = daily_allocations.wbs_item_id
              AND pm.user_id = auth.uid()
        )
    );
CREATE POLICY "Members can insert allocations"
    ON daily_allocations FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM wbs_items w
            JOIN project_members pm ON pm.project_id = w.project_id
            WHERE w.id = daily_allocations.wbs_item_id
              AND pm.user_id = auth.uid()
        )
    );
CREATE POLICY "Members can update allocations"
    ON daily_allocations FOR UPDATE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM wbs_items w
            JOIN project_members pm ON pm.project_id = w.project_id
            WHERE w.id = daily_allocations.wbs_item_id
              AND pm.user_id = auth.uid()
        )
    );
CREATE POLICY "Members can delete allocations"
    ON daily_allocations FOR DELETE TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM wbs_items w
            JOIN project_members pm ON pm.project_id = w.project_id
            WHERE w.id = daily_allocations.wbs_item_id
              AND pm.user_id = auth.uid()
        )
    );

-- New membership-based policies: Baselines
CREATE POLICY "Members can read baselines"
    ON baselines FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));
CREATE POLICY "Members can insert baselines"
    ON baselines FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));
CREATE POLICY "Members can update baselines"
    ON baselines FOR UPDATE TO authenticated
    USING (fn_is_project_member(project_id));

-- New membership-based policies: Baseline Snapshots
CREATE POLICY "Members can read snapshots"
    ON baseline_snapshots FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM baselines b
            JOIN project_members pm ON pm.project_id = b.project_id
            WHERE b.id = baseline_snapshots.baseline_id
              AND pm.user_id = auth.uid()
        )
    );
CREATE POLICY "Members can insert snapshots"
    ON baseline_snapshots FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM baselines b
            JOIN project_members pm ON pm.project_id = b.project_id
            WHERE b.id = baseline_snapshots.baseline_id
              AND pm.user_id = auth.uid()
        )
    );

-- New membership-based policies: AI Forecasts
CREATE POLICY "Members can read forecasts"
    ON ai_forecasts FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));
CREATE POLICY "Members can insert forecasts"
    ON ai_forecasts FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));

-- New membership-based policies: Chat Messages
CREATE POLICY "Members can read chat"
    ON chat_messages FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));
CREATE POLICY "Members can insert chat"
    ON chat_messages FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));
CREATE POLICY "Members can update chat"
    ON chat_messages FOR UPDATE TO authenticated
    USING (fn_is_project_member(project_id));

-- Auto-add project creator as admin
CREATE OR REPLACE FUNCTION fn_auto_add_project_admin()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO project_members (project_id, user_id, role)
    VALUES (NEW.id, auth.uid(), 'admin')
    ON CONFLICT (project_id, user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_project_auto_admin
    AFTER INSERT ON projects
    FOR EACH ROW EXECUTE FUNCTION fn_auto_add_project_admin();

-- ============================================================
-- DONE! All migrations applied.
-- ============================================================
