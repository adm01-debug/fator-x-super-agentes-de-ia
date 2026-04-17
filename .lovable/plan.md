
Sprint 23 (Mobile Lighthouse + Runtime A11y) completo ✅. Próximo da fila de Continuous Hardening: 🟢 **Sprint 24 — Visual regression (Playwright screenshots baseline)**.

## Por quê
- Lighthouse + axe pegam métricas e a11y, mas **mudanças visuais silenciosas** (cor errada, layout shift, ícone sumido, tipografia trocada) só aparecem se alguém olhar a tela
- Playwright tem `toHaveScreenshot()` nativo com diff por pixel + threshold tolerante a anti-aliasing
- Custo zero: roda no mesmo job E2E que já existe

## Plano

**1. `e2e/visual.spec.ts` (novo):** baseline screenshots de telas-chave
- `/auth` (login form) — viewport desktop 1280×720
- `/auth` viewport mobile 375×667
- `/` (landing pública, se existir; senão skip)
- Auth guard: tela de loading/redirect em rota protegida sem sessão

**2. `playwright.config.ts`:** ajustes
- `expect.toHaveScreenshot.maxDiffPixelRatio: 0.01` (1% tolerância)
- `expect.toHaveScreenshot.threshold: 0.2` (anti-aliasing)
- `snapshotPathTemplate`: `e2e/__screenshots__/{testFilePath}/{arg}-{projectName}{ext}`
- Project `chromium` já cobre; adicionar viewport `mobile-chrome` (Pixel 5)

**3. `package.json`:** scripts
- `"test:e2e:visual": "playwright test e2e/visual.spec.ts"`
- `"test:e2e:update": "playwright test --update-snapshots"` — para atualizar baseline intencionalmente

**4. `.github/workflows/ci.yml`:** job `e2e-tests` já roda specs novos automaticamente. Adicionar upload de `e2e/__screenshots__/` em failure para inspeção dos diffs.

**5. `.gitignore`:** garantir que `test-results/` e `playwright-report/` estão ignorados; `__screenshots__/` **commitada** (são o baseline).

**6. `docs/RUNBOOK.md`:** seção "Visual Regression Tests"
- Como rodar local
- Como atualizar baseline (com PR dedicado)
- Política: diff >1% bloqueia merge; update intencional requer 1 reviewer aprovando o screenshot

**7. `mem://features/audit-improvements`:** Sprint 24 logged + fila atualizada (Sprint 25 k6, Sprint 26 OTel).

## Arquivos
- `e2e/visual.spec.ts` (novo)
- `e2e/__screenshots__/` (baselines gerados na primeira run)
- `playwright.config.ts` (config snapshot + viewport mobile)
- `package.json` (2 scripts)
- `.github/workflows/ci.yml` (artifact upload em failure)
- `.gitignore` (verificação)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- `npm run test:e2e:visual` na primeira run gera baseline (passa)
- Mudança intencional: `npm run test:e2e:update` regenera, commit explícito
- Mudança não intencional: CI falha com diff PNG anexo no artifact
