# 🤖 Fator X — Super Agentes de IA

Plataforma completa para criação, configuração, deploy e monitoramento de agentes de IA.

## Stack

- **Frontend:** React + Vite + Tailwind + shadcn/ui + Framer Motion + Zustand
- **Backend:** Supabase (PostgreSQL + Auth + Edge Functions + RLS + pgvector)
- **LLMs:** Multi-provider via LLM Gateway (Anthropic, OpenAI, Google, OpenRouter, Lovable)

## Arquitetura

```
┌─ Frontend (React) ──────────────────────────────────────┐
│  Dashboard │ Agent Builder │ Oracle │ Super Cérebro      │
│  Workflows │ Knowledge    │ Memory │ Monitoring          │
│  Evaluations │ Deployments │ Billing │ Security          │
└──────────────────────┬──────────────────────────────────┘
                       │
┌─ Edge Functions ─────┴──────────────────────────────────┐
│  llm-gateway      → Traces, custos, guardrails, budget  │
│  oracle-council   → Conselho multi-modelo (3 stages)    │
│  test-runner      → Execução automatizada de testes     │
│  rag-ingest       → Chunking + embeddings (pgvector)    │
│  workflow-engine  → Orquestração sequencial multi-agente │
│  cerebro-query    → Super Cérebro + bancos externos     │
└──────────────────────┬──────────────────────────────────┘
                       │
┌─ Supabase ───────────┴──────────────────────────────────┐
│  PostgreSQL + pgvector │ Auth │ RLS │ Triggers           │
│  38+ tabelas │ Budget auto-update │ Alert auto-create    │
└─────────────────────────────────────────────────────────┘
```

## Features Implementadas

### Core
- ✅ Agent Builder com 15 módulos (Identity, Brain, Memory, RAG, Tools, Prompt, Orchestration, Guardrails, Testing, Observability, Deploy, Billing, Readiness, Blueprint, Settings)
- ✅ LLM Gateway multi-provider com rate limiting, guardrails enforcement, budget kill switch, traces automáticos, cost tracking por modelo
- ✅ Oracle Council — conselho multi-IA com 5 modos (council, researcher, validator, executor, advisor), peer review e chairman synthesis
- ✅ Super Cérebro conectado a bancos externos via cerebro-query
- ✅ Memória persistente (Supabase + pgvector) com 6 tipos
- ✅ RAG Pipeline (ingestão, chunking, embeddings via rag-ingest)
- ✅ Workflow Engine — orquestração sequencial multi-agente
- ✅ Test Runner — execução automatizada de suites de teste
- ✅ Evaluations Lab com datasets e test cases
- ✅ Knowledge Bases com collections, documents, chunks
- ✅ Prompt Versioning com diff visual
- ✅ Monitoring com traces, gráficos e KPIs
- ✅ Billing com budgets, usage records, alertas automáticos
- ✅ Multi-tenant (workspaces + RLS)
- ✅ Auth completo (sign up, sign in, reset password, rate limiting)

### Segurança
- ✅ Row Level Security em todas as tabelas
- ✅ Rate limiting por usuário (30 req/min gateway, 10 req/min oracle)
- ✅ Guardrails (input validation, blocked topics, keywords)
- ✅ Budget enforcement com kill switch
- ✅ Workspace secrets para API keys
- ✅ E2E tests (Playwright) para auth, agent builder e security

## Desenvolvimento

```bash
npm install
npm run dev
```

## Deploy

```bash
# Supabase migrations
supabase db push

# Edge Functions
supabase functions deploy llm-gateway
supabase functions deploy oracle-council
supabase functions deploy test-runner
supabase functions deploy rag-ingest
supabase functions deploy workflow-engine
supabase functions deploy cerebro-query
```
