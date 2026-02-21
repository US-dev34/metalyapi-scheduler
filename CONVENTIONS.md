# CONVENTIONS.md — Kod Standartları ve Kurallar

**Proje:** MetalYapi Façade Scheduling Platform
**Versiyon:** 1.0
**Son Güncelleme:** 2026-02-20
**Yönetici:** Orchestrator Agent

---

## 1. Genel Kurallar

| Kural | Değer |
|-------|-------|
| Frontend Dili | TypeScript (strict mode) |
| Backend Dili | Python 3.12+ |
| Encoding | UTF-8 |
| Line Endings | LF (Unix) — `.gitattributes` ile enforce |
| Frontend Indent | 2 space |
| Backend Indent | 4 space |
| Max Line Length | 100 karakter (TS), 120 karakter (Python) |
| Trailing Whitespace | Yok |
| Final Newline | Her dosyanın sonunda 1 boş satır |

---

## 2. Naming Conventions

### 2.1 Database (Agent 1)

| Öğe | Convention | Örnek |
|-----|------------|-------|
| Tablo adları | snake_case, çoğul | `wbs_items`, `daily_allocations` |
| Kolon adları | snake_case | `wbs_code`, `actual_manpower` |
| Primary Key | `id` (UUID) | `id uuid DEFAULT gen_random_uuid()` |
| Foreign Key | `{tablo_tekil}_id` | `project_id`, `wbs_item_id` |
| Index | `idx_{tablo}_{kolon}` | `idx_allocations_date` |
| View | `vw_{isim}` | `vw_wbs_progress` |
| Function | `fn_{isim}` | `fn_calculate_progress` |
| Migration | `{sıra_no}_{açıklama}.sql` | `001_initial_schema.sql` |

### 2.2 Python / Backend (Agent 2, Agent 4)

| Öğe | Convention | Örnek |
|-----|------------|-------|
| Dosya adları | snake_case | `schedule_service.py` |
| Fonksiyonlar | snake_case | `get_daily_matrix()` |
| Değişkenler | snake_case | `wbs_items`, `date_range` |
| Class'lar | PascalCase | `AllocationService` |
| Pydantic Model | PascalCase + suffix | `AllocationUpdateRequest` |
| Constants | UPPER_SNAKE_CASE | `MAX_FORECAST_DAYS` |
| Router prefix | kebab-case URL | `/api/v1/wbs/` |
| Request/Response body | snake_case keys | `{"actual_manpower": 5}` |

### 2.3 TypeScript / Frontend (Agent 3)

| Öğe | Convention | Örnek |
|-----|------------|-------|
| Dosya adları (component) | PascalCase | `DailyGridView.tsx` |
| Dosya adları (hook) | camelCase + `use` prefix | `useAllocations.ts` |
| Dosya adları (store) | camelCase + `Store` suffix | `uiStore.ts` |
| Dosya adları (lib) | camelCase | `api.ts`, `utils.ts` |
| Component'ler | PascalCase | `<ChatPanel />` |
| Hook'lar | camelCase + `use` prefix | `useWBS()` |
| Fonksiyonlar | camelCase | `handleCellEdit()` |
| Değişkenler | camelCase | `dateRange`, `wbsItems` |
| Interface/Type | PascalCase | `DailyMatrixResponse` |
| Enum | PascalCase | `ViewMode.Daily` |
| Constants | UPPER_SNAKE_CASE | `DEBOUNCE_MS` |
| CSS class | Tailwind utility | `className="flex gap-2"` |

### 2.4 API Endpoints

```
Format: {HTTP_METHOD} /api/v1/{resource}/{sub-resource}

URL path:      kebab-case    → /api/v1/wbs/items
Query params:  snake_case    → ?from_date=2026-02-17
Request body:  snake_case    → { "actual_manpower": 5 }
Response body: snake_case    → { "wbs_code": "CW-01" }
```

---

## 3. Git Conventions

### 3.1 Branch Naming

```
Format: {type}/{agent}-{kısa-açıklama}

Örnekler:
  feature/agent1-initial-schema
  feature/agent2-crud-endpoints
  feature/agent3-daily-grid
  feature/agent4-nlp-parser
  feature/agent5-docker-setup
  fix/agent2-allocation-validation
  refactor/agent3-grid-performance
```

### 3.2 Commit Message

```
Format: {type}({scope}): {message}

type:   feat | fix | refactor | test | docs | chore
scope:  db | api | ui | ai | devops | orch

Örnekler:
  feat(db): add initial schema migration with WBS tables
  feat(api): implement allocation batch update endpoint
  feat(ui): add DailyGridView with AG Grid cell editing
  feat(ai): implement NLP message parser with Claude API
  fix(api): correct productivity rate calculation
  test(devops): add backend smoke tests for CRUD endpoints
  refactor(ui): extract CellRenderer to shared components
  docs(orch): update INTERFACE_CONTRACTS.md with new response type
  chore(devops): update Docker base images
```

