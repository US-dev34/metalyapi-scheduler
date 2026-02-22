-- ÜSQ WBS Database Schema
-- Auto-generated from Terminplan + Payment Plan

-- 1. ACTIVITIES TABLE
CREATE TABLE IF NOT EXISTS activity (
    id SERIAL PRIMARY KEY,
    wbs_code TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    tp_pos TEXT,
    package TEXT DEFAULT 'E2NS',
    building TEXT,
    nta_ref TEXT,
    status TEXT,
    budget_eur NUMERIC(12,2),
    target_kw TEXT,
    qty_total NUMERIC(10,2),
    qty_done NUMERIC(10,2),
    qty_remaining NUMERIC(10,2),
    manpower_per_day INTEGER,
    duration_days INTEGER,
    total_mandays INTEGER,
    scope TEXT,
    responsible TEXT,
    payment_ref TEXT,
    source TEXT,
    level INTEGER NOT NULL,
    parent_wbs TEXT REFERENCES activity(wbs_code),
    is_leaf BOOLEAN DEFAULT FALSE,
    baseline_start DATE,
    baseline_finish DATE,
    baseline_working_days INTEGER,
    baseline_total_md INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_activity_parent ON activity(parent_wbs);
CREATE INDEX idx_activity_package ON activity(package);
CREATE INDEX idx_activity_building ON activity(building);
CREATE INDEX idx_activity_tp ON activity(tp_pos);
CREATE INDEX idx_activity_level ON activity(level);
CREATE INDEX idx_activity_tkw ON activity(target_kw);

-- 2. DAILY ALLOCATION TABLE (baseline manpower per day)
CREATE TABLE IF NOT EXISTS daily_allocation (
    id SERIAL PRIMARY KEY,
    wbs_code TEXT NOT NULL REFERENCES activity(wbs_code),
    tp_pos TEXT,
    date DATE NOT NULL,
    baseline_manpower INTEGER NOT NULL DEFAULT 0,
    actual_manpower INTEGER,
    day_of_week TEXT,
    kw INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(wbs_code, date)
);

CREATE INDEX idx_daily_wbs ON daily_allocation(wbs_code);
CREATE INDEX idx_daily_date ON daily_allocation(date);
CREATE INDEX idx_daily_kw ON daily_allocation(kw);

-- 3. WEEKLY PROGRESS LOG (audit trail)
CREATE TABLE IF NOT EXISTS weekly_progress_log (
    id SERIAL PRIMARY KEY,
    wbs_code TEXT NOT NULL REFERENCES activity(wbs_code),
    report_date DATE NOT NULL,
    kw INTEGER,
    qty_done_cumulative NUMERIC(10,2),
    qty_remaining NUMERIC(10,2),
    progress_pct NUMERIC(5,2),
    notes TEXT,
    reported_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_progress_wbs ON weekly_progress_log(wbs_code);
CREATE INDEX idx_progress_date ON weekly_progress_log(report_date);

-- 4. PAYMENT MILESTONES TABLE
CREATE TABLE IF NOT EXISTS payment_milestone (
    id SERIAL PRIMARY KEY,
    payment_ref TEXT UNIQUE NOT NULL,
    description TEXT,
    amount_eur NUMERIC(12,2),
    target_kw TEXT,
    package TEXT,
    building TEXT,
    status TEXT,
    linked_wbs_codes TEXT[],
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. CALENDAR TABLE
CREATE TABLE IF NOT EXISTS calendar (
    date DATE PRIMARY KEY,
    year INTEGER,
    month INTEGER,
    day INTEGER,
    kw INTEGER,
    day_of_week TEXT,
    day_number INTEGER,
    is_working_day BOOLEAN,
    is_saturday BOOLEAN,
    is_sunday BOOLEAN,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name TEXT
);

-- 6. VIEW: Activity with baseline summary
CREATE OR REPLACE VIEW v_activity_summary AS
SELECT 
    a.*,
    COALESCE(d.baseline_md, 0) as calc_baseline_md,
    d.first_day as calc_baseline_start,
    d.last_day as calc_baseline_finish,
    d.working_days as calc_working_days
FROM activity a
LEFT JOIN (
    SELECT wbs_code,
           SUM(baseline_manpower) as baseline_md,
           MIN(date) as first_day,
           MAX(date) as last_day,
           COUNT(*) as working_days
    FROM daily_allocation
    WHERE baseline_manpower > 0
    GROUP BY wbs_code
) d ON a.wbs_code = d.wbs_code;

-- 7. VIEW: Daily total manpower
CREATE OR REPLACE VIEW v_daily_total_manpower AS
SELECT 
    date,
    kw,
    day_of_week,
    SUM(baseline_manpower) as total_baseline_mp,
    SUM(COALESCE(actual_manpower, 0)) as total_actual_mp
FROM daily_allocation
GROUP BY date, kw, day_of_week
ORDER BY date;

-- 8. VIEW: Weekly KW summary
CREATE OR REPLACE VIEW v_weekly_summary AS
SELECT 
    kw,
    MIN(date) as week_start,
    MAX(date) as week_end,
    SUM(baseline_manpower) as total_baseline_md,
    COUNT(DISTINCT wbs_code) as active_activities
FROM daily_allocation
WHERE baseline_manpower > 0
GROUP BY kw
ORDER BY kw;
