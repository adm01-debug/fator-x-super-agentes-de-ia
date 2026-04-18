
Sprint 36 (Compliance Reports) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 37 — SBOM / Supply Chain Security**.

## Por quê
- Temos detecção, treino, auto-remediação, DR, postmortems e compliance reports
- **Mas não rastreamos dependências** (npm packages) nem vulnerabilidades conhecidas (CVEs)
- SBOM (Software Bill of Materials) = inventário auditável de tudo que roda em produção
- Requisito explícito de SOC 2 / ISO 27001 / executive order US 14028

## Plano

**1. Migração SQL — `sbom_snapshots` + `sbom_components` + `vulnerability_findings`:**
- `sbom_snapshots`: id, workspace_id, name, format (`cyclonedx`|`spdx`), source (`package.json`|`manual`|`upload`), total_components, generated_by, created_at
- `sbom_components`: id, snapshot_id, name, version, ecosystem (`npm`|`deno`|`pypi`), license, direct bool, supplier, purl
- `vulnerability_findings`: id, snapshot_id, component_id, cve_id, severity (`critical`|`high`|`medium`|`low`), cvss_score, summary, fixed_version, status (`open`|`acknowledged`|`fixed`|`accepted_risk`), discovered_at, resolved_at
- RLS: members SELECT, admins INSERT/UPDATE

**2. RPCs:**
- `create_sbom_snapshot(workspace_id, name, components jsonb[])` → cria snapshot + bulk insert componentes
- `record_vulnerability(snapshot_id, component_id, cve_id, severity, ...)` → registra CVE
- `acknowledge_vulnerability(id, notes)` / `mark_vulnerability_fixed(id)` → status transitions

**3. Edge function `sbom-scanner`:**
- POST `{workspace_id, snapshot_id}` → consulta OSV.dev (free public API) por package@version
- Para cada match → INSERT em `vulnerability_findings`
- Retorna summary: `{scanned, found_critical, found_high, found_medium, found_low}`

**4. UI — `src/pages/SBOMPage.tsx` (`/security/sbom`):**
- Lista snapshots com badge counts (critical/high/medium/low)
- "Novo SBOM": parse `package.json` colado/upload → cria snapshot + componentes
- "Escanear": dispara edge function → toast com resultados
- Detalhes (Sheet): tabela componentes + tab vulnerabilidades agrupadas por severidade

**5. UI — `src/pages/VulnerabilitiesPage.tsx` (`/security/vulnerabilities`):**
- View consolidada de todos os findings ativos no workspace
- Filtros: severity, status, ecosystem
- Ações inline: acknowledge, mark fixed (com notes)
- Stats cards: total open, critical count, MTTR médio

**6. `src/services/sbomService.ts`:** CRUD snapshots/components/vulns + parser package.json + scanner trigger

**7. Sidebar:** items "SBOM" e "Vulnerabilidades" sob Segurança (ícones `Package`, `ShieldAlert`)

**8. `docs/RUNBOOK.md`:** seção "Supply Chain Security" — cadência de scan (semanal), SLA de fix por severidade (critical 24h, high 7d, medium 30d)

**9. `mem://features/audit-improvements`:** Sprint 37 logged + fila (Sprint 38 Secrets Rotation, Sprint 39 Penetration Test Tracking)

## Arquivos
- `supabase/migrations/<ts>_sbom.sql`
- `supabase/functions/sbom-scanner/index.ts` (nova)
- `src/services/sbomService.ts` (novo)
- `src/pages/SBOMPage.tsx` (nova)
- `src/pages/VulnerabilitiesPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (2 items)
- `src/App.tsx` (2 rotas)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Colar `package.json` real → snapshot criado com N componentes
- Disparar scan → OSV.dev consultado → CVEs registrados
- Acknowledge vulnerability → status muda, audit log
- RLS: non-admin vê SBOMs mas não escaneia
