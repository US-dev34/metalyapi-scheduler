# Phase 3 — Chat + AI Integration

## Özet
NLP mesaj parser'ı ve Claude API entegrasyonu, Chat Panel UI (mesaj → parse → önizleme → onay → grid güncelleme), Forecast engine, Optimization önerileri ve AI Panel UI. Bu phase sonunda kullanıcı doğal dilde veri girebilecek, AI tahminleri görebilecek, risk uyarıları alabilecek.

## Başarı Kriteri (Phase Tamamlanma)
- [ ] NLP parser Türkçe mesajları doğru parse ediyor (min %90 accuracy)
- [ ] Chat mesajı → parse → preview → confirm → grid update akışı çalışıyor
- [ ] AI forecasts tablosu oluşturuldu ve forecast endpoint çalışıyor
- [ ] Chat messages tablosu ve history endpoint çalışıyor
- [ ] Forecast engine: local compute + Claude API hybrid çalışıyor
- [ ] Chat Panel UI: mesaj gönder, preview gör, onayla
- [ ] AI Panel UI: forecast, alerts, recommendations görünüyor
- [ ] AI graceful degradation: AI fail olduğunda app crash olmuyor
- [ ] AI mock test'leri pass

---

## Task Listesi

### TASK-3.1: AI & Chat Database Tables
- **Agent:** 1 (DB)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** ai_forecasts, chat_messages ve audit_log tablolarını oluştur. Audit trigger function.
- **Input:** ARCHITECTURE.md Section 3.1
- **Output:**
  - `supabase/migrations/006_ai_chat_tables.sql`
  - `supabase/migrations/007_audit_trigger.sql`
- **Acceptance Criteria:**
  - [ ] ai_forecasts tablosu: confidence CHECK(0-1), parameters JSONB
  - [ ] chat_messages tablosu: parsed_actions JSONB, applied boolean
  - [ ] audit_log tablosu: action CHECK(insert/update/delete)
  - [ ] Audit trigger: daily_allocations tablosunda INSERT/UPDATE/DELETE'te tetikleniyor
  - [ ] Index'ler: audit_log(table_name), audit_log(record_id)
  - [ ] Type generation güncellendi
- **Depends On:** Phase 2 complete

### TASK-3.2: AI Service — Claude API Client
- **Agent:** 4 (AI)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Claude API client wrapper, error handling, retry logic, token tracking.
- **Input:** AGENT_4_AI_PROMPT.md Claude client spec
- **Output:**
  - `/backend/services/ai/__init__.py`
  - `/backend/services/ai/client.py`
- **Acceptance Criteria:**
  - [ ] Claude API client wrapper çalışıyor
  - [ ] Model selection: Sonnet default, Haiku for alerts
  - [ ] Error handling: APIError, RateLimitError, timeout
  - [ ] Retry logic: 3 attempts with exponential backoff
  - [ ] Token usage logging
  - [ ] Graceful degradation: AI fail → structured error response
- **Depends On:** Phase 0 complete (requirements.txt has anthropic)

### TASK-3.3: NLP Message Parser
- **Agent:** 4 (AI)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Türkçe doğal dil mesajlarını parse eden servis. WBS kodu eşleştirme, tarih çıkarımı, çoklu aksiyon desteği.
- **Input:** AGENT_4_AI_PROMPT.md NLP spec, parse_message prompt template
- **Output:**
  - `/backend/services/ai/nlp_parser.py`
  - `/backend/services/ai/prompts/parse_message.txt`
- **Acceptance Criteria:**
  - [ ] "Bugün CW-01'de 5 adam çalıştı, 3 ünite bitti" → doğru parse
  - [ ] "CW-02'de 7 adam, 5 ünite. CW-03 bugün çalışılmadı" → 2 aksiyon
  - [ ] "Dün DR-01'de 4 adam 2 ünite" → tarih: dün
  - [ ] WBS kodu fuzzy matching (curtain wall → CW-01)
  - [ ] Confidence score hesaplanıyor
  - [ ] Unknown WBS kodu → düşük confidence + uyarı
  - [ ] JSON output validation (parse hatası koruması)
