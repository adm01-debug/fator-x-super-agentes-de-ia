
Sprint 43 (Change Management/CAB) ✅. Próximo da fila: 🟢 **Sprint 44 — Incident Response Playbooks**.

## Por quê
- Temos postmortems (reativo), mudanças (CAB), BCP, riscos — mas **não temos playbooks formais de IR**
- NIST SP 800-61 / SOC2 CC7.4 / ISO 27035 exigem procedimentos documentados por tipo de incidente + tabletop exercises periódicos
- Hoje, quando ocorre incidente (data breach, DDoS, ransomware), equipe improvisa → MTTR alto e gaps de evidência

## Plano

### 1. Migração SQL
- `ir_playbooks`: id, workspace_id, name, incident_type (`data_breach`|`ddos`|`ransomware`|`account_takeover`|`insider_threat`|`service_outage`|`supply_chain`|`other`), severity_default (`low`|`medium`|`high`|`critical`), description, owner_id, version, status (`draft`|`active`|`archived`), last_reviewed_at, next_review_due, created_at, updated_at
- `ir_playbook_steps`: id, playbook_id, step_order, phase (`detect`|`contain`|`eradicate`|`recover`|`postmortem`), title, instructions, expected_duration_minutes, responsible_role, automation_hint
- `ir_tabletop_exercises`: id, playbook_id, scheduled_for, executed_at, scenario, participants text[], facilitator_id, outcome (`pass`|`partial`|`fail`|`scheduled`), gaps text[], action_items, mttr_actual_minutes, notes
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger ao INSERT tabletop: atualiza `last_reviewed_at` e `next_review_due` (critical=90d, high=180d, demais=365d)

### 2. RPCs
- `create_ir_playbook(...)` → cria playbook draft
- `activate_ir_playbook(playbook_id)` → status=active, version+1
- `record_tabletop(playbook_id, ...)` → registra exercício + recalcula prazos
- `get_ir_summary(workspace_id)` → playbooks ativos por tipo, exercícios overdue, MTTR médio 90d, gaps abertos

### 3. UI — `src/pages/IRPlaybooksPage.tsx` (`/security/ir`)
- Stats: playbooks ativos, exercícios overdue, MTTR médio (min), gaps abertos
- Tabs: **Playbooks** (lista por tipo com badges de status/review) + **Exercícios** (timeline tabletop com outcome)
- Dialog "Novo playbook": tipo, severidade, owner, steps inline (phase/title/instructions/duration/role)
- Drill-in Sheet: tabs **Steps** (NIST 5 phases) + **Exercícios** (histórico + agendar/registrar) + **Detalhes**
- Badge pulsante quando review overdue

### 4. Service & integração
- `src/services/irPlaybookService.ts`: CRUD + steps + tabletops + summary + helpers (review overdue, MTTR breach)
- Sidebar: "Playbooks (IR)" sob Segurança (ícone `BookOpen`)
- Rota lazy em `src/App.tsx`
- `docs/RUNBOOK.md`: seção IR Playbooks (NIST 5 phases, cadência tabletop, escalation)
- `mem://features/audit-improvements`: log Sprint 44 + fila (Sprint 45 Asset Inventory, Sprint 46 Privacy/DSAR)

## Arquivos
- `supabase/migrations/<ts>_ir_playbooks.sql`
- `src/services/irPlaybookService.ts` (novo)
- `src/pages/IRPlaybooksPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Criar playbook "Data Breach LGPD" type=data_breach severity=critical com 5 steps (uma por phase)
- Activate → status=active version=1
- Registrar tabletop scheduled_for=hoje outcome=partial mttr=240min gaps=["faltou DPO"] → next_review_due=+90d
- Forçar review overdue (data antiga) → badge vermelho pulsante, conta em "exercícios overdue"
- RLS: non-admin vê playbooks mas não cria/ativa
