
Sprint 19 (Bundle-size budget guard) completo ✅. Score 10/10 mantido. Próximo da fila: 🟢 **Sprint 20 — Renovate/Dependabot config (dependency freshness audit)**.

## Por que esta agora
Das 2 candidatas restantes (Playwright auth E2E, Lighthouse CI), Renovate/Dependabot é a de maior ROI e menor fricção:
- Zero secrets necessários (Dependabot é nativo do GitHub)
- Detecta CVEs em deps automaticamente — complementa o `npm audit` do CI
- Mantém Sentry, Supabase, Vite atualizados sem esforço manual
- Setup é 1 arquivo YAML

Playwright auth E2E precisa de credenciais sintéticas + fluxo OTP/Google = fricção alta. Lighthouse CI precisa de URL pública estável + budget de performance separado.

## Plano

**1. `.github/dependabot.yml` (novo):**
- Ecosystem `npm` na raiz, schedule `weekly` (segunda 06:00 UTC)
- `open-pull-requests-limit: 5` — evita spam
- Grouping estratégico:
  - `react` (react, react-dom, @types/react*)
  - `supabase` (@supabase/*)
  - `sentry` (@sentry/*)
  - `radix` (@radix-ui/*)
  - `dev-dependencies` (todos devDeps minor/patch)
- `ignore`: bumps `major` em react/react-dom (breaking, requer migração manual)
- Labels: `dependencies`, `automated`
- Commit prefix: `chore(deps)`
- Ecosystem `github-actions` em `.github/workflows/` (weekly) — mantém `actions/checkout@v4`, `setup-node@v4` etc atualizados

**2. `docs/RUNBOOK.md`:** seção "Dependency Freshness":
- Cadência (semanal segunda)
- Como revisar PRs do Dependabot (CI roda full pipeline → verde = merge)
- Política de major bumps (manual, com smoke test)
- Como pausar temporariamente (`@dependabot ignore this dependency`)

**3. `.lovable/memory/features/audit-improvements.md`:** Sprint 20 logged + `Next candidates` reduzido para 2 (Playwright E2E, Lighthouse CI).

## Arquivos
- `.github/dependabot.yml` (novo)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append)

## Validação
- Dependabot ativa automaticamente quando o YAML é mergeado em `main`
- Primeiro batch de PRs aparece na próxima segunda
- Sem impacto em build/dev local
