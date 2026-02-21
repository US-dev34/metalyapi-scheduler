# AGENTS.md — Multi-Agent Registry

**Proje:** MetalYapi Façade Scheduling Platform
**Versiyon:** 1.0
**Son Güncelleme:** 2026-02-20
**Yönetici:** Orchestrator Agent

---

## Agent Genel Bakış

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│                    🎯 ORCHESTRATOR AGENT                         │
│                    (Ana Claude Code Session)                     │
│                                                                  │
│    ─ Phase bazlı task dağıtımı                                  │
│    ─ Interface contract enforcement                              │
│    ─ Integration testing & conflict resolution                   │
│    ─ Code review & quality gate                                  │
│    ─ AGENTS.md ve CONVENTIONS.md yönetimi                       │
│                                                                  │
├───────────┬───────────┬───────────┬───────────┬─────────────────┤
│     ▼     │     ▼     │     ▼     │     ▼     │       ▼         │
│ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │ ┌───────────┐  │
│ │Agent 1│ │ │Agent 2│ │ │Agent 3│ │ │Agent 4│ │ │  Agent 5  │  │
│ │DB &   │ │ │Backend│ │ │Front- │ │ │AI     │ │ │  Test &   │  │
│ │Schema │ │ │API    │ │ │end UI │ │ │Service│ │ │  DevOps   │  │
│ └───────┘ │ └───────┘ │ └───────┘ │ └───────┘ │ └───────────┘  │
└───────────┴───────────┴───────────┴───────────┴─────────────────┘
```

---

## Agent 1 — DB & Schema

- **Role:** Supabase/PostgreSQL veritabanı şemasının, migration'ların, view'ların, RLS politikalarının ve seed data'nın sahibi.
- **Scope:** Bu agent'ın dokunabileceği dizinler:
  - `/supabase/migrations/` — tüm SQL migration dosyaları
  - `/supabase/seed.sql` — test ve geliştirme seed data'sı
  - `/supabase/config.toml` — Supabase proje konfigürasyonu
  - `/src/types/database.ts` — Supabase CLI ile auto-generate edilen tipler
- **Owns:**
  - Tüm SQL migration dosyaları (`001_initial_schema.sql`, `002_views.sql`, `003_rls_policies.sql`, vb.)
  - `supabase/seed.sql`
  - `src/types/database.ts` (auto-generated)
- **Reads (Read-Only):**
  - `ARCHITECTURE.md` — şema referansı
  - `INTERFACE_CONTRACTS.md` — IC-001, IC-004
  - `CONVENTIONS.md` — naming ve git kuralları
- **Never Touches:**
  - `/backend/` — Backend API kodu
  - `/frontend/` — Frontend kodu
  - `/tests/` — Test dosyaları (Agent 5'in scope'u)
  - `/.github/` — CI/CD dosyaları
  - `/docker-compose.yml`
- **Reports To:** Orchestrator
- **Depends On:** Hiçbir agent'a bağımlı değil (ilk çalışan agent)
- **Interface Contracts:**
  - **Sağladığı:** IC-001 (DB Schema → TypeScript Types), IC-004 (WBS Data Contract)
  - **Tükettiği:** Yok (source of truth)

---

## Agent 2 — Backend API

- **Role:** FastAPI backend'in routers, services, Pydantic modelleri, compute engine ve middleware katmanlarının sahibi.
- **Scope:** Bu agent'ın dokunabileceği dizinler:
  - `/backend/main.py` — FastAPI app entry point
  - `/backend/config.py` — Settings (env vars)
  - `/backend/routers/` — Tüm API router dosyaları
  - `/backend/services/` — Business logic servisleri (AI hariç)
  - `/backend/models/` — Pydantic schemas ve DB client
  - `/backend/middleware/` — Audit log middleware
  - `/backend/requirements.txt` — Python dependencies
  - `/backend/Dockerfile` — Backend container
- **Owns:**
  - `/backend/routers/*.py` — projects, wbs, allocations, baselines, chat, reports
  - `/backend/services/schedule_service.py`
  - `/backend/services/baseline_service.py`
  - `/backend/services/compute_engine.py`
  - `/backend/services/import_export.py`
  - `/backend/models/schemas.py`
  - `/backend/models/db.py`
  - `/backend/middleware/audit.py`
  - `/backend/main.py`, `/backend/config.py`
- **Reads (Read-Only):**
  - `src/types/database.ts` — Agent 1'in ürettiği tipler (referans)
  - `INTERFACE_CONTRACTS.md` — IC-001, IC-002
  - `ARCHITECTURE.md` — endpoint spec
  - `CONVENTIONS.md` — naming, error handling
- **Never Touches:**
  - `/supabase/migrations/` — DB schema (Agent 1)
  - `/frontend/` — Frontend kodu (Agent 3)
  - `/backend/services/ai/` — AI servisleri (Agent 4)
  - `/backend/prompts/` — AI prompt dosyaları (Agent 4)
  - `/tests/` — Test dosyaları (Agent 5)
  - `/.github/` — CI/CD (Agent 5)
- **Reports To:** Orchestrator
- **Depends On:** Agent 1 (DB schema ve tipler hazır olmalı)
- **Interface Contracts:**
  - **Sağladığı:** IC-002 (Backend API → Frontend Client)
  - **Tükettiği:** IC-001 (DB Schema → TypeScript Types), IC-003 (AI Service → Backend)

---

## Agent 3 — Frontend UI

- **Role:** React/TypeScript frontend'in tüm component'leri, hook'ları, store'ları ve view'larının sahibi.
- **Scope:** Bu agent'ın dokunabileceği dizinler:
  - `/frontend/src/components/` — Tüm React component'leri
  - `/frontend/src/pages/` — Sayfa component'leri
  - `/frontend/src/hooks/` — Custom React hook'ları
  - `/frontend/src/stores/` — Zustand store'ları
  - `/frontend/src/lib/` — Utility ve client dosyaları
  - `/frontend/src/types/` — Frontend TypeScript tipleri
  - `/frontend/src/App.tsx` — Ana app component
  - `/frontend/src/main.tsx` — Entry point
  - `/frontend/package.json` — Frontend dependencies
  - `/frontend/tsconfig.json` — TypeScript config
  - `/frontend/vite.config.ts` — Vite config
  - `/frontend/Dockerfile` — Frontend container
- **Owns:**
  - `/frontend/src/components/**/*` — layout, grid, gantt, chat, ai, shared
  - `/frontend/src/hooks/**/*` — useAllocations, useWBS, useBaseline, useAI
  - `/frontend/src/stores/**/*` — uiStore, projectStore
  - `/frontend/src/lib/**/*` — supabase client, api client, utils
  - `/frontend/src/types/index.ts`
- **Reads (Read-Only):**
  - `src/types/database.ts` — DB tipleri (Agent 1 → IC-001)
  - `INTERFACE_CONTRACTS.md` — IC-002, IC-003
  - `ARCHITECTURE.md` — component tree, cell behavior
  - `CONVENTIONS.md` — naming, styling
- **Never Touches:**
  - `/supabase/` — DB dosyaları (Agent 1)
  - `/backend/` — Backend kodu (Agent 2, Agent 4)
  - `/tests/` — Test dosyaları (Agent 5)
  - `/.github/` — CI/CD (Agent 5)
- **Reports To:** Orchestrator
- **Depends On:** Agent 1 (type definitions), Agent 2 (API endpoints çalışır olmalı)
- **Interface Contracts:**
  - **Sağladığı:** Yok (consumer)
  - **Tükettiği:** IC-001 (DB Types), IC-002 (Backend API), IC-003 (AI Service responses)

---

## Agent 4 — AI Service

- **Role:** Claude API entegrasyonu, NLP parser, forecast engine, optimization engine ve prompt yönetiminin sahibi.
- **Scope:** Bu agent'ın dokunabileceği dizinler:
  - `/backend/services/ai/` — Tüm AI servis dosyaları
  - `/backend/services/ai/prompts/` — Prompt template dosyaları
  - `/backend/routers/ai.py` — AI router (Agent 2 ile paylaşımlı — aşağıda açıklama var)
  - `/backend/routers/chat.py` — Chat router (Agent 2 ile paylaşımlı — aşağıda açıklama var)
- **Owns:**
  - `/backend/services/ai/nlp_parser.py`
  - `/backend/services/ai/forecast.py`
  - `/backend/services/ai/optimizer.py`
  - `/backend/services/ai/report_gen.py`
  - `/backend/services/ai/prompts/*.txt` veya `*.jinja2`
- **Reads (Read-Only):**
  - `src/types/database.ts` — WBS ve allocation tipleri
  - `INTERFACE_CONTRACTS.md` — IC-003, IC-004
  - `ARCHITECTURE.md` — AI integration spec
  - `CONVENTIONS.md` — prompt versioning kuralları
  - `/backend/services/compute_engine.py` — Local compute sonuçları (referans)
- **Never Touches:**
  - `/supabase/` — DB dosyaları (Agent 1)
  - `/frontend/` — Frontend kodu (Agent 3)
  - `/backend/services/schedule_service.py` — (Agent 2)
  - `/backend/services/baseline_service.py` — (Agent 2)
  - `/backend/models/` — Pydantic models (Agent 2)
  - `/tests/` — Test dosyaları (Agent 5)
- **Reports To:** Orchestrator
- **Depends On:** Agent 1 (WBS data), Agent 2 (compute engine sonuçları, DB client)
- **Interface Contracts:**
  - **Sağladığı:** IC-003 (AI Service → Backend/Frontend)
  - **Tükettiği:** IC-001 (DB Types), IC-004 (WBS Data)

---

## Agent 5 — Test & DevOps

- **Role:** Test framework'leri (Pytest, Vitest, Playwright), Docker setup, CI/CD pipeline ve environment konfigürasyonlarının sahibi.
- **Scope:** Bu agent'ın dokunabileceği dizinler:
  - `/tests/` — Tüm test dosyaları (backend, frontend, e2e)
  - `/.github/workflows/` — CI/CD pipeline dosyaları
  - `/docker-compose.yml` — Docker orchestration
  - `/scripts/` — Utility script'ler
  - `/.env.example` — Environment variable template
  - `/backend/Dockerfile` (review only — Agent 2 owns, Agent 5 review eder)
  - `/frontend/Dockerfile` (review only — Agent 3 owns, Agent 5 review eder)
- **Owns:**
  - `/tests/backend/**/*` — Pytest test dosyaları
  - `/tests/frontend/**/*` — Vitest test dosyaları
  - `/tests/e2e/**/*` — Playwright E2E testleri
  - `/.github/workflows/*.yml`
  - `/docker-compose.yml`
  - `/scripts/*.sh`
  - `/.env.example`
- **Reads (Read-Only):**
  - Tüm agent'ların kaynak kodları (test yazabilmek için)
  - `INTERFACE_CONTRACTS.md` — tüm contract'lar
  - `ARCHITECTURE.md` — full referans
  - `CONVENTIONS.md` — test kuralları
- **Never Touches:**
  - `/supabase/migrations/` — (Agent 1 — SQL migration'lar)
  - `/backend/services/` — (Agent 2, Agent 4 — business logic)
  - `/backend/routers/` — (Agent 2 — API endpoints)
  - `/frontend/src/components/` — (Agent 3 — UI components)
  - Source code dosyaları (sadece test dosyaları yazar, kaynak koda müdahale etmez)
- **Reports To:** Orchestrator
- **Depends On:** Tüm agent'lar (test edebilmek için çalışan kod gerekli)
- **Interface Contracts:**
  - **Sağladığı:** IC-005 (Environment Variables)
  - **Tükettiği:** IC-001, IC-002, IC-003, IC-004 (hepsini test eder)

---

## Scope Overlap Kuralları ve Conflict Resolution

### Paylaşımlı Alanlar

| Dosya/Dizin | Primary Owner | Secondary Access | Kural |
|-------------|---------------|------------------|-------|
| `/backend/routers/ai.py` | Agent 2 | Agent 4 (AI logic) | Agent 2 router skeleton'ı oluşturur, Agent 4 AI service call'larını yazar. Conflict → Orchestrator hakem. |
| `/backend/routers/chat.py` | Agent 2 | Agent 4 (NLP parse) | Agent 2 endpoint ve DB logic'i yazar, Agent 4 NLP parser entegrasyonunu yazar. Conflict → Orchestrator hakem. |
| `/src/types/database.ts` | Agent 1 (auto-gen) | Agent 2, Agent 3 (read) | Agent 1 Supabase CLI ile generate eder. Diğerleri sadece import eder, asla elle düzenlemez. |
| `/frontend/src/types/index.ts` | Agent 3 | Agent 2 (referans) | Agent 3 yazar, Agent 2 API response type'ları için referans alır. |
| `/.env.example` | Agent 5 | Tüm agent'lar (katkı) | Agent 5 master'ı tutar. Her agent kendi env variable'larını Agent 5'e bildirir. |
| `/backend/Dockerfile` | Agent 2 | Agent 5 (review) | Agent 2 yazar, Agent 5 CI/CD uyumunu review eder. |
| `/frontend/Dockerfile` | Agent 3 | Agent 5 (review) | Agent 3 yazar, Agent 5 CI/CD uyumunu review eder. |

### Conflict Resolution Sıralaması

1. **DB Schema is master.** Type mismatch varsa → DB schema (Agent 1) doğrudur, diğerleri adapt olur.
2. **API contract owner → Agent 2.** Backend API response format'ında anlaşmazlık → Agent 2'nin Pydantic modeli geçerlidir.
3. **AI service interface → Agent 4.** AI response format'ında anlaşmazlık → Agent 4'ün tanımı geçerlidir.
4. **Son karar: Orchestrator.** Yukarıdaki kurallar yetmezse → Orchestrator INTERFACE_CONTRACTS.md'yi günceller.

### Genel Kurallar

- Her agent **sadece kendi scope'unda** dosya oluşturur/düzenler.
- Scope dışı bir değişiklik gerekirse → **STOP** + Orchestrator'a bildir.
- Başka agent'ın dosyasına **read-only** erişim serbesttir.
- Conflict durumunda → **INTERFACE_CONTRACTS.md** referans alınır.
- Contract yetersizse → Orchestrator contract'ı günceller.

---

## Agent Bağımlılık Grafiği

```
Agent 1 (DB) ───────────────┐
   │                         │
   ├──→ Agent 2 (Backend) ──┤──→ Agent 5 (Test)
   │       │                 │
   │       ├──→ Agent 3 (FE) ┤
   │       │                 │
   │       └──→ Agent 4 (AI) ┘
   │               │
   └───────────────┘ (WBS data)
```

- **Agent 1** hiçbir agent'a bağımlı değil — her zaman ilk başlar.
- **Agent 2** Agent 1'e bağımlı (schema + types).
- **Agent 3** Agent 1 (types) ve Agent 2'ye (API) bağımlı.
- **Agent 4** Agent 1 (WBS data) ve Agent 2'ye (compute engine) bağımlı.
- **Agent 5** tüm agent'lara bağımlı (test edebilmek için çalışan kod gerekli).

---

*Bu doküman Orchestrator Agent tarafından yönetilir. Agent'lar bu dokümanı düzenleyemez — değişiklik talebi Orchestrator'a iletilir.*
