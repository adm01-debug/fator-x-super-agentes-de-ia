# ⚡ Nexus Agents Studio

> **Plataforma Operacional de Inteligência Artificial** para criação, treinamento, deploy e gestão de agentes IA de alto desempenho.

**O que nos diferencia:** Nenhum concorrente (Dify, n8n, CrewAI, StackAI, Vellum) combina TODOS estes recursos em uma plataforma única:

- 🔮 **Oráculo** — Multi-LLM Council Engine (conselho de múltiplas IAs deliberando)
- 🧠 **Super Cérebro** — Enterprise Memory Layer com Knowledge Graph temporal
- 🗄️ **DataHub** — Cross-database intelligence (5 bancos, 340+ tabelas, 920K+ registros)
- ⚡ **Agent Builder** — 15 tabs de configuração profunda com score de prontidão
- 🔀 **Workflow Canvas** — Editor visual drag-and-drop com 12 tipos de nó
- 🌐 **MCP + A2A** — Interoperabilidade com 5.800+ servidores e agentes externos

## Stack

```
React 18 + TypeScript + Tailwind CSS + Shadcn/UI + Supabase + Zustand
```

## Arquitetura

```
├── src/
│   ├── components/        # UI components (agent-builder, rbac, workflows, super-cerebro)
│   ├── services/          # 13 domain services (agents, workflows, oracle, cerebro, ...)
│   ├── stores/            # 7 Zustand stores
│   ├── hooks/             # Custom hooks (useRBAC, useBillingData, useTracesData, useI18n)
│   ├── lib/mcp/           # MCP Client + Registry
│   ├── i18n/              # Internationalization (pt-BR, en-US)
│   └── pages/             # 30+ pages
├── supabase/
│   ├── functions/         # 24 Edge Functions + _shared modules
│   │   ├── _shared/       # rate-limiter, cors, auth, validation
│   │   ├── llm-gateway/   # Multi-provider LLM gateway (771 lines)
│   │   ├── smolagent-runtime/  # Autonomous ReAct agent (604 lines)
│   │   ├── oracle-council/    # Multi-LLM deliberation
│   │   ├── oracle-research/   # Deep Research iterativo
│   │   ├── datahub-mcp-server/ # DataHub exposed as MCP server
│   │   ├── a2a-server/       # Agent-to-Agent Protocol
│   │   ├── guardrails-engine/ # 4-layer defense-in-depth
│   │   └── ...
│   └── migrations/        # 42 SQL migrations (38 original + 4 new)
└── .github/workflows/     # CI/CD (lint → typecheck → test → build)
```

## Segurança

- 🔒 CORS whitelist (zero wildcard) em todas as 24 Edge Functions
- 🛡️ Rate limiting com 7 presets (standard, llm, heavy, auth, webhook, datahub, oracle)
- 👥 RBAC com 5 roles e 31 permissões
- 🔐 Guardrails 4 camadas (prompt injection, PII, toxicidade, vazamento de secrets)
- 🔑 API keys com hash SHA-256

## Quick Start

```bash
git clone https://github.com/adm01-debug/fator-x-super-agentes-de-ia.git
cd fator-x-super-agentes-de-ia
npm install
npm run dev
```

## Arquitetura

```
Frontend (React 18 + TypeScript + Vite + Tailwind)
    │
    ├── src/services/ ──→ Supabase Edge Functions (39 deployed)
    │                        ├── llm-gateway (multi-provider LLM)
    │                        ├── guardrails-ml (5-layer DeBERTa + toxic-bert)
    │                        ├── nlp-pipeline (NER + sentiment PT-BR)
    │                        ├── smart-model-router (complexity-based routing)
    │                        ├── rag-embed-v2 / rag-rerank-v2
    │                        ├── eval-engine-v2 (RAGAS metrics)
    │                        └── +32 more (see docs/EDGE-FUNCTIONS.md)
    │
    ├── Supabase DB ──→ 75 tables, 8 views, 4 RPCs, pgvector, pg_trgm
    │                    ├── RBAC: 5 roles, 32 permissions
    │                    ├── RLS: 80 policies
    │                    └── Seed: 13 HF models, 12 pricing patterns
    │
    └── OpenClaw VPS ──→ Qwen3-30B (HuggingFace free tier)
                          └── Hostinger KVM 4 (187.77.151.129)
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18, TypeScript (strict), Vite, Tailwind CSS |
| State | Zustand, TanStack Query |
| Backend | Supabase Edge Functions (Deno) |
| Database | PostgreSQL 17 + pgvector + pg_trgm |
| Auth | Supabase Auth (JWT + RLS) |
| AI/ML | HuggingFace Inference API, DeBERTa, toxic-bert |
| CI/CD | GitHub Actions (lint + tsc + vitest + playwright) |
| VPS | Hostinger KVM 4 + Docker + OpenClaw |

## Licenca

Proprietário — Promo Brindes © 2026

---

*Desenvolvido por Pink e Cerébro — Promo Brindes*
*Powered by Claude Code + Lovable*
