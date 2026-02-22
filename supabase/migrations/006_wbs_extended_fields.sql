-- Migration 006: Add extended fields to wbs_items
-- Adds building, NTA ref, status, budget, target KW, scope, notes,
-- and separate internal/external quantity tracking

ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS building text;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS nta_ref text;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS status text DEFAULT '';
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS budget_eur numeric(14,2) DEFAULT 0;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS target_kw text;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS scope text;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS notes text;

-- External work tracking
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS qty_ext numeric(12,2) DEFAULT 0;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS done_ext numeric(12,2) DEFAULT 0;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS rem_ext numeric(12,2) DEFAULT 0;

-- Internal work tracking
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS qty_int numeric(12,2) DEFAULT 0;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS done_int numeric(12,2) DEFAULT 0;
ALTER TABLE wbs_items ADD COLUMN IF NOT EXISTS rem_int numeric(12,2) DEFAULT 0;
