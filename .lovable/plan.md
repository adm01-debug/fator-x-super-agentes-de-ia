
Auditoria técnica exaustiva do Nexus Agents Studio nas 22 dimensões. Esta é uma tarefa de **análise read-only** — não preciso de aprovação para executar leitura de arquivos. Vou apresentar o plano de execução da auditoria + estrutura do entregável, e ao aprovar, executo a varredura completa.

## Plano de Execução da Auditoria

### Fase 0 — Coleta de Inventário (10 min)
- `code--exec` para contagens: arquivos `src/`, edge functions, migrations, linhas TS/TSX
- `supabase--read_query` para inventário de tabelas, RLS policies, índices
- `code--view` em: `package.json`, `tsconfig.app.json`, `eslint.config.js`, `.github/workflows/`, `vitest.config.ts`, `playwright.config.ts`, `README.md`
- `supabase--linter` para findings automáticos
- `security--run_security_scan` para validação de exposição de dados

### Fase 1 — Varredura das 22 Dimensões
Para cada dimensão: nota 0–10 com **evidência citada** (arquivo:linha), gaps objetivos, ações concretas.

**Mapeamento dimensão → fontes de evidência:**

| Dimensão | Fontes |
|---|---|
| 1. Arquitetura | `src/` tree, `docs/adr/*`, padrões de imports |
| 2. Autenticação | `AuthContext.tsx`, `_shared/auth.ts`, config Supabase Auth |
| 3. Autorização | `pg_policies` query, `has_role`, `is_workspace_admin`, AuthGuard |
| 4. Banco de Dados | schema query, índices (`pg_indexes`), FKs, migrations |
| 5. CI/CD | `.github/workflows/ci.yml`, `.husky/`, branch protection |
| 6. Data Integrity | RPCs, triggers, transações em edge functions |
| 7. Documentação | `README.md`, `docs/`, `CHANGELOG`, ADRs |
| 8. Infraestrutura | `vite.config.ts`, env management, secrets |
| 9. Logging | `lib/logger.ts`, edge function `console.*`, PII redaction |
| 10. Observabilidade | traces table, dashboards, error tracking |
| 11. Lógica de Negócio | services/, validations/, state machines |
| 12. Manutenibilidade | tamanhos de arquivos, dead code, complexidade |
| 13. Operacionalidade | `RUNBOOK.md`, rollback, feature flags |
| 14. Performance | bundle config, índices, paginação, N+1 |
| 15. Qualidade | ESLint config, console.log scan, TODOs |
| 16. Segurança | scan results, CSP, CORS, OWASP, webhooks HMAC |
| 17. Testes | `vitest`, `playwright`, coverage, RLS tests |
| 18. Tipagem | `tsconfig.json` strict, scan `as any`, Zod |
| 19. Validação | `validations/`, Zod schemas, edge function inputs |
| 20. Operações | git flow docs, PR template, dependabot |

(O prompt lista 22, mas as últimas 2 são meta. Cubro as 20 numeradas + comentário sobre as duas extras.)

### Fase 2 — Consolidação
- Scorecard tabela ASCII com 20 notas
- **Média ponderada** (×3 para Seg/Auth/Authz/DataInt; ×2 para DB/Tipagem/Valid/Testes/Arq; ×1 demais)
- Top 10 ações por ROI (impacto÷esforço)
- Roadmap 3 ondas: 🔴 Quick Wins / 🟠 Sprint 1 / 🟡 Sprint 2
- Parágrafo final sobre maturidade

### Estrutura do Entregável
```
1. INVENTÁRIO
2. AS 20 DIMENSÕES (cada uma: Nota/Evidências/Gaps/Ações)
3. SCORECARD + Nota Geral Ponderada
4. TOP 10 AÇÕES POR ROI
5. ROADMAP 3 ONDAS
6. NOTA FINAL + comentário de maturidade
```

### Regras
- Zero notas 10 sem evidência absoluta
- Toda nota com citação de arquivo/linha ou ausência específica
- Gaps acionáveis (código/config/migration), nunca "melhorar X"
- Calibrado ao porte: produto Lovable single-tenant Cloud, não enterprise multi-region

### Tempo estimado
~8–12 chamadas de ferramentas read-only para coleta, depois síntese textual em uma resposta longa final.

**Nota:** A auditoria é puramente analítica — não modifica código. Após apresentar o relatório, você decide quais ações virar plano de execução (modo default).
