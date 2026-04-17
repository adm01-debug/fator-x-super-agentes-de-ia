
A fila de auditoria está **100% zerada**. Todos os 22 sprints foram concluídos e o score 10/10 está consolidado e mantido. Não há mais itens em "Next candidates" no `mem://features/audit-improvements`.

Para continuar evoluindo além do 10/10 da auditoria original, identifiquei **3 áreas de hardening contínuo** que naturalmente surgem após uma base 10/10. Proponho começar pelo de maior ROI:

## 🟢 Sprint 23 — Mobile Lighthouse profile + a11y deep-dive

### Por quê
- Sprint 21 só audita preset `desktop`. Mobile tem CPU 4× mais lenta + rede 3G → métricas reais do usuário em campo
- Acessibilidade ≥0.95 atual é boa, mas falta cobertura runtime (axe-core nos testes Playwright pega regressões dinâmicas que Lighthouse estático não vê)
- Complementa Sprints 19 (bundle) + 21 (perf desktop) fechando o tripé performance

### Plano (resumo)

1. **`lighthouserc.json`**: adicionar segunda config `mobile` (preset `mobile`, throttling 4G, viewport 360×640)
   - Assertions mobile mais permissivas: perf ≥0.75, LCP ≤4000ms, TBT ≤600ms
   - A11y/best-practices/CLS mantém os mesmos thresholds rígidos

2. **`@axe-core/playwright`** (nova devDep): integrar em todos os specs E2E
   - Helper `e2e/helpers/a11y.ts` com `expectNoA11yViolations(page)` 
   - Adicionar 1 assertion axe em cada spec existente (`auth.spec.ts`, `auth-flows.spec.ts`)
   - Falha em violations `serious` ou `critical` (warn em `moderate`/`minor`)

3. **`.github/workflows/ci.yml`**: job `lighthouse` roda matrix `[desktop, mobile]`

4. **`docs/RUNBOOK.md`**: nova seção "Mobile Performance + Runtime A11y"
   - Tabela comparativa desktop vs mobile budgets
   - Como interpretar violations axe-core

5. **`mem://features/audit-improvements`**: Sprint 23 logged + nova fila "Continuous hardening"

### Arquivos
- `lighthouserc.json` (refatorar para multi-config)
- `package.json` (1 devDep)
- `e2e/helpers/a11y.ts` (novo)
- `e2e/auth.spec.ts` + `e2e/auth-flows.spec.ts` (1 assertion cada)
- `.github/workflows/ci.yml` (matrix)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

### Validação
- `npm run lhci:local` gera 2 reports (desktop + mobile)
- `npm run test:e2e` executa axe em cada cenário e falha em violations críticas
- CI mostra 2 colunas de Lighthouse no PR

Após Sprint 23, próximas candidatas naturais: **Sprint 24 — Visual regression (Playwright screenshots)** e **Sprint 25 — k6 load test do edge function crítico**.
