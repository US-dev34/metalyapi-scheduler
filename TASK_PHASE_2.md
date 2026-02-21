# Phase 2 — Baseline + Weekly/Summary Views

## Özet
Baseline yönetim sistemi (snapshot oluşturma, rebaseline), compute engine'e baseline karşılaştırma eklenmesi, Weekly Grid View ve Summary/Gantt View'ların implemente edilmesi. Bu phase sonunda 3 farklı görünüm senkronize çalışacak ve baseline'a göre sapma analizi yapılabilecek.

## Başarı Kriteri (Phase Tamamlanma)
- [ ] Baseline tabloları oluşturuldu (baselines, baseline_snapshots)
- [ ] Baseline oluşturma endpoint'i çalışıyor (snapshot alınıyor)
- [ ] Rebaseline endpoint'i çalışıyor (eski deaktif, yeni aktif)
- [ ] DailyMatrixResponse baseline karşılaştırma verisi içeriyor (planned field)
- [ ] Compute engine variance hesaplıyor
- [ ] Weekly Grid View çalışıyor (bu hafta actual + gelecek hafta plan)
- [ ] Summary View + Gantt chart çalışıyor
- [ ] ViewToggle ile 3 view arası geçiş sorunsuz
- [ ] View integration test'leri pass

---

## Task Listesi

### TASK-2.1: Baseline Tables
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** baselines ve baseline_snapshots tablolarını migration olarak oluştur. daily_plan JSONB yapısı dahil.
- **Input:** ARCHITECTURE.md Section 3.1 (baselines, baseline_snapshots), AGENT_1_DB_PROMPT.md
- **Output:**
  - `supabase/migrations/004_baseline_tables.sql`
- **Acceptance Criteria:**
  - [ ] baselines tablosu: id, project_id, version, name, approved_at, approved_by, notes, is_active
  - [ ] baseline_snapshots: id, baseline_id, wbs_item_id, total_manday, start_date, end_date, daily_plan (JSONB), manpower_per_day
  - [ ] UNIQUE(project_id, version) constraint
  - [ ] Foreign key'ler doğru
  - [ ] daily_plan JSONB formatı: {"2026-02-17": 5, "2026-02-18": 7}
  - [ ] Type generation güncellendi
- **Depends On:** Phase 1 complete

