# Nexus Agents Studio — Arquitetura Técnica

## Visão Geral

Plataforma enterprise para criação, deploy e monitoramento de agentes de IA.

**Stack:** React 18 + TypeScript (strict) + Vite + Tailwind + shadcn/ui + Zustand + Supabase

---

## 27 Services

### Camada Core
| Service | Linhas | Função |
|---------|--------|--------|
| `agentService` | 303 | CRUD de agentes no Supabase |
| `dbManager` | 1078 | Database Manager — 33 funções SQL |
| `llmService` | 395 | Multi-provider LLM (OpenRouter/Anthropic/OpenAI) |

### Camada de Busca (RAG)
| Service | Linhas | Função |
|---------|--------|--------|
| `ragPipeline` | 306 | Ingest → chunk → retrieve → RAG query |
| `advancedRag` | 285 | BM25 + Semantic + RRF + Reranking + Citations |
| `agenticRag` | 130 | Self-correcting retrieval (CRAG pattern) |
| `vectorSearch` | 210 | pgvector + text + LLM hybrid search |
| `graphRag` | 289 | Knowledge graph construction + community detection |

### Camada de Memória
| Service | Linhas | Função |
|---------|--------|--------|
| `memoryService` | 240 | 6 layers + forgetting policies + LGPD |
| `selfEditingMemory` | 170 | MemGPT/Letta pattern — self-editing via tools |

### Camada de Segurança
| Service | Linhas | Função |
|---------|--------|--------|
| `securityService` | 250 | PII Detection (10 patterns) + Injection (15 patterns) |
| `traceService` | 351 | Auto-traces + cost + budget + guardrails |

### Camada de Execução
| Service | Linhas | Função |
|---------|--------|--------|
| `graphEngine` | 451 | Graph orchestration — ciclos, branching, HITL, checkpoints |
| `workflowEngine` | 200 | Sequential workflow execution |
| `testRunnerService` | 150 | LLM-as-judge test runner |

### Camada de Integração
| Service | Linhas | Função |
|---------|--------|--------|
| `edgeFunctions` | 160 | Client tipado para 6 Edge Functions Supabase |
| `identityResolution` | 266 | Cross-DB matching (email/CNPJ/phone) |
| `widgetService` | 130 | Embeddable chat widget generator |
| `voiceService` | 200 | STT/TTS via Web Speech API |

### Camada Enterprise
| Service | Linhas | Função |
|---------|--------|--------|
| `modelRouter` | 200 | Load balancing + fallback chains + semantic cache |
| `alertService` | 150 | Auto-alerts (error rate, latency, budget) |
| `agentGovernance` | 250 | Versioning + handoff + policies + approval + audit |
| `contextManager` | 200 | RAGAS metrics + cost attribution + streaming |
| `abTestingService` | 170 | Z-test statistical significance |
| `annotationService` | 140 | Human review queue |
| `anomalyDetection` | 180 | Statistical baselines + health scoring |
| `cicdService` | 200 | Pipeline CI/CD + triggers + SDK generation |

---

## 27 Páginas

| Seção | Páginas |
|-------|---------|
| **Dashboard** | DashboardPage |
| **Agents** | AgentsPage, AgentDetailPage, CreateAgentPage, AgentBuilder (17 módulos) |
| **Development** | KnowledgePage, MemoryPage, ToolsPage, PromptsPage, PromptEditorPage, WorkflowsPage |
| **Operations** | EvaluationsPage, DeploymentsPage, MonitoringPage, DataStoragePage, DataHubPage, SuperCerebroPage, OraculoPage, DatabaseManagerPage, MarketplacePage |
| **Admin** | SecurityPage, TeamPage, BillingPage, SettingsPage |
| **Auth** | AuthPage, NotFound, Index |

---

## Fluxo de Dados

```
User Input
  → securityService.checkInputSecurity() [PII + Injection]
  → traceService.checkInputGuardrails() [Content rules]
  → contextManager.trimConversation() [Context window]
  → modelRouter.callWithFallback() [Provider resilience]
    → llmService.callModel() [API call]
  → securityService.checkOutputSecurity() [Output PII]
  → traceService.recordTrace() [Observability]
  → traceService.recordUsage() [Cost tracking]
  → memoryService.autoExtractFromConversation() [Memory]
  → annotationService.autoFlagTrace() [Quality]
  → User Response
```

---

## Testes

- **18 arquivos de teste**, **245 testes**
- Cobertura: 27/27 services testados
- Framework: Vitest + jsdom
- CI: GitHub Actions (tsc + vitest + vite build)

---

## Migrations

6 arquivos SQL, 37 tabelas, extensões pgvector + pg_trgm.

---

## Configuração

- **TypeScript:** `strict: true`, `noImplicitAny: true`
- **Vite:** Manual chunks (vendor-react, vendor-state, vendor-charts, vendor-supabase)
- **Tailwind:** Tema dark, fontes Space Grotesk + Inter + JetBrains Mono
- **Supabase:** RLS habilitado, multi-tenant via workspace_id
