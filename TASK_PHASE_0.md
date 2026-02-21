# Phase 0 — Proje Setup + Data Hazırlığı

## Özet
Proje altyapısının kurulması: repo initialization, Supabase projesi oluşturma, Docker skeleton, boilerplate dosyalar, convention dokümanları ve WBS seed data hazırlığı. Bu phase sonunda tüm agent'lar çalışmaya başlayabilecek ortam hazır olmalı.

## Başarı Kriteri (Phase Tamamlanma)
- [ ] Repo yapısı ARCHITECTURE.md Section 7.4'e uygun
- [ ] Supabase projesi oluşturuldu ve bağlanıyor
- [ ] FastAPI app çalışıyor (health endpoint → 200)
- [ ] React frontend dev server çalışıyor (Vite → localhost:5173)
- [ ] Docker compose up başarılı (backend + frontend + db)
- [ ] `.env.example` dosyası tüm variable'ları içeriyor
- [ ] AGENTS.md ve CONVENTIONS.md repo'da mevcut
- [ ] WBS seed data template hazır

---

## Task Listesi

### TASK-0.1: Repo Yapısı Oluştur
- **Agent:** Orchestrator
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** ARCHITECTURE.md Section 7.4'teki dizin yapısını oluştur. Tüm klasörler ve placeholder dosyalar.
- **Input:** ARCHITECTURE.md
- **Output:**
  - `/supabase/migrations/` (boş dizin)
  - `/supabase/seed.sql` (placeholder)
  - `/backend/` (tüm alt dizinler)
  - `/frontend/` (tüm alt dizinler)
  - `/tests/` (backend, frontend, e2e alt dizinleri)
  - `/scripts/` (boş dizin)
  - `/.github/workflows/` (boş dizin)
  - `README.md`
- **Acceptance Criteria:**
  - [ ] Tüm dizinler oluşturuldu
  - [ ] .gitignore dosyası mevcut (node_modules, __pycache__, .env, venv)
  - [ ] README.md temel proje bilgisini içeriyor
- **Depends On:** none

### TASK-0.2: Supabase Project Init
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** Supabase CLI ile local development projesi oluştur. `supabase/config.toml` konfigüre et. Migration skeleton dosyası oluştur.
- **Input:** ARCHITECTURE.md Section 3
- **Output:**
  - `supabase/config.toml`
  - `supabase/migrations/001_initial_schema.sql` (boş skeleton)
  - `supabase/seed.sql` (placeholder)
- **Acceptance Criteria:**
  - [ ] `supabase init` başarılı
  - [ ] config.toml doğru konfigüre edilmiş
  - [ ] `supabase start` çalışıyor (Docker ile)
- **Depends On:** TASK-0.1

### TASK-0.3: FastAPI App Skeleton
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** FastAPI uygulamasının temel yapısını oluştur: main.py, config.py, router skeletonları, requirements.txt.
- **Input:** ARCHITECTURE.md Section 4.1
- **Output:**
  - `/backend/main.py` — FastAPI app, CORS, router includes
  - `/backend/config.py` — Settings from env vars
  - `/backend/models/db.py` — Supabase client init
  - `/backend/routers/__init__.py`
  - `/backend/services/__init__.py`
  - `/backend/requirements.txt`
  - `/backend/Dockerfile`
- **Acceptance Criteria:**
  - [ ] `uvicorn main:app` başarılı
  - [ ] GET / → health check 200
  - [ ] CORS header'ları doğru
  - [ ] Requirements.txt tüm base dependency'leri içeriyor
- **Depends On:** TASK-0.1

### TASK-0.4: React Frontend Skeleton
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** Vite + React + TypeScript projesi oluştur. Tailwind, shadcn/ui, AG Grid, TanStack Query, Zustand kurulumu.
- **Input:** ARCHITECTURE.md Section 5
- **Output:**
  - `/frontend/package.json`
  - `/frontend/tsconfig.json`
  - `/frontend/vite.config.ts`
  - `/frontend/src/App.tsx` — basic layout shell
  - `/frontend/src/main.tsx` — entry point with providers
  - `/frontend/src/lib/supabase.ts` — Supabase client
  - `/frontend/src/lib/api.ts` — Backend API client
  - `/frontend/src/stores/uiStore.ts` — skeleton
  - `/frontend/src/stores/projectStore.ts` — skeleton
  - `/frontend/src/types/index.ts` — basic type exports
  - `/frontend/Dockerfile`
  - `tailwind.config.js`