### 3.3 Branch Stratejisi

```
main
  └── develop
        ├── feature/agent1-xxx
        ├── feature/agent2-xxx
        ├── feature/agent3-xxx
        ├── feature/agent4-xxx
        └── feature/agent5-xxx
```

- Her agent `develop` branch'inden kendi feature branch'ini açar
- PR → `develop` branch'ine merge (Orchestrator review)
- Phase sonu → `develop` → `main` merge (Orchestrator onayı)

---

## 4. File Organization

### 4.1 Agent Scope Kuralları

- Her agent **sadece** AGENTS.md'de belirtilen dizinlerde çalışır
- Scope dışı dosyaya dokunmak → **STOP** + Orchestrator'a bildir
- Shared types: `/src/types/database.ts` — **sadece Agent 1** auto-generate eder, diğerleri read-only

### 4.2 Import Sıralaması

**TypeScript:**
```typescript
// 1. External libraries
import React from 'react';
import { useQuery } from '@tanstack/react-query';

// 2. Internal types
import type { WBSItem, DailyAllocation } from '@/types';

// 3. Internal modules
import { api } from '@/lib/api';
import { useUIStore } from '@/stores/uiStore';

// 4. Local modules
import { CellRenderer } from './CellRenderer';
```

**Python:**
```python
# 1. Standard library
from datetime import date, timedelta
from typing import Optional

# 2. Third-party
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# 3. Internal
from services.schedule_service import ScheduleService
from models.schemas import AllocationUpdateRequest
```

### 4.3 Dosya Boyut Limitleri

