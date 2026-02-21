-- Migration 005: Authentication & Membership-Based RLS
-- MetalYapi Façade Scheduling Platform
-- Created: 2026-02-21
--
-- Creates project_members table and replaces permissive USING(true) policies
-- with membership-based policies scoped to project access.

-- ============================================
-- Table: project_members
-- ============================================

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

-- Admins can manage memberships for their projects
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

-- ============================================
-- Helper function: check project membership
-- ============================================

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

-- ============================================
-- Drop old permissive policies
-- ============================================

-- Projects
DROP POLICY IF EXISTS "Users can read projects" ON projects;
DROP POLICY IF EXISTS "Users can insert projects" ON projects;
DROP POLICY IF EXISTS "Users can update projects" ON projects;

-- WBS Items
DROP POLICY IF EXISTS "Users can read wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can insert wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can update wbs_items" ON wbs_items;
DROP POLICY IF EXISTS "Users can delete wbs_items" ON wbs_items;

-- Daily Allocations
DROP POLICY IF EXISTS "Users can read allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can insert allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can update allocations" ON daily_allocations;
DROP POLICY IF EXISTS "Users can delete allocations" ON daily_allocations;

-- Baselines
DROP POLICY IF EXISTS "Users can read baselines" ON baselines;
DROP POLICY IF EXISTS "Users can insert baselines" ON baselines;
DROP POLICY IF EXISTS "Users can update baselines" ON baselines;

-- Baseline Snapshots
DROP POLICY IF EXISTS "Users can read snapshots" ON baseline_snapshots;
DROP POLICY IF EXISTS "Users can insert snapshots" ON baseline_snapshots;

-- AI Forecasts
DROP POLICY IF EXISTS "Users can read forecasts" ON ai_forecasts;
DROP POLICY IF EXISTS "Users can insert forecasts" ON ai_forecasts;

-- Chat Messages
DROP POLICY IF EXISTS "Users can read chat" ON chat_messages;
DROP POLICY IF EXISTS "Users can insert chat" ON chat_messages;
DROP POLICY IF EXISTS "Users can update chat" ON chat_messages;

-- ============================================
-- New membership-based policies: Projects
-- ============================================

CREATE POLICY "Members can read projects"
    ON projects FOR SELECT TO authenticated
    USING (fn_is_project_member(id));

CREATE POLICY "Authenticated can create projects"
    ON projects FOR INSERT TO authenticated
    WITH CHECK (true);

CREATE POLICY "Members can update projects"
    ON projects FOR UPDATE TO authenticated
    USING (fn_is_project_member(id));

-- ============================================
-- New membership-based policies: WBS Items
-- ============================================

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

-- ============================================
-- New membership-based policies: Daily Allocations
-- (join through wbs_items for project_id)
-- ============================================

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

-- ============================================
-- New membership-based policies: Baselines
-- ============================================

CREATE POLICY "Members can read baselines"
    ON baselines FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));

CREATE POLICY "Members can insert baselines"
    ON baselines FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));

CREATE POLICY "Members can update baselines"
    ON baselines FOR UPDATE TO authenticated
    USING (fn_is_project_member(project_id));

-- ============================================
-- New membership-based policies: Baseline Snapshots
-- (join through baselines for project_id)
-- ============================================

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

-- ============================================
-- New membership-based policies: AI Forecasts
-- ============================================

CREATE POLICY "Members can read forecasts"
    ON ai_forecasts FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));

CREATE POLICY "Members can insert forecasts"
    ON ai_forecasts FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));

-- ============================================
-- New membership-based policies: Chat Messages
-- ============================================

CREATE POLICY "Members can read chat"
    ON chat_messages FOR SELECT TO authenticated
    USING (fn_is_project_member(project_id));

CREATE POLICY "Members can insert chat"
    ON chat_messages FOR INSERT TO authenticated
    WITH CHECK (fn_is_project_member(project_id));

CREATE POLICY "Members can update chat"
    ON chat_messages FOR UPDATE TO authenticated
    USING (fn_is_project_member(project_id));

-- ============================================
-- Audit log: keep existing policies (read for auth, insert for service)
-- ============================================
-- (No changes needed — audit_log policies from 003 are adequate)

-- ============================================
-- Auto-add project creator as admin
-- ============================================

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