- **Depends On:** TASK-3.2

### TASK-3.4: Forecast Engine
- **Agent:** 4 (AI)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** 3-adımlı forecast: (1) Local compute, (2) Claude API call, (3) Store results. Prompt template dahil.
- **Input:** AGENT_4_AI_PROMPT.md forecast spec, compute_engine.py (Agent 2)
- **Output:**
  - `/backend/services/ai/forecast.py`
  - `/backend/services/ai/prompts/generate_forecast.txt`
- **Acceptance Criteria:**
  - [ ] Step 1: productivity_rate, remaining_days, estimated_end_date (local)
  - [ ] Step 2: Claude API → adjusted forecast, risk, recommendations
  - [ ] Step 3: ai_forecasts tablosuna kayıt
  - [ ] ForecastResponse formatı IC-003'e uygun
  - [ ] Risk level: low/medium/high doğru atanıyor
  - [ ] Recommendations doğal dil Türkçe
  - [ ] Fallback: Claude fail → sadece local compute sonuçları dön
- **Depends On:** TASK-3.2, TASK-3.1

### TASK-3.5: Optimization & What-If Engine
- **Agent:** 4 (AI)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Resource optimization önerileri ve what-if senaryo analizi.
- **Input:** AGENT_4_AI_PROMPT.md optimizer + whatif spec
- **Output:**
  - `/backend/services/ai/optimizer.py`
  - `/backend/services/ai/prompts/whatif_analysis.txt`
- **Acceptance Criteria:**
  - [ ] Optimization: hangi WBS'e kaç adam ekle/çıkar önerisi
  - [ ] Bottleneck detection: en yavaş ilerleyen WBS'ler
  - [ ] What-if: "+5 adam KW10" senaryosu → projected impact
  - [ ] Results doğal dil açıklama ile
  - [ ] Graceful degradation
- **Depends On:** TASK-3.4

### TASK-3.6: Weekly Report Generator
- **Agent:** 4 (AI)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** Haftalık otomatik doğal dil rapor. İlerleme, riskler, öneriler.
- **Input:** AGENT_4_AI_PROMPT.md report spec
- **Output:**
  - `/backend/services/ai/report_gen.py`
  - `/backend/services/ai/prompts/weekly_report.txt`
- **Acceptance Criteria:**
  - [ ] Haftalık özet: toplam ilerleme, planned vs actual
  - [ ] Risk items: geciken WBS'ler
  - [ ] Highlights: iyi ilerleyen WBS'ler
  - [ ] Recommendations: gelecek hafta önerileri
  - [ ] Output: markdown formatında Türkçe doğal dil
- **Depends On:** TASK-3.4

### TASK-3.7: Chat Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** Chat router: message (NLP parse çağır), apply (parsed actions'ı daily_allocations'a uygula), history.
- **Input:** ARCHITECTURE.md Section 4.1 chat endpoints, Agent 4 NLP parser
- **Output:**
  - `/backend/routers/chat.py`
  - Chat Pydantic models
- **Acceptance Criteria:**
  - [ ] POST /chat/{project_id}/message → Agent 4 NLP parser çağır → ChatParseResponse
  - [ ] Response: parsed_actions, summary, confidence, applied=false
  - [ ] POST /chat/{project_id}/apply → parsed actions'ı daily_allocations'a yaz
  - [ ] Apply: source='chat' olarak işaretle
  - [ ] GET /chat/{project_id}/history → chat_messages listesi
  - [ ] Error: AI unavailable → 503 with AI_UNAVAILABLE code
- **Depends On:** TASK-3.3, TASK-3.1

