# Diagrama ER — Nexus Agents Studio

## 33+ tabelas em 5 migrations

```
┌─── CORE (Migration 001) ──────────────────────────────────────────┐
│                                                                    │
│  auth.users ──┐                                                    │
│               │ user_id                                            │
│  ┌────────────▼──────────┐    ┌──────────────────┐                │
│  │ agents                │◄───│ prompt_versions   │                │
│  │ id, name, config JSONB│    │ version, content  │                │
│  │ status, workspace_id  │    │ is_active (unique) │                │
│  └──┬────────┬───────────┘    └──────────────────┘                │
│     │        │                                                     │
│     │        └──────────┐                                          │
│     ▼                   ▼                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐            │
│  │ agent_traces │  │ agent_usage  │  │ agent_feedback│            │
│  │ event, level │  │ date, cost   │  │ type, score   │            │
│  └──────────────┘  └──────────────┘  └──────────────┘            │
│                                                                    │
│  ┌────────────────────────┐                                       │
│  │ agent_execution_traces │                                       │
│  │ full trace details     │                                       │
│  └────────────────────────┘                                       │
└────────────────────────────────────────────────────────────────────┘

┌─── DATAHUB (Migration 002-003) ───────────────────────────────────┐
│                                                                    │
│  ┌────────────────────┐    ┌──────────────────────┐               │
│  │ datahub_connections │───│ datahub_table_schemas │               │
│  │ 5 bancos reais      │    │ cache de colunas     │               │
│  └────────┬───────────┘    └──────────────────────┘               │
│           │                                                        │
│  ┌────────▼───────────┐    ┌──────────────────────┐               │
│  │ datahub_entity_map │    │ datahub_quality_issues│               │
│  │ 12 entidades       │    │ 23 gaps identificados │               │
│  └────────────────────┘    └──────────────────────┘               │
│                                                                    │
│  ┌──────────────────┐  ┌──────────────┐  ┌──────────────┐        │
│  │ datahub_identity  │  │ saved_queries│  │ access_policy │        │
│  │ cross-db matching │  │ SQL + NL     │  │ agente x banco│        │
│  └──────────────────┘  └──────────────┘  └──────────────┘        │
└────────────────────────────────────────────────────────────────────┘

┌─── SUPER CEREBRO + ORACULO (Migration 004) ───────────────────────┐
│                                                                    │
│  BRAIN:                         ORACLE:                            │
│  ┌──────────────────┐           ┌──────────────────┐              │
│  │ brain_collections │           │ oracle_configs   │              │
│  │ brain_facts       │           │ oracle_presets   │              │
│  │ brain_entities    │           │ oracle_queries   │              │
│  │ brain_relationships│          │ oracle_responses │              │
│  │ brain_decay_alerts│           └──────────────────┘              │
│  │ brain_sandbox     │                                             │
│  └──────────────────┘                                              │
└────────────────────────────────────────────────────────────────────┘

┌─── MULTI-TENANT (Migration 005) ──────────────────────────────────┐
│                                                                    │
│  auth.users ──► workspaces ──► workspace_members                  │
│                     │              (role: admin/editor/viewer)     │
│                     │                                              │
│                     ├──► workspace_secrets (API keys, key_hint)   │
│                     ├──► knowledge_bases (RAG collections)        │
│                     └──► evaluation_runs (test history)           │
└────────────────────────────────────────────────────────────────────┘
```

## Chaves de Matching Cross-Database (DataHub)

```
EMAIL (exato)  →  CRM users ↔ RH colaboradores (20/21 match)
CNPJ raiz (8d) →  CRM companies ↔ Catalogo suppliers (filial vs matriz)
TELEFONE       →  CRM company_phones ↔ WhatsApp contacts
NOME fuzzy     →  Fallback para entidades sem CNPJ
```
