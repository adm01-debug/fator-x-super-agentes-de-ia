
QA Sprint já teve fase 1 (RLS P1 fixes aplicados). Próxima fase: **consistência visual + a11y** nas 6 páginas de Segurança (Sprints 41-45) sem mexer em backend.

## Plano — QA Fase 2: Polimento Visual & A11y

### 1. Auditoria das 6 páginas de Segurança
Ler e comparar: `VendorsPage`, `RisksPage`, `BCPPage`, `ChangeManagementPage`, `IncidentResponsePage`, `AssetInventoryPage`.

Checar:
- Header com `PageHeader` + descrição PT-BR
- Container: `p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter`
- Stats: 4 cards no topo com mesma estrutura
- Badges de severidade usando tokens (`destructive`, `nexus-amber`, `emerald-500`, `primary`)
- `animate-pulse` em badges críticos (overdue, expiring, pending)
- Empty states com ícone + título + descrição
- Botões icon-only com `aria-label`
- Dialogs com `aria-describedby`

### 2. Fixes pontuais
Aplicar correções somente onde houver inconsistência detectada:
- Padronizar spacing/container
- Uniformizar badge helpers (cores via tokens, não hex)
- Adicionar `aria-label` em botões icon-only faltantes
- Garantir `animate-pulse` consistente em badges críticos

### 3. Verificação de lazy loading
Confirmar em `src/App.tsx` que rotas Sprints 41-45 (`/security/bcp`, `/security/changes`, `/security/ir`, `/security/assets`) usam `lazy()`.

### 4. Documentação final
- `docs/RUNBOOK.md`: índice atualizado se faltar alguma seção
- `mem://features/audit-improvements`: append "QA Fase 2 — visual consistency pass"

### Entregáveis
- Lista curta de findings por página
- Fixes mínimos cirúrgicos (sem refactor)
- Memory atualizado

### Arquivos prováveis
- `src/pages/VendorsPage.tsx`, `RisksPage.tsx`, `BCPPage.tsx`, `ChangeManagementPage.tsx`, `IncidentResponsePage.tsx`, `AssetInventoryPage.tsx` (correções pontuais)
- `src/App.tsx` (verificar lazy)
- `docs/RUNBOOK.md`
- `.lovable/memory/features/audit-improvements.md`
