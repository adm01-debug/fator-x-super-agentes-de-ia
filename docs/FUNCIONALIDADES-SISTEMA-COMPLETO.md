# 🚀 Nexus Agents Studio — Análise Exaustiva de Funcionalidades

> **Documento gerado:** 2026-04-16
> **Escopo:** Auditoria completa do código-fonte (40 páginas, 60+ services, 46 Edge Functions)
> **Repositório:** [adm01-debug/fator-x-super-agentes-de-ia](https://github.com/adm01-debug/fator-x-super-agentes-de-ia)

---

## 📊 Sumário Executivo

| Camada | Quantidade |
|---|---:|
| **Páginas (rotas)** | 40 |
| **Services (frontend)** | 67 |
| **Edge Functions (backend)** | 46 |
| **Tabelas no banco (RLS)** | 80+ |
| **Componentes UI** | 28 grupos |
| **Roles RBAC** | 5 |
| **Permissões granulares** | 37 |

---

## 1️⃣ Núcleo de Agentes IA

### 1.1 Agent Builder (15 abas de configuração)
- **Páginas:** `AgentsPage`, `AgentBuilder`, `CreateAgentPage`, `AgentDetailPage`
- **Funcionalidades:**
  - Criação visual de agentes com persona, missão e modelo LLM
  - 15 abas: Identidade, Modelo, Prompt, Knowledge, Tools, Guardrails, Memory, Skills, Routing, Deploy, Versioning, A2A, Cost, Evaluation, Monitoring
  - Versionamento de agentes (`agent_versions`)
  - Templates pré-configurados (`agent_templates`)
  - Score de prontidão por agente
  - Avatar emoji + tags + categoria

### 1.2 Smolagent Runtime (Agente Autônomo ReAct)
- **Edge Function:** `smolagent-runtime`
- **Página:** `SmolagentPage`
- Loop ReAct (Reasoning + Acting) autônomo
- Sandbox isolado para execução segura
- Playground expandido com streaming

### 1.3 Agent Skills & Self-Evolution (ACE)
- **Service:** `agentEvolutionService`, `skillsRegistryService`
- **Tabela:** `agent_skills`, `agent_installed_skills`, `skill_registry`
- Reflector sobre traces para aprender skills
- Skills Marketplace público (instaláveis pela comunidade)
- 5 categorias de skills

---

## 2️⃣ 🔮 Oráculo — Multi-LLM Council

- **Página:** `OraclePage`
- **Edge Functions:** `oracle-council`, `oracle-research`
- **Service:** `oracleService`
- **Funcionalidades:**
  - 5 modos de deliberação (Council, Debate, Consensus, Chairman, Research)
  - Conselho de múltiplas IAs deliberando simultaneamente
  - Chairman Synthesis com citações inline
  - Deep Research iterativo
  - Histórico (`oracle_history`) com confidence + consensus score
  - Métricas: latência, tokens, custo USD por consulta

---

## 3️⃣ 🧠 Super Cérebro (Enterprise Memory Layer)

- **Página:** `SuperCerebroPage` (8 tabs)
- **Edge Functions:** `cerebro-brain`, `cerebro-query`, `memory-manager`, `memory-tools`
- **Services:** `cerebroService`, `memoryService`, `temporalKnowledgeService`, `entityResolutionService`, `knowledgeDecayService`
- **Funcionalidades:**
  - Knowledge Graph temporal
  - Memórias episódicas, semânticas e procedurais
  - Context Tiers L0/L1/L2 (busca hierárquica)
  - Decay temporal de conhecimento
  - Entity Resolution (deduplicação inteligente)
  - Compactação automática

---

## 4️⃣ 🗄️ DataHub (Cross-Database Intelligence)

- **Página:** `DataHubPage`
- **Edge Functions:** `datahub-query`, `datahub-mcp-server`
- **Service:** `datahubService`
- **Funcionalidades:**
  - 5 bancos Supabase conectados
  - 340+ tabelas / 920K+ registros indexados
  - DataHub exposto como **MCP Server** (interoperabilidade)
  - Queries cross-database
  - Aba "MCP Server" para consumo externo

---

## 5️⃣ ⚡ Workflows & Automação

### 5.1 Workflow Canvas
- **Página:** `WorkflowsPage`
- **Edge Function:** `workflow-engine-v2`
- **Service:** `workflowsService`, `workflowCheckpointService`
- Editor visual drag-and-drop
- 12 tipos de nós
- Checkpoints + resume
- Tabelas: `workflows`, `workflow_steps`, `workflow_runs`

### 5.2 Automation Center (10 services)
- **Página:** `AutomationCenterPage`
- **Services:**
  - `cronSchedulerService` — agendamento cron
  - `webhookTriggerService` — gatilhos via webhook
  - `retryEngineService` — retry inteligente
  - `credentialVaultService` — vault de credenciais
  - `notificationEngineService` — notificações multi-canal
  - `automationTemplateService` — templates prontos
  - `executionHistoryService` — histórico de execuções
  - `connectorRegistryService` — registro de conectores
  - `queueManagerService` — fila de jobs
  - `batchProcessorService` — processamento em lote

### 5.3 Approval Queue
- **Página:** `ApprovalQueuePage`
- Aprovação manual de workflow runs sensíveis

---

## 6️⃣ 🌐 Conectividade Externa (MCP + A2A)

### 6.1 MCP (Model Context Protocol)
- **Lib:** `src/lib/mcp/` (Client + Registry)
- 5.800+ servidores MCP suportados
- Tela "MCP Servers" em Settings

### 6.2 A2A (Agent-to-Agent Protocol)
- **Edge Function:** `a2a-server`
- **Service:** `agentCardService`, `agentHandoffService`
- Geração de Agent Cards (descoberta)
- Handoff entre agentes
- Painel A2A nos Deployments

### 6.3 Integrações Nativas
- **Bitrix24:** OAuth + API + Webhook (CRM brasileiro)
- **WhatsApp:** Webhook inbound + outbound
- **Routing unificado:** bitrix24/whatsapp/gmail/slack
- **Página:** `RoutingConfigPage`

---

## 7️⃣ 🔐 Segurança & Compliance

### 7.1 RBAC (Role-Based Access Control)
- **Páginas:** `RolesPage`, `PermissionsPage`, `RolePermissionsPage`
- **Service:** `rbacService`, `accessControlService`
- 5 roles hierárquicos (Owner, Admin, Editor, Viewer, Guest)
- 37 permissões granulares
- Componente `<AccessControl>` para gates de UI

### 7.2 Autenticação Avançada
- **Páginas:** `AuthPage`, `ResetPasswordPage`
- 2FA/TOTP completo (`user_2fa`, `TwoFactorSetup`)
- Password Breach Check (HIBP) server-side
- Google OAuth
- Backup codes

### 7.3 IP Whitelist + Geo-Blocking
- **Tabelas:** `ip_whitelist`, `geo_allowed_countries`, `access_blocked_log`
- **Edge Function:** `validate-access`
- Painel diagnóstico (`AccessControlPanel`)

### 7.4 Guardrails (4 camadas)
- **Edge Functions:** `guardrails-engine`, `guardrails-ml`
- **Service:** `guardrailsMLService`
- Detecção: Prompt Injection, PII, Toxicidade, Vazamento de Secrets
- Painel no Agent Builder

### 7.5 LGPD Compliance
- **Página:** `LGPDCompliancePage`
- **Edge Function:** `lgpd-manager`
- Consent records, exportação de dados, requisição de deleção

### 7.6 Audit Log + Forensic Snapshots
- `audit_log` + `forensic_snapshots` (chain hash imutável)
- Service: `auditLogService`

### 7.7 API Keys (SHA-256)
- Geração e gestão na `SettingsPage`
- Scopes granulares

---

## 8️⃣ 📚 Knowledge & RAG

- **Página:** `KnowledgePage`
- **Edge Functions:** `rag-ingest`, `rag-embed-v2`, `rag-rerank-v2`, `semantic-search`, `doc-ocr`
- **Services:** `knowledgeService`, `ragPipelineService`, `searchService`
- **Funcionalidades:**
  - Knowledge Bases + Collections + Documents + Chunks
  - Embedding multi-provider
  - Reranking
  - Busca semântica + visual
  - OCR de documentos (PDF, imagens)

---

## 9️⃣ 🚀 Deployments

- **Página:** `DeploymentsPage`, `OpenclawDeployPage`
- **Service:** `deploymentsService`, `openclawDeployService`
- **Tabelas:** `deploy_connections`, `environments`
- Deploy multi-ambiente (dev/staging/prod)
- Conexões ativas com canais (WhatsApp, Bitrix24, etc.)

---

## 🔟 📊 Monitoramento & Observabilidade

- **Página:** `MonitoringPage`
- **Service:** `monitoringService`, `healthService`, `healthAlertsService`
- **Edge Function:** `health-check`
- **Funcionalidades:**
  - Traces de agentes (`agent_traces`, `session_traces`, `trace_events`)
  - NexusTracer (OpenTelemetry GenAI)
  - Alertas (`alerts`)
  - Latência, custo, tokens por sessão
  - Aba "Tracing" dedicada

---

## 1️⃣1️⃣ 💰 Billing & Custos

- **Página:** `BillingPage`
- **Service:** `billingService`, `costCalculatorService`
- **Tabelas:** `usage_records`, `budgets`, `model_pricing`
- Calculadora de custos (18 modelos, BRL + USD)
- Budgets com alertas
- Tracking por workspace

---

## 1️⃣2️⃣ 🧪 Evaluations & Testing

- **Página:** `EvaluationsPage`
- **Edge Functions:** `eval-engine-v2`, `eval-judge`, `test-runner`
- **Service:** `evaluationsService`, `evalEngineService`
- Datasets + Test Cases
- Batch testing
- LLM-as-a-Judge
- Red Teaming / Prompt Pentesting

---

## 1️⃣3️⃣ 🎓 Fine-Tuning

- **Página:** `FineTuningPage`
- **Edge Function:** `hf-autotrain`
- **Service:** `fineTuningService`
- Wizard completo de fine-tuning (HuggingFace AutoTrain)

---

## 1️⃣4️⃣ 🛠️ Tools & Integrations

- **Página:** `ToolsPage`
- **Service:** `toolsService`
- **Tabelas:** `tool_integrations`, `tool_policies`
- Registry de tools por agente
- Políticas (max calls/run, requires approval)

---

## 1️⃣5️⃣ 🎨 Multimodal AI

- **Edge Functions:**
  - `image-analysis` — análise de imagens (Gemini 2.5 Flash)
  - `visual-search` — busca por imagem
  - `audio-transcribe` — STT
  - `text-to-speech` — TTS
  - `product-mockup` — geração de mockups
- **Services:** `visionService`, `audioService`, `productMockupService`

---

## 1️⃣6️⃣ 📝 Prompt Management

- **Páginas:** `PromptsPage`, `PromptEditorPage`
- **Service:** `promptVersionService`
- **Tabela:** `prompt_versions`
- Versionamento de prompts por agente

---

## 1️⃣7️⃣ 👥 Team & Workspaces

- **Página:** `TeamPage`
- **Service:** `teamsService`
- **Tabelas:** `workspaces`, `workspace_members`, `workspace_secrets`, `user_roles`
- Convite de membros
- Multi-workspace
- Secrets por workspace

---

## 1️⃣8️⃣ ⚙️ Settings & Admin

- **Páginas:** `SettingsPage`, `AdminPage`
- **Services:** `settingsService`, `adminCrudService`
- CRUD admin de tabelas
- Configuração geral
- Seletor de idioma (i18n PT-BR / EN-US)

---

## 1️⃣9️⃣ 🤖 LLM Gateway (Multi-Provider)

- **Edge Function:** `llm-gateway` (771 linhas)
- **Service:** `llmGatewayService`, `modelRouterService`
- **Funcionalidades:**
  - Multi-provider (OpenAI, Google Gemini, Anthropic via Lovable AI)
  - Streaming SSE nativo
  - Smart Model Router (`smart-model-router`)
  - Cost tracking + budget enforcement

---

## 2️⃣0️⃣ 🎛️ Recursos Adicionais

| Recurso | Localização |
|---|---|
| **Dashboard principal** | `DashboardPage` + `dashboardService` |
| **Search global** | `SearchPage` + `searchService` |
| **Data Storage UI** | `DataStoragePage` |
| **Widget embarcável** | `widgetService` + `widget-proxy` |
| **NLP Pipeline** | `nlpPipelineService` + `nlp-pipeline` |
| **AI Studio** | `AIStudioPage` |
| **Notification Center** | `useNotificationStore` + sino no header |
| **i18n** | PT-BR + EN-US (seletor no header) |

---

## 📈 Diferenciais Competitivos (vs Dify, n8n, CrewAI, StackAI, Vellum)

✅ **Único no mercado** combinando:
1. Multi-LLM Council Engine (Oráculo)
2. Knowledge Graph temporal (Super Cérebro)
3. Cross-database intelligence (DataHub)
4. 15 abas de configuração profunda (Agent Builder)
5. MCP + A2A nativos
6. Integração Bitrix24/WhatsApp para mercado brasileiro
7. LGPD Compliance built-in
8. Calculadora de custos em BRL

---

## 🏗️ Stack Técnico

```
Frontend:  React 18 + TypeScript + Vite 5 + Tailwind + Shadcn/UI + Zustand
Backend:   Supabase (PostgreSQL + Edge Functions Deno + RLS)
AI:        Lovable AI Gateway (Gemini 2.5/3.x, GPT-5.x)
Auth:      Supabase Auth + 2FA TOTP + HIBP + Google OAuth
DevOps:    GitHub Actions (lint → typecheck → test → build)
```

---

*Análise gerada a partir do mapeamento completo de `src/pages/`, `src/services/`, `supabase/functions/` e `src/integrations/supabase/types.ts`.*
