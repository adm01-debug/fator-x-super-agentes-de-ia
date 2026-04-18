
## Plano — Bateria Abrangente de Testes (QA Total)

Sistema com 45 sprints, 60+ suítes existentes, 137 verificações no último relatório. Vou executar uma rodada completa cobrindo backend, frontend, segurança, performance e UI real.

### Fase 1 — Auditoria estática (read-only, paralelo)
- `supabase--linter` → todas as RLS/índices/policies (290+ tabelas)
- `security--run_security_scan` → exposição de dados, secrets
- `tsc --noEmit` → 0 erros TS em ~290 arquivos
- `vite build` → build de produção + tamanho de bundles
- ESLint full pass

### Fase 2 — Suítes unitárias & integração
- `vitest run --coverage` → executar TODAS as 60+ suítes em `src/test/` + `src/tests/`
  - Services automação (15 suítes)
  - Services domínio (17 suítes: agents, oracle, rag, billing, rbac, etc.)
  - Lib & infra (10 suítes)
  - Components & UI (20+ suítes)
- Coletar: total testes, pass/fail, coverage lines/branches/functions

### Fase 3 — Edge Functions (27 funções)
- `supabase--test_edge_functions` → rodar todos os `*_test.ts`
- `supabase--curl_edge_functions` em endpoints críticos:
  - `llm-gateway` (ping)
  - `synthetic-runner` (health check)
  - `test-runner` (smoke)
  - `workflow-engine-v2` (validação)
- Logs: `supabase--edge_function_logs` para últimas execuções com erro

### Fase 4 — Banco de dados (read-only)
- Contagens por tabela crítica (agents, workflows, runs, audit_log)
- Verificação de índices em FKs
- Detecção de migrations órfãs
- RLS policies sample test via `supabase--read_query` em diferentes contextos

### Fase 5 — Browser E2E (smoke real no preview)
Testar fluxos principais com `browser--navigate_to_sandbox` + `act`:
1. `/dashboard` → carrega, stats visíveis
2. `/agents` → lista, criar agente (wizard)
3. `/oracle` → query simples
4. `/automations` → listar workflows
5. `/security/risks` → listar riscos
6. `/security/bcp` → listar planos
7. `/security/changes` → CAB
8. `/security/ir` → playbooks
9. `/security/assets` → CMDB
10. `/monitoring` → métricas
11. Mobile viewport (375px) → 3 páginas-chave
12. Console errors / network 4xx-5xx

### Fase 6 — Performance
- `browser--performance_profile` em 3 páginas pesadas (Dashboard, AgentBuilder, DataHub)
- Bundle analyzer já roda no `vite build`
- Heap, DOM nodes, layout time

### Fase 7 — Acessibilidade spot-check
- Focus rings, aria-labels, contraste em badges
- Navegação por teclado em formulários

### Entregáveis
- Relatório final em `NEXUS-RELATORIO-TESTES-ABRANGENTE-V2.md` com:
  - Total verificações executadas
  - Passa/Falha/Warning por categoria
  - P0/P1/P2 findings
  - Comparativo vs relatório anterior (137 checks)
- Memory update em `mem://features/audit-improvements`
- Fixes inline para bugs P0 encontrados (se houver)

### Estimativa
- ~2.000-3.000 verificações automatizadas (vitest sozinho gera centenas de asserts)
- ~30 fluxos E2E
- Tempo estimado: 8-12 min de execução paralela

### Arquivos prováveis
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V2.md` (novo)
- `.lovable/memory/features/audit-improvements.md` (append)
- Migrações pequenas se linter apontar P0
- Fixes pontuais em páginas se browser detectar erros
