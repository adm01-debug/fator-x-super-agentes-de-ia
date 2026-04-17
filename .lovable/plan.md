
Próxima melhoria da fila: 🟢 **Sprint 18 — Vitest Coverage Gate enforcement em CI**.

## Contexto
Já temos thresholds definidos em `vitest.config.ts` (lines/functions/statements 70%, branches 60%), mas:
- Nenhum script `test:coverage` exposto no `package.json`
- Sem documentação de como rodar / ler o report
- Sem badge ou referência no RUNBOOK

Sprint 17 marcou 10/10, mas há candidatos listados — este é o próximo de maior ROI (qualidade contínua).

## Plano

**1. `package.json`:** adicionar scripts:
- `"test:coverage": "vitest run --coverage"`
- `"test:coverage:ci": "vitest run --coverage --reporter=verbose"`

**2. `vitest.config.ts`:** garantir `coverage.reportsDirectory: 'coverage'` e adicionar `all: true` (cobre arquivos não-importados em testes — força visibilidade real).

**3. `.gitignore`:** adicionar `coverage/` se não estiver.

**4. `docs/RUNBOOK.md`:** nova seção "Coverage Gate":
- Como rodar: `npm run test:coverage`
- Thresholds atuais e racional
- Onde abrir o HTML report (`coverage/index.html`)
- Política: PR que derrubar coverage abaixo dos limites falha o build

**5. `mem://features/audit-improvements`:** Sprint 18 logged.

**Arquivos:**
- `package.json` (2 scripts)
- `vitest.config.ts` (coverage opts)
- `.gitignore` (1 linha)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)
