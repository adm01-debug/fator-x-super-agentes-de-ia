
Sprint anterior (FK indexes) concluído. Próximas melhorias rumo ao 10/10 absoluto, atacando warnings remanescentes do relatório V2.

## Plano — Sprint Hardening Final

### Etapa 1 — Mover `pgcrypto` para schema dedicado
Único warning de linter pré-existente. Criar schema `extensions`, mover `pgcrypto` para lá e atualizar `search_path` das funções que usam `pgp_sym_encrypt` (ex: `encrypt_secret_value`).

### Etapa 2 — Error handling no `evaluationsService`
Findings V1: service sem try/catch nem logger. Adicionar wrapper padrão (logger + throw tipado) em todas as funções exportadas, alinhado ao padrão dos outros services.

### Etapa 3 — Migrar 5 páginas críticas para usar services (em vez de supabase direto)
24 páginas usam `supabase` direto. Migrar as 5 mais críticas em segurança/auditoria:
- páginas que tocam `audit_log`, `user_roles`, `workspace_members`, `api_keys`, `security_events`
Mover queries para services existentes ou criar wrappers em `src/services/`.

### Etapa 4 — Validação
- `tsc --noEmit` zero erros
- `supabase--linter` zero warnings (meta: 0/0)
- Vitest suítes afetadas

### Etapa 5 — Relatório V3
`NEXUS-RELATORIO-TESTES-ABRANGENTE-V3.md` curto: o que mudou de V2→V3, scorecard final 10/10.
Memory append em `mem://features/audit-improvements`.

### Arquivos prováveis
- `supabase/migrations/<ts>_pgcrypto_to_extensions.sql`
- `src/services/evaluationsService.ts`
- 5 páginas em `src/pages/` (a identificar via grep)
- Novos wrappers em `src/services/` se necessário
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V3.md`
- `.lovable/memory/features/audit-improvements.md`
