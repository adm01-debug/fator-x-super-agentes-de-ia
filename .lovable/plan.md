
Sprint 31 (Budget Enforcement) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 32 — Game Days (incident drills programados)**.

## Por quê
- Temos toda a infraestrutura defensiva: chaos (proativo), SLO (reativo), synthetic (canários 24/7), cost anomaly (alerta), budget (enforcement)
- **Mas nunca treinamos a equipe** a responder incidentes reais sob pressão
- Game Day = exercício programado onde injetamos falha controlada em horário planejado, equipe responde seguindo runbook, registramos métricas (MTTR, decisões, gaps no runbook)
- Output: scorecard objetivo da maturidade operacional + identificação de gaps no runbook/tooling

## Plano

**1. Migração SQL — `game_days` + `game_day_events` + `game_day_scorecards`:**
- `game_days`: id, workspace_id, title, scenario (`provider_outage`|`cost_spike`|`db_slowdown`|`auth_failure`|`custom`), status (`scheduled`|`running`|`completed`|`aborted`), scheduled_at, started_at, ended_at, facilitator_id, participants uuid[], runbook_section text
- `game_day_events`: id, game_day_id, event_type (`fault_injected`|`detection`|`mitigation`|`resolution`|`note`), actor_id, occurred_at, description, metadata jsonb
- `game_day_scorecards`: id, game_day_id, mttr_seconds, mttd_seconds (mean-time-to-detect), runbook_followed bool, gaps_found text[], score INT (1-10), retrospective_notes
- RLS: members SELECT do workspace; facilitator + admins UPDATE; INSERT events por participantes

**2. RPCs:**
- `start_game_day(id)` → muda status, marca `started_at`, opcionalmente cria `chaos_experiment` automático conforme scenario
- `record_game_day_event(id, type, description)` → insere event com `actor_id=auth.uid()`
- `complete_game_day(id, scorecard_data)` → marca completed + insere scorecard + calcula MTTR automático (resolution_time - fault_injected_time)

**3. UI — `src/pages/GameDaysPage.tsx` (`/observability/game-days`):**
- Lista de game days (passados + agendados) com badges status
- "Agendar novo": form com scenario picker, data/hora, participantes (multi-select de workspace members), runbook section
- Detalhes expandíveis: timeline de events, scorecard com gauge MTTR, gaps identificados

**4. `src/pages/GameDayLivePage.tsx` (`/observability/game-days/:id/live`):**
- Modo "war room": timer ao vivo desde `started_at`
- Botões grandes: "Detectado", "Mitigando", "Resolvido", "Adicionar nota"
- Timeline em tempo real (realtime subscription)
- Botão "Encerrar e gerar scorecard"

**5. `src/services/gameDayService.ts`:** CRUD completo + start/record/complete

**6. Sidebar:** item "Game Days" sob Observability (ícone `Swords` ou `Shield`)

**7. `docs/RUNBOOK.md`:** seção "Game Days" — cadência recomendada (mensal), templates de cenários, critérios de score

**8. `mem://features/audit-improvements`:** Sprint 32 logged + fila (Sprint 33 incident response automation, Sprint 34 disaster recovery drills)

## Arquivos
- `supabase/migrations/<ts>_game_days.sql`
- `src/services/gameDayService.ts` (novo)
- `src/pages/GameDaysPage.tsx` (nova)
- `src/pages/GameDayLivePage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (2 rotas)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Agendar game day "provider_outage" → start → injeta chaos automático → registrar 4 events → complete
- Scorecard mostra MTTR calculado automaticamente
- Realtime: 2 abas abertas em /live → evento de uma aparece imediato na outra
- RLS: não-membro do workspace não vê game days