- Tek dosya max **300 satır** (aşarsa refactor gerekli)
- Component max **200 satır** (UI logic ayrı hook'a taşınır)
- Service max **250 satır** (büyürse modüllere bölünür)

---

## 5. Error Handling

### 5.1 Backend Error Response Format

```python
# Tüm API error'ları bu formatta döner:
{
    "error": "Human readable error message",
    "code": "ALLOCATION_NOT_FOUND",
    "details": {
        "wbs_id": "uuid-xxx",
        "date": "2026-02-19"
    }
}

# HTTP Status Kodları:
# 200 — Success
# 201 — Created
# 400 — Bad Request (validation error)
# 404 — Not Found
# 409 — Conflict (duplicate, version mismatch)
# 422 — Unprocessable Entity (business rule violation)
# 500 — Internal Server Error
# 503 — Service Unavailable (AI service down)
```

### 5.2 Backend Error Codes

```
Prefix bazlı error code:
  PRJ_   → Project errors (PRJ_NOT_FOUND, PRJ_DUPLICATE)
  WBS_   → WBS errors (WBS_NOT_FOUND, WBS_INVALID_CODE)
  ALC_   → Allocation errors (ALC_DATE_INVALID, ALC_NEGATIVE_VALUE)
  BSL_   → Baseline errors (BSL_NO_ACTIVE, BSL_VERSION_CONFLICT)
  AI_    → AI errors (AI_UNAVAILABLE, AI_PARSE_FAILED, AI_TOKEN_LIMIT)
  EXP_   → Export errors (EXP_GENERATION_FAILED)
  AUTH_  → Auth errors (AUTH_UNAUTHORIZED, AUTH_FORBIDDEN)
```

### 5.3 Frontend Error Handling

```typescript
// TanStack Query error boundary pattern:
const { data, error, isLoading } = useQuery({
  queryKey: ['allocations', projectId, dateRange],
  queryFn: () => api.getAllocations(projectId, dateRange),
  retry: 2,
  retryDelay: 1000,
});

// Error display:
// - API errors → toast notification
// - Network errors → banner "Bağlantı sorunu"
// - AI errors → inline message "AI şu an kullanılamıyor, manuel giriş yapabilirsiniz"
```

### 5.4 AI Graceful Degradation

```
AI fail ≠ App fail. Her zaman:
1. AI unavailable → kullanıcıya "AI servisi şu an kullanılamıyor" mesajı
2. NLP parse fail → kullanıcıya "Mesaj anlaşılamadı, lütfen tekrar deneyin" + grid'den manuel giriş yönlendirmesi
3. Forecast fail → son başarılı forecast'ı göster + "Güncelleme başarısız" notu
4. Token limit → mesajı kısaltıp tekrar dene, yine fail → graceful error
```

---

## 6. Environment Variables

### 6.1 Naming Convention

```bash
# Backend (.env) — prefix yok
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
CLAUDE_API_KEY=sk-ant-...
DATABASE_URL=postgresql://...
CORS_ORIGINS=http://localhost:5173

# Frontend (.env) — VITE_ prefix zorunlu
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE_URL=http://localhost:8000
```

### 6.2 Kurallar

- **Asla hardcode secret yok** — tüm secret'lar .env'den okunur
- `.env` dosyaları `.gitignore`'da
- `.env.example` her zaman güncel (Agent 5 yönetir)
- Her yeni env variable → `.env.example`'a eklenir
- Default value'lar sadece development için kabul edilir

---

## 7. API Versioning

```
Base URL: /api/v1/

Kurallar:
  - Tüm endpoint'ler /api/v1/ prefix ile başlar
  - Breaking change = yeni version (v2)
  - Non-breaking ekleme (yeni field, yeni endpoint) → mevcut version'da
  - Deprecation → header ile bildir, min 1 phase geçiş süresi
```

---

## 8. Documentation

### 8.1 Backend (Python)

```python
async def get_daily_matrix(
    project_id: str,
    from_date: date,
    to_date: date,
    view: str = "daily"
) -> DailyMatrixResponse:
    """
    Daily allocation matrisini döndürür.

    WBS satırları × tarih kolonları formatında pivot edilmiş data.
    Baseline karşılaştırması dahil.

    Args:
        project_id: Proje UUID
        from_date: Başlangıç tarihi (inclusive)
        to_date: Bitiş tarihi (inclusive)
        view: Görünüm tipi (daily|weekly|summary)

    Returns:
        DailyMatrixResponse with wbs_items, date_range, matrix, totals

    Raises:
        HTTPException 404: Project not found
    """
```

### 8.2 Frontend (TypeScript)

```typescript
/**
 * Daily allocation matrisini fetch eder ve cache'ler.
 *
 * AG Grid'in ihtiyaç duyduğu format'ta data döner.
 * 300ms debounce ile cell edit'leri batch olarak gönderir.
 *
 * @param projectId - Aktif proje UUID
 * @param dateRange - { from: string, to: string } YYYY-MM-DD format
 * @returns TanStack Query result with DailyMatrixResponse
 */
export function useAllocations(projectId: string, dateRange: DateRange) {
```

### 8.3 Kurallar

- Her public fonksiyon/method → docstring/JSDoc **zorunlu**
- Private/internal → sadece karmaşık logic'te comment
- Complex algorithm → inline comment ile açıklama
- TODO format: `// TODO(agent-N): açıklama` — kimin sorumluluğu olduğu belli olsun
- FIXME format: `// FIXME(agent-N): açıklama` — bilinen bug
- HACK format: `// HACK(agent-N): geçici çözüm, neden` — technical debt

---

## 9. Dependency Rules

### 9.1 Onay Süreci

- Yeni dependency ekleme → **Orchestrator onayı gerekir**
- Her agent ekleme isteğinde: paket adı, versiyon, neden, alternatifler
- Minimum dependency prensibi — "bunu stdlib ile yapabilir miyiz?" önce sor

### 9.2 Versiyon Pinleme

```bash
# Python (requirements.txt) — exact version
fastapi==0.115.0
pydantic==2.7.0
anthropic==0.40.0

# TypeScript (package.json) — exact version (no ^, no ~)
"dependencies": {
  "react": "18.3.1",
  "ag-grid-react": "32.0.0",
  "@tanstack/react-query": "5.50.0"
}
```

### 9.3 Approved Dependencies

**Backend (Python):**
- `fastapi` — Web framework
- `uvicorn` — ASGI server
- `pydantic` — Validation
- `anthropic` — Claude API SDK
- `supabase-py` — Supabase client
- `httpx` — HTTP client
- `python-multipart` — File upload
- `openpyxl` — Excel processing
- `weasyprint` veya `reportlab` — PDF generation

**Frontend (TypeScript):**
- `react`, `react-dom` — UI framework
- `ag-grid-react`, `ag-grid-community` — Grid engine
- `@tanstack/react-query` — Server state
- `zustand` — Client state
- `@supabase/supabase-js` — Supabase client
- `tailwindcss` — Styling
- `shadcn/ui` components — UI kit
- `frappe-gantt` veya `dhtmlx-gantt` — Gantt chart
- `zod` — Schema validation
- `date-fns` — Date utilities
- `lucide-react` — Icons
- `axios` veya native `fetch` — HTTP client

---

## 10. Communication Protocol

### 10.1 Agent → Orchestrator Communication

```
Durum 1: Scope dışı değişiklik gerekli
→ STOP + Orchestrator'a bildir
→ "Agent 2: /frontend/src/types/index.ts'e yeni type eklemem gerekiyor — ForecastView için"
→ Orchestrator: Ya izin verir ya da doğru agent'a yönlendirir

Durum 2: Interface contract conflict
→ STOP + INTERFACE_CONTRACTS.md referans ver
→ "Agent 3: IC-002'deki DailyMatrixResponse'da totals field'ı eksik, Agent 2 ile sync gerekli"
→ Orchestrator: Contract'ı günceller veya agent'ları koordine eder

Durum 3: Dependency eksik
→ Bekle veya mock ile ilerle
→ Orchestrator'a bildir: "Agent 3: Agent 2'nin allocation endpoint'i henüz hazır değil, mock data ile ilerliyorum"
→ Integration point'te gerçek endpoint'e geçiş yapılır

Durum 4: Belirsizlik
→ STOP + netleştir, varsayımla ilerleme
→ "Agent 4: NLP parser'da tarih formatı belirsiz — DD.MM.YYYY mi YYYY-MM-DD mi? Varsayım: DD.MM.YYYY (Türk formatı)"
→ Orchestrator: Onaylar veya düzeltir

Durum 5: Task tamamlandı
→ Self-check → acceptance criteria listele → "TASK-1.3 tamamlandı, tüm kriterler sağlanıyor"
```

### 10.2 Orchestrator → Agent Communication

```
Task atama template'i ORCHESTRATOR_PROMPT.md'de tanımlıdır.
Her task:
  - Scope belirtir (hangi dosyalar)
  - Acceptance criteria belirtir (ne tamamlanmış sayılır)
  - Dependency belirtir (neyi bekliyor)
  - Priority belirtir (P0/P1/P2)
```

### 10.3 Agent ↔ Agent Communication

- Agent'lar **doğrudan birbirleriyle iletişim kurmaz**
- Tüm koordinasyon Orchestrator üzerinden
- Shared interface → INTERFACE_CONTRACTS.md üzerinden
- Code sharing → AGENTS.md'deki "Reads" section'ı ile

---

## 11. Testing Standards

### 11.1 Backend (Pytest)

```python
# Test dosya yapısı: tests/backend/test_{module}.py
# Naming: test_{fonksiyon_adı}_{senaryo}
# Fixture'lar: conftest.py'de

def test_get_daily_matrix_returns_correct_shape():
    """Daily matrix response'un doğru formatta olduğunu doğrular."""

def test_get_daily_matrix_empty_date_range():
    """Boş tarih aralığında boş matrix dönmeli."""

def test_allocation_batch_update_validates_negative():
    """Negatif manpower değeri 422 dönmeli."""
```

### 11.2 Frontend (Vitest)

```typescript
// Test dosya yapısı: tests/frontend/{component}.test.tsx
// veya co-located: components/grid/DailyGridView.test.tsx

describe('DailyGridView', () => {
  it('renders WBS rows correctly', () => { });
  it('applies cell color based on baseline comparison', () => { });
  it('debounces cell edits before API call', () => { });
});
```

### 11.3 E2E (Playwright)

```typescript
// tests/e2e/{flow}.spec.ts
test.describe('Daily Grid Flow', () => {
  test('user can edit cell and see update', async ({ page }) => { });
  test('chat message updates grid', async ({ page }) => { });
});
```

### 11.4 AI Call Mocking

```
Tüm test'lerde:
- Gerçek Claude API çağrısı yapılmaz
- Mock response dosyaları: tests/fixtures/ai_responses/
- Response format INTERFACE_CONTRACTS.md IC-003'e uygun olmalı
```

---

## 12. Performance Standards

| Metrik | Hedef |
|--------|-------|
| Grid render (500 WBS × 90 gün) | < 1 saniye |
| API CRUD response | < 200ms |
| API AI call response | < 5 saniye |
| Frontend bundle size | < 500KB gzipped |
| First Contentful Paint | < 2 saniye |
| Grid cell edit → DB write | < 500ms (debounce dahil) |

---

## 13. Security Standards

- Tüm API endpoint'leri auth middleware arkasında
- RLS (Row Level Security) tüm tablolarda aktif
- Input validation: Backend (Pydantic), Frontend (Zod)
- SQL injection koruması: Parameterized queries (Supabase client bunu sağlar)
- XSS koruması: React default escaping + DOMPurify for user content
- CORS: Sadece izin verilen origin'ler
- Rate limiting: AI endpoint'lerinde (dakikada max 30 çağrı)

---

*Bu doküman Orchestrator Agent tarafından yönetilir. Tüm agent'lar bu kurallara uymak zorundadır. Kural değişiklik talebi Orchestrator'a iletilir.*
