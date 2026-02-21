-- Seed Data for Development/Testing
-- MetalYapi Façade Scheduling Platform
-- WBS verisi runtime'da tam olarak sağlanacak

-- ============================================
-- Test Project
-- ============================================

INSERT INTO projects (id, name, code, start_date, end_date, status)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'E2NS Facade Project',
    'E2NS-001',
    '2026-02-17',
    '2026-06-30',
    'active'
) ON CONFLICT (code) DO NOTHING;

-- ============================================
-- WBS Items (Örnek yapı — gerçek data sonra eklenecek)
-- ============================================

INSERT INTO wbs_items (id, project_id, wbs_code, wbs_name, qty, unit, sort_order, level, is_summary) VALUES
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'CW-01', 'Curtain Wall Tip-1', 100, 'm2', 1, 2, false),
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 'CW-02', 'Curtain Wall Tip-2', 150, 'm2', 2, 2, false),
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'CW-03', 'Curtain Wall Tip-3', 80, 'm2', 3, 2, false),
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'DR-01', 'Door Type-A', 50, 'pcs', 4, 2, false),
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 'DR-02', 'Door Type-B', 30, 'pcs', 5, 2, false),
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 'GL-01', 'Glazing Panel', 200, 'm2', 6, 2, false)
ON CONFLICT (project_id, wbs_code) DO NOTHING;

-- ============================================
-- Sample Daily Allocations (birkaç gün test verisi)
-- ============================================

INSERT INTO daily_allocations (wbs_item_id, date, planned_manpower, actual_manpower, qty_done, source) VALUES
    -- CW-01: 3 gün çalışma
    ('10000000-0000-0000-0000-000000000001', '2026-02-17', 5, 6, 4, 'grid'),
    ('10000000-0000-0000-0000-000000000001', '2026-02-18', 5, 5, 3.5, 'grid'),
    ('10000000-0000-0000-0000-000000000001', '2026-02-19', 5, 4, 3, 'grid'),
    -- CW-02: 2 gün çalışma
    ('10000000-0000-0000-0000-000000000002', '2026-02-17', 7, 7, 5, 'grid'),
    ('10000000-0000-0000-0000-000000000002', '2026-02-18', 7, 8, 6, 'grid'),
    -- DR-01: 1 gün çalışma
    ('10000000-0000-0000-0000-000000000004', '2026-02-17', 3, 3, 2, 'grid'),
    -- GL-01: 2 gün çalışma
    ('10000000-0000-0000-0000-000000000006', '2026-02-18', 4, 4, 8, 'grid'),
    ('10000000-0000-0000-0000-000000000006', '2026-02-19', 4, 5, 10, 'grid')
ON CONFLICT (wbs_item_id, date) DO NOTHING;

-- {{WBS_DATA_PLACEHOLDER}}
-- Tam WBS verisi runtime'da sağlanacak.
-- Yukarıdaki örnek WBS kodları test context'i içindir: CW-01, CW-02, CW-03, DR-01, DR-02, GL-01
