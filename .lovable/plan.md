
Sprint 33 (Incident Response Automation) completo ✅. Score 10/10 mantido. Próximo da fila Continuous Hardening: 🟢 **Sprint 34 — Disaster Recovery Drills (backup + restore validation)**.

## Por quê
- Temos detecção (SLO/synthetic/cost), enforcement (budget), treino (game days) e auto-remediação (playbooks)
- **Mas nunca validamos** que conseguimos restaurar dados após corrupção/perda total
- DR Drill = teste programado de backup→restore em ambiente isolado com métricas RTO/RPO
- Garante continuidade real do negócio, não apenas teórica

## Plano

**1. Migração SQL — `dr_drills` + `dr_snapshots` + `dr_restore_logs`:**
- `dr_drills`: id, workspace_id, name, scope (`full`|`workspace`|`table`), target_tables text[], scheduled_at, status (`scheduled`|`snapshotting`|`restoring`|`validating`|`completed`|`failed`), rto_target_seconds, rpo_target_seconds, actual_rto_seconds, actual_rpo_seconds, executor_id
- `dr_snapshots`: id, drill_id, table_name, row_count, snapshot_data jsonb (sample), checksum, captured_at
- `dr_restore_logs`: id, drill_id, step (`snapshot`|`isolate`|`restore`|`validate`|`cleanup`), status, started_at, ended_at, error_message, metadata jsonb
- RLS: members SELECT, admins INSERT/UPDATE; service role para snapshots

**2. RPCs:**
- `start_dr_drill(drill_id)` → snapshot row counts + checksums das tabelas alvo
- `record_dr_step(drill_id, step, status, metadata)` → log granular
- `complete_dr_drill(drill_id, actual_rto, actual_rpo, success)` → calcula desvios vs targets

**3. Edge function `dr-orchestrator`:**
- Recebe `{drill_id}` → executa: snapshot → simulate restore (compare counts/checksums) → validate → cleanup
- Registra cada step em `dr_restore_logs` com timing
- Retorna RTO/RPO observados

**4. UI — `src/pages/DRDrillsPage.tsx` (`/observability/dr-drills`):**
- Lista drills com status badges + RTO/RPO atual vs target
- "Agendar drill": form com scope picker (full/workspace/table), target tables multi-select, RTO/RPO targets em segundos
- Detalhes expandíveis: timeline de `dr_restore_logs`, snapshots capturados, gauge RTO/RPO (verde/amber/vermelho)
- Templates: "Workspace mensal", "Tabelas críticas semanal", "Full quarterly"

**5. `src/services/drDrillService.ts`:** CRUD drills, listSnapshots, listLogs, startDrill, manual trigger

**6. Sidebar:** item "DR Drills" sob Operações (ícone `DatabaseBackup` ou `Archive`)

**7. Realtime:** subscription em `dr_restore_logs` INSERT → atualiza timeline ao vivo

**8. `docs/RUNBOOK.md`:** seção "Disaster Recovery" — cadência (mensal critical, quarterly full), RTO/RPO targets recomendados, recovery procedures reais

**9. `mem://features/audit-improvements`:** Sprint 34 logged + fila (Sprint 35 Postmortem Templates, Sprint 36 Compliance Reports)

## Arquivos
- `supabase/migrations/<ts>_dr_drills.sql`
- `supabase/functions/dr-orchestrator/index.ts` (nova)
- `src/services/drDrillService.ts` (novo)
- `src/pages/DRDrillsPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Agendar drill "tabelas críticas" → executar → snapshots capturados, restore simulado, RTO/RPO calculados
- RTO acima do target → status amber, alerta no card
- Realtime: timeline de logs aparece ao vivo conforme edge function progride
- RLS: non-admin vê drills mas não agenda
