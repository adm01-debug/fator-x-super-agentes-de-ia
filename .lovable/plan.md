
Sprint 40 (Risk Register) ✅. Próximo da fila: 🟢 **Sprint 41 — Vendor Risk Management (TPRM)**.

## Por quê
- Temos riscos internos, pentests, SBOM, secrets — mas **não rastreamos terceiros** (SaaS, processadores, APIs externas)
- SOC2 CC9.2 / ISO 27001 A.15 / LGPD Art.39 exigem due diligence + monitoramento contínuo de fornecedores
- Sem inventário, DPAs vencidos e certs SOC2 expirados viram risco invisível

## Plano

**1. Migração SQL — `vendors` + `vendor_assessments` + `vendor_documents`:**
- `vendors`: id, workspace_id, name, vendor_type (`saas`|`processor`|`api`|`infra`|`consulting`|`other`), website, contact_email, criticality (`critical`|`high`|`medium`|`low`), data_classification (`pii`|`phi`|`financial`|`confidential`|`public`), status (`active`|`under_review`|`suspended`|`offboarded`), onboarded_at, offboarded_at, dpa_signed (bool), dpa_expires_at, soc2_valid_until, iso27001_valid_until, notes, owner_id
- `vendor_assessments`: id, vendor_id, assessed_by, assessed_at, risk_score (1-25), security_score (1-5), compliance_score (1-5), operational_score (1-5), findings (text[]), recommendations, next_review_due
- `vendor_documents`: id, vendor_id, doc_type (`dpa`|`soc2`|`iso27001`|`pentest_report`|`questionnaire`|`contract`|`other`), title, file_url, valid_until, uploaded_by, uploaded_at
- RLS: members SELECT, admins INSERT/UPDATE
- Trigger: ao INSERT assessment, atualiza `vendors.next_review_due` (critical=90d, high=180d, demais=365d)

**2. RPCs:**
- `register_vendor(...)` → cria vendor
- `assess_vendor(vendor_id, scores, findings, recs)` → registra assessment
- `offboard_vendor(vendor_id, notes)` → status offboarded
- `get_vendor_summary(workspace_id)` → totais por criticality, DPAs vencendo (<30d), certs expirados, assessments overdue

**3. UI — `src/pages/VendorsPage.tsx` (`/security/vendors`):**
- Stats: total ativos, críticos, DPAs vencendo, assessments overdue, certs expirados
- Tabela com filtros (criticality, type, status) + badges visuais (DPA expired vermelho pulsante, <30d amber)
- "Novo vendor": dialog com type, criticality, data classification, contato
- Drill-in Sheet: tabs **Assessments** (histórico + novo), **Documentos** (upload metadata DPA/SOC2/etc com valid_until), **Detalhes**

**4. `src/services/vendorRiskService.ts`:** CRUD + assessments + summary + helpers de urgência (cert expiry)

**5. Sidebar:** item "Fornecedores" sob Segurança (ícone `Building`)

**6. `docs/RUNBOOK.md`:** seção "Vendor Risk Management" — questionário padrão, cadências por criticality, processo de offboarding

**7. `mem://features/audit-improvements`:** Sprint 41 logged + fila (Sprint 42 BCP, Sprint 43 Change Management)

## Arquivos
- `supabase/migrations/<ts>_vendor_risk.sql`
- `src/services/vendorRiskService.ts` (novo)
- `src/pages/VendorsPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Registrar "OpenAI" type=api criticality=critical data=confidential → next_review_due=+90d
- Adicionar assessment scores 4/5/4 → histórico criado
- Adicionar doc DPA com valid_until=+15d → badge amber "vencendo"
- Forçar SOC2 expirado → badge vermelho pulsante
- RLS: non-admin vê vendors mas não cria/avalia
