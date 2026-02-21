# Phase 1 — Core Backend + Daily Grid

## Özet
Veritabanı şemasının tamamlanması, temel CRUD API endpoint'lerinin oluşturulması, Daily Grid View'ın AG Grid ile implemente edilmesi ve backend smoke test'lerinin yazılması. Bu phase sonunda kullanıcı günlük adam/miktar verisi girebilecek, grid'de görebilecek, veritabanına kaydedilecek.

## Başarı Kriteri (Phase Tamamlanma)
- [ ] Tam DB şeması deploy edilmiş (projects, wbs_items, daily_allocations)
- [ ] Views çalışıyor (vw_wbs_progress)
- [ ] Seed data yüklenmiş (test WBS items)
- [ ] TypeScript types auto-generated
- [ ] Tüm CRUD endpoint'leri çalışıyor (projects, wbs, allocations)
- [ ] DailyMatrixResponse doğru formatta dönüyor
- [ ] Batch update endpoint çalışıyor
- [ ] Daily Grid View render oluyor (AG Grid)
- [ ] Hücre düzenleme → debounce → API → DB flow çalışıyor
- [ ] CellRenderer renk kodları doğru
- [ ] Backend smoke test'leri pass
- [ ] Grid ↔ API ↔ DB integration çalışıyor

---

## Task Listesi

### TASK-1.1: Full Database Schema
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** ARCHITECTURE.md Section 3'teki tüm tabloları migration olarak oluştur: projects, wbs_items, daily_allocations. Index'ler, constraint'ler, updated_at trigger'ı dahil.
- **Input:** ARCHITECTURE.md Section 3.1, AGENT_1_DB_PROMPT.md
- **Output:**
  - `supabase/migrations/001_initial_schema.sql`
- **Acceptance Criteria:**
  - [ ] 3 tablo oluşturuldu (projects, wbs_items, daily_allocations)
  - [ ] UUID primary keys
  - [ ] Foreign key'ler doğru
  - [ ] UNIQUE constraint'ler: (project_id, wbs_code), (wbs_item_id, date)
  - [ ] Index'ler: FK kolonları + date
  - [ ] updated_at trigger fonksiyonu
  - [ ] `supabase db reset` başarılı
- **Depends On:** TASK-0.2

### TASK-1.2: Database Views
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** vw_wbs_progress view'ını oluştur. Daily matrix için gerekli query helper'ları.
- **Input:** ARCHITECTURE.md Section 3.2
- **Output:**
  - `supabase/migrations/002_views.sql`
- **Acceptance Criteria:**
  - [ ] vw_wbs_progress view doğru aggregate yapıyor
  - [ ] progress_pct, productivity_rate, remaining doğru hesaplanıyor
  - [ ] Division by zero koruması var
  - [ ] Örnek data ile test edilmiş
- **Depends On:** TASK-1.1

### TASK-1.3: Seed Data
- **Agent:** 1 (DB)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** Test project ve WBS items için seed data oluştur. WBS_DATA_PLACEHOLDER kullan, örnek kodlar: CW-01, CW-02, CW-03, DR-01, DR-02, GL-01.
- **Input:** WBS_DATA_PLACEHOLDER, AGENT_1_DB_PROMPT.md
- **Output:**
  - `supabase/seed.sql`
- **Acceptance Criteria:**
  - [ ] Test projesi oluşturuluyor
  - [ ] Minimum 6 WBS item seed edilmiş
  - [ ] Örnek daily_allocations (birkaç gün) seed edilmiş
  - [ ] Idempotent (tekrar çalıştırılabilir — ON CONFLICT DO NOTHING)
- **Depends On:** TASK-1.1

### TASK-1.4: RLS Policies (Basic)
- **Agent:** 1 (DB)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** Temel Row Level Security policy'leri. Başlangıçta authenticated users tüm verilere erişebilir.
- **Input:** AGENT_1_DB_PROMPT.md RLS Template
- **Output:**
  - `supabase/migrations/003_rls_policies.sql`
- **Acceptance Criteria:**
  - [ ] RLS enabled on all tables
  - [ ] Authenticated users: SELECT, INSERT, UPDATE izinli
  - [ ] Anonymous users: erişim yok
- **Depends On:** TASK-1.1

### TASK-1.5: TypeScript Type Generation
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** Supabase CLI ile TypeScript type'ları generate et.
- **Input:** Completed schema
- **Output:**
  - `src/types/database.ts`
- **Acceptance Criteria:**
  - [ ] Type generation başarılı
  - [ ] Tüm tablolar type'larda mevcut
  - [ ] Type dosyası compile edilebiliyor
- **Depends On:** TASK-1.1, TASK-1.2

