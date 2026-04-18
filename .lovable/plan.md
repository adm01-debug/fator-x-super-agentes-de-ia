
Sprint 44 (IR Playbooks) ✅. Próximo da fila: 🟢 **Sprint 45 — Asset Inventory (CMDB-lite)**.

## Por quê
- Temos riscos, vendors, BCP, mudanças, IR playbooks — mas **não temos inventário de ativos**
- ISO 27001 A.5.9 / SOC2 CC6.1 / NIST CSF ID.AM exigem inventário completo de hardware, software e cloud resources com owner e classificação
- Sem CMDB, impossível mapear blast radius de mudanças/incidentes ou validar SBOM contra ativos reais

## Plano

### 1. Migração SQL
- `assets`: id, workspace_id, name, asset_type (`hardware`|`software`|`cloud_resource`|`saas_account`|`network_device`|`mobile_device`|`iot`|`other`), category, owner_id, custodian_id, environment (`production`|`staging`|`development`|`testing`), classification (`public`|`internal`|`confidential`|`restricted`), status (`active`|`maintenance`|`decommissioned`|`lost`), location, vendor, model, serial_number, ip_address, hostname, os, version, purchased_at, warranty_until, last_seen_at, tags text[], metadata jsonb, linked_system_id (FK conceitual a business_systems), linked_vendor_id (FK conceitual a vendors)
- `asset_audits`: id, asset_id, audited_by, audited_at, findings, status_after, notes
- RLS: members SELECT, admins INSERT/UPDATE/DELETE
- Trigger ao INSERT em asset_audits: atualiza `last_seen_at` no asset

### 2. RPCs
- `register_asset(...)` → cria ativo
- `audit_asset(asset_id, findings, status_after, notes)` → registra auditoria + atualiza last_seen
- `decommission_asset(asset_id, reason)` → status=decommissioned
- `get_asset_summary(workspace_id)` → totais por type/classification/environment, ativos sem owner, sem auditoria 90d, warranty vencendo 30d

### 3. UI — `src/pages/AssetInventoryPage.tsx` (`/security/assets`)
- Stats: total ativos, sem owner, sem auditoria 90d, warranty vencendo 30d
- Filtros: type, environment, classification, status
- Tabela com badges (classification, environment, status) + busca por hostname/serial
- Dialog "Novo ativo": tipo, classificação, ambiente, owner, vendor, hostname, IP, OS, warranty
- Drill-in Sheet: tabs **Detalhes** + **Auditorias** (histórico + nova auditoria inline)
- Badge pulsante para warranty vencendo e ativos não auditados

### 4. Service & integração
- `src/services/assetInventoryService.ts`: CRUD + audits + summary + helpers (warranty expiring, audit overdue)
- Sidebar: "Inventário (CMDB)" sob Segurança (ícone `Boxes`)
- Rota lazy em `src/App.tsx`
- `docs/RUNBOOK.md`: seção Asset Inventory (taxonomia, classificação, cadência de auditoria)
- `mem://features/audit-improvements`: log Sprint 45 + fila (Sprint 46 Privacy/DSAR, Sprint 47 Access Reviews)

## Arquivos
- `supabase/migrations/<ts>_asset_inventory.sql`
- `src/services/assetInventoryService.ts` (novo)
- `src/pages/AssetInventoryPage.tsx` (nova)
- `src/components/layout/AppSidebar.tsx` (item)
- `src/App.tsx` (rota)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Cadastrar "MacBook Pro CTO" type=hardware classification=confidential env=production warranty=+10d → badge amber pulsante
- Registrar auditoria status_after=active → last_seen_at atualizado
- Forçar audit overdue (90d+ sem auditoria) → conta em "sem auditoria 90d"
- Decommission → status=decommissioned, sai da lista ativa
- RLS: non-admin vê ativos mas não cadastra/audita
