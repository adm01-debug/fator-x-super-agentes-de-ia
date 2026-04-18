
Sprint 42 (BCP) ✅. Próximo da fila: 🟢 **Sprint 43 — Change Management (CAB)**.

## Por quê
- Temos BCP, vendors, riscos, pentests, secrets — mas mudanças em produção não são rastreadas formalmente
- ITIL 4 / SOC2 CC8.1 / ISO 27001 A.12.1.2 exigem CAB (Change Advisory Board), aprovação documentada e janelas de freeze
- Hoje deploys saem sem registro de risco/rollback/aprovador → audit trail incompleto

## Plano

### 1. Migração SQL
- `change_requests`: id, workspace_id, title, description, change_type (`standard`|`normal`|`emergency`), risk_level (`low`|`medium`|`high`|`critical`), affected_systems text[] (FK conceitual a business_systems), requested_by, assigned_to, status (`draft`|`pending_approval`|`approved`|`rejected`|`scheduled`|`in_progress`|`completed`|`rolled_back`|`failed`), scheduled_for, executed_at, completed_at, rollback_plan, validation_steps, post_mortem_url
- `change_approvals`: id, change_id, approver_id, decision (`approve`|`reject`|`request_changes`), comment, decided_at
- `freeze_windows`: id, workspace_id, name, reason, starts_at, ends_at, allow_emergency (bool), created_by
- RLS: members SELECT, admins/requesters INSERT, approvers UPDATE
- Trigger: ao approve, valida que mudança não cai em freeze (a menos `emergency` + `allow_emergency`)

### 2. RPCs
- `submit_change_request(...)` → cria draft → pending_approval
- `decide_change(change_id, decision, comment)` → registra approval, atualiza status
- `execute_change(change_id)` → in_progress → completed/failed
- `rollback_change(change_id, reason)` → status rolled_back
- `get_change_summary(workspace_id)` → pending, scheduled próximos 7d, em freeze, taxa de sucesso 30d

### 3. UI — `src/pages/ChangeManagementPage.tsx` (`/security/changes`)
- Stats: pendentes aprovação, agendadas próximos 7d, em freeze ativo, taxa sucesso 30d
- Tabs: **Mudanças** (tabela filtrável por status/risk/type) + **Janelas de freeze** (timeline visual)
- Dialog "Nova mudança": tipo, risco, sistemas afetados (multi-select de business_systems), rollback plan, validation steps, scheduled_for
- Drill-in Sheet: tabs **Detalhes** + **Aprovações** (histórico + aprovar/rejeitar inline) + **Execução** (start/complete/rollback)
- Badge pulsante quando scheduled cai dentro de freeze sem ser emergency

### 4. Service & integração
- `src/services/changeManagementService.ts`: CRUD + approvals + freeze check + summary
- Sidebar: "Mudanças (CAB)" sob Segurança (ícone `GitPullRequest`)
- Rota lazy em `src/App.tsx`
- `docs/RUNBOOK.md`: seção Change Management (tipos de mudança, SLA de aprovação, processo de freeze)
- `mem://features/audit-improvements`: log Sprint 43 + fila (Sprint 44 IR Playbooks, Sprint 45 Asset Inventory)

## Arquivos
- `supabase/migrations/<ts>_change_management.sql`
- `src/services/changeManagementService.ts` (novo)
- `src/pages/ChangeManagementPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Submeter "Migrar DB para PG16" type=normal risk=high → status=pending_approval
- Aprovador aprova → status=approved, scheduled_for=+2d
- Criar freeze "Black Friday" cobrindo a data → badge vermelho pulsante
- Mudança emergency com `allow_emergency=true` → passa pelo freeze
- Rollback registra status=rolled_back e exige post_mortem_url
- RLS: non-admin vê mudanças mas não aprova
