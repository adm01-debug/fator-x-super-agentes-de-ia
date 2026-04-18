
Já atingimos 10/10 no V4. Para manter momentum rumo à "perfeição contínua", próximo sprint ataca as 9 páginas P3 remanescentes (supabase direto) — única pendência arquitetural restante.

## Plano — Sprint Polish Arquitetural V5

### Etapa 1 — Mapear as 9 páginas
Identificar quais tabelas cada uma toca via grep, agrupar por domínio.

### Etapa 2 — Criar/expandir services
Para cada domínio sem service: criar `src/services/<dominio>Service.ts` com padrão `wrapErr` + `logger.error` (mesmo do `evaluationsService`). Reutilizar services existentes quando possível.

### Etapa 3 — Refatorar as 9 páginas
Substituir `supabase.from(...)` direto por chamadas ao service. Zero mudança de comportamento, apenas indireção.

### Etapa 4 — Testes de contrato
1 suíte Vitest curta por novo service (mock supabase, assert error wrapping).

### Etapa 5 — Validação
- `tsc --noEmit` zero erros
- `vitest run` 100% verde
- `supabase--linter` zero novos warnings

### Etapa 6 — Relatório V5 + memory
`NEXUS-RELATORIO-TESTES-ABRANGENTE-V5.md` (delta V4→V5, scorecard 10/10 mantido + arquitetura 100% service-layer).
Append `mem://features/audit-improvements`.

### Arquivos prováveis
- 2-4 novos services em `src/services/`
- 9 páginas refatoradas em `src/pages/`
- 2-4 suítes em `src/test/`
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V5.md`
- `.lovable/memory/features/audit-improvements.md`
