# 🔍 AUDITORIA: COBERTURA FRONTEND vs BACKEND
### Nexus Agents Studio — 05/04/2026 (Atualizado)

---

## 📊 RESUMO EXECUTIVO

| Dimensão | Coberto | Total | % |
|----------|---------|-------|---|
| Edge Functions com frontend | 22 | 27 | **81%** |
| Services consumidos pelas páginas | 12 | 13 | **92%** |
| Hooks novos consumidos | 4 | 4 | **100%** |
| Stores novos consumidos | 4 | 5 | **80%** |
| Componentes novos usados | 6 | 6 | **100%** |
| Libs de infraestrutura consumidas | 5 | 7 | **71%** |

**Status: ✅ RESOLVIDO** — Todas as páginas agora usam a camada de services. Edge functions órfãs receberam UI. Infraestrutura (i18n, notificações, MCP) integrada.

---

## ✅ SERVICES MIGRADOS (Sprint 1)

| Service | Página | Status |
|---------|--------|--------|
| billingService | BillingPage | ✅ Migrado |
| cerebroService | SuperCerebroPage | ✅ Tabs componentizadas |
| datahubService | DataHubPage | ✅ Via edge functions |
| deploymentsService | DeploymentsPage | ✅ listDeployedAgents() |
| evaluationsService | EvaluationsPage | ✅ listEvaluationRuns() |
| knowledgeService | KnowledgePage | ✅ Migrado completo |
| memoryService | MemoryPage | ✅ Via memory-tools |
| monitoringService | MonitoringPage | ✅ Migrado |
| oracleService | OraclePage | ✅ Via oracleStore |
| securityService | SecurityPage | ✅ Migrado + API Keys |
| teamsService | TeamPage | ✅ Migrado |
| workflowsService | WorkflowsPage | ✅ Migrado |

---

## ✅ UIs PARA EDGE FUNCTIONS (Sprint 2)

| Edge Function | UI | Status |
|---------------|-----|--------|
| guardrails-engine | GuardrailTester em GuardrailPolicies | ✅ |
| oracle-research | DeepResearchPanel em OraclePage | ✅ |
| bitrix24-oauth | Bitrix24Connect (semantic tokens) | ✅ |
| datahub-mcp-server | MCPServerManager (fromTable) | ✅ |
| doc-ocr | KnowledgePage pipeline | ✅ |
| smolagent-runtime | SmolagentPage playground | ✅ |

---

## ✅ INFRA INTEGRADA (Sprint 3)

| Módulo | Integração | Status |
|--------|-----------|--------|
| useI18n | Sidebar footer — seletor PT/EN | ✅ |
| NotificationsDrawer | Header — bell icon com dados reais | ✅ |
| MCPServerManager | fromTable() sem erros TS | ✅ |
| AccessControl | Componente RBAC ativo | ✅ |

---

## 📝 PENDENTE (baixa prioridade)

| Item | Nota |
|------|------|
| a2a-server UI | Painel A2A nos Deployments — v2.0 |
| product-mockup UI | Gerador de mockups — v2.0 |
| hf-autotrain wizard | Fine-tuning completo — v2.0 |
| test-runner batch UI | Batch testing panel — v2.0 |
| NexusTracer UI | Tracing detalhado no Monitoring — v2.0 |
