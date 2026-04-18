
Sprint 37 (SBOM) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 38 — Secrets Rotation Tracking**.

## Por quê
- Temos SBOM/CVEs, postmortems, DR, compliance — mas **não rastreamos rotação de credenciais** (API keys, JWT signing keys, DB passwords, OAuth client secrets)
- SOC2 CC6.1 / ISO 27001 A.9.2.4 / PCI-DSS 3.6 exigem rotação periódica documentada
- Sem inventário, secrets antigos viram "shadow risk" — vazaram em 2024 e ninguém sabe que ainda funcionam

## Plano

**1. Migração SQL — `managed_secrets` + `secret_rotation_events`:**
- `managed_secrets`: id, workspace_id, name, category (`api_key`|`oauth_client`|`db_password`|`jwt_signing`|`webhook_secret`|`encryption_key`), provider, environment (`prod`|`staging`|`dev`), rotation_interval_days, last_rotated_at, next_rotation_due, status (`active`|`pending_rotation`|`overdue`|`retired`), owner_id, notes
- `secret_rotation_events`: id, secret_id, rotated_by, rotated_at, reason (`scheduled`|`compromised`|`employee_offboarding`|`manual`), previous_age_days, notes
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger: ao INSERT em `secret_rotation_events`, atualiza `managed_secrets.last_rotated_at` + recalcula `next_rotation_due`

**2. RPCs:**
- `register_managed_secret(...)` → cria entrada (sem armazenar valor — apenas metadata)
- `record_secret_rotation(secret_id, reason, notes)` → registra evento + atualiza próximo prazo
- `mark_secret_retired(secret_id, notes)` → status retired
- `get_secrets_status_summary(workspace_id)` → contagens active/pending/overdue para dashboard

**3. UI — `src/pages/SecretsRotationPage.tsx` (`/security/secrets-rotation`):**
- Stats cards: total managed, overdue (vermelho), pending (amber), active (verde)
- Tabela com filtros (categoria, environment, status) + ordenação por `next_rotation_due`
- Badges visuais: overdue (vermelho pulsante), <7 dias (amber), <30 dias (yellow), ok (verde)
- Ações: "Registrar rotação" (dialog com reason + notes) | "Aposentar" | editar metadata
- Templates: "API key OpenAI (90d)", "DB password (180d)", "JWT signing (30d)", "OAuth client (365d)"

**4. `src/services/secretsRotationService.ts`:** CRUD + rotation tracking + summary

**5. Sidebar:** item "Rotação de Secrets" sob Administração (ícone `KeyRound` ou `RefreshCw`)

**6. `docs/RUNBOOK.md`:** seção "Secrets Rotation" — cadências recomendadas por categoria, procedimento de rotação emergencial (compromise), checklist offboarding

**7. `mem://features/audit-improvements`:** Sprint 38 logged + fila (Sprint 39 Pentest Tracking, Sprint 40 Risk Register)

## Arquivos
- `supabase/migrations/<ts>_secrets_rotation.sql`
- `src/services/secretsRotationService.ts` (novo)
- `src/pages/SecretsRotationPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Registrar secret "OpenAI API Key" com intervalo 90d → next_rotation_due = +90d
- Registrar rotação → evento criado, next_rotation_due recalculado
- Forçar overdue (data antiga) → badge vermelho pulsante, aparece em "overdue" stat
- RLS: non-admin vê secrets mas não registra rotação
