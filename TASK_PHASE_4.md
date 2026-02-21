# Phase 4 — Reports + Polish + Deploy

## Özet
PDF/Excel export, haftalık rapor üreteci, Dashboard KPI paneli, E2E testler, mobile responsive tuning ve final deploy. Bu phase sonunda uygulama production-ready olacak — tüm ana özellikler çalışıyor, test edilmiş, responsive ve deploy edilmiş.

## Başarı Kriteri (Phase Tamamlanma)
- [ ] PDF export çalışıyor (proje raporu)
- [ ] Excel export çalışıyor (grid data)
- [ ] Dashboard KPI panel görünüyor (ilerleme özeti, manday, productivity)
- [ ] Import modal çalışıyor (Excel/CSV WBS import)
- [ ] What-If modal çalışıyor
- [ ] E2E testleri pass (Playwright)
- [ ] Mobile responsive: ana görünümler mobilde okunabiliyor
- [ ] CI/CD pipeline tam çalışıyor (lint, type check, test, build, deploy)
- [ ] Production deploy başarılı (Vercel + Railway/Supabase)
- [ ] Performance: grid 500 WBS × 90 gün < 1s render

---

## Task Listesi

### TASK-4.1: PDF Export Endpoint
- **Agent:** 2 (Backend)
- **Priority:** P1
- **Estimated Effort:** L
- **Description:** PDF rapor export'u. Proje özeti, WBS progress tablosu, Gantt-like timeline. WeasyPrint veya ReportLab kullanarak.
- **Input:** ARCHITECTURE.md Section 4.1 reports endpoints
- **Output:**
  - `/backend/routers/reports.py`
  - `/backend/services/import_export.py` (PDF generation kısmı)
- **Acceptance Criteria:**
  - [ ] GET /reports/{project_id}/pdf → PDF dosyası (binary response)
  - [ ] PDF içeriği: proje adı, tarih, WBS progress tablosu
  - [ ] Her WBS için: code, name, qty, done, %, TMD
  - [ ] Gantt-like bar gösterimi (opsiyonel — basit tablo yeterli)
  - [ ] Türkçe karakter desteği
  - [ ] Dosya boyutu < 5MB
- **Depends On:** Phase 3 complete

### TASK-4.2: Excel Export Endpoint
- **Agent:** 2 (Backend)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Excel export: grid data'yı openpyxl ile .xlsx dosyasına dönüştür.
- **Input:** DailyMatrixResponse data
- **Output:**
  - `/backend/services/import_export.py` (Excel generation kısmı)
  - Reports router güncelleme
- **Acceptance Criteria:**
  - [ ] GET /reports/{project_id}/excel → XLSX dosyası
  - [ ] Excel: WBS satırları × tarih kolonları (grid ile aynı yapı)
  - [ ] Frozen ilk 9 kolon (WBS info)
  - [ ] Cell renkleme (opsiyonel)
  - [ ] Baseline vs Actual ayrı sheet (opsiyonel)
  - [ ] Summary sheet
- **Depends On:** Phase 3 complete

### TASK-4.3: Excel/CSV Import
- **Agent:** 2 (Backend)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** WBS import endpoint. Excel veya CSV dosyasından WBS items bulk import.
- **Input:** WBS router import endpoint skeleton
- **Output:**
  - WBS router import endpoint implementasyon
  - import_export.py (import kısmı)
- **Acceptance Criteria:**
  - [ ] POST /wbs/{project_id}/import → upload file → parse → insert
  - [ ] Excel format: columns = wbs_code, wbs_name, qty, unit, parent_code, sort_order
  - [ ] CSV format: same columns, comma-separated
  - [ ] Validation: duplicate code check, required field check
  - [ ] Error response: row number + error detail
  - [ ] Partial import option: valid rows import, invalid rows return
- **Depends On:** Phase 3 complete

### TASK-4.4: Dashboard KPI Panel
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Dashboard/Header area'da KPI kartları: toplam ilerleme, planned vs actual manday, productivity, risk count.
- **Input:** vw_wbs_progress, forecast data
- **Output:**
  - Dashboard KPI component'leri (Header veya MainContent üstü)
  - KPI data hook
