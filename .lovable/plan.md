
Score atual: 9.8/10. Para chegar a 10/10 absoluto faltam apenas dois itens não-bloqueantes do relatório V3:

1. **Cobertura de testes (9 → 10)** — adicionar suítes E2E/unit para fluxos pouco cobertos
2. **Refator P3** — 21 páginas ainda usam `supabase` direto (não-críticas, mas pendência cosmética de arquitetura)

## Plano — Sprint Excelência Absoluta (10/10)

### Etapa 1 — Auditoria das 21 páginas P3
Mapear quais tabelas cada uma toca e agrupar por domínio (knowledge, voice, ai-studio, monitoring, etc.) para decidir entre:
- usar service existente
- criar wrapper novo em `src/services/`

### Etapa 2 — Migrar 10 páginas mais "pesadas" para services
Foco nas que fazem mais de 1 query direta. Padrão: extrair queries para `src/services/<dominio>Service.ts` com `try/catch + logger.error` (mesmo padrão do `evaluationsService` recém-refatorado). As 11 restantes (queries triviais de 1 linha) ficam como aceitas — documentar exceção arquitetural.

### Etapa 3 — Novas suítes de teste (cobertura 9 → 10)
Adicionar 3 suítes Vitest:
- `voice-agents-service.test.ts` — mock de chamadas, assert de error wrapping
- `browser-sessions-service.test.ts` — idem
- `evaluations-scoring.test.ts` — testar `scoreDeterministic` e `scoreStatistical` (funções puras, ROUGE-L, LCS) com casos conhecidos. Alta densidade de asserts.

### Etapa 4 — Validação
- `tsc --noEmit` zero erros
- `vitest run` todas suítes verdes
- `supabase--linter` sem novos warnings

### Etapa 5 — Relatório V4 + memory
`NEXUS-RELATORIO-TESTES-ABRANGENTE-V4.md` curto (delta V3→V4, scorecard final **10/10**).
Append em `mem://features/audit-improvements`.

### Arquivos prováveis
- `src/services/voiceAgentsService.ts`, `browserSessionsService.ts`, `knowledgeService.ts` (novos/expandidos)
- 10 páginas em `src/pages/` (refator de queries → service calls)
- `src/test/voice-agents-service.test.ts`, `browser-sessions-service.test.ts`, `evaluations-scoring.test.ts`
- `NEXUS-RELATORIO-TESTES-ABRANGENTE-V4.md`
- `.lovable/memory/features/audit-improvements.md`
