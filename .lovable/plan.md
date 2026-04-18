
Próxima melhoria pendente do relatório V2: criar índices nas 23 FKs sem cobertura (P2 performance). Plano enxuto e cirúrgico.

## Plano — Sprint Performance: Índices em FKs

### Etapa 1 — Identificar FKs sem índice
Query no `pg_constraint` + `pg_index` para listar todas as FKs do schema `public` que não têm índice de cobertura na coluna referenciadora.

### Etapa 2 — Migration consolidada
Uma migration `perf_fk_indexes` criando `CREATE INDEX IF NOT EXISTS idx_<tabela>_<coluna>` para cada FK identificada. Padrão btree simples; nomes consistentes; sem `CONCURRENTLY` (não suportado em transação de migration).

Ganhos esperados:
- Joins mais rápidos em queries de membership/workspace
- DELETE em parents (workspaces, agents, knowledge_bases) deixa de fazer seq scan nas filhas
- Realtime/audit queries com filtros por FK ficam O(log n)

### Etapa 3 — Validação
- `supabase--linter` pós-migration para confirmar zero novos warnings
- Sample query plan em 2 tabelas críticas (`workspace_members`, `agent_workflow_runs`) confirmando uso do índice

### Etapa 4 — Documentação
Append em `mem://features/audit-improvements`: "Sprint Performance — 23 FK indexes added".

### Arquivos
- `supabase/migrations/<ts>_perf_fk_indexes.sql`
- `.lovable/memory/features/audit-improvements.md`
