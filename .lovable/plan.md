
Wave 1 está 100% completa (3/3 quick wins). Próxima da fila da auditoria: 🟡 **Sprint 1 — Item #1: Integrar Sentry SDK para observabilidade de erros em produção**.

## Problema
Hoje erros de runtime só aparecem no console do navegador do usuário. Sem Sentry:
- Não vemos crashes silenciosos em produção
- Sem stack trace agregado, source maps, breadcrumbs de UX
- Impossível medir taxa de erro por release/rota
- `src/lib/logger.ts` já captura `window.onerror` mas só loga local

## Plano

**1. Instalar `@sentry/react`** (peer-compatible com React 18 + Vite).

**2. `src/lib/sentry.ts` (novo):**
- `initSentry()` chamado em `main.tsx` antes do `ReactDOM.render`
- DSN via `import.meta.env.VITE_SENTRY_DSN` (opcional — se vazio, no-op silencioso, não quebra dev local)
- `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0`
- `environment: import.meta.env.MODE`, `release: __APP_VERSION__` (injetar via vite define)
- `beforeSend`: scrubbing de PII (email, tokens, headers Authorization)
- Ignore list: `ResizeObserver loop`, `Network request failed` (ruído conhecido)

**3. `src/main.tsx`:** chamar `initSentry()` no topo.

**4. `src/lib/logger.ts`:** quando Sentry estiver inicializado, encaminhar `logger.error()` via `Sentry.captureException`. Manter console local em paralelo.

**5. `src/components/shared/ErrorBoundary.tsx`:** envolver com `Sentry.ErrorBoundary` ou chamar `Sentry.captureException` no `componentDidCatch`.

**6. `vite.config.ts`:** adicionar `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`.

**7. CSP (`index.html`):** adicionar `https://*.sentry.io` em `connect-src` para o transport funcionar.

**8. `docs/RUNBOOK.md`:** seção "Observability — Sentry" explicando como criar projeto Sentry e setar `VITE_SENTRY_DSN` no Lovable env.

**Decisão sobre DSN:**
- Não vou pedir o DSN agora — o init é tolerante a DSN vazio (no-op). Usuário ativa quando criar o projeto Sentry. Isso destrava o código sem bloquear no input.

**Validação:**
- App carrega sem Sentry DSN (modo dev) — sem warnings.
- Com DSN setado, erro forçado em ErrorBoundary aparece no Sentry.
- Bundle size: Sentry adiciona ~40kb gzipped, aceitável.

**Arquivos:**
- `package.json` (dep `@sentry/react`)
- `src/lib/sentry.ts` (novo)
- `src/main.tsx` (chamada init)
- `src/lib/logger.ts` (forward)
- `src/components/shared/ErrorBoundary.tsx` (capture)
- `vite.config.ts` (define version)
- `index.html` (CSP connect-src)
- `docs/RUNBOOK.md` (seção)
