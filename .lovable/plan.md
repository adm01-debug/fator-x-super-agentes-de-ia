
## Sprint QA — Polimento Final & Quality Assurance

Sistema maduro (45 sprints). Foco agora em **encontrar e corrigir inconsistências** acumuladas, sem adicionar features novas.

### 1. Auditoria automatizada (read-only primeiro)
- `supabase--linter` → detectar RLS faltando, policies frouxas, índices ausentes nas 45+ tabelas criadas
- `security--run_security_scan` → varredura de exposição de dados
- Buscar cores hardcoded (`bg-emerald-`, `text-red-`, `bg-blue-`) fora dos tokens nexus-* nas páginas recentes (Sprints 41-45)
- Buscar `as any`, `console.log` esquecidos, TODOs órfãos
- Verificar consistência de PT-BR nos títulos das páginas novas (BCP, CAB, IR, CMDB)

### 2. Consistência visual nas páginas de Segurança
Padronizar as 6 páginas do módulo (Vendors, Risks, BCP, Changes, IR, Assets):
- Mesma estrutura de stats cards (4 cards no topo)
- Mesmos badges de severidade (`destructive` / `warning` / `success` tokens)
- Mesma animação `animate-pulse` em badges críticos
- Mesmo padding/spacing (`p-6 sm:p-8 lg:p-10`)
- Empty states uniformes

### 3. Acessibilidade & UX
- `aria-label` em botões icon-only
- Focus rings consistentes (já temos token, validar uso)
- Contraste WCAG AA nos badges custom
- Dialogs com `aria-describedby`

### 4. Performance
- Lazy imports nas rotas novas (Sprints 41-45) — confirmar que estão lazy
- Verificar bundle dos services novos
- Memo em listas grandes (assets, changes podem crescer)

### 5. Documentação
- `docs/RUNBOOK.md`: índice atualizado com todas as seções (BCP, CAB, IR, CMDB)
- `mem://features/audit-improvements`: marcar QA pass

### Entregáveis
- Lista de findings priorizados (P0/P1/P2)
- Fixes aplicados em ordem de criticidade
- Relatório final no memory

### Arquivos prováveis
- Páginas Sprints 41-45 (correções pontuais de tokens/a11y)
- `docs/RUNBOOK.md`
- `mem://features/audit-improvements`
- Migrações pequenas se linter apontar RLS gaps
