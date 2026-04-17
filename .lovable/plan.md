
Sprint 20 completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 21 — Lighthouse CI (performance budget guard)**.

## Por que esta agora
Das 2 candidatas restantes, Lighthouse CI tem maior ROI imediato:
- Complementa o bundle-size guard (Sprint 19) com métricas reais de runtime (LCP, CLS, TBT, FCP)
- Detecta regressões de performance antes do merge (não só tamanho de bundle)
- Roda local contra `dist/` servido por `vite preview` — sem URL pública necessária
- Gera artefato HTML navegável + assertions falham CI

Playwright auth E2E fica por último (precisa credenciais sintéticas + fluxo OTP/Google).

## Plano

**1. Instalar deps (devDependencies):**
- `@lhci/cli` — CLI oficial do Lighthouse CI
- (Chrome headless já vem no runner do GitHub Actions)

**2. `lighthouserc.json` (novo, raiz):**
- `ci.collect.staticDistDir: "./dist"` — serve build local
- `ci.collect.url: ["http://localhost/", "http://localhost/auth"]` — landing + auth (rotas públicas)
- `ci.collect.numberOfRuns: 3` — média de 3 runs reduz flakiness
- `ci.collect.settings.preset: "desktop"` — baseline desktop primeiro
- `ci.assert.assertions`:
  - `categories:performance` ≥ 0.85 (warn) / 0.80 (error)
  - `categories:accessibility` ≥ 0.95 (error)
  - `categories:best-practices` ≥ 0.90 (error)
  - `categories:seo` ≥ 0.90 (warn)
  - `largest-contentful-paint` ≤ 2500ms (warn)
  - `cumulative-layout-shift` ≤ 0.1 (error)
  - `total-blocking-time` ≤ 300ms (warn)
- `ci.upload.target: "temporary-public-storage"` — link público no PR sem setup

**3. `package.json`:** scripts:
- `"lhci": "lhci autorun"`
- `"lhci:local": "npm run build && lhci autorun"` — uso dev local

**4. `.github/workflows/ci.yml`:** novo job `lighthouse` (paralelo ao `check:bundle`):
- Runs após `npm run build`
- `npx @lhci/cli autorun`
- Upload do `.lighthouseci/` como artefato

**5. `.gitignore`:** adicionar `.lighthouseci/`

**6. `docs/RUNBOOK.md`:** seção "Performance Budget — Lighthouse CI":
- Como rodar local (`npm run lhci:local`)
- Tabela de assertions e limites
- Como ajustar budget (PR dedicado)
- Como ler o report HTML

**7. `mem://features/audit-improvements`:** Sprint 21 logged + `Next candidates` reduzido para 1 (Playwright E2E).

## Arquivos
- `package.json` (1 dep + 2 scripts)
- `lighthouserc.json` (novo)
- `.github/workflows/ci.yml` (novo job)
- `.gitignore` (1 linha)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- `npm run lhci:local` gera report local em `.lighthouseci/`
- CI falha se performance/a11y caírem abaixo dos thresholds
- Link público do report aparece no log do PR
