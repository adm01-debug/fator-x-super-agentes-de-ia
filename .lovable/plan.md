
Sprint 39 (Pentest Tracking) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 40 — Risk Register (ISO 31000 / SOC2 CC3.2)**.

## Por quê
- Temos pentests, SBOM, secrets, postmortems, DR, compliance — tudo reativo/operacional
- **Falta um registro centralizado de riscos** (estratégicos, operacionais, técnicos, regulatórios) com ownership, likelihood, impact e tratamento
- ISO 31000 / SOC2 CC3.2 / ISO 27005 exigem risk register formal com revisão periódica
- Hoje riscos vivem em planilhas/Notion soltos — sem auditoria, sem SLA de revisão, sem heatmap

## Plano

**1. Migração SQL — `risk_register` + `risk_review_events`:**
- `risk_register`: id, workspace_id, title, description, category (`strategic`|`operational`|`technical`|`security`|`compliance`|`financial`|`reputational`), likelihood (1-5), impact (1-5), inherent_score (likelihood×impact, generated), residual_score (após mitigation), treatment (`accept`|`mitigate`|`transfer`|`avoid`), mitigation_plan, owner_id, status (`identified`|`assessed`|`treated`|`monitored`|`closed`), identified_at, next_review_due, closed_at, related_finding_id (FK opcional para pentest_findings)
- `risk_review_events`: id, risk_id, reviewed_by, reviewed_at, previous_residual_score, new_residual_score, notes
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger: ao INSERT em risk_review_events, atualiza next_review_due (+90d) e residual_score

**2. RPCs:**
- `register_risk(...)` → cria risco com inherent_score auto
- `review_risk(risk_id, new_residual_score, notes)` → registra review + recalcula próximo prazo
- `close_risk(risk_id, notes)` → status closed
- `get_risk_summary(workspace_id)` → contagens por nível (critical/high/med/low), overdue reviews, treatment distribution

**3. UI — `src/pages/RiskRegisterPage.tsx` (`/security/risks`):**
- Stats cards: total, critical (residual ≥15), overdue reviews, pendentes de tratamento
- **Heatmap visual 5x5** (likelihood × impact) com bolhas dimensionadas por contagem
- Tabela filtrável por categoria/status/treatment + ordenação por residual_score desc
- "Novo risco": dialog com sliders 1-5 para likelihood/impact, dropdown treatment, mitigation_plan
- Drill-in (Sheet): histórico de reviews, mitigation timeline, link para finding relacionado

**4. `src/services/riskService.ts`:** CRUD + reviews + summary + heatmap aggregation

**5. Sidebar:** item "Registro de Riscos" sob Administração (ícone `AlertOctagon`)

**6. `docs/RUNBOOK.md`:** seção "Risk Management" — escala 1-5 likelihood/impact, cadência de review (90d default, 30d para critical), critérios de escalation

**7. `mem://features/audit-improvements`:** Sprint 40 logged + fila (Sprint 41 Vendor Risk Mgmt, Sprint 42 Business Continuity Plan)

## Arquivos
- `supabase/migrations/<ts>_risk_register.sql`
- `src/services/riskService.ts` (novo)
- `src/pages/RiskRegisterPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Registrar risco "Vazamento de PII via API" likelihood=4 impact=5 → inherent=20 (critical)
- Treatment=mitigate + plan → review após implementação → residual=8 (medium)
- Heatmap mostra bolha em (4,5) com contagem
- Forçar overdue review → aparece em "overdue" stat
- RLS: non-admin vê riscos mas não registra