- **Acceptance Criteria:**
  - [ ] `npm run dev` → localhost:5173 açılıyor
  - [ ] TypeScript strict mode hata vermiyor
  - [ ] Tailwind class'ları çalışıyor
  - [ ] AG Grid import edilebiliyor
  - [ ] TanStack Query provider kurulu
- **Depends On:** TASK-0.1

### TASK-0.5: Docker & Environment Setup
- **Agent:** 5 (DevOps)
- **Priority:** P0
- **Estimated Effort:** S
- **Description:** Docker compose dosyası, .env.example, setup script'leri oluştur.
- **Input:** ARCHITECTURE.md, CONVENTIONS.md Section 6
- **Output:**
  - `/docker-compose.yml`
  - `/.env.example`
  - `/scripts/setup.sh`
  - `/scripts/seed.sh`
  - `/.gitignore`
- **Acceptance Criteria:**
  - [ ] `docker compose up` başarılı (3 servis ayağa kalkıyor)
  - [ ] `.env.example` tüm gerekli variable'ları içeriyor
  - [ ] `scripts/setup.sh` çalıştırılabilir
- **Depends On:** TASK-0.1

### TASK-0.6: CI/CD Pipeline Skeleton
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** GitHub Actions CI pipeline'ın iskeletini oluştur. Lint, type check, test, build adımları.
- **Input:** CONVENTIONS.md Section 3
- **Output:**
  - `/.github/workflows/ci.yml`
- **Acceptance Criteria:**
  - [ ] YAML syntax valid
  - [ ] Lint, type check, test, build job'ları tanımlı
  - [ ] Push ve PR trigger'ları aktif
- **Depends On:** TASK-0.5

### TASK-0.7: Test Infrastructure Setup
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** S
- **Description:** Pytest, Vitest, Playwright konfigürasyonları ve test dizin yapısı.
- **Input:** CONVENTIONS.md Section 11
- **Output:**
  - `/tests/conftest.py`
  - `/tests/backend/` (placeholder test dosyası)
  - `/tests/frontend/` (placeholder test dosyası)
  - `/tests/e2e/` (placeholder)
  - `/tests/fixtures/` (boş dizin)
  - `pytest.ini` veya `pyproject.toml` test config
- **Acceptance Criteria:**
  - [ ] `pytest --collect-only` test dosyalarını buluyor
  - [ ] Vitest config çalışıyor
  - [ ] Test dizin yapısı oluşturuldu
- **Depends On:** TASK-0.3, TASK-0.4

---

## Dependency Graph

```
TASK-0.1 (Orch) ──→ TASK-0.2 (Agent 1)
TASK-0.1 (Orch) ──→ TASK-0.3 (Agent 2)
TASK-0.1 (Orch) ──→ TASK-0.4 (Agent 3)
TASK-0.1 (Orch) ──→ TASK-0.5 (Agent 5)
TASK-0.5 (Agent 5) ──→ TASK-0.6 (Agent 5)
TASK-0.3 + TASK-0.4 ──→ TASK-0.7 (Agent 5)
```

## Paralel Çalışma Planı

| Slot | Orchestrator | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|-------------|---------|---------|---------|---------|---------|
| 1    | TASK-0.1    | wait    | wait    | wait    | -       | wait    |
| 2    | done        | TASK-0.2| TASK-0.3| TASK-0.4| -       | TASK-0.5|
| 3    | review      | done    | done    | done    | -       | TASK-0.6, TASK-0.7 |
| 4    | quality gate| -       | -       | -       | -       | done    |

## Integration Points

Phase 0 sonunda:
- **Test:** `docker compose up` → 3 servis çalışıyor
- **Test:** Backend health endpoint → 200
- **Test:** Frontend dev server → sayfa açılıyor
- **Test:** Supabase bağlantısı → connection established
- **Review:** Tüm dizin yapısı ARCHITECTURE.md'ye uygun
- **Review:** .env.example tam ve doğru
