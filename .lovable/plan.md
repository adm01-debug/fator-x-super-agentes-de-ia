
Finalizar Sprint 41 (polish) + executar Sprint 42 (BCP).

## Parte A — Polish Sprint 41
Substituir 3 ocorrências de `bg-emerald-500/...` em `VendorsPage.tsx` por tokens semânticos `bg-success/15 text-success border-success/30` (já existentes no design system) nos badges DPA "OK", SOC2 válido e ISO válido.

## Parte B — Sprint 42: Business Continuity Plan (BCP)

**Por quê:** Temos riscos, vendors, pentests, postmortems — mas não temos BIA (Business Impact Analysis) nem RTO/RPO documentados por sistema crítico. ISO 22301 / SOC2 A1.2 / NIST 800-34 exigem BCP formal com testes periódicos.

### 1. Migração SQL
- `business_systems`: id, workspace_id, name, description, category (`core`|`supporting`|`analytical`|`external`), criticality (`tier_1`|`tier_2`|`tier_3`|`tier_4`), rto_minutes, rpo_minutes, mtpd_hours (Maximum Tolerable Period of Disruption), dependencies text[], owner_id, recovery_strategy, status (`operational`|`degraded`|`down`|`retired`), last_tested_at, next_test_due
- `bcp_test_runs`: id, system_id, test_type (`tabletop`|`walkthrough`|`simulation`|`full_failover`), executed_by, executed_at, scenario, actual_rto_minutes, actual_rpo_minutes, success (bool), gaps text[], action_items, notes
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger: ao INSERT em bcp_test_runs, atualiza `last_tested_at` e `next_test_due` (tier_1=90d, tier_2=180d, tier_3=365d)

### 2. RPCs
- `register_business_system(...)` → cria sistema
- `record_bcp_test(system_id, ...)` → registra teste + recalcula prazos
- `get_bcp_summary(workspace_id)` → totais por tier, RTO/RPO compliance (actual vs target), tests overdue, sistemas down/degraded

### 3. UI — `src/pages/BCPPage.tsx` (`/security/bcp`)
- Stats: sistemas críticos (tier_1), tests overdue, RTO/RPO breaches, sistemas down/degraded
- Tabela filtrável por tier/category/status com badges (RTO/RPO em min/h, breach pulsante)
- Dialog "Novo sistema": tier, RTO/RPO sliders, dependências, recovery strategy
- Drill-in Sheet: tabs **Detalhes** + **Histórico de testes** (com novo teste inline)

### 4. Service & integração
- `src/services/bcpService.ts`: CRUD + tests + summary + helpers (RTO breach, test overdue)
- Sidebar: item "Continuidade" (ícone `LifeBuoy`) sob Segurança
- Rota lazy em `src/App.tsx`
- `docs/RUNBOOK.md`: seção BCP (tiers, cadência de testes, escalation)
- `mem://features/audit-improvements`: log Sprint 42 + fila (Sprint 43 Change Management)

## Arquivos
- `src/pages/VendorsPage.tsx` (polish 3 badges)
- `supabase/migrations/<ts>_bcp.sql`
- `src/services/bcpService.ts` (novo)
- `src/pages/BCPPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Polish: badges OK/SOC2/ISO usam `bg-success/15` (consistente com tokens)
- Cadastrar "Auth Service" tier_1 RTO=15min RPO=5min → next_test_due=+90d
- Registrar teste tipo `simulation` actual_rto=25min → breach badge pulsante
- Forçar test overdue → aparece em "tests overdue" stat
- RLS: non-admin vê sistemas mas não cadastra/testa
