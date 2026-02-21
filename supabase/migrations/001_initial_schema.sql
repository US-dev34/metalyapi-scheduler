-- Migration 001: Initial Schema
-- MetalYapi Façade Scheduling Platform
-- Created: 2026-02-20

-- ============================================
-- Utility Functions
-- ============================================

CREATE OR REPLACE FUNCTION fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- Table: projects
-- ============================================

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

-- ============================================
-- Table: wbs_items
-- ============================================

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

-- ============================================
-- Table: daily_allocations
-- ============================================

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

-- ============================================
-- Table: baselines
-- ============================================

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

-- ============================================
-- Table: baseline_snapshots
-- ============================================

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

-- ============================================
-- Table: ai_forecasts
-- ============================================

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

-- ============================================
-- Table: chat_messages
-- ============================================

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

-- ============================================
-- Table: audit_log
-- ============================================

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