- **Acceptance Criteria:**
  - [ ] Overall Progress: % bar (tüm WBS ağırlıklı ortalama)
  - [ ] Total Manday: Planned vs Actual (sayısal + bar chart)
  - [ ] Average Productivity: birim/adam oranı
  - [ ] Risk Count: High/Medium/Low risk WBS sayıları
  - [ ] Auto-refresh: veriler güncellenince KPI'lar da güncelleniyor
  - [ ] Compact layout: tek satırda veya 2 satırda kartlar
- **Depends On:** Phase 3 complete

### TASK-4.5: Import/Export Modals
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** ImportModal (Excel/CSV drag-drop), ExportModal (PDF/Excel seçenekleri).
- **Input:** Import/Export endpoints
- **Output:**
  - `/frontend/src/components/shared/ImportModal.tsx` (güncelle veya oluştur)
  - `/frontend/src/components/shared/ExportModal.tsx` (güncelle veya oluştur)
- **Acceptance Criteria:**
  - [ ] Import Modal: drag-drop area, dosya seçme, format detection
  - [ ] Import: progress bar, success/error per row feedback
  - [ ] Export Modal: PDF veya Excel seçimi, tarih aralığı seçimi
  - [ ] Export: download trigger, loading state
  - [ ] Error handling: file too large, invalid format
- **Depends On:** TASK-4.1, TASK-4.2, TASK-4.3

### TASK-4.6: What-If Modal
- **Agent:** 3 (Frontend)
- **Priority:** P2
- **Estimated Effort:** M
- **Description:** What-If senaryo modal'ı. Kullanıcı senaryo girer, AI impact analizi gösterir.
- **Input:** AI whatif endpoint
- **Output:**
  - `/frontend/src/components/shared/WhatIfModal.tsx` (güncelle veya oluştur)
- **Acceptance Criteria:**
  - [ ] Senaryo input: free-text (Türkçe doğal dil)
  - [ ] Önerilen senaryolar: "+N adam", "WBS-X durdur", "deadline uzat"
  - [ ] Submit → AI analysis → result display
  - [ ] Result: before/after comparison (tarih, manday, risk)
  - [ ] Loading state, error handling
- **Depends On:** TASK-3.8

### TASK-4.7: Mobile Responsive Tuning
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Tüm view'ların mobile responsive review ve düzeltmesi. Grid'de horizontal scroll, sidebar collapse, panel'ler full-screen modal.
- **Input:** CONVENTIONS.md responsive breakpoints
- **Output:**
  - Component style güncellemeleri
  - Mobile-specific layout adjustments
- **Acceptance Criteria:**
  - [ ] Mobile (< 768px): Sidebar hamburger menu, grid read-only scroll
  - [ ] Tablet (768-1024px): Sidebar collapsible, grid functional
  - [ ] Desktop (> 1024px): Full layout, all panels
  - [ ] Chat panel: mobile'da full-screen overlay
  - [ ] AI panel: mobile'da ayrı tab/page
  - [ ] Touch gestures: swipe for navigation (opsiyonel)
  - [ ] No horizontal overflow (except grid)
- **Depends On:** Phase 3 complete

### TASK-4.8: E2E Tests (Playwright)
- **Agent:** 5 (DevOps)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Playwright ile end-to-end test senaryoları: grid editing, chat flow, view toggle, baseline, export.
- **Input:** All endpoints, all views
- **Output:**
  - `/tests/e2e/grid-editing.spec.ts`
  - `/tests/e2e/chat-flow.spec.ts`
  - `/tests/e2e/view-toggle.spec.ts`
  - `/tests/e2e/baseline-flow.spec.ts`
  - `/tests/e2e/export-flow.spec.ts`
- **Acceptance Criteria:**
  - [ ] Grid cell edit → value persisted → color updated
  - [ ] Chat message → preview → confirm → grid updated
  - [ ] Daily → Weekly → Summary view toggle smooth
  - [ ] Baseline create → grid shows planned values
  - [ ] Export PDF/Excel → file downloaded
  - [ ] All E2E tests pass: `npx playwright test`
  - [ ] No flaky tests (explicit waits, no arbitrary sleep)
- **Depends On:** Phase 3 complete, TASK-4.5

### TASK-4.9: Performance Testing
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Grid render performance testi (500 WBS × 90 gün), API response time, bundle size analizi.
- **Input:** Performance targets from ARCHITECTURE.md Section 10
- **Output:**
  - Performance test script'leri
  - Performance report
