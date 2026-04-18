
Continuação da bateria QA. Fase 1-2 já feitas (linter, security scan, tsc, build, vitest parcial). Findings P0 críticos identificados. Executar agora em sequência: fixes P0 → fases restantes → relatório final.

## Plano — QA Total Fases 3-7 + P0 Fixes

### Etapa 1 — Migration P0 (segurança crítica)
Uma migration consolidando os 5 findings:
1. **`workspace_members.email`**: revogar SELECT da coluna `email` para `authenticated`; criar RPC `get_workspace_members_with_email(workspace_id)` que retorna email apenas para admins via `is_workspace_admin`
2. **`oncall_schedule`**: idem — remover email/phone direto, criar RPC `get_oncall_with_contacts` admin-only
3. **`user_2fa`**: revogar SELECT de `totp_secret` e `backup_codes`; políticas só permitem ler `is_enabled, created_at`; secrets só via edge function server-side
4. **`user_roles` privilege escalation**: policy de UPDATE/INSERT exigindo `is_workspace_admin(auth.uid(), workspace_id)` — usuário não pode auto-promover
5. **`compliance_frameworks`**: adicionar workspace_id + RLS scoped (se ainda global, manter SELECT público mas restringir write)
6. **Forums metadata**: revisar policies de SELECT em `forum_posts`/`forum_threads` para não vazar emails de autores (join via view safe)

Nota: `realtime.messages` é schema reservado Supabase — não tocar; documentar no relatório como aceito-com-mitigação (RLS herda das tabelas publicadas).

### Etapa 2 — Fase 3: Edge Functions
- `supabase--test_edge_functions` (todas, timeout 240s)
- `supabase--curl_edge_functions` smoke em: `llm-gateway`, `health-check`, `synthetic-runner`, `workflow-engine-v2`, `guardrails-engine`
- `supabase--edge_function_logs` últimos erros nas 5 funções mais usadas

### Etapa 3 — Fase 4: DB read-only
- `supabase--read_query`: contagens (agents, workflows, agent_workflow_runs, audit_log, traces, assets, risks, incidents)
- Verificar índices em FKs críticas (workflow_id, agent_id, workspace_id)
- Detectar tabelas sem `created_at` index

### Etapa 4 — Fase 5: Browser E2E (10 fluxos)
Smoke real no preview:
1. `/dashboard` — stats carregam, sem erro console
2. `/agents` — lista renderiza
3. `/oracle` — input visível
4. `/automations` — workflows listam
5. `/security/risks`
6. `/security/bcp`
7. `/security/changes`
8. `/security/ir`
9. `/security/assets`
10. `/monitoring`

Para cada: navigate → screenshot → console errors → network 4xx/5xx.
Mobile (375px) em 3 páginas-chave (/dashboard, /agents, /oracle).

### Etapa 5 — Fase 6: Performance
- `browser--performance_profile` em `/dashboard`, `/agents`, `/datahub`
- Coletar: TTI, heap, DOM nodes, layout time

### Etapa 6 — Fase 7: A11y spot-check
- Tab navigation em form de criar agente
- Focus rings visíveis
- Aria-labels em icon buttons das páginas Security

### Etapa 7 — Relatório final
`NEXUS-RELATORIO-TESTES-ABRANGENTE-V2.md`:
- Sumário executivo (verificações totais, pass/fail)
- Comparativo vs V1 (137 checks)
- Fixes P0 aplicados
- Findings restantes P1/P2 priorizados
- Recomendações próximos sprints

Update `mem://features/audit-improvements` com QA Total Pass.

### Arquivos prováveis
- `supabase/migrations/<timestamp>_qa_p0_security.sql` (RLS + RPCs)
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V2.md` (novo)
- `.lovable/memory/features/audit-improvements.md` (append)
- Ajustes pontuais em services se RPCs novas (ex: `teamsService.listMembers` apontar para nova RPC)