### TASK-1.6: Projects CRUD Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Projects router ve service: list, create, get by id.
- **Input:** ARCHITECTURE.md Section 4.1, Pydantic models from AGENT_2_BACKEND_PROMPT.md
- **Output:**
  - `/backend/routers/projects.py`
  - `/backend/services/schedule_service.py` (projects kısmı)
  - `/backend/models/schemas.py` (ProjectCreate, ProjectResponse)
- **Acceptance Criteria:**
  - [ ] GET /api/v1/projects/ → 200, project listesi
  - [ ] POST /api/v1/projects/ → 201, yeni proje
  - [ ] GET /api/v1/projects/{id} → 200, proje detay
  - [ ] 404 for missing project
  - [ ] Validation error → 422
- **Depends On:** TASK-0.3, TASK-1.1

### TASK-1.7: WBS CRUD Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** WBS router ve service: tree listing (hierarchical), create, update, import, export.
- **Input:** ARCHITECTURE.md Section 4.1
- **Output:**
  - `/backend/routers/wbs.py`
  - Schedule service WBS methods
  - WBS Pydantic models
- **Acceptance Criteria:**
  - [ ] GET /wbs/{project_id}/items → hierarchical WBS tree
  - [ ] POST /wbs/{project_id}/items → create WBS item
  - [ ] PUT /wbs/{project_id}/items/{id} → update
  - [ ] Parent-child hierarchy doğru çalışıyor
  - [ ] Import endpoint skeleton (tam implementasyon Phase 4)
- **Depends On:** TASK-1.6

### TASK-1.8: Allocations Endpoints + Daily Matrix
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Allocation router: daily matrix GET (date range query, pivot to DailyMatrixResponse), batch update PUT. Compute engine entegrasyonu.
- **Input:** ARCHITECTURE.md Section 4.1, IC-002 DailyMatrixResponse
- **Output:**
  - `/backend/routers/allocations.py`
  - `/backend/services/compute_engine.py`
  - Allocation Pydantic models
- **Acceptance Criteria:**
  - [ ] GET /allocations/{project_id}/daily?from=&to= → DailyMatrixResponse
  - [ ] Response: wbs_items (progress), date_range, matrix, totals
  - [ ] PUT /allocations/{project_id}/daily → batch update
  - [ ] Batch update: multiple cells in one request
  - [ ] Compute engine: progress_pct, productivity_rate hesaplıyor
  - [ ] Date range filtering çalışıyor
  - [ ] Error handling: invalid dates, missing project
- **Depends On:** TASK-1.7, TASK-1.5

### TASK-1.9: Audit Log Middleware
- **Agent:** 2 (Backend)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** POST/PUT/DELETE request'leri intercept edip audit_log tablosuna yazan middleware.
- **Input:** ARCHITECTURE.md audit_log schema
- **Output:**
  - `/backend/middleware/audit.py`
- **Acceptance Criteria:**
  - [ ] POST, PUT, DELETE request'leri loglanıyor
  - [ ] table_name, record_id, action, old_values, new_values kaydediliyor
  - [ ] GET request'leri loglanmıyor
  - [ ] Performance impact minimal
- **Depends On:** TASK-1.6

### TASK-1.10: App Layout Shell
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Ana uygulama layout: Sidebar (ProjectSelector, ViewToggle, DateNavigator) + MainContent alanı.
- **Input:** ARCHITECTURE.md Section 5.1
- **Output:**
  - `/frontend/src/App.tsx`
  - `/frontend/src/components/layout/Sidebar.tsx`
  - `/frontend/src/components/layout/MainContent.tsx`
  - `/frontend/src/components/layout/Header.tsx`
  - `/frontend/src/components/shared/ProjectSelector.tsx`
  - `/frontend/src/components/shared/ViewToggle.tsx`
  - `/frontend/src/components/shared/DateNavigator.tsx`
  - `/frontend/src/stores/uiStore.ts` (activeView, dateRange)
  - `/frontend/src/stores/projectStore.ts` (activeProject)
- **Acceptance Criteria:**
  - [ ] Sidebar render oluyor (sol taraf)
  - [ ] MainContent alanı boş placeholder ile render
  - [ ] ViewToggle: Daily/Weekly/Summary butonları
  - [ ] DateNavigator: ← Bu Hafta → navigasyonu
  - [ ] Zustand stores çalışıyor
  - [ ] Responsive: sidebar collapses on mobile
- **Depends On:** TASK-0.4

### TASK-1.11: Daily Grid View (AG Grid)
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** XL
- **Description:** AG Grid ile Daily Grid View: frozen WBS kolonları, scrollable date kolonları, hücre düzenleme, CellRenderer renk kodları, TotalRow, debounce → batch update flow.
- **Input:** ARCHITECTURE.md Section 5.2, 5.3, IC-002 DailyMatrixResponse
- **Output:**
  - `/frontend/src/components/grid/DailyGridView.tsx`
  - `/frontend/src/components/grid/CellRenderer.tsx`
  - `/frontend/src/components/grid/GridToolbar.tsx`
  - `/frontend/src/hooks/useAllocations.ts`
  - `/frontend/src/hooks/useWBS.ts`
