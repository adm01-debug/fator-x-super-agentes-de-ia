
Sprint 34 (DR Drills) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 35 — Postmortem Templates (auto-geração a partir de incidentes)**.

## Por quê
- Temos detecção, treino, auto-remediação e DR validation, mas **aprendizado pós-incidente** ainda é manual
- Postmortem = documento estruturado (timeline, root cause, action items) que transforma incidente em conhecimento
- Auto-geração reduz fricção e garante que **todo** incidente sério gere aprendizado

## Plano

**1. Migração SQL — `postmortems` + `postmortem_action_items`:**
- `postmortems`: id, workspace_id, title, incident_source (`incident_run`|`game_day`|`dr_drill`|`manual`), source_id, severity (`SEV1`|`SEV2`|`SEV3`|`SEV4`), status (`draft`|`review`|`published`), summary, timeline jsonb (events array), root_cause, contributing_factors text[], what_went_well text[], what_went_wrong text[], lessons_learned text, author_id, reviewer_id, published_at
- `postmortem_action_items`: id, postmortem_id, description, owner_id, due_date, priority (`P0`|`P1`|`P2`), status (`open`|`in_progress`|`done`|`cancelled`), completed_at
- RLS: members SELECT, author/admins UPDATE

**2. RPCs:**
- `generate_postmortem_from_incident(incident_run_id)` → cria draft com timeline preenchida via action_results + duration
- `generate_postmortem_from_gameday(game_day_id)` → usa game_day_events + scorecard
- `publish_postmortem(id)` → muda status, marca published_at, registra audit

**3. UI — `src/pages/PostmortemsPage.tsx` (`/observability/postmortems`):**
- Lista com filtros (severity, status, source)
- "Gerar postmortem": picker de incident/gameday/drill recente → cria draft
- Templates manuais: SEV1 outage, cost incident, security breach

**4. UI — `src/pages/PostmortemEditorPage.tsx` (`/observability/postmortems/:id`):**
- Editor estruturado: summary (textarea), timeline (lista cronológica editável), root cause (markdown), 5 whys helper
- Action items: tabela inline com owner/due_date/priority
- "Publicar" gate: requer summary + root_cause + ≥1 action item

**5. `src/services/postmortemService.ts`:** CRUD + auto-generators + action item management

**6. Sidebar:** item "Postmortems" sob Observability (ícone `FileText` ou `BookText`)

**7. `docs/RUNBOOK.md`:** seção "Postmortem Process" — quando escrever (toda SEV1/SEV2), template de blameless postmortem, SLA de publicação (5 dias úteis)

**8. `mem://features/audit-improvements`:** Sprint 35 logged + fila (Sprint 36 Compliance Reports, Sprint 37 SBOM/Supply Chain)

## Arquivos
- `supabase/migrations/<ts>_postmortems.sql`
- `src/services/postmortemService.ts` (novo)
- `src/pages/PostmortemsPage.tsx` (nova)
- `src/pages/PostmortemEditorPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (2 rotas)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Selecionar incident_run completed → "Gerar postmortem" → draft com timeline pré-preenchida
- Editar root cause + adicionar 2 action items → publicar (gate funciona)
- Filtro por SEV1 retorna apenas críticos
- RLS: non-member não vê postmortems do workspace
