-- Migration 004: Add unique constraint on baselines(project_id, version)
-- Prevents race condition where concurrent baseline creation produces duplicate versions.

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_baseline_project_version'
    ) THEN
        ALTER TABLE baselines
            ADD CONSTRAINT uq_baseline_project_version UNIQUE (project_id, version);
    END IF;
END $$;