- **Acceptance Criteria:**
  - [ ] AG Grid render oluyor
  - [ ] WBS kolonları frozen (pinned left): Code, Name, QTY, Done, Rem, %, MP/Day, Days, TMD
  - [ ] Date kolonları scrollable
  - [ ] Hücre editable (inline edit)
  - [ ] CellRenderer renk kodları:
    - Boş → gri, Eşit → beyaz, Fazla → yeşil, Eksik → kırmızı, Gelecek → açık mavi
  - [ ] Today column highlighted (kalın border)
  - [ ] Debounce (300ms) → batch API call
  - [ ] TotalRow: günlük toplam adam
  - [ ] API'den data fetch ediliyor (useAllocations hook)
- **Depends On:** TASK-1.10, TASK-1.8

### TASK-1.12: Backend Smoke Tests
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Phase 1 smoke test'leri: Projects CRUD, WBS CRUD, Allocations, Compute engine.
- **Input:** Phase 1 endpoints, IC-002
- **Output:**
  - `/tests/backend/test_projects.py`
  - `/tests/backend/test_wbs.py`
  - `/tests/backend/test_allocations.py`
  - `/tests/backend/test_compute_engine.py`
  - `/tests/conftest.py` (updated fixtures)
- **Acceptance Criteria:**
  - [ ] All CRUD endpoint'ler test edildi
  - [ ] DailyMatrixResponse shape doğru
  - [ ] Batch update test edildi
  - [ ] Compute engine formülleri test edildi
  - [ ] Error case'ler test edildi (404, 422)
  - [ ] `pytest tests/backend/ -v` → all pass
- **Depends On:** TASK-1.6, TASK-1.7, TASK-1.8

---

## Dependency Graph

```
TASK-1.1 (Agent 1) ──→ TASK-1.2 (Agent 1)
TASK-1.1 (Agent 1) ──→ TASK-1.3 (Agent 1)
TASK-1.1 (Agent 1) ──→ TASK-1.4 (Agent 1)
TASK-1.1 (Agent 1) ──→ TASK-1.5 (Agent 1)
TASK-1.1 (Agent 1) ──→ TASK-1.6 (Agent 2)
TASK-1.6 (Agent 2) ──→ TASK-1.7 (Agent 2)
TASK-1.7 (Agent 2) ──→ TASK-1.8 (Agent 2)
TASK-1.5 (Agent 1) ──→ TASK-1.8 (Agent 2)
TASK-1.6 (Agent 2) ──→ TASK-1.9 (Agent 2)
TASK-0.4 (Agent 3) ──→ TASK-1.10 (Agent 3)
TASK-1.10 + TASK-1.8 ──→ TASK-1.11 (Agent 3)
TASK-1.6 + TASK-1.7 + TASK-1.8 ──→ TASK-1.12 (Agent 5)
```

## Paralel Çalışma Planı

| Slot | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|---------|
| 1    | TASK-1.1| wait    | TASK-1.10| -      | wait    |
| 2    | TASK-1.2, 1.3, 1.4 | TASK-1.6 | TASK-1.10 (cont.) | - | wait |
| 3    | TASK-1.5 | TASK-1.7 | wait (API gerekli) | - | wait |
| 4    | done    | TASK-1.8, 1.9 | TASK-1.11 | - | TASK-1.12 (partial) |
| 5    | -       | done    | TASK-1.11 (cont.) | - | TASK-1.12 |
| 6    | -       | -       | done    | -       | done    |

## Integration Points

Phase 1 sonunda test edilecek tam akış:
1. **DB → Backend:** Schema doğru, endpoint'ler DB'ye yazabiliyor/okuyabiliyor
2. **Backend → Frontend:** API'den DailyMatrixResponse dönüyor, Frontend doğru render ediyor
3. **Frontend → Backend → DB:** Grid cell edit → debounce → PUT batch → DB write → response
4. **Full flow:** Seed data yükle → Grid'de göster → Hücre düzenle → DB'de güncelle → Grid refresh

### Integration Test Senaryosu
```
1. Seed data yüklü (projects + wbs_items + allocations)
2. Frontend → GET /allocations/{project_id}/daily?from=2026-02-17&to=2026-02-23
3. Grid render oluyor (6 WBS satırı × 7 gün)
4. CW-01, 2026-02-19 hücresine "5" yaz
5. 300ms debounce sonrası → PUT /allocations/{project_id}/daily
6. Backend validates + writes DB + returns updated
7. Grid cell renk güncellemesi (baseline karşılaştırma)
8. TotalRow güncellenmesi
```
