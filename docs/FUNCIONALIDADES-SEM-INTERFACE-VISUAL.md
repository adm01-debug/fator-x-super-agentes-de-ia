# 🕳️ Funcionalidades sem Interface Visual Completa

> **Documento gerado:** 2026-04-16
> **Escopo:** Auditoria de código vs UI — identifica funcionalidades implementadas no backend (services, hooks, libs, edge functions) que **não têm tela dedicada** ou estão **subutilizadas no frontend**.
> **Metodologia:** cruzamento entre `src/services/`, `src/hooks/`, `src/lib/`, `src/stores/`, `supabase/functions/` e o consumo real em `src/pages/`.

---

## 📊 Sumário Executivo

| Categoria | Total | Sem UI | % Órfão |
|---|---:|---:|---:|
| **Edge Functions** | 45 | 13 | **29%** |
| **Services frontend** | 67 | 24 | **36%** |
| **Hooks customizados** | 26 | 5 | **19%** |
| **Stores Zustand** | 6 | 2 | **33%** |
| **Libs de infraestrutura** | 14 | 6 | **43%** |

> **Diagnóstico geral:** o sistema possui uma camada de lógica muito mais rica do que a UI consegue expor. Aproximadamente **1/3 da capacidade real do produto está invisível ao usuário final**.

---

## 1️⃣ Edge Functions sem UI dedicada (13)

### 🔴 Severidade ALTA — funcionalidades core sem tela

| # | Edge Function | O que faz | UI faltando |
|---|---|---|---|
| 1 | `a2a-server` | Agent-to-Agent Protocol (Agent Cards, Task routing) | Painel A2A em **DeploymentsPage** |
| 2 | `bitrix24-oauth` | Fluxo OAuth completo Bitrix24 | Botão "Conectar Bitrix24" em **SettingsPage** |
| 3 | `bitrix24-api` | Proxy autenticado para API Bitrix24 | Console de teste em **ToolsPage** |
| 4 | `bitrix24-webhook` | Recebimento de eventos Bitrix24 | Logs de webhook em **RoutingConfigPage** |
| 5 | `datahub-mcp-server` | DataHub exposto como MCP Server | Aba "MCP Server" em **DataHubPage** |
| 6 | `oracle-research` | Deep Research iterativo multi-step | Botão "Deep Research" na **OraclePage** |
| 7 | `guardrails-ml` | ML para detecção de PII/Toxicidade | Painel ML em **GuardrailsModule** |

### 🟡 Severidade MÉDIA — features sem UI dedicada

| # | Edge Function | Melhoria sugerida |
|---|---|---|
| 8 | `doc-ocr` | Botão "Extrair texto (OCR)" em **KnowledgePage** |
| 9 | `image-analysis` | Preview de análise de imagem no Agent Builder |
| 10 | `product-mockup` | Tela "Gerador de Mockup" |
| 11 | `test-runner` | Painel de batch testing na **EvaluationsPage** |
| 12 | `hf-autotrain` | Wizard de fine-tuning expandido |
| 13 | `webhook-receiver` | Console de inspeção de webhooks |

---

## 2️⃣ Services frontend não consumidos por páginas (24)

### 🔴 Núcleo de automação completo sem UI

A `AutomationCenterPage` existe, porém **10 services de automação** estão presentes apenas como código:

| Service | Função |
|---|---|
| `cronSchedulerService` | Agendamento cron de jobs |
| `webhookTriggerService` | Gatilhos via webhook |
| `retryEngineService` | Retry inteligente com backoff |
| `credentialVaultService` | Vault de credenciais criptografadas |
| `notificationEngineService` | Notificações multi-canal |
| `automationTemplateService` | Templates prontos de automação |
| `executionHistoryService` | Histórico de execuções |
| `connectorRegistryService` | Registro de conectores |
| `queueManagerService` | Fila de jobs assíncronos |
| `batchProcessorService` | Processamento em lote |

**UI faltando:** abas dedicadas dentro de **AutomationCenterPage** para Cron, Webhooks, Vault, Filas, Templates e Histórico.

### 🟡 Knowledge Graph & Memória avançada

| Service | Função | Onde deveria estar |
|---|---|---|
| `temporalKnowledgeService` | Knowledge Graph temporal | Aba em **SuperCerebroPage** |
| `entityResolutionService` | Deduplicação de entidades | Aba em **SuperCerebroPage** |
| `knowledgeDecayService` | Decay temporal de conhecimento | Aba em **SuperCerebroPage** |
| `progressiveSkillLoader` | Carregamento progressivo de skills | **SkillsMarketplacePage** |

### 🟡 A2A & Routing

| Service | Função | UI faltando |
|---|---|---|
| `agentCardService` | Geração de Agent Cards (descoberta) | Tab "Agent Card" no **AgentBuilder** |
| `agentHandoffService` | Handoff entre agentes | Visual em **WorkflowsPage** |
| `agentRoutingService` | Roteamento dinâmico | **RoutingConfigPage** já existe mas não consome |

### 🟡 Integrações de canal

| Service | Função | UI faltando |
|---|---|---|
| `whatsappOutboundService` | Envio WhatsApp ativo | Composer em **DeploymentsPage** |
| `whatsappWebhookService` | Logs de inbound WhatsApp | Console em **RoutingConfigPage** |
| `bitrix24WebhookService` | Logs de webhooks Bitrix24 | Console em **RoutingConfigPage** |

