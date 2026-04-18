
Sprint 32 (Game Days) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 33 — Incident Response Automation (auto-remediação + paging)**.

## Por quê
- Temos detecção completa (SLO, synthetic, cost anomaly, chaos) e treino (game days), mas resposta a incidente real ainda é 100% manual
- Incident Response Automation = playbooks executáveis que disparam automaticamente em condições críticas: rotacionar provider LLM caído, pausar agente runaway, reabrir circuit breaker, paginar on-call
- Reduz MTTR de minutos para segundos em cenários conhecidos

## Plano

**1. Migração SQL — `incident_playbooks` + `incident_runs` + `oncall_schedule`:**
- `incident_playbooks`: id, workspace_id, name, trigger_type (`slo_breach`|`synthetic_fail`|`cost_anomaly`|`budget_block`|`manual`), trigger_config jsonb (thresholds), actions jsonb[] (steps: notify, disable_chaos, pause_agent, switch_provider, page_oncall), enabled bool, cooldown_minutes
- `incident_runs`: id, playbook_id, triggered_by (event source id), status (`running`|`succeeded`|`failed`|`partial`), started_at, ended_at, action_results jsonb[], notes
- `oncall_schedule`: id, workspace_id, user_id, starts_at, ends_at, escalation_order int
- RLS: members SELECT, admins UPDATE; INSERT runs via SECURITY DEFINER

**2. Edge function `incident-orchestrator`:**
- Recebe POST `{playbook_id, trigger_event}` → executa actions sequencial
- Action handlers: `notify` (toast realtime), `disable_chaos` (UPDATE chaos_experiments), `pause_agent` (agents.status), `switch_provider` (workspace_settings.preferred_llm), `page_oncall` (lookup current oncall + insert notification)
- Registra cada step em `incident_runs.action_results`
- Respeita cooldown (não dispara mesmo playbook 2× em N min)

**3. Auto-trigger:** triggers Postgres em `slo_alerts`/`synthetic_results`/`cost_alerts`/`budget_events` chamam `pg_net` → edge function

**4. UI — `src/pages/IncidentPlaybooksPage.tsx` (`/observability/playbooks`):**
- Lista playbooks + toggle enabled
- Editor: trigger picker, actions builder (drag-and-drop), cooldown, preview
- Histórico de `incident_runs` com timeline de actions
- Templates pré-prontos: "Provider down → switch", "Cost spike → notify+pause", "Synthetic fail → page oncall"

**5. UI — `src/pages/OncallPage.tsx` (`/observability/oncall`):**
- Calendar view de plantões
- "Quem está on-call agora" badge no topo
- Form para adicionar turnos (user picker + datas)

**6. `src/services/incidentService.ts`:** CRUD playbooks, runs, oncall + manual trigger

**7. Sidebar:** items "Playbooks" e "On-call" sob Operações (ícones `BookOpen`, `Phone`)

**8. Realtime:** subscription em `incident_runs` INSERT → toast "Playbook X disparado"

**9. `docs/RUNBOOK.md`:** seção "Incident Response Automation" — templates, escalation matrix, override manual

**10. `mem://features/audit-improvements`:** Sprint 33 logged + fila (Sprint 34 DR Drills, Sprint 35 Postmortem Templates)

## Arquivos
- `supabase/migrations/<ts>_incident_response.sql`
- `supabase/functions/incident-orchestrator/index.ts` (nova)
- `src/services/incidentService.ts` (novo)
- `src/pages/IncidentPlaybooksPage.tsx` (nova)
- `src/pages/OncallPage.tsx` (nova)
- `src/components/shared/IncidentRunsMounter.tsx` (novo)
- `src/components/layout/AppSidebar.tsx` (2 items)
- `src/App.tsx` (2 rotas + mounter)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Criar playbook "provider_outage → switch + notify" → simular SLO breach → run executado, agent switched, toast disparado
- Cooldown impede double-trigger em 5min
- Oncall lookup retorna usuário correto baseado em data atual
- RLS: non-admin vê playbooks mas não edita
