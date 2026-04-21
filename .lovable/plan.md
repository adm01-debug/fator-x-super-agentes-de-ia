
Vou criar um documento markdown completo (`FUNCIONALIDADES-DO-SISTEMA.md`) na raiz do projeto, mapeando exaustivamente todas as funcionalidades do Nexus Agents Studio com base na análise de:

- **98 páginas** em `src/pages/`
- **93 services** em `src/services/`
- **63 edge functions** em `supabase/functions/`
- Rotas em `src/App.tsx`
- Schema Supabase (tabelas, RLS, RPCs)
- Documentação existente (ADRs, relatórios V1-V6, memory files)

## Estrutura do documento

### 1. Visão Geral
Plataforma multi-tenant de criação, deploy e governança de agentes de IA (Fator X), PT-BR, com backend Supabase Cloud.

### 2. Funcionalidades organizadas por domínio (12 grandes áreas)

**A. Construção de Agentes**
Wizard, builder visual, templates, prompt editor/versioning, A/B testing, simulação, debugger, orquestração multi-agente, sub-agentes, handoff, cards A2A.

**B. Inteligência & Modelos**
Oracle (multi-LLM council), LLM Gateway, smart model router, fine-tuning (HF AutoTrain), federated learning, smolagent runtime, NLP pipeline, vision agents, voice agents (telephony/studio), browser agents, computer use, code interpreter.

**C. Memória & Conhecimento**
6 tipos de memória (short-term, episodic, semantic, procedural, profile, shared), RAG v2 (embed/rerank), knowledge graph, knowledge management, knowledge decay, temporal knowledge, entity resolution, busca global/semântica/visual, gap analysis.

**D. Dados & Integrações**
DataHub (4 bancos externos), Cerebro (super brain), Bitrix24 (API/OAuth/webhook), WhatsApp (in/out), Email/Calendar triggers, MCP servers, custom APIs, connector registry, widget proxy.

**E. Workflows & Automação**
Workflow engine v2, graph execute, automation pipeline, automation center/templates, cron scheduler, webhook triggers/receiver, queue worker, batch processor, retry engine, checkpoints, replay fork.

**F. Avaliação & Qualidade**
Eval engine v2, eval judge, CLEAR scoring (deterministic/statistical), test runner, synthetic data/runner, prompt experiments, agent evolution.

**G. Observabilidade & Monitoramento**
Traces timeline, OTel observability, SLO dashboard, synthetic monitoring, health checks/alerts, cost anomalies/optimizer, monitoring KPIs, dashboards.

**H. Segurança & Governança**
RBAC + roles/permissions, RLS multi-tenant, guardrails (engine + ML), pentest + findings, vulnerabilities, SBOM scanner, secrets rotation, credential vault, asset inventory, vendor risk, access control, audit log, validate-access edge.

**I. Compliance & Risco**
LGPD manager, compliance reports, data residency, risk register, change management, approval queue.

**J. Resiliência & Operações**
Disaster recovery, DR drills, BCP, chaos lab, game days (live), incident playbooks, IR playbooks, postmortems, on-call schedule, notification engine.

**K. Deploy & Distribuição**
Multi-channel deploy (API, WhatsApp, Web Chat, Slack, Email, Bitrix24, Telegram, Discord, HF Space), canary deployments, openclaw deploy, mobile SDK, widget embed, marketplace (monetizado + skills).

**L. Plataforma & Admin**
Multi-tenancy, Enterprise SSO, billing, budget settings, team management, workspaces, settings, admin CRUD, public help center, public forum, article editor.

### 3. Mapeamento técnico (apêndice)
- Tabela: 98 páginas → rota → service principal
- Tabela: 63 edge functions → propósito → secrets necessárias
- Stack: React 18 + Vite + TS strict + Tailwind + Supabase Cloud + Lovable AI Gateway
- Arquitetura dual-client (auth local + data external)
- Status produção: 10/10 (V6)

### 4. Estatísticas finais
Linhas de código aproximadas, cobertura de testes (83 testes), número de RPCs, número de tabelas com RLS.

### Sobre o GitHub
O conteúdo do repositório GitHub é **idêntico** ao código atual do projeto (sync bidirecional automático do Lovable). Portanto, a análise do código local cobre 100% do que está no GitHub — não há divergência possível. Mencionarei isso explicitamente no documento.

### Arquivo gerado
- `FUNCIONALIDADES-DO-SISTEMA.md` na raiz do projeto (~600-900 linhas, navegável por TOC)