### 🟡 Multimodal & Pipelines

| Service | Função | UI faltando |
|---|---|---|
| `productMockupService` | Geração de mockup de produto | Tela "AI Studio → Mockup" |
| `widgetService` | Widget embarcável | Tela "Widget Builder" |
| `nlpPipelineService` | Pipeline NLP customizável | Apenas dialog modal — falta tela completa |
| `middlewarePipelineService` | Middleware de requisições | Painel admin sem UI |
| `workflowCheckpointService` | Checkpoints + resume | Botão "Retomar" em **WorkflowsPage** |
| `costCalculatorService` | Calculadora de custos | Widget standalone faltando |
| `auditLogService` | Histórico forense | Tela "Audit Log" dedicada |

---

## 3️⃣ Hooks customizados subutilizados (5)

| Hook | Onde é usado hoje | Onde deveria estar |
|---|---|---|
| `useStreaming` | Não consumido | Streaming de respostas em **AgentBuilder Playground** |
| `useRetryAction` | Não consumido | Botões de retry em listas (jobs, runs, deploys) |
| `useWorkflowAutosave` | Não consumido | Auto-save no canvas de **WorkflowsPage** |
| `useNLPAnalysis` | Apenas em dialog | Análise inline em prompts |
| `usePasswordBreachCheck` | Apenas em **AuthPage** | Reaproveitar em **ResetPasswordPage** |

---

## 4️⃣ Stores Zustand parcialmente integrados (2)

| Store | Status | UI faltando |
|---|---|---|
| `uiStore` | Usado parcialmente | Persistência de tema, sidebar collapsed, modais globais |
| `datahubStore` | Apenas em **DataHubPage** | Estado compartilhado em **AgentBuilder Knowledge tab** |

---

## 5️⃣ Libs de infraestrutura sem exposição ao usuário (6)

| Lib | Capacidade | Onde deveria aparecer |
|---|---|---|
| `lib/mcp/` | Cliente MCP + Registry (5.800+ servers) | Tela "MCP Servers" em **SettingsPage** (existe panel parcial) |
| `lib/tracing/` + `tracing.ts` | NexusTracer custom | Aba "Tracing" em **MonitoringPage** |
| `lib/otel-genai.ts` | OpenTelemetry GenAI semantic conventions | Visualizador OTEL em Monitoring |
| `lib/ag-ui/` | Componentes de UI generativa | Showcase em **AIStudioPage** |
| `lib/agentBulkActions.ts` | Ações em lote em agentes | Toolbar de seleção múltipla em **AgentsPage** |
| `lib/agentExportImport.ts` | Export/Import JSON de agentes | Botões "Exportar/Importar" em **AgentsPage** |
| `lib/oracleExport.ts` | Exportação de relatórios do Oracle | Botão "Exportar PDF/MD" em **OraclePage** |

---

## 6️⃣ Páginas com UI placeholder (precisam expandir)

| Página | Estado atual | Funcionalidade backend disponível |
|---|---|---|
| `SecurityPage` | ~30 linhas, placeholder | `securityService`, `accessControlService`, `auditLogService` prontos |
| `RoutingConfigPage` | UI básica | 3 services de webhook + routing prontos |
| `FineTuningPage` | Listagem simples | `hf-autotrain` + `fineTuningService` suportam wizard completo |
| `DataStoragePage` | Listagem simples | `dataStorageService` permite upload/preview avançado |

---

## 🎯 Plano sugerido para 100% de coverage

### Sprint 1 — Painéis administrativos (alta prioridade)
- **SecurityPage** completa (audit log, access control, forensic snapshots)
- **AutomationCenterPage** com 6 abas (Cron, Webhooks, Vault, Filas, Templates, Histórico)
- **SuperCerebroPage** com 3 novas abas (Temporal, Entity Resolution, Decay)

### Sprint 2 — Conectividade externa
- Botão "Conectar Bitrix24" + console de webhooks
- Composer WhatsApp outbound em **DeploymentsPage**
- Painel A2A com Agent Cards
- Aba MCP Server em **DataHubPage**

### Sprint 3 — Experiência do agente
- Agent Bulk Actions (export/import, duplicar em massa)
- Playground com streaming real (`useStreaming`)
- Workflow autosave + retomar checkpoint
- Botão "Deep Research" no Oracle

### Sprint 4 — Multimodal & Polimento
- AI Studio: Mockup, OCR, Visual Search inline
- Widget Builder embarcável
- NLP Pipeline standalone page
- Audit Log viewer com filtros forenses

---

## 📈 Impacto esperado

| Métrica | Atual | Pós-plano |
|---|---:|---:|
| Edge Functions com UI | 32/45 (71%) | 45/45 (100%) |
| Services consumidos por páginas | 43/67 (64%) | 67/67 (100%) |
| Capacidade exposta ao usuário | ~65% | **100%** |

---

*Documento gerado a partir da análise cruzada de imports reais em `src/pages/` vs declarações em `src/services/`, `src/hooks/`, `src/lib/`, `src/stores/` e `supabase/functions/`.*
