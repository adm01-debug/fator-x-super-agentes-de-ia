
Sprint 18 (Coverage Gate) está completo. A meta 10/10 foi atingida e mantida. Próximo da fila de "Next candidates": 🟢 **Sprint 19 — Bundle-size budget guard**.

## Por que esta agora
Das 3 candidatas (Playwright auth E2E, Bundle-size guard, Lighthouse CI), bundle-size é a de maior ROI imediato:
- Sentry adicionou ~40kb gzipped no Sprint 16 — sem guard, regressões silenciosas vão acumular
- Setup é 100% local (sem secrets, sem CI flakiness)
- Detecta bloat de deps imediatamente em PR

Playwright E2E precisa de credenciais de teste; Lighthouse CI precisa de URL pública estável + GitHub Action — ambos com mais fricção.

## Plano

**1. Instalar `rollup-plugin-visualizer`** (dev dep) — gera treemap HTML do bundle.

**2. `vite.config.ts`:**
- Adicionar `visualizer({ filename: 'dist/stats.html', gzipSize: true, brotliSize: true })` em modo build
- Configurar `build.rollupOptions.output.manualChunks` para split estratégico:
  - `react-vendor`: react, react-dom, react-router-dom
  - `supabase`: @supabase/supabase-js
  - `sentry`: @sentry/react
  - `ui-vendor`: @radix-ui/*
  - `charts`: recharts (se usado)
- Setar `build.chunkSizeWarningLimit: 600` (kb) — força revisão de chunks grandes

**3. `scripts/check-bundle-size.mjs` (novo):**
- Lê `dist/stats.html` ou `dist/assets/*.js` após build
- Compara contra orçamento em `bundle-budget.json`:
  ```json
  {
    "total_gzip_kb": 800,
    "chunks": {
      "react-vendor": 180,
      "supabase": 130,
      "sentry": 60,
      "main": 250
    }
  }
  ```
- Exit 1 se algum chunk passar do budget — falha o build

**4. `package.json`:**
- `"build:analyze": "vite build && open dist/stats.html"`
- `"check:bundle": "node scripts/check-bundle-size.mjs"`
- Script `build` continua igual (não bloqueia dev)

**5. `.github/workflows/ci.yml`:**
- Adicionar step após `build`: `node scripts/check-bundle-size.mjs`

**6. `docs/RUNBOOK.md`:** seção "Bundle Size Budget":
- Como rodar local (`npm run build:analyze`)
- Como atualizar budget (PR dedicado documentando justificativa)
- Top 5 chunks atuais e lógica de split

**7. `mem://features/audit-improvements`:** Sprint 19 logged.

## Arquivos
- `package.json` (dev dep + 2 scripts)
- `vite.config.ts` (visualizer + manualChunks)
- `bundle-budget.json` (novo, raiz)
- `scripts/check-bundle-size.mjs` (novo)
- `.github/workflows/ci.yml` (1 step)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- `npm run build` continua passando local
- `npm run check:bundle` falha se algum chunk inflar acima do budget
- `dist/stats.html` abre treemap navegável
