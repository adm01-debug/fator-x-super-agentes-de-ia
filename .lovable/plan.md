
Sprint 38 (Secrets Rotation) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 39 — Penetration Test Tracking**.

## Por quê
- Temos SBOM/CVEs (vulns conhecidas), secrets rotation, postmortems, DR e compliance
- **Mas não rastreamos pentests** (testes ofensivos manuais por terceiros) nem findings derivados
- SOC2 CC4.1 / ISO 27001 A.12.6.1 / PCI-DSS 11.3 exigem pentest anual + remediação documentada
- Sem registro centralizado, findings de pentest viram tickets soltos e prazos de remediação são perdidos

## Plano

**1. Migração SQL — `pentest_engagements` + `pentest_findings`:**
- `pentest_engagements`: id, workspace_id, name, vendor (ex: "Bishop Fox"), scope (jsonb: domains/apps/IPs), engagement_type (`black_box`|`grey_box`|`white_box`|`red_team`), started_at, completed_at, status (`scoping`|`in_progress`|`reporting`|`completed`|`cancelled`), report_url, executive_summary, total_findings, lead_contact, notes
- `pentest_findings`: id, engagement_id, title, severity (`critical`|`high`|`medium`|`low`|`info`), cvss_score, category (`auth`|`injection`|`xss`|`csrf`|`crypto`|`config`|`logic`|`info_disclosure`|`other`), description, reproduction_steps, impact, recommendation, affected_assets text[], status (`open`|`in_remediation`|`fixed`|`accepted_risk`|`false_positive`), discovered_at, due_date (auto: critical 7d, high 30d, medium 90d, low 180d), assigned_to, fixed_at, verification_notes
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger: ao INSERT finding, calcula `due_date` baseado em severity

**2. RPCs:**
- `create_pentest_engagement(...)` → cria engagement
- `record_pentest_finding(engagement_id, ...)` → registra finding com due_date auto
- `update_finding_status(id, status, notes)` → transição de status + audit
- `get_pentest_summary(workspace_id)` → contagens por severity/status, MTTR, overdue

**3. UI — `src/pages/PentestPage.tsx` (`/security/pentests`):**
- Stats cards: engagements totais, findings abertos, critical/high overdue, MTTR médio
- Lista de engagements com status badges + counts por severity
- "Novo engagement": dialog com vendor, scope, tipo, datas
- Drill-in (Sheet) com tab "Findings" — lista filtrável por severity/status

**4. UI — `src/pages/PentestFindingsPage.tsx` (`/security/pentest-findings`):**
- View consolidada de todos os findings ativos (multi-engagement)
- Filtros: severity, status, category, engagement
- Badges visuais: overdue (vermelho pulsante), <7d (amber), on-track (verde)
- Ações inline: marcar em remediação, fixed (com notes), accepted_risk

**5. `src/services/pentestService.ts`:** CRUD + summary + status transitions

**6. Sidebar:** items "Pentests" e "Findings" sob Segurança (ícones `Bug`, `Target`)

**7. `docs/RUNBOOK.md`:** seção "Penetration Testing" — cadência (anual + após mudanças críticas), SLAs por severity, processo de retest

**8. `mem://features/audit-improvements`:** Sprint 39 logged + fila (Sprint 40 Risk Register, Sprint 41 Vendor Risk Mgmt)

## Arquivos
- `supabase/migrations/<ts>_pentests.sql`
- `src/services/pentestService.ts` (novo)
- `src/pages/PentestPage.tsx` (nova)
- `src/pages/PentestFindingsPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (2 items)
- `src/App.tsx` (2 rotas)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Criar engagement "Pentest Q2 2026" → registrar 3 findings (critical/high/medium)
- due_date auto-calculado: critical=+7d, high=+30d, medium=+90d
- Transição open → in_remediation → fixed (com verification_notes)
- Forçar overdue (data antiga) → badge vermelho pulsante, conta em "overdue" stat
- RLS: non-admin vê findings mas não cria engagements
