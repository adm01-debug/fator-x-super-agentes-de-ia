
Sprint 30 (Cost Anomaly Detection) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 31 — Budget Enforcement (hard caps + auto-pause)**.

## Por quê
- Sprint 30 nos avisa quando custo explode, mas **não impede** — fatura ainda chega
- Budget enforcement = limites duros por workspace/agent: ao atingir threshold → bloqueia chamadas LLM (soft 80%, hard 100%)
- Auto-pause de agentes runaway evita prejuízo financeiro real
- Fecha o ciclo FinOps completo: tracking → alerting → enforcement

## Plano

**1. Migração SQL — `workspace_budgets` + `budget_events`:**
- `workspace_budgets`: id, workspace_id (UNIQUE), monthly_limit_usd, daily_limit_usd, hard_stop bool, soft_threshold_pct (default 80), notify_emails text[], created_by, updated_at
- `budget_events`: id, workspace_id, event_type (`soft_warning`|`hard_block`|`agent_paused`|`reset`), period_spend_usd, period_limit_usd, triggered_at, metadata jsonb
- RLS: members SELECT, admins UPDATE; INSERT só via SECURITY DEFINER

**2. RPCs:**
- `get_current_spend(workspace_id, period)` → agrega `agent_traces.cost_usd` do mês/dia atual
- `check_budget(workspace_id)` → retorna `{allowed, reason, spend, limit, pct}` — usado pelo llm-gateway antes de chamar provider
- `enforce_budget()` → cron 5min: marca workspaces over-limit, pausa agents (`agents.status='paused'`), insere `budget_events`

**3. Instrumentar `llm-gateway/index.ts`:**
- Antes de chamar provider: `const budget = await check_budget(workspace_id)`
- Se `!allowed` → retorna 402 Payment Required com mensagem explicativa
- Se soft warning → adiciona header `X-Budget-Warning: 85% used`

**4. UI — `src/pages/BudgetSettingsPage.tsx` (`/settings/budget`):**
- Form: monthly limit, daily limit, soft threshold slider, hard stop toggle, notify emails
- Card "Spend atual": progress bar mensal + diário (verde/amber/vermelho conforme %)
- Histórico de `budget_events` (timeline)
- Empty state se sem budget configurado

**5. `src/services/budgetService.ts`:** getBudget, upsertBudget, getCurrentSpend, listEvents

**6. Widget Dashboard `BudgetWidget.tsx`:** progress bar com % usage + link

**7. Sidebar:** item "Orçamento" sob Configurações (ícone `Wallet`)

**8. Realtime:** subscription em `budget_events` INSERT → toast severity-coded global (`BudgetEventsMounter`)

**9. `docs/RUNBOOK.md`:** seção "Budget Enforcement" — interpretação, reset mensal, recovery após hard-stop

**10. `mem://features/audit-improvements`:** Sprint 31 logged + fila (Sprint 32 game days, Sprint 33 incident response automation)

## Arquivos
- `supabase/migrations/<ts>_budget_enforcement.sql`
- `src/services/budgetService.ts` (novo)
- `src/pages/BudgetSettingsPage.tsx` (nova)
- `src/components/dashboard/BudgetWidget.tsx` (novo)
- `src/components/shared/BudgetEventsMounter.tsx` (novo)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota + mounter)
- `supabase/functions/llm-gateway/index.ts` (check antes do provider)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Configurar budget $10/mês → fazer chamadas até atingir 80% → toast warning + header
- Atingir 100% → 402 retornado pelo gateway, agents pausados, evento registrado
- Reset manual via UI ou cron mensal automático
- RLS: member não-admin não consegue alterar budget