### TASK-3.8: AI Endpoints
- **Agent:** 2 (Backend)
- **Priority:** P0
- **Estimated Effort:** M
- **Description:** AI router: forecast, optimize, whatif, report endpoints. Agent 4 servislerini çağırır.
- **Input:** ARCHITECTURE.md Section 4.1 ai endpoints, Agent 4 services
- **Output:**
  - `/backend/routers/ai.py`
  - AI Pydantic models
- **Acceptance Criteria:**
  - [ ] POST /ai/{project_id}/forecast → Agent 4 forecast engine → ForecastResponse
  - [ ] POST /ai/{project_id}/optimize → optimization suggestions
  - [ ] POST /ai/{project_id}/whatif → what-if analysis
  - [ ] GET /ai/{project_id}/report → weekly report
  - [ ] All endpoints: AI error → 503, graceful degradation
  - [ ] ForecastResponse formatı IC-003'e uygun
- **Depends On:** TASK-3.4, TASK-3.5, TASK-3.6

### TASK-3.9: Chat Panel UI
- **Agent:** 3 (Frontend)
- **Priority:** P0
- **Estimated Effort:** L
- **Description:** Sağ tarafta slide-out Chat Panel. Mesaj geçmişi, input, parse sonucu önizleme, onay butonu.
- **Input:** ARCHITECTURE.md Section 5.1 ChatPanel, IC-003 ChatParseResponse
- **Output:**
  - `/frontend/src/components/chat/ChatPanel.tsx`
  - `/frontend/src/components/chat/ChatHistory.tsx`
  - `/frontend/src/components/chat/MessageInput.tsx`
  - `/frontend/src/components/chat/ParsedPreview.tsx`
  - `/frontend/src/components/chat/ConfirmButton.tsx`
- **Acceptance Criteria:**
  - [ ] Panel slide-out animasyonu (sağdan)
  - [ ] Chat geçmişi scrollable (en yeni altta)
  - [ ] Message input: textarea + gönder butonu (Enter veya button click)
  - [ ] Gönderildikten sonra: loading spinner
  - [ ] Parse sonucu preview kartları:
    - Her aksiyon için kart: WBS kodu, tarih, adam, miktar
    - Renk: yeşil (güvenli), sarı (düşük confidence)
  - [ ] Onayla butonu → apply API call → grid refresh
  - [ ] Düzenle butonu → preview kartlarında inline edit
  - [ ] Error: AI fail → "Mesaj anlaşılamadı, manuel giriş yapın"
- **Depends On:** TASK-3.7, TASK-1.10

### TASK-3.10: AI Panel UI
- **Agent:** 3 (Frontend)
- **Priority:** P1
- **Estimated Effort:** L
- **Description:** Alt panel: ForecastView, AlertList, RecommendationList, WeeklyReport.
- **Input:** ARCHITECTURE.md Section 5.1 AIPanel, IC-003 ForecastResponse
- **Output:**
  - `/frontend/src/components/ai/AIPanel.tsx`
  - `/frontend/src/components/ai/ForecastView.tsx`
  - `/frontend/src/components/ai/AlertList.tsx`
  - `/frontend/src/components/ai/RecommendationList.tsx`
  - `/frontend/src/components/ai/WeeklyReport.tsx`
  - `/frontend/src/hooks/useAI.ts`
