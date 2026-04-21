# 🚀 Nexus Agents Studio — Funcionalidades do Sistema

> **Documento gerado:** 2026-04-21
> **Versão:** V6 (Production-Ready 10/10)
> **Escopo:** Mapeamento exaustivo de todas as funcionalidades do sistema
> **Sincronia GitHub:** Este código é espelhado bidirecionalmente com o repositório GitHub via Lovable. A análise aqui cobre 100% do que está versionado.

---

## 📑 Sumário

1. [Visão Geral](#1-visão-geral)
2. [Sumário Executivo](#2-sumário-executivo)
3. [Funcionalidades por Domínio](#3-funcionalidades-por-domínio)
   - [A. Construção de Agentes](#a-construção-de-agentes)
   - [B. Inteligência & Modelos](#b-inteligência--modelos)
   - [C. Memória & Conhecimento](#c-memória--conhecimento)
   - [D. Dados & Integrações](#d-dados--integrações)
   - [E. Workflows & Automação](#e-workflows--automação)
   - [F. Avaliação & Qualidade](#f-avaliação--qualidade)
   - [G. Observabilidade & Monitoramento](#g-observabilidade--monitoramento)
   - [H. Segurança & Governança](#h-segurança--governança)
   - [I. Compliance & Risco](#i-compliance--risco)
   - [J. Resiliência & Operações](#j-resiliência--operações)
   - [K. Deploy & Distribuição](#k-deploy--distribuição)
   - [L. Plataforma & Admin](#l-plataforma--admin)
4. [Mapeamento Técnico](#4-mapeamento-técnico)
5. [Stack & Arquitetura](#5-stack--arquitetura)
6. [Estatísticas Finais](#6-estatísticas-finais)

---

## 1. Visão Geral

**Nexus Agents Studio** (também referenciado como **Fator X — Super Agentes de IA**) é uma plataforma **multi-tenant enterprise** para criação, deploy, governança e observabilidade de agentes de IA, com foco no mercado brasileiro (PT-BR nativo, integração Bitrix24, calculadora em BRL, LGPD built-in).

**Características-chave:**
- 🇧🇷 **PT-BR nativo** com suporte i18n (PT/EN)
- 🏢 **Multi-tenant** com isolamento RLS por workspace
- 🤖 **Multi-LLM** (Gemini 2.5/3.x, GPT-5.x via Lovable AI Gateway)
- 🔐 **Segurança enterprise** (RBAC, 2FA, guardrails, pentest, LGPD)
- ⚡ **Real-time** via Supabase Realtime
- 🌐 **MCP + A2A** nativos para interoperabilidade
- 📊 **10/10 production-ready** (V6 — auditoria completa concluída)

---

## 2. Sumário Executivo

| Camada | Quantidade |
|---|---:|
| **Páginas (rotas)** | 98 |
| **Services (frontend)** | 93 |
| **Edge Functions (backend)** | 63 |
| **Tabelas no banco (RLS)** | 200+ |
| **RPCs SECURITY DEFINER** | 30+ |
| **Roles RBAC** | 5 hierárquicos |
| **Permissões granulares** | 37+ |
| **Testes automatizados** | 83 (vitest) |
| **ADRs documentados** | 5 |
| **Relatórios de auditoria** | V1 → V6 |

---

## 3. Funcionalidades por Domínio

### A. Construção de Agentes

Núcleo da plataforma — criação visual e programática de agentes IA.

#### A.1 Agent Builder & Wizard
- **Páginas:** `AgentsPage`, `AgentBuilder`, `CreateAgentPage`, `AgentDetailPage`, `AgentTemplatesPage`
- **Service:** `agentsService`
- **Funcionalidades:**
  - Wizard guiado de criação (`CreateAgentWizard`)
  - Builder visual com **15 abas** de configuração: Identidade, Modelo, Prompt, Knowledge, Tools, Guardrails, Memory, Skills, Routing, Deploy, Versioning, A2A, Cost, Evaluation, Monitoring
  - Templates pré-configurados (`agent_templates`)
  - Score de prontidão por agente
  - Avatar emoji + tags + categoria
  - Versionamento (`agent_versions`) com rollback

#### A.2 Prompt Management
- **Páginas:** `PromptsPage`, `PromptEditorPage`, `PromptABTestPage`, `PromptExperimentsPage`
- **Services:** `promptVersionService`, `promptExperimentService`
- **Tabelas:** `prompt_versions`, `agent_experiments`, `agent_experiment_runs`
- **Funcionalidades:**
  - Versionamento de prompts por agente
  - A/B testing com traffic split
  - Experimentos com winner detection
  - Editor com syntax highlighting

#### A.3 Orquestração Multi-Agente
- **Páginas:** `AgentOrchestrationPage`, `AgentSimulationPage`, `AgentDebuggerPage`
- **Services:** `agentGraphService`, `agentRoutingService`, `agentHandoffService`, `agentCardService`
- **Tabelas:** `agent_graphs`, `agent_workflows`, `agent_workflow_runs`
- **Funcionalidades:**
  - Grafos de agentes com nós e arestas
  - Sub-agentes e handoff entre agentes
  - Cards A2A (Agent-to-Agent Protocol) para descoberta
  - Simulação e debugger interativo

#### A.4 Agent Skills & Self-Evolution (ACE)
- **Service:** `agentEvolutionService`, `skillsRegistryService`
- **Tabelas:** `agent_skills`, `agent_installed_skills`, `skill_registry`
- **Funcionalidades:**
  - Reflector sobre traces para aprender skills
  - Marketplace de skills público
  - 5 categorias de skills instaláveis
  - Confidence score por skill

---

### B. Inteligência & Modelos

#### B.1 🔮 Oráculo — Multi-LLM Council
- **Página:** `OraclePage`
- **Edge Functions:** `oracle-council`, `oracle-research`
- **Service:** `oracleService`
- **Funcionalidades:**
  - 5 modos: Council, Debate, Consensus, Chairman, Research
  - Conselho de múltiplas IAs deliberando simultaneamente
  - Chairman Synthesis com citações inline
  - Deep Research iterativo
  - Histórico (`oracle_history`) com confidence + consensus
  - Métricas de latência, tokens e custo USD/BRL

#### B.2 LLM Gateway & Smart Router
- **Edge Functions:** `llm-gateway` (771 linhas), `smart-model-router`
- **Services:** `llmGatewayService`, `modelRouterService`
- **Funcionalidades:**
  - Multi-provider (OpenAI, Google, Anthropic via Lovable AI)
  - Streaming SSE nativo
  - Smart routing baseado em custo/latência/capacidade
  - Cost tracking + budget enforcement

#### B.3 Smolagent Runtime (ReAct autônomo)
- **Página:** `SmolagentPage`
- **Edge Function:** `smolagent-runtime`
- Loop ReAct (Reasoning + Acting) autônomo
- Sandbox isolado para execução segura
- Playground com streaming

#### B.4 Fine-Tuning & Federated Learning
- **Páginas:** `FineTuningPage`, `FederatedLearningPage`
- **Edge Function:** `hf-autotrain`
- **Service:** `fineTuningService`
- Wizard HuggingFace AutoTrain
- Federated learning para treino distribuído

#### B.5 Agentes Multimodais
- **Páginas:** `VisionAgentsPage`, `VoiceAgentsPage`, `VoiceAgentStudioPage`, `VoiceTelephonyPage`, `BrowserAgentPage`, `ComputerUsePage`, `CodeInterpreterPage`
- **Edge Functions:** `image-analysis`, `visual-search`, `audio-transcribe`, `text-to-speech`, `voice-session`, `voice-synthesize`, `voice-transcribe`, `browser-agent-run`, `browser-session-cancel`, `code-interpreter-execute`, `product-mockup`
- **Services:** `visionService`, `audioService`, `voiceAgentService`, `browserAgentService`, `codeInterpreterService`, `productMockupService`
- **Funcionalidades:**
  - **Vision:** análise de imagens (Gemini 2.5 Flash), busca visual, OCR
  - **Voice:** STT/TTS, voice studio, telephony (calls inbound/outbound)
  - **Browser Agent:** navegação autônoma com goal + steps
  - **Computer Use:** controle de desktop simulado
  - **Code Interpreter:** execução sandboxed (Python/Node)
  - **Product Mockup:** geração de mockups de produtos

#### B.6 NLP Pipeline
- **Página:** `NLPPipelinePage`
- **Edge Function:** `nlp-pipeline`
- **Service:** `nlpPipelineService`
- Pipeline de NLP: classificação, NER, sentiment, embedding

---

### C. Memória & Conhecimento

#### C.1 🧠 Super Cérebro (Enterprise Memory Layer)
- **Página:** `SuperCerebroPage` (8 tabs)
- **Edge Functions:** `cerebro-brain`, `cerebro-query`, `memory-manager`, `memory-tools`
- **Services:** `cerebroService`, `memoryService`, `temporalKnowledgeService`, `entityResolutionService`, `knowledgeDecayService`, `contextTiersService`
- **6 tipos de memória:**
  1. Short-term (sessão)
  2. Episodic (eventos)
  3. Semantic (fatos)
  4. Procedural (skills)
  5. Profile (perfil de usuário)
  6. Shared (compartilhada entre agentes)
- **Funcionalidades adicionais:**
  - Knowledge Graph temporal
  - Context Tiers L0/L1/L2 (busca hierárquica)
  - Decay temporal de conhecimento
  - Entity Resolution (deduplicação inteligente)
  - Compactação automática

#### C.2 Knowledge Bases & RAG v2
- **Páginas:** `KnowledgePage`, `KnowledgeManagementPage`, `KnowledgeGraphPage`, `MemoryPage`
- **Edge Functions:** `rag-ingest`, `rag-embed-v2`, `rag-rerank`, `rag-rerank-v2`, `semantic-search`, `doc-ocr`, `kb-analyze-gaps`, `kb-translate-article`
- **Services:** `knowledgeService`, `knowledgeManagementService`, `ragPipelineService`, `searchService`
- **Funcionalidades:**
  - Knowledge Bases + Collections + Documents + Chunks
  - Embedding multi-provider
  - Reranking v2
  - OCR de PDF/imagens
  - Gap analysis (detecção de lacunas)
  - Tradução de artigos

#### C.3 Busca Global
- **Página:** `SearchPage`
- **Edge Function:** `global-search`
- **Service:** `searchService`
- Busca semântica + keyword cross-domain

---

### D. Dados & Integrações

#### D.1 🗄️ DataHub (Cross-Database Intelligence)
- **Página:** `DataHubPage`
- **Edge Functions:** `datahub-query`, `datahub-mcp-server`
- **Service:** `datahubService`
- **Funcionalidades:**
  - **4 bancos Supabase externos** conectados
  - 340+ tabelas / 920K+ registros indexados
  - DataHub exposto como **MCP Server**
  - Queries cross-database
  - Painel de qualidade de dados

#### D.2 Integrações Nativas BR
- **Bitrix24 (CRM brasileiro):**
  - **Edge Functions:** `bitrix24-api`, `bitrix24-oauth`, `bitrix24-webhook`
  - **Service:** `bitrix24WebhookService`
  - OAuth + REST API + Webhooks (deals, leads, contacts, tasks)
- **WhatsApp:**
  - **Edge Functions:** `whatsapp-webhook`
  - **Services:** `whatsappOutboundService`, `whatsappWebhookService`
  - Inbound + outbound

#### D.3 Email/Calendar Triggers
- **Página:** `EmailCalendarTriggersPage`
- Triggers via inbox e Google Calendar

#### D.4 MCP & Connector Registry
- **Lib:** `src/lib/mcp/`
- **Service:** `connectorRegistryService`
- 5.800+ servidores MCP suportados
- Registry unificado de conectores

#### D.5 Widget Embarcável
- **Edge Function:** `widget-proxy`
- **Service:** `widgetService`
- Widget JS embarcável em sites externos

#### D.6 Routing Unificado
- **Página:** `RoutingConfigPage`
- Routing por canal: Bitrix24, WhatsApp, Gmail, Slack, Webhook

---

### E. Workflows & Automação

#### E.1 Workflow Engine v2
- **Página:** `WorkflowsPage`
- **Edge Functions:** `workflow-engine-v2`, `graph-execute`, `agent-workflow-runner`
- **Services:** `workflowsService`, `workflowCheckpointService`, `replayForkService`
- **Funcionalidades:**
  - Editor visual drag-and-drop
  - 12 tipos de nós
  - **Checkpoints + resume**
  - **Replay & fork** (re-execução de runs)

#### E.2 Automation Center
- **Páginas:** `AutomationCenterPage`, `AutomationsPage`
- **Edge Functions:** `automation-pipeline`, `cron-executor`, `webhook-receiver`, `queue-worker`
- **Services:** `cronSchedulerService`, `webhookTriggerService`, `retryEngineService`, `credentialVaultService`, `notificationEngineService`, `automationTemplateService`, `executionHistoryService`, `queueManagerService`, `batchProcessorService`
- **Funcionalidades:**
  - Cron scheduler
  - Webhook triggers
  - Retry inteligente
  - Vault de credenciais
  - Notificações multi-canal
  - Templates prontos
  - Histórico de execuções
  - Fila de jobs
  - Processamento em lote

#### E.3 Approval Queue
- **Página:** `ApprovalQueuePage`
- **Service:** `approvalService`
- Aprovação manual de workflow runs sensíveis

#### E.4 Replay & Fork
- **Página:** `ReplayForkPage`
- **Edge Function:** `replay-fork-execute`
- Re-executar runs com modificações

---

### F. Avaliação & Qualidade

#### F.1 Eval Engine v2
- **Página:** `EvaluationsPage`
- **Edge Functions:** `eval-engine-v2`, `eval-judge`, `agent-eval-runner`, `test-runner`
- **Services:** `evaluationsService`, `evalEngineService`
- **Tabelas:** `agent_eval_datasets`, `agent_eval_runs`, `agent_eval_results`
- **Funcionalidades:**
  - Datasets + Test Cases
  - Batch testing
  - **LLM-as-a-Judge**
  - **CLEAR scoring** (Correctness, Latency, Efficiency, Adherence, Robustness)
  - Red Teaming / Prompt Pentesting

#### F.2 Synthetic Data & Monitoring
- **Páginas:** `SyntheticDataPage`, `SyntheticMonitoringPage`
- **Edge Function:** `synthetic-runner`
- **Service:** `syntheticService`
- Geração de dados sintéticos
- Monitoramento sintético (probes contínuos)

#### F.3 Agent Evolution
- **Service:** `agentEvolutionService`
- Self-improvement via reflection sobre traces

---

### G. Observabilidade & Monitoramento

#### G.1 Traces & OTel
- **Páginas:** `TracesTimelinePage`, `ObservabilityOTelPage`, `MonitoringPage`
- **Tabelas:** `agent_traces`, `session_traces`, `trace_events`
- **NexusTracer** (OpenTelemetry GenAI)
- Timeline interativo

#### G.2 SLO & Health
- **Páginas:** `SLODashboard`, `MonitoringPage`
- **Edge Function:** `health-check`
- **Services:** `monitoringService`, `healthService`, `healthAlertsService`
- SLO dashboards (uptime, latency, error rate)
- Alertas configuráveis (`alerts`)

#### G.3 Cost Optimization
- **Páginas:** `CostAnomaliesPage`, `CostOptimizerPage`, `BillingPage`, `BudgetSettingsPage`
- **Services:** `costAnomalyService`, `costCalculatorService`, `billingService`, `budgetService`
- **Tabelas:** `usage_records`, `budgets`, `model_pricing`, `budget_events`
- Detecção de anomalias de custo
- Otimizador de gastos
- Calculadora 18 modelos (BRL + USD)
- Budgets com alertas

#### G.4 Dashboard Principal
- **Página:** `DashboardPage`
- **Service:** `dashboardService`
- KPIs consolidados

---

### H. Segurança & Governança

#### H.1 RBAC (Role-Based Access Control)
- **Páginas:** `RolesPage`, `PermissionsPage`, `RolePermissionsPage`
- **Services:** `rbacService`, `accessControlService`
- 5 roles hierárquicos (Owner, Admin, Editor, Viewer, Guest)
- 37+ permissões granulares
- Componente `<AccessControl>` para gates de UI
- Tabela `user_roles` com SECURITY DEFINER `has_role()`

#### H.2 Autenticação
- **Páginas:** `AuthPage`, `ResetPasswordPage`, `EnterpriseSSOPage`
- 2FA/TOTP completo (`user_2fa`)
- Password Breach Check (HIBP) server-side
- Google OAuth
- Backup codes
- Enterprise SSO (SAML)

#### H.3 Guardrails (4 camadas)
- **Edge Functions:** `guardrails-engine`, `guardrails-ml`
- **Service:** `guardrailsMLService`
- Detecção: Prompt Injection, PII, Toxicidade, Vazamento de Secrets
- Painel no Agent Builder

#### H.4 Pentest & Vulnerabilities
- **Páginas:** `PentestPage`, `PentestFindingsPage`, `VulnerabilitiesPage`, `SBOMPage`
- **Services:** `pentestService`, `sbomService`
- **Edge Function:** `sbom-scanner`
- Pentest scanner + triage de findings
- SBOM (Software Bill of Materials)
- Tracking de vulnerabilidades

#### H.5 Secrets & Vault
- **Página:** `SecretsRotationPage`
- **Services:** `secretsRotationService`, `credentialVaultService`
- Rotation automática
- Vault de credenciais

#### H.6 Asset & Vendor Risk
- **Páginas:** `AssetInventoryPage`, `VendorsPage`
- **Services:** `assetInventoryService`, `vendorRiskService`
- Inventário de assets
- Risk scoring de fornecedores

#### H.7 Access Control & Audit
- **Página:** `SecurityPage`
- **Edge Function:** `validate-access`
- **Services:** `accessControlService`, `auditLogService`
- **Tabelas:** `ip_whitelist`, `geo_allowed_countries`, `access_blocked_log`, `audit_log`, `forensic_snapshots`
- IP Whitelist + Geo-Blocking
- Audit log + forensic snapshots (chain hash imutável)

#### H.8 API Keys
- **Página:** `SettingsPage`
- API Keys SHA-256 com scopes granulares

---

### I. Compliance & Risco

#### I.1 LGPD Compliance
- **Página:** `LGPDCompliancePage`
- **Edge Function:** `lgpd-manager`
- **Service:** `lgpdService`
- Consent records
- Exportação de dados pessoais
- Requisição de deleção
- Data Subject Rights

#### I.2 Compliance Reports
- **Página:** `ComplianceReportsPage`
- **Service:** `complianceService`
- **Tabelas:** `compliance_frameworks`, `compliance_controls`, `compliance_evidence`, `compliance_reports`
- Frameworks (LGPD, ISO 27001, SOC 2)
- Coleta de evidências
- Score por controle

#### I.3 Data Residency
- **Página:** `DataResidencyPage`
- Controle de localização geográfica de dados

#### I.4 Risk Register
- **Página:** `RiskRegisterPage`
- **Service:** `riskService`
- Registro corporativo de riscos

#### I.5 Change Management
- **Página:** `ChangeManagementPage`
- **Service:** `changeManagementService`
- **Tabelas:** `change_requests`, `change_approvals`
- Workflow de change requests com aprovação

---

### J. Resiliência & Operações

#### J.1 Disaster Recovery & BCP
- **Páginas:** `DisasterRecoveryPage`, `DRDrillsPage`, `BCPPage`
- **Edge Function:** `dr-orchestrator`
- **Services:** `drDrillService`, `bcpService`
- **Tabelas:** `business_systems`, `bcp_test_runs`
- DR drills com RTO/RPO tracking
- BCP (Business Continuity Plan)
- Categorização por criticidade

#### J.2 Chaos Engineering
- **Página:** `ChaosLabPage`
- **Service:** `chaosService`
- **Tabela:** `chaos_experiments`
- Fault injection (latency, errors, disconnects)
- Game days simulados

#### J.3 Game Days (Live)
- **Páginas:** `GameDaysPage`, `GameDayLivePage`
- **Service:** `gameDayService`
- Game days ao vivo com observadores

#### J.4 Incident Management
- **Páginas:** `IncidentPlaybooksPage`, `IRPlaybooksPage`, `OncallPage`, `PostmortemsPage`, `PostmortemEditorPage`
- **Edge Function:** `incident-orchestrator`
- **Services:** `incidentService`, `irPlaybookService`, `postmortemService`
- **Tabela:** `oncall_schedule`, `oncall_schedule_emails` (PII isolado)
- Playbooks de IR
- On-call schedule
- Postmortems editáveis

#### J.5 Notifications
- **Edge Function:** `notification-sender`
- **Service:** `notificationEngineService`
- Multi-canal: email, WhatsApp, Slack, webhook

---

### K. Deploy & Distribuição

#### K.1 Deployments Multi-Canal
- **Páginas:** `DeploymentsPage`, `OpenclawDeployPage`, `CanaryDeploymentsPage`
- **Edge Function:** `openclaw-proxy`
- **Services:** `deploymentsService`, `openclawDeployService`
- **Tabelas:** `deploy_connections`, `environments`
- **Canais suportados:**
  - REST API
  - WhatsApp
  - Web Chat / Widget
  - Slack
  - Email
  - Bitrix24
  - Telegram
  - Discord
  - HuggingFace Space
- **Canary deployments** (gradual rollout)
- Multi-ambiente (dev/staging/prod)

#### K.2 Mobile SDK
- **Página:** `MobileSDKPage`
- SDK para apps iOS/Android

#### K.3 Marketplace
- **Páginas:** `MarketplaceMonetizedPage`, `SkillsMarketplacePage`
- **Service:** `marketplaceService`
- Marketplace monetizado (skills + agentes)
- Skills instaláveis pela comunidade

#### K.4 Tools Registry
- **Página:** `ToolsPage`
- **Service:** `toolsService`
- **Tabelas:** `tool_integrations`, `tool_policies`
- Registry de tools por agente
- Políticas (max calls/run, requires approval)

---

### L. Plataforma & Admin

#### L.1 Multi-Tenancy & Workspaces
- **Páginas:** `MultiTenancyPage`, `TeamPage`
- **Service:** `teamsService`, `workspaceContextService`
- **Tabelas:** `workspaces`, `workspace_members`, `workspace_member_emails` (PII isolado V6), `workspace_secrets`
- **RPC atômica:** `invite_workspace_member`
- Convite de membros (via RPC atômica)
- Multi-workspace com switcher
- Secrets por workspace

#### L.2 Settings & Admin
- **Páginas:** `SettingsPage`, `AdminPage`
- **Services:** `settingsService`, `adminCrudService`
- CRUD admin de tabelas
- Configurações gerais
- Seletor i18n PT/EN

#### L.3 AI Studio
- **Página:** `AIStudioPage`
- Playground completo

#### L.4 Public Pages
- **Páginas:** `PublicHelpCenterPage`, `PublicForumPage`, `ArticleEditorPage`
- Help center público
- Fórum comunitário
- Editor de artigos

#### L.5 Data Storage
- **Página:** `DataStoragePage`
- **Service:** `dataStorageService`
- Upload/gerenciamento de arquivos

---

## 4. Mapeamento Técnico

### 4.1 Edge Functions (63)

| Função | Propósito |
|---|---|
| `_shared` | Utilitários comuns (CORS, auth, validation) |
| `a2a-server` | Agent-to-Agent protocol server |
| `agent-conversational-builder` | Builder de agente via chat |
| `agent-eval-runner` | Runner de avaliação de agentes |
| `agent-workflow-runner` | Runner de workflows |
| `audio-transcribe` | STT (speech-to-text) |
| `automation-pipeline` | Pipeline de automação |
| `bitrix24-api` | API REST Bitrix24 |
| `bitrix24-oauth` | OAuth Bitrix24 |
| `bitrix24-webhook` | Webhook inbound Bitrix24 |
| `browser-agent-run` | Browser agent autônomo |
| `browser-session-cancel` | Cancelar sessão browser |
| `cerebro-brain` | Super Cérebro core |
| `cerebro-query` | Query no cérebro |
| `code-interpreter-execute` | Code interpreter sandbox |
| `cron-executor` | Executor de cron jobs |
| `datahub-mcp-server` | DataHub como MCP server |
| `datahub-query` | Queries cross-database |
| `doc-ocr` | OCR de documentos |
| `dr-orchestrator` | Orquestrador de DR drills |
| `eval-engine-v2` | Engine de avaliação v2 |
| `eval-judge` | LLM-as-a-judge |
| `global-search` | Busca global |
| `graph-execute` | Executor de grafos de agentes |
| `guardrails-engine` | Guardrails core |
| `guardrails-ml` | Guardrails ML-based |
| `health-check` | Health check |
| `hf-autotrain` | HuggingFace AutoTrain |
| `image-analysis` | Análise de imagens |
| `incident-orchestrator` | Orquestrador de incidentes |
| `kb-analyze-gaps` | Gap analysis em KB |
| `kb-translate-article` | Tradução de artigos |
| `lgpd-manager` | LGPD compliance |
| `llm-gateway` | Gateway multi-provider LLM |
| `memory-manager` | Gerenciador de memória |
| `memory-tools` | Tools de memória |
| `nlp-pipeline` | Pipeline NLP |
| `notification-sender` | Envio multi-canal |
| `openclaw-proxy` | Proxy Openclaw |
| `oracle-council` | Oracle multi-LLM council |
| `oracle-research` | Oracle deep research |
| `product-mockup` | Geração de mockups |
| `queue-worker` | Worker de fila |
| `rag-embed-v2` | RAG embedding v2 |
| `rag-ingest` | Ingestão RAG |
| `rag-rerank` | Reranking |
| `rag-rerank-v2` | Reranking v2 |
| `replay-fork-execute` | Replay/fork de runs |
| `sbom-scanner` | Scanner SBOM |
| `semantic-search` | Busca semântica |
| `smart-model-router` | Roteador inteligente de modelos |
| `smolagent-runtime` | Runtime smolagent ReAct |
| `synthetic-runner` | Runner sintético |
| `test-runner` | Test runner |
| `text-to-speech` | TTS |
| `validate-access` | Validação de acesso (IP/geo) |
| `visual-search` | Busca visual |
| `voice-session` | Sessão de voz |
| `voice-synthesize` | Síntese de voz |
| `voice-transcribe` | Transcrição de voz |
| `webhook-receiver` | Receiver genérico webhooks |
| `whatsapp-webhook` | Webhook WhatsApp |
| `widget-proxy` | Proxy do widget embarcável |
| `workflow-engine-v2` | Engine de workflow v2 |

### 4.2 Estrutura de Páginas (98)

Páginas agrupadas por domínio funcional (ver seção 3 para detalhes). Todas protegidas por `<AuthGuard>` exceto: `AuthPage`, `ResetPasswordPage`, `PublicHelpCenterPage`, `PublicForumPage`, `Index`, `NotFound`.

---

## 5. Stack & Arquitetura

### 5.1 Stack Técnico
```
Frontend:  React 18 + TypeScript 5 (strict) + Vite 5 + Tailwind v3 + Shadcn/UI + Zustand
Backend:   Supabase (PostgreSQL + Edge Functions Deno + RLS) via Lovable Cloud
AI:        Lovable AI Gateway (Gemini 2.5/3.x, GPT-5.x, sem API key necessária)
Auth:      Supabase Auth + 2FA TOTP + HIBP + Google OAuth + SAML SSO
Realtime:  Supabase Realtime (WebSockets)
DevOps:    GitHub Actions (lint → typecheck → test → build)
Tests:     Vitest (83 testes) + Deno tests (edge functions)
```

### 5.2 Arquitetura Dual-Client
- **`supabase`** (cliente local): autenticação e dados próprios da app
- **`supabaseExternal`** (cliente externo): leitura/escrita de dados de negócio em projeto Supabase separado
- Ver `mem://features/external-db-migration` para detalhes

### 5.3 Princípios Arquiteturais (ADRs 001-005)
- **ADR-001:** Supabase como backend único
- **ADR-002:** A2A Protocol para interop entre agentes
- **ADR-003:** Edge Functions com `_shared/` (CORS, auth, Zod, rate-limit)
- **ADR-004:** Dynamic Table Access Pattern
- **ADR-005:** Client-side RBAC com Server RLS

---

## 6. Estatísticas Finais

| Métrica | Valor |
|---|---:|
| **Páginas (rotas React)** | 98 |
| **Services frontend** | 93 |
| **Edge Functions** | 63 |
| **Tabelas no Postgres** | 200+ |
| **Tabelas com RLS habilitado** | 100% |
| **RPCs SECURITY DEFINER** | 30+ |
| **Roles RBAC** | 5 |
| **Permissões granulares** | 37+ |
| **Testes automatizados (Vitest)** | 83 |
| **Idiomas suportados** | 2 (PT-BR, EN-US) |
| **Modelos LLM no calculator** | 18 |
| **Modos do Oráculo** | 5 |
| **Tipos de memória** | 6 |
| **Canais de deploy** | 9+ |
| **Servidores MCP suportados** | 5.800+ |
| **ADRs documentados** | 5 |
| **Relatórios de auditoria** | V1 → V6 |
| **Production-Ready Score** | **10/10** ✅ |

---

## 🏆 Diferenciais Competitivos

Único no mercado combinando:
1. **Multi-LLM Council Engine** (Oráculo)
2. **Knowledge Graph temporal** (Super Cérebro)
3. **Cross-database intelligence** (DataHub + MCP server)
4. **15 abas de configuração profunda** (Agent Builder)
5. **MCP + A2A nativos**
6. **Integração Bitrix24/WhatsApp** para mercado brasileiro
7. **LGPD Compliance built-in**
8. **Calculadora de custos em BRL**
9. **DR drills + Chaos Lab + Game Days** (resiliência completa)
10. **CLEAR scoring** (avaliação multidimensional)

---

## 📌 Notas Finais

- **Sincronia GitHub:** Repositório espelhado bidirecionalmente — análise local cobre 100% do código versionado.
- **Status produção:** ✅ Aprovado (V6 — auditoria de segurança completa, RLS hardening, PII isolation).
- **Próximas evoluções:** Ver `mem://features/audit-improvements` para roadmap contínuo.

---

*Documento gerado a partir do mapeamento exaustivo de `src/pages/` (98), `src/services/` (93), `supabase/functions/` (63), `src/integrations/supabase/types.ts` e documentação `docs/`.*
