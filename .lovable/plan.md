

# Plano de Migração: Lovable Cloud → Supabase Externo (tdprnylgyrogbbhgdoik)

## Diagnóstico Atual

**Lovable Cloud (origem):** 42 tabelas, ~232 registros no total
- Tabelas com dados: `agent_usage` (180), `agent_traces` (10), `agents` (8), `workspace_members` (5), `workspaces` (4), `sessions` (3), `audit_log` (2), `usage_records` (13), `chunks` (10), `documents` (3), `collections` (1), `knowledge_bases` (1)
- Tabelas vazias: ~30 tabelas (workflows, alerts, budgets, etc.)
- 8 funções SECURITY DEFINER, ~113 RLS policies, 42 Edge Functions
- **43 arquivos frontend** fazendo queries diretas via `supabase.from()`

**Supabase externo destino:** `tdprnylgyrogbbhgdoik` (o "banco de dados externo" deste projeto)

**Padrão de referência (outro projeto — pgxfvjmuubtbowutlide):** Usa `CONNECTION_REGISTRY` + `getExternalClient()` nas Edge Functions para conectar a múltiplos bancos externos via service_role_key.

---

## Arquitetura Proposta

```text
┌─────────────────────┐     ┌──────────────────────────────┐
│   Frontend (React)  │     │  Lovable Cloud (tifbqkyum..)│
│                     │     │  ┌─────────────────────────┐ │
│  supabase (local)   │─────│  │ auth.users (permanece)  │ │
│  → APENAS auth      │     │  │ auth.sessions           │ │
│                     │     │  └─────────────────────────┘ │
│  supabaseExternal   │──┐  └──────────────────────────────┘
│  → TODOS os dados   │  │
└─────────────────────┘  │  ┌──────────────────────────────┐
                         └──│  Supabase Externo             │
                            │  (tdprnylgyrogbbhgdoik)       │
  ┌──────────────────┐      │  ┌─────────────────────────┐ │
  │  Edge Functions  │──────│  │ 42 tabelas migradas     │ │
  │  (42 funções)    │      │  │ RLS + funções + triggers│ │
  └──────────────────┘      │  │ profiles (mapa auth)    │ │
                            │  └─────────────────────────┘ │
                            └──────────────────────────────┘
```

---

## Fases de Implementação

### FASE 1 — Schema DDL no Supabase Externo
- Gerar SQL completo com todas 42 tabelas, enums (`agent_status`, `trace_level`), índices e constraints
- Criar tabela `profiles` mapeando `auth.uid()` do Lovable Cloud
- Adaptar 8 funções SECURITY DEFINER para o contexto externo
- Adaptar ~113 RLS policies (usar `service_role_key` nas Edge Functions; no frontend, auth via JWT custom ou passthrough)
- **Entregável**: Script SQL pronto para execução

### FASE 2 — Migrar Dados (~232 registros)
- Exportar via `supabase--read_query` as tabelas com dados
- Gerar INSERT statements preservando UUIDs e timestamps
- Importar no externo
- Validar contagem e integridade
- **Entregável**: Script de dados + relatório

### FASE 3 — Criar Cliente Externo no Frontend
- Criar `src/integrations/supabase/externalClient.ts` com URL e anon_key do `tdprnylgyrogbbhgdoik`
- Manter `client.ts` original intacto (apenas auth)
- **Entregável**: Novo client configurado

### FASE 4 — Migrar 43 Arquivos Frontend
- Substituir `supabase.from('tabela')` → `supabaseExternal.from('tabela')` em todos os 43 arquivos de serviço/hooks
- Manter `supabase.auth.*` inalterado
- Arquivos afetados: `agentsService.ts`, `dashboardService.ts`, `oracleService.ts`, `knowledgeService.ts`, `memoryService.ts`, `adminCrudService.ts`, `use-data.ts`, e mais ~36 arquivos
- **Entregável**: Frontend migrado

### FASE 5 — Adaptar Edge Functions
- Adicionar secrets `EXTERNAL_DB_URL` e `EXTERNAL_DB_SERVICE_ROLE_KEY` para `tdprnylgyrogbbhgdoik`
- Atualizar as 42 Edge Functions que fazem queries diretas para usar o client externo
- Manter auth validation via Lovable Cloud JWT
- **Entregável**: Edge Functions atualizadas

### FASE 6 — Testes e Validação
- CRUD em todas as entidades via frontend
- Validar auth flow: login Lovable Cloud → dados no externo
- Testar Edge Functions com `curl_edge_functions`
- Benchmark de latência
- **Entregável**: Relatório de testes

---

## Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| JWT do Lovable Cloud não válido no externo | RLS no externo usa `service_role_key` via Edge Functions; frontend usa anon_key com RLS customizado |
| Realtime quebra | Configurar Realtime no projeto externo |
| Latência adicional | Queries diretas via `supabaseExternal` client, sem proxy |
| `client.ts` auto-gerado | Nunca tocamos nele — novo arquivo separado |

## Secrets Necessários
- `EXTERNAL_DB_URL` → URL do `tdprnylgyrogbbhgdoik`
- `EXTERNAL_DB_ANON_KEY` → anon key do externo (para frontend)
- `EXTERNAL_DB_SERVICE_ROLE_KEY` → service role key (para Edge Functions)

## Estimativa: ~5 sessões sequenciais

Aprove o plano para iniciar pela **Fase 1** (geração do DDL completo).