- **Acceptance Criteria:**
  - [ ] AI Panel collapsible (alt tarafta)
  - [ ] Forecast View: WBS bazlı tablo (tahmin bitiş, risk, öneri)
  - [ ] Risk renk kodları: low=yeşil, medium=sarı, high=kırmızı
  - [ ] Alert List: "CW-01 %15 geride" gibi uyarı kartları
  - [ ] Recommendation List: aksiyon önerileri
  - [ ] Weekly Report: markdown render (AI'ın ürettiği doğal dil)
  - [ ] "Generate Forecast" butonu → loading → sonuç
  - [ ] AI unavailable → "AI servisi şu an kullanılamıyor" mesajı
- **Depends On:** TASK-3.8

### TASK-3.11: AI & Chat Mock Tests
- **Agent:** 5 (DevOps)
- **Priority:** P1
- **Estimated Effort:** M
- **Description:** NLP parser test'leri (mock Claude), chat flow test, forecast test, graceful degradation test.
- **Input:** Phase 3 endpoints, IC-003, mock fixtures
- **Output:**
  - `/tests/backend/test_chat.py`
  - `/tests/backend/test_ai_forecast.py`
  - `/tests/backend/test_nlp_parser.py`
  - `/tests/fixtures/ai_responses/` (mock response JSON'ları)
- **Acceptance Criteria:**
  - [ ] NLP parser: 5+ test mesajı doğru parse
  - [ ] Chat flow: message → parse → apply → DB update
  - [ ] Forecast: mock response → correct ForecastResponse
  - [ ] Graceful degradation: mock API error → structured error response
  - [ ] AI calls ALWAYS mocked (gerçek API çağrısı yok)
  - [ ] `pytest tests/backend/ -v` → all pass
- **Depends On:** TASK-3.7, TASK-3.8

---

## Dependency Graph

```
Phase 2 complete ──→ TASK-3.1 (Agent 1)
Phase 0 complete ──→ TASK-3.2 (Agent 4)
TASK-3.2 ──→ TASK-3.3 (Agent 4)
TASK-3.2 ──→ TASK-3.4 (Agent 4)
TASK-3.4 ──→ TASK-3.5 (Agent 4)
TASK-3.4 ──→ TASK-3.6 (Agent 4)
TASK-3.3 + TASK-3.1 ──→ TASK-3.7 (Agent 2)
TASK-3.4 + TASK-3.5 + TASK-3.6 ──→ TASK-3.8 (Agent 2)
TASK-3.7 ──→ TASK-3.9 (Agent 3)
TASK-3.8 ──→ TASK-3.10 (Agent 3)
TASK-3.7 + TASK-3.8 ──→ TASK-3.11 (Agent 5)
```

## Paralel Çalışma Planı

| Slot | Agent 1 | Agent 2 | Agent 3 | Agent 4 | Agent 5 |
|------|---------|---------|---------|---------|---------|
| 1    | TASK-3.1| wait    | wait    | TASK-3.2| wait    |
| 2    | done    | wait    | wait    | TASK-3.3, 3.4 | wait |
| 3    | -       | wait    | wait    | TASK-3.5, 3.6 | wait |
| 4    | -       | TASK-3.7, 3.8 | wait | done   | wait    |
| 5    | -       | done    | TASK-3.9, 3.10 | - | TASK-3.11 |
| 6    | -       | -       | done    | -       | done    |

## Integration Points

Phase 3 sonunda test edilecek tam akış:

### Chat → Grid Update Flow
```
1. Kullanıcı chat'e yazar: "Bugün CW-01'de 5 adam çalıştı, 3 ünite bitti"
2. POST /chat/{project_id}/message → NLP parser
3. Claude API parse → ChatParseResponse (actions, confidence)
4. Frontend ParsedPreview gösterir
5. Kullanıcı "Onayla" tıklar
6. POST /chat/{project_id}/apply
7. daily_allocations güncellenir (source='chat')
8. Grid auto-refresh (Supabase realtime veya query invalidation)
9. CellRenderer renk güncelleme
```

### Forecast Flow
```
1. Kullanıcı "Generate Forecast" tıklar
2. POST /ai/{project_id}/forecast
3. Step 1: Local compute (productivity, remaining)
4. Step 2: Claude API (adjusted forecast, risk)
5. Step 3: ai_forecasts tablosuna kayıt
6. Frontend ForecastView güncellenir
7. Alert List risk uyarılarını gösterir
```

### Graceful Degradation Test
```
1. Claude API simüle olarak kapatılır (mock)
2. Chat mesajı gönderilir → "AI servisi şu an kullanılamıyor" mesajı
3. Forecast tıklanır → sadece local compute sonuçları gösterilir
4. Uygulama crash OLMAZ
```
