
Próxima melhoria da fila da auditoria: 🔴 **Wave 1 — Quick Win #1: Mascarar emails em `workspace_members`** (ação top de ROI: alto impacto / baixo esforço, fecha o único finding ERROR do scan de segurança).

## Problema
`workspace_members.email` exposto a qualquer membro do workspace via RLS atual → harvesting de emails para phishing/spam. Único finding **ERROR** do scan.

## Plano

**Migration:**
1. Criar view `public.workspace_members_safe` com email mascarado (`a***@domain.com`) para membros não-admin; admins veem email completo.
2. Revogar SELECT direto de `workspace_members.email` para usuários comuns via policy reescrita: política atual permite ver todos os membros do workspace → trocar por política que separa SELECT de colunas sensíveis.
   - Estratégia escolhida: manter RLS atual (permite ver linhas), mas criar **função `get_workspace_member_email(member_id)`** SECURITY DEFINER que retorna email completo só para admin/dono, senão mascarado.
   - Frontend passa a usar a view `workspace_members_safe` em listagens.
3. Função utilitária `mask_email(text)` em SQL: `left(local,1) || '***@' || domain`.

**Frontend:**
- `src/services/workspaceService.ts` (ou equivalente): trocar `from('workspace_members')` por `from('workspace_members_safe')` em listagens de membros.
- Localizar componentes que renderizam lista de membros (provável `src/pages/admin/` ou `src/components/workspace/`) e atualizar tipos.

**Validação:**
- `tsc` clean.
- Re-run security scan → finding `workspace_members_email_exposed` deve sair de ERROR.
- Mark finding as fixed.

**Arquivos:**
- migration nova (mask_email + view + grants)
- `src/services/workspaceService.ts` (ajuste de query)
- 1-2 componentes de UI (ajuste de tipo)
- `src/integrations/supabase/types.ts` (auto-regen)