### TASK-2.2: Baseline Snapshot Function
- **Agent:** 1 (DB)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Baseline oluşturulduğunda mevcut WBS progress durumunu snapshot olarak kaydeden DB function veya logic.
- **Input:** Baseline schema
- **Output:**
  - `supabase/migrations/005_baseline_functions.sql` (opsiyonel — logic backend'de de olabilir)
- **Acceptance Criteria:**
  - [ ] Baseline oluşturulduğunda tüm WBS items için snapshot kaydı oluşuyor
  - [ ] daily_plan JSONB mevcut allocation'lardan dolduruluyor
  - [ ] Rebaseline: eski baseline is_active=false, yeni baseline is_active=true
- **Depends On:** TASK-2.1

### TASK-2.3: Baseline Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Baselines router: list, create (with snapshot), get specific version, rebaseline.
- **Input:** ARCHITECTURE.md Section 4.1 baselines endpoints
- **Output:**
  - `/backend/routers/baselines.py`
  - `/backend/services/baseline_service.py`
  - Baseline Pydantic models
- **Acceptance Criteria:**
  - [ ] GET /baselines/{project_id}/ → baseline listesi
  - [ ] POST /baselines/{project_id}/ → yeni baseline + snapshot oluştur
  - [ ] GET /baselines/{project_id}/{version} → specific baseline + snapshots
  - [ ] POST /baselines/{project_id}/rebaseline → eski deaktif, yeni baseline
  - [ ] Snapshot verileri doğru (her WBS için planned data)
  - [ ] Error: duplicate version → 409
- **Depends On:** TASK-2.1, TASK-2.2

### TASK-2.4: Compute Engine — Baseline Variance
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Compute engine'e baseline karşılaştırma ekle. DailyMatrixResponse'daki her hücrenin `planned` field'ını aktif baseline'dan doldur.
- **Input:** IC-002 DailyMatrixResponse, baseline_snapshots daily_plan
- **Output:**
  - `/backend/services/compute_engine.py` (güncelleme)
  - Allocations router update (baseline data injection)
- **Acceptance Criteria:**
  - [ ] DailyMatrixResponse.matrix[wbs_id][date].planned = baseline daily_plan value
  - [ ] Aktif baseline yoksa planned = 0
  - [ ] Variance calculation: actual - planned
  - [ ] Weekly aggregation: haftalık planned vs actual toplam
  - [ ] Summary: overall progress vs baseline progress karşılaştırma
- **Depends On:** TASK-2.3

### TASK-2.5: Weekly/Summary Allocation Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Allocations router'a weekly ve summary endpoint'lerini ekle.
- **Input:** ARCHITECTURE.md Section 4.1
- **Output:**
  - Allocations router güncelleme (weekly, summary methods)
  - WeeklyResponse, SummaryResponse Pydantic models
- **Acceptance Criteria:**
  - [ ] GET /allocations/{project_id}/weekly → haftalık aggregated data
  - [ ] GET /allocations/{project_id}/summary → summary + Gantt bar data
  - [ ] Weekly: bu hafta actual + gelecek hafta plan
  - [ ] Summary: WBS başına total progress + date range bars
  - [ ] Gantt data: start_date, end_date, baseline_end, forecast_end per WBS
- **Depends On:** TASK-2.4

### TASK-2.6: Weekly Grid View
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Weekly Grid View: bu hafta detay (actual), gelecek hafta (plan/forecast), Weekly KPI kartları.
- **Input:** ARCHITECTURE.md Section 5.1 WeeklyGridView, weekly endpoint response
- **Output:**
  - `/frontend/src/components/grid/WeeklyGridView.tsx`
  - CurrentWeekGrid, NextWeekGrid, WeeklyKPI sub-components
- **Acceptance Criteria:**
  - [ ] Bu hafta grid: WBS × 7 gün (Mon-Sun) actual data
  - [ ] Gelecek hafta grid: plan/forecast data (editable)
  - [ ] Weekly KPI: Total Planned MP, Total Actual MP, Δ Progress, Productivity
  - [ ] Baseline karşılaştırma renk kodları
  - [ ] Data weekly endpoint'ten fetch ediliyor
- **Depends On:** TASK-2.5, TASK-1.11

### TASK-2.7: Summary View + Gantt Chart
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Summary View: WBS özet tablosu + Gantt chart (frappe-gantt). Baseline bar üst, Actual+Forecast bar alt.
- **Input:** ARCHITECTURE.md Section 5.1 SummaryView
- **Output:**
  - `/frontend/src/components/gantt/SummaryView.tsx`
  - `/frontend/src/components/gantt/GanttBar.tsx`
  - `/frontend/src/components/gantt/MilestoneMarker.tsx`
  - `/frontend/src/hooks/useBaseline.ts`
- **Acceptance Criteria:**
  - [ ] WBS Summary Table: Code, Name, QTY, Done, %, TMD
  - [ ] Gantt chart render oluyor (haftalık barlar)
  - [ ] Baseline bar (üst): planlanan tarih aralığı
  - [ ] Actual+Forecast bar (alt): gerçekleşen + tahmin
  - [ ] Milestone markers (teslim tarihleri)
  - [ ] Summary endpoint'ten data fetch
- **Depends On:** TASK-2.5, TASK-1.10

### TASK-2.8: View Toggle Integration
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** ViewToggle component'i ile 3 view arası sorunsuz geçiş. State korunmalı (date range, filters).
- **Input:** uiStore activeView state
- **Output:**
  - ViewToggle güncelleme
  - MainContent conditional rendering
- **Acceptance Criteria:**
  - [ ] Daily/Weekly/Summary arası geçiş sorunsuz
  - [ ] View değiştiğinde date range korunuyor
  - [ ] Filtreleme state'i korunuyor
  - [ ] Animasyonlu geçiş (fade veya slide)
  - [ ] Loading state view geçişinde gösteriliyor
- **Depends On:** TASK-2.6, TASK-2.7

### TASK-2.9: Baseline Modal
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** Re-baseline onay modal'ı. Kullanıcı baseline oluşturma/güncelleme yapabilmeli.
- **Input:** Baseline endpoint'leri
- **Output:**
  - `/frontend/src/components/shared/BaselineModal.tsx`
- **Acceptance Criteria:**
  - [ ] Modal açılıyor/kapanıyor
  - [ ] Baseline adı ve not girişi
  - [ ] "Oluştur" butonu → POST /baselines
  - [ ] Rebaseline onay: "Mevcut baseline deaktif edilecek, onaylıyor musunuz?"
  - [ ] Success/error feedback
- **Depends On:** TASK-2.3

### TASK-2.10: View Integration Tests
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Phase 2 integration test'leri: baseline CRUD, weekly/summary response format, view sync.
- **Input:** Phase 2 endpoints, IC-002
- **Output:**
  - `/tests/backend/test_baselines.py`
  - `/tests/backend/test_compute_baseline.py`
  - `/tests/backend/test_weekly_summary.py`
- **Acceptance Criteria:**
  - [ ] Baseline create + snapshot test
  - [ ] Rebaseline test
  - [ ] DailyMatrixResponse planned field doğru
  - [ ] Weekly response format test
  - [ ] Summary response format test
  - [ ] Compute engine variance test
  - [ ] `pytest tests/backend/ -v` → all pass
- **Depends On:** TASK-2.3, TASK-2.5

---

## Dependency Graph

```
Phase 1 complete ──→ TASK-2.1 (Agent 1)
TASK-2.1 ──→ TASK-2.2 (Agent 1)
TASK-2.1 + TASK-2.2 ──→ TASK-2.3 (Agent 2)
TASK-2.3 ──→ TASK-2.4 (Agent 2)
TASK-2.4 ──→ TASK-2.5 (Agent 2)
TASK-2.5 + TASK-1.11 ──→ TASK-2.6 (Agent 3)
TASK-2.5 + TASK-1.10 ──→ TASK-2.7 (Agent 3)
TASK-2.6 + TASK-2.7 ──→ TASK-2.8 (Agent 3)
TASK-2.3 ──→ TASK-2.9 (Agent 3)
TASK-2.3 + TASK-2.5 ──→ TASK-2.10 (Agent 5)
```

## Paralel Çalışma Planı

| Slot | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|---------|
| 1    | TASK-2.1| wait    | wait    | -       | wait    |
| 2    | TASK-2.2| wait    | wait    | -       | wait    |
| 3    | done    | TASK-2.3| TASK-2.9| -       | wait    |
| 4    | -       | TASK-2.4| wait    | -       | wait    |
| 5    | -       | TASK-2.5| TASK-2.6, 2.7 | - | TASK-2.10 |
| 6    | -       | done    | TASK-2.8| -       | done    |

## Integration Points

Phase 2 sonunda test edilecek:
1. **Baseline flow:** Create baseline → snapshot kayıt → grid'de planned data görünüyor
2. **3 View sync:** Daily, Weekly, Summary aynı veriyi farklı formatta gösteriyor
3. **Variance display:** Actual vs Planned renk kodları çalışıyor
4. **Rebaseline:** Eski baseline deaktif → yeni baseline aktif → grid güncelleniyor
