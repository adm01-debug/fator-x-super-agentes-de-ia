# Nexus Agents Studio

Plataforma operacional para criacao, configuracao, treinamento e gestao de super agentes de IA.

## Stack

- **Frontend:** React 18 + TypeScript (strict) + Tailwind CSS + Shadcn/UI + Zustand + Vite
- **Backend:** Supabase (PostgreSQL 17 + pgvector + Auth + RLS + Storage)
- **Integracoes:** MCP (Anthropic), A2A (Google), OpenRouter, Bitrix24, n8n

## Inicio Rapido

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # Build de producao
npm test           # Vitest (19 testes)
npx tsc --noEmit   # Type check
```

## Arquitetura

```
src/
├── pages/              # 25 paginas (lazy loaded)
├── components/
│   ├── agent-builder/  # 17 modulos do builder
│   │   ├── modules/    # Identity, Brain, Memory, RAG, Tools, Prompt, etc.
│   │   └── ui/         # 16 componentes reutilizaveis
│   ├── layout/         # AppLayout, Sidebar, Header
│   └── shared/         # MetricCard, StatusBadge, CommandPalette
├── stores/             # Zustand (agentBuilderStore)
├── services/           # agentService.ts (Supabase CRUD)
├── types/              # agentTypes.ts (395 linhas)
├── config/             # datahub-blacklist.ts
├── hooks/              # useAutoSave, useAuth
└── lib/                # utils, mock-data/
```

## Modulos

| Modulo | Descricao |
|--------|-----------|
| Agent Builder | 17 tabs: Identity, Brain, Memory, RAG, Tools, Prompt, Orchestration, Guardrails, Testing, Observability, Deploy, Billing, Readiness, Blueprint, Settings, Team, Playground |
| Super Cerebro | Enterprise Memory Layer (8 tabs, 10 engines) |
| Oraculo | Multi-LLM Council (5 tabs, 12 presets, 5 modos) |
| DataHub | Gestao de 5 bancos externos (10 tabs, 12 entidades) |

## Banco de Dados

5 SQL migrations, 33+ tabelas com RLS:

| Migration | Tabelas | Escopo |
|-----------|---------|--------|
| 001_initial_schema | 10 | Core (agents, traces, usage, prompts, feedback, execution_traces) |
| 002_datahub_tables | 7 | DataHub (connections, schemas, entities, queries, sync, access) |
| 003_datahub_identity_quality | 2 | Identity Resolution + Data Quality |
| 004_super_cerebro_oraculo | 10 | Brain (collections, facts, entities, relationships) + Oracle (configs, presets, queries, responses) |
| 005_workspaces_secrets_kb | 4+ | Multi-tenant (workspaces, members, secrets, knowledge_bases, evaluations) |

## Performance

- Bundle principal: 195KB (reducao de 74%)
- 17 modulos lazy loaded (~12-17KB cada)
- framer-motion removido, CSS animations nativas
- Vite manualChunks: vendor-react, vendor-charts, vendor-state, vendor-supabase
- Google Fonts via preconnect

## Deploy Channels

API REST, WhatsApp, Web Chat, Slack, Bitrix24, Telegram, Discord, Email, OpenClaw

## Testes

```bash
npm test           # 19 testes unitarios
npx tsc --noEmit   # Zero erros TypeScript
npm run build      # Zero erros de build
```

## Licenca

Proprietario - Promo Brindes