- **Acceptance Criteria:**
  - [ ] Grid render: 500 WBS × 90 gün < 1 saniye
  - [ ] API CRUD response: < 200ms
  - [ ] API AI response: < 5 saniye (mock)
  - [ ] Frontend bundle: < 500KB gzipped
  - [ ] FCP: < 2 saniye
  - [ ] No memory leaks (10 dakika kullanım sonrası)
- **Depends On:** Phase 3 complete

### TASK-4.10: CI/CD Full Pipeline
- **Agent:** 5 (DevOps)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** CI/CD pipeline'ı tam hale getir: lint, type check, backend tests, frontend tests, E2E tests, build, deploy.
- **Input:** `.github/workflows/ci.yml` skeleton
- **Output:**
  - `.github/workflows/ci.yml` (final)
  - `.github/workflows/deploy.yml` (production deploy)
- **Acceptance Criteria:**
  - [ ] CI: lint → type check → test → build (her PR'da)
  - [ ] Deploy: main merge → auto-deploy
  - [ ] Backend deploy: Railway veya Supabase Edge Functions
  - [ ] Frontend deploy: Vercel
  - [ ] Environment secrets configured
  - [ ] Pipeline < 10 dakika
- **Depends On:** TASK-4.8

### TASK-4.11: Final Integration & Deploy
- **Agent:** Orchestrator
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Tüm agent output'larının final review'ı, integration test, production deploy.
- **Input:** Tüm Phase 4 task'ları
- **Output:**
  - Final review raporu
  - Production deployment
  - README.md güncellemesi
- **Acceptance Criteria:**
  - [ ] Tüm Phase 0-4 acceptance criteria karşılandı
  - [ ] E2E tests pass
  - [ ] Performance targets met
  - [ ] Production deploy başarılı
  - [ ] README.md güncel (setup, usage, architecture)
  - [ ] No critical TODO/FIXME kalmadı
  - [ ] .env.example güncel
- **Depends On:** Tüm TASK-4.x

---

## Dependency Graph

```
Phase 3 complete ──→ TASK-4.1 (Agent 2)
Phase 3 complete ──→ TASK-4.2 (Agent 2)
Phase 3 complete ──→ TASK-4.3 (Agent 2)
Phase 3 complete ──→ TASK-4.4 (Agent 3)
TASK-4.1 + 4.2 + 4.3 ──→ TASK-4.5 (Agent 3)
TASK-3.8 ──→ TASK-4.6 (Agent 3)
Phase 3 complete ──→ TASK-4.7 (Agent 3)
Phase 3 + TASK-4.5 ──→ TASK-4.8 (Agent 5)
Phase 3 complete ──→ TASK-4.9 (Agent 5)
TASK-4.8 ──→ TASK-4.10 (Agent 5)
All TASK-4.x ──→ TASK-4.11 (Orchestrator)
```

## Paralel Çalışma Planı

| Slot | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|---------|
| 1    | -       | TASK-4.1, 4.2, 4.3 | TASK-4.4, 4.7 | -  | TASK-4.9 |
| 2    | -       | done    | TASK-4.5, 4.6 | -       | wait    |
| 3    | -       | -       | done    | -       | TASK-4.8 |
| 4    | -       | -       | -       | -       | TASK-4.10 |
| 5    | -       | -       | -       | -       | done    |
| 6    | -       | -       | -       | -       | TASK-4.11 (Orch) |

## Integration Points

Phase 4 sonunda test edilecek:

### Full Application Smoke Test
```
1. Fresh deploy (clean DB)
2. Import WBS data (Excel)
3. Create baseline
4. Daily grid'de birkaç gün data gir
5. Chat'ten veri gir → preview → confirm
6. Weekly view'da haftalık özeti kontrol
7. Summary view'da Gantt barlarını kontrol
8. Generate Forecast → AI panel'de sonuçları gör
9. Export PDF → dosya indir, içeriği kontrol
10. Export Excel → dosya indir, grid data uyuşuyor mu
11. Mobile browser'da aç → responsive layout kontrol
```

### Performance Benchmark
```
- 500 WBS items seed
- 90 gün tarih aralığı
- Grid render time: < 1s
- Cell edit → DB write: < 500ms
- Page load: < 2s
- Bundle size: < 500KB gzipped
```
