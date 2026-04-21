
Vou criar `docs/FUNCIONALIDADES-SEM-INTERFACE-VISUAL-V2.md` — auditoria atualizada (V2) cruzando o estado real do código pós-V6 com o que está exposto no frontend.

## Conteúdo do documento

### 1. Sumário executivo
Tabela com totais e % de cobertura por camada (edge functions, services, libs).

### 2. Edge Functions órfãs (12 — não chamadas em `src/`)
**ALTA severidade (6):**
- `oracle-council` / `oracle-research` — Oráculo usa wrapper antigo, não invoca diretamente
- `guardrails-engine` — só `guardrails-ml` é chamado
- `bitrix24-api` / `bitrix24-oauth` / `bitrix24-webhook` — integração Bitrix sem UI ativa
- `whatsapp-webhook` — sem console de inbound
- `a2a-server` — protocolo A2A sem painel
- `agent-conversational-builder` — builder conversacional sem entrada

**MÉDIA severidade (3):**
- `doc-ocr` — sem botão "OCR" em KnowledgePage
- `rag-ingest` — ingestão direta sem wizard
- `text-to-speech` — endpoint TTS standalone sem UI

### 3. Services com UI parcial ou ausente (~25)
Agrupados em **5 clusters** (com tabela: service → cluster → onde deveria estar):

**Cluster Automação (10):** cronSchedulerService, webhookTriggerService, retryEngineService, credentialVaultService, notificationEngineService, automationTemplateService, executionHistoryService, queueManagerService, batchProcessorService, connectorRegistryService — usados em demos isolados, sem abas dedicadas no AutomationCenterPage.

**Cluster Memória avançada (5):** temporalKnowledgeService, entityResolutionService, knowledgeDecayService, contextTiersService, progressiveSkillLoader — sem abas no SuperCerebroPage.

**Cluster A2A & Multimodal (4):** agentCardService, agentHandoffService, productMockupService, widgetService — sem páginas próprias.

**Cluster Pipelines & Middleware (3):** middlewarePipelineService (0 refs), nlpPipelineService, ragPipelineService — sem console de pipeline.

**Cluster Observabilidade & Custos (3):** costCalculatorService, healthAlertsService, fineTuningService — widget/wizard ausentes.

### 4. Libs de infraestrutura sem exposição UI (8)
- `lib/ag-ui` (0 refs) — UI generativa sem showcase
- `lib/tracing` (0 refs) — NexusTracer sem visualizador
- `lib/otel-genai` (0 refs) — semantic conventions OTel
- `lib/webVitals` (0 refs) — métricas RUM
- `lib/normalize` (0 refs) — utilitário sem uso
- `lib/auditService` (0 refs) — wrapper de audit antigo
- `lib/middlewarePipelineService` (0 refs)
- `lib/mcp` (1 ref apenas) — MCP Registry com 5.800+ servers, sem tela "MCP Servers" em Settings

### 5. Páginas placeholder/incompletas
Lista de páginas que existem mas têm UI mínima vs backend rico:
- `RoutingConfigPage` — 3 webhook services prontos, UI básica
- `EmailCalendarTriggersPage` — sem ações reais
- `MobileSDKPage` — somente documentação estática

### 6. Comparativo V1 (auditoria anterior) vs V2 (atual)
Tabela mostrando o que foi resolvido entre V1 → V2:
- Edge functions órfãs: 13 → 12
- Services órfãos: 24 → ~25 (mas 9 foram migrados em V5)
- Stores parcialmente integrados: 2 → 0 (uiStore + datahubStore agora consumidos)
- Hooks subutilizados: 5 → 0 ✅ (todos os hooks são consumidos)

### 7. Plano sugerido — 4 sprints rumo a 100% UI coverage
- **Sprint 1 — Painéis administrativos:** abas no AutomationCenter + SuperCerebro
- **Sprint 2 — Conectividade externa:** Bitrix24 + WhatsApp + A2A
- **Sprint 3 — Multimodal & Polimento:** TTS, OCR, Mockup, Widget Builder
- **Sprint 4 — Observabilidade:** MCP Servers UI, Tracing visualizer, OTel viewer, web vitals dashboard

### 8. Impacto esperado
Tabela: capacidade exposta atual ~75% → 100% pós-plano.

### Arquivo gerado
- `docs/FUNCIONALIDADES-SEM-INTERFACE-VISUAL-V2.md` (~400 linhas)
