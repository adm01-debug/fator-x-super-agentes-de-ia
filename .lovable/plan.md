
Bateria QA total do zero — explorar, testar e corrigir até 10/10 production-ready.

## Plano — QA Exaustivo V6 (rumo à produção)

### Fase 1 — Inventário & Baseline (descoberta)
- Mapear superfície: páginas (`src/pages`), componentes, services (91), edge functions (`supabase/functions/*`), tabelas, RLS policies, webhooks
- Rodar baseline: `tsc --noEmit`, `eslint`, `vitest run` (todas suítes), `supabase--linter`, `security--run_security_scan`
- Capturar inventário de rotas no `App.tsx` e checar protected routes / AuthGuard

### Fase 2 — Camada de dados (Supabase)
- `supabase--linter` + `security--get_scan_results` — listar findings P0/P1/P2
- Validar RLS em **todas** as tabelas críticas (audit_log, user_roles, workspace_members, api_keys, security_events, agents, agent_traces) via query introspection
- Verificar funções SECURITY DEFINER com `search_path` setado
- Identificar tabelas sem índice em FKs novas, queries lentas via `pg_stat_statements` (se disponível)

### Fase 3 — Edge Functions (cada uma)
Para cada função em `supabase/functions/`:
- CORS headers presentes em **todas** as respostas (incluindo erros)
- JWT validation in-code (verify_jwt=false padrão)
- Input validation com Zod
- Secret presence check (`Deno.env.get` + erro claro)
- Logs estruturados
- Rodar `supabase--curl_edge_functions` em endpoints críticos: `oracle-council`, `llm-gateway`, `guardrails-engine`, `openclaw-proxy`, `dr-orchestrator`, `widget-proxy`, `eval-judge`, etc.
- `supabase--edge_function_logs` para detectar erros recentes

### Fase 4 — Camada de serviços (frontend)
Auditar 91 services para:
- `try/catch + logger.error` consistente (padrão `wrapErr`)
- Tipos Zod nas entradas críticas
- Tratamento de `null`/`maybeSingle` vs `single`
- Sem `as any` (memory rule)
- Uso correto de `supabase` (auth) vs `supabaseExternal` (data)

### Fase 5 — UI / fluxos críticos (manual + browser)
Browser tests dos 8 fluxos mais críticos:
1. Login email + Google OAuth
2. Criar agente → publicar → deploy widget
3. Oracle multi-LLM query
4. Eval run completa (CLEAR scoring)
5. DR drill execute
6. Pentest scan + finding triage
7. Voice agent session (transcribe → reply)
8. Webhook Bitrix24 / WhatsApp

Para cada fluxo: console logs, network requests, screenshots, validação de outcome real (não só UI).

### Fase 6 — Acessibilidade, mobile, performance
- WCAG: focus-visible, contraste, aria, keyboard nav (sample 5 páginas)
- Mobile (375px) em 5 páginas críticas
- Lighthouse-like via `browser--performance_profile`
- Bundle size warnings (vite build output)

### Fase 7 — Correções (priorizadas)
Aplicar fixes na ordem:
- **P0** crítico (RLS gap, secret leak, auth bypass) → migration imediata
- **P1** funcional (erro de fluxo, edge function quebrada) → fix + teste
- **P2** UX/perf (loading state, contraste, query lenta) → fix + visual check

### Fase 8 — Re-validação completa
- Re-rodar tudo da Fase 1
- Re-rodar fluxos críticos no browser
- Confirmar 0 erros TS, 0 warnings linter (exceto pgcrypto aceito), 100% testes verdes

### Fase 9 — Relatório V6 + memory
`NEXUS-RELATORIO-TESTES-ABRANGENTE-V6.md`:
- Inventário (X páginas, Y services, Z edge functions, N tabelas)
- Findings encontrados (tabela P0/P1/P2 com status: fixed/accepted)
- Cenários testados (lista dos ~30-50 cenários reais executados)
- Scorecard final 10/10 dimensão por dimensão
- Checklist production-ready

Append `mem://features/audit-improvements`.

### Estimativa de escopo
- **Leitura/auditoria:** ~80-120 arquivos
- **Testes automatizados:** todas suítes Vitest + Deno tests críticos
- **Browser tests:** 8 fluxos × ~5 ações cada
- **Correções:** estimativa 5-15 fixes (P0 deve ser 0-2, P1 3-7, P2 5-10)
- **Migrations novas:** 0-2 (só se P0 surgir)

### Arquivos prováveis afetados
- `supabase/migrations/<ts>_qa_v6_*.sql` (se houver P0)
- Services em `src/services/` (hardening)
- Edge functions em `supabase/functions/*/index.ts` (CORS/validation gaps)
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V6.md` (novo)
- `.lovable/memory/features/audit-improvements.md` (append V6)
