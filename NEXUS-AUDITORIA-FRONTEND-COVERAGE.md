# 🔍 AUDITORIA: COBERTURA FRONTEND vs BACKEND
### Nexus Agents Studio — 05/04/2026

---

## 📊 RESUMO EXECUTIVO

| Dimensão | Coberto | Total | % |
|----------|---------|-------|---|
| Edge Functions com frontend | 15 | 27 | **56%** |
| Services consumidos pelas páginas | 1 | 13 | **8%** |
| Hooks novos consumidos | 3 | 4 | **75%** |
| Stores novos consumidos | 2 | 5 | **40%** |
| Componentes novos usados | 4 | 6 | **67%** |
| Libs de infraestrutura consumidas | 1 | 7 | **14%** |

**Diagnóstico:** O BACKEND está sólido (27 Edge Functions, 13 services, 43 migrations). Porém o FRONTEND consome diretamente via `supabase.from()` e `fetch()` em cada página, IGNORANDO a camada de services criada como abstração. Além disso, 12 Edge Functions não têm nenhuma UI.

---

## ❌ FUNCIONALIDADES SEM TELA (12 Edge Functions)

### Severidade ALTA — 6 funcionalidades core sem UI

| # | Edge Function | O que faz | Tela necessária |
|---|---------------|-----------|-----------------|
| 1 | guardrails-engine | 4 camadas de proteção | Painel de Guardrails no Agent Builder |
| 2 | oracle-research | Deep Research iterativo | Botão "Deep Research" na OraclePage |
| 3 | a2a-server | Agent Cards + Task routing | Painel A2A nos Deployments |
| 4 | bitrix24-oauth | OAuth Bitrix24 | Botão "Conectar Bitrix24" em Settings |
| 5 | bitrix24-api | Proxy API Bitrix24 | Testar chamadas na ToolsPage |
| 6 | datahub-mcp-server | DataHub como MCP server | Aba "MCP Server" no DataHubPage |

### Severidade MÉDIA — 6 features sem UI dedicada

| # | Edge Function | Melhoria |
|---|---------------|----------|
| 7 | doc-ocr | Botão "OCR" na KnowledgePage |
| 8 | image-analysis | Preview de imagem no Agent Builder |
| 9 | product-mockup | Tela de geração de mockup |
| 10 | smolagent-runtime | Playground interativo expandido |
| 11 | test-runner | Painel de batch testing |
| 12 | hf-autotrain | Wizard de fine-tuning completo |

---

## ❌ SERVICES NÃO CONSUMIDOS (12/13)

As 32 páginas fazem `supabase.from('tabela').select()` DIRETO em vez de usar os services.

| Service | Página | Problema |
|---------|--------|----------|
| billingService | BillingPage | Usa supabase direto |
| cerebroService | SuperCerebroPage | Tabs usam fetch direto |
| datahubService | DataHubPage | Usa supabase direto |
| deploymentsService | DeploymentsPage | Usa supabase direto |
| evaluationsService | EvaluationsPage | Usa supabase direto |
| knowledgeService | KnowledgePage | Usa supabase + fetch |
| memoryService | MemoryPage | Usa supabase direto |
| monitoringService | MonitoringPage | 12 chamadas supabase direto! |
| oracleService | OraclePage | Usa oracleStore direto |
| securityService | SecurityPage (30L!) | Página é placeholder |
| teamsService | TeamPage | Usa supabase direto |
| workflowsService | WorkflowsPage | 11 chamadas supabase direto! |

---

## ❌ INFRA INACESSÍVEL AO USUÁRIO

| Módulo | Onde deveria estar | Status |
|--------|-------------------|--------|
| NexusMCPClient | Settings → "MCP Servers" | Sem UI |
| NexusTracer | Monitoring → "Tracing" | Sem UI |
| useI18n | Sidebar + seletor de idioma | Sem UI |
| useNotificationStore | Header → sino | Sem UI |
| useUIStore | Sidebar/modais | Não integrado |
| useDatahubStore | DataHubPage | Não integrado |
| AccessControl | Botões de ação | Não wrappando botões |

---

## 🎯 PLANO PARA 100% COVERAGE (3 Sprints)

### Sprint 1 — Wiring Services (maior impacto)
Migrar páginas para usar services em vez de supabase direto.

### Sprint 2 — UIs para Edge Functions órfãs
GuardrailsPanel, DeepResearchUI, Bitrix24Connect, MCPManager, A2AConfig, SecurityDashboard

### Sprint 3 — Infra Connectivity
useI18n no sidebar, NotificationCenter, AccessControl em botões, Tracer no Monitoring
