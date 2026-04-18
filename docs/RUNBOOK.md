# Nexus Agents Studio — Runbook Operacional

## Deploy

O deploy é automático via Lovable:
1. Fazer alterações no código via Lovable Chat
2. Build automático no preview
3. Publicar via botão "Publish" no Lovable

### Rollback
1. Abrir **History** no Lovable (botão no painel lateral)
2. Identificar a versão anterior estável
3. Clicar em "Restore" na versão desejada
4. Verificar preview e publicar novamente

**Tempo estimado de rollback: < 3 minutos**

## Edge Functions

Edge Functions são deployadas automaticamente ao salvar.

### Logs
- Acessar via Lovable Cloud → Edge Function Logs
- Filtrar por nome da função
- Verificar erros com stack trace

## Incidentes

### Severidades
| Sev | Descrição | SLA |
|-----|-----------|-----|
| P1 | Sistema indisponível | 30 min |
| P2 | Feature crítica quebrada | 2h |
| P3 | Bug não-bloqueante | 24h |
| P4 | Melhoria/cosmético | Backlog |

### Procedimento
1. **Detectar** — Alerta, report de usuário, ou monitoramento
2. **Avaliar** — Determinar severidade (P1-P4)
3. **Comunicar** — Notificar stakeholders se P1/P2
4. **Mitigar** — Rollback se necessário, ou hotfix
5. **Resolver** — Implementar correção definitiva
6. **Post-mortem** — Documentar causa raiz e ações preventivas

## Cenários Comuns

### DB Lento
1. Verificar se há queries sem índice (checar `agent_traces`, `audit_log`)
2. Verificar limites do plano Supabase
3. Considerar paginação se estiver carregando muitos registros

### API Externa Fora (Bitrix24)
1. O sistema deve degradar graciosamente
2. Operações locais continuam funcionando
3. Retry automático quando a API voltar

### Erro 401 em Massa
1. Verificar se o Supabase Auth está operacional
2. Verificar se as chaves API não expiraram
3. Limpar cache do browser e relogar

## Security Headers

A defesa em profundidade combina headers via `<meta>` no `index.html` e headers HTTP injetados na borda (Lovable CDN).

### Injetados via `<meta http-equiv>` (no `index.html`)
| Header | Valor (resumido) | Propósito |
|--------|------------------|-----------|
| `Content-Security-Policy` | `default-src 'self'` + allowlists para Supabase, Lovable, fontes Google | Mitiga XSS, exfiltração e injeção de scripts |
| `X-Content-Type-Options` | `nosniff` | Bloqueia MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Reduz vazamento de URL via Referer |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=(), payment=()` | Restringe APIs sensíveis (microfone liberado p/ Voice Agent) |

### Injetados pela borda (Lovable CDN — não funcionam via meta)
| Header | Valor esperado |
|--------|----------------|
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `X-Frame-Options` | `SAMEORIGIN` (e CSP `frame-ancestors` complementa) |

### Validação
1. DevTools → Network → selecionar request do HTML → aba Headers → conferir presença.
2. Console sem violações de CSP em fluxos críticos (auth, dashboards, agents, voice).
3. Re-rodar `security--run_security_scan` após mudanças.

### Mudanças
Qualquer ajuste em CSP deve ser testado em **todas** as integrações (Supabase realtime/auth, OpenRouter, Anthropic, HuggingFace, Lovable preview iframe).

## Contatos
- **Técnico:** Equipe Promo Brindes
- **Suporte Lovable:** https://docs.lovable.dev

## Observability — Sentry

A aplicação está integrada ao Sentry SDK (`@sentry/react`). A inicialização é **tolerante** — sem `VITE_SENTRY_DSN`, o SDK fica em no-op silencioso e não afeta dev local nem produção.

### Ativar Sentry em produção
1. Criar projeto no Sentry → tipo **React** → copiar o DSN.
2. Em **Lovable Cloud → Environment Variables**, setar:
   - `VITE_SENTRY_DSN=https://xxxx@oXXX.ingest.sentry.io/XXX`
3. Rebuild/publish — o SDK ativa automaticamente.

### O que é coletado
- **Erros não capturados** (window.onerror, unhandledrejection)
- **Erros do React ErrorBoundary** com componentStack
- **logger.error / logger.critical** encaminhados via `Sentry.captureException`
- **Performance traces:** `tracesSampleRate: 0.1` (10% das navegações)
- **Session Replay:** apenas em erro (`replaysOnErrorSampleRate: 1.0`), com `maskAllText` e `blockAllMedia`

### PII Scrubbing
O `beforeSend` aplica redaction em chaves sensíveis: `email`, `password`, `token`, `authorization`, `api_key`, `secret`, `cookie`, `session`. `event.user.email` também é mascarado.

### Erros ignorados (ruído conhecido)
- `ResizeObserver loop`
- `Network request failed` / `Failed to fetch` / `Load failed`
- `Non-Error promise rejection captured`

### Release tracking
Cada build injeta `__APP_VERSION__` (de `package.json`) como `release` no Sentry — permite agrupar erros por versão e usar source maps.

### CSP
`connect-src` já inclui `https://*.sentry.io`, `https://*.ingest.sentry.io`, `https://*.ingest.us.sentry.io` e `https://*.ingest.de.sentry.io`.

## RLS Persona Tests

Suite de testes de integração que prova o isolamento cross-tenant das políticas RLS contra um projeto Supabase real. Cobre 8 cenários críticos:

- `agents` — Bob não enxerga / atualiza / deleta agentes da Alice
- `workspace_secrets` — SELECT direto bloqueado, RPC `get_masked_secrets` só funciona para o owner
- `audit_log` — INSERT direto falha, RPC `log_audit_entry` funciona
- `api_keys` — `key_hash` nunca vaza para outros usuários
- `workspace_members` — não-membros recebem zero linhas

### Rodar localmente

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
npm run test:rls
```

> ⚠️ Os testes criam usuários sintéticos (`*@rls-tests.invalid`) e os deletam no `afterAll`. Use **service role do projeto de teste**, nunca produção.

### Comportamento sem env

Sem `SUPABASE_SERVICE_ROLE_KEY` o suite faz `describe.skip` com aviso no console. CI continua verde — opt-in só quando o secret estiver disponível no runner.

### CI

Para ativar em CI, adicionar os 3 secrets ao runner e incluir o step `npm run test:rls` no pipeline. Recomendado rodar contra um projeto Supabase **dedicado a testes**, não produção.

## Coverage Gate

A suite de testes unitários roda com `@vitest/coverage-v8` e thresholds enforced no `vitest.config.ts`. PRs que derrubarem cobertura abaixo dos limites **falham o build**.

### Thresholds atuais
| Métrica | Limite |
|---------|--------|
| Lines | 70% |
| Functions | 70% |
| Statements | 70% |
| Branches | 60% |

Escopo coberto: `src/services/**`, `src/lib/**`, `src/hooks/**`. UI/components ficam fora do gate (cobertos por Playwright).

### Rodar localmente
```bash
npm run test:coverage          # roda + report em terminal + HTML
npm run test:coverage:ci       # versão verbose (usado em CI)
```

Após rodar, abrir `coverage/index.html` no browser para o report navegável (linhas vermelhas = sem cobertura).

### Política
- `all: true` força arquivos não-importados em testes a aparecerem como 0% — evita "cobertura fantasma".
- Novos services em `src/services/` devem ser acompanhados de suíte em `src/test/`.
- Rebaixar threshold só com PR dedicado documentando o débito técnico — nunca silenciosamente.

## Bundle Size Budget

O build gera `dist/bundle-report.html` (treemap navegável via `rollup-plugin-visualizer`) e o script `scripts/check-bundle-size.mjs` valida cada chunk contra `bundle-budget.json`. PRs que estourarem o orçamento **falham o CI**.

### Rodar localmente
```bash
npm run build              # gera dist/ + bundle-report.html
npm run check:bundle       # valida contra bundle-budget.json
npm run build:analyze      # build + dica para abrir o report
```

Abrir `dist/bundle-report.html` no browser para visualizar o treemap (gzip + brotli sizes lado a lado).

### Estratégia de chunks (vite.config.ts)
| Chunk | Conteúdo | Racional |
|-------|----------|----------|
| `vendor-react` | react, react-dom, react-router-dom | Core runtime, cache longo |
| `vendor-supabase` | @supabase/supabase-js | API client, isolado para invalidação seletiva |
| `vendor-query` | @tanstack/react-query | State async, raramente muda |
| `vendor-ui` | sonner | UI primitives compartilhadas |
| `index` | App code | Tudo que não é vendor |

### Orçamentos atuais (gzip KB)
Ver `bundle-budget.json` na raiz. Total: 1200 KB. Limites por chunk derivados do baseline pós-Sentry (Sprint 16) com folga de ~15%.

### Política
- **Estourar o budget falha o build** — sem exceção silenciosa.
- Para subir um limite: PR dedicado editando `bundle-budget.json` com justificativa no commit body (nova feature, dep nova, etc.).
- Antes de subir, sempre tentar primeiro: code-splitting com `lazy()`, remoção de deps redundantes, tree-shaking review via `bundle-report.html`.
- Warnings (>85% do limite) são amarelos no output — sinal pra agir antes de virar erro vermelho.

## Dependency Freshness

Dependabot roda semanalmente (segunda 06:00 UTC) e abre PRs agrupados para manter deps npm + GitHub Actions atualizadas. Config: `.github/dependabot.yml`.

### Grupos de PR
| Grupo | Conteúdo | Racional |
|-------|----------|----------|
| `react` | react, react-dom, react-router-dom, @types/react* | Core runtime — bump conjunto evita mismatch |
| `supabase` | @supabase/* | API client — versionamento alinhado |
| `sentry` | @sentry/* | Observability SDK — bump conjunto |
| `radix` | @radix-ui/* | UI primitives — alta frequência de patches |
| `dev-dependencies` | Todos devDeps minor/patch | Reduz ruído (vitest, eslint, types, etc.) |
| `github-actions` | Workflows CI | actions/checkout, setup-node, etc. |

Limite: 5 PRs npm + 3 PRs Actions abertos simultaneamente — evita spam.

### Política de revisão
- **Minor/patch**: CI verde (lint + test + coverage + bundle budget) → merge direto.
- **Major bumps**: revisão manual obrigatória + smoke test em preview. React/react-dom major estão **ignorados** no Dependabot — upgrade requer plano de migração dedicado.
- **CVE crítico**: priorizar imediato, mesmo fora da janela semanal.

### Pausar/desabilitar uma dep
Comentar no PR do Dependabot:
- `@dependabot ignore this dependency` — pula essa lib até nova major
- `@dependabot ignore this minor version` — só pula a versão atual
- `@dependabot rebase` — atualiza branch contra `main`
- `@dependabot recreate` — recria o PR do zero

### Cadence
Segunda-feira de manhã: revisar fila de PRs `dependencies` no GitHub. Merge em batch reduz overhead.

## Performance Budget — Lighthouse CI

Lighthouse CI roda em PRs (job `lighthouse` no `.github/workflows/ci.yml`) contra o build estático em `dist/`. Configuração: `lighthouserc.json`.

### Rodar localmente
```bash
npm run lhci:local        # build + autorun (3 runs por URL, média)
npm run lhci              # só autorun (assume dist/ pronto)
```

Após executar, os reports HTML ficam em `.lighthouseci/` e um link público temporário é impresso no terminal (válido ~7 dias).

### URLs auditadas
| URL | Por quê |
|-----|---------|
| `/index.html` | Entrypoint SPA — mede LCP/CLS/TBT do shell inicial |
| `/auth` | Rota pública crítica — mede performance do fluxo de login |

### Assertions (preset desktop)
| Métrica | Limite | Severidade |
|---------|--------|------------|
| `categories:performance` | ≥ 0.85 | warn |
| `categories:accessibility` | ≥ 0.95 | **error** |
| `categories:best-practices` | ≥ 0.90 | **error** |
| `categories:seo` | ≥ 0.90 | warn |
| `largest-contentful-paint` | ≤ 2500ms | warn |
| `cumulative-layout-shift` | ≤ 0.1 | **error** |
| `total-blocking-time` | ≤ 300ms | warn |

`error` falha o job; `warn` aparece amarelo no log mas não bloqueia merge.

### Política
- **Acessibilidade < 0.95 ou CLS > 0.1**: blocker — investigar antes de merge (regressão de a11y/UX é dívida cara).
- **Performance < 0.85**: warning — abrir issue para investigar (chunk pesado, imagem não otimizada, render-blocking script).
- **Subir um threshold**: PR dedicado editando `lighthouserc.json` com justificativa (nova feature pesada, third-party adicionada, etc.).
- **Baixar um threshold**: requer aprovação do tech lead + issue rastreando o débito técnico.

### Como ler o report
1. Acessar o link público impresso no log do CI (ou abrir `.lighthouseci/lhr-*.html` localmente).
2. Aba **Performance** → "Opportunities" lista quick wins (defer scripts, optimize images, etc.).
3. Aba **Diagnostics** → mostra main-thread work breakdown.
4. Comparar com run anterior via aba **Compare** (Lighthouse server) ou diff manual.

### Limitações conhecidas
- Roteamento client-side: Lighthouse audita só o HTML estático servido — não navega para rotas SPA pós-hidratação. Para auditar rotas autenticadas, use Playwright + Lighthouse programático (futuro Sprint).
- Tempo de CI: +60-90s no pipeline. Job roda em paralelo com `e2e-tests` para minimizar wall-clock.
- Variação entre runs: usar `numberOfRuns: 3` (média) reduz mas não elimina ruído. Re-run em caso de flake suspeita.

## Auth E2E Tests

Cobertura E2E real do fluxo de autenticação usando **usuários sintéticos criados via service role**. Suite: `e2e/auth-flows.spec.ts` (login real). Complementa `e2e/auth.spec.ts` que cobre validação de UI sem backend.

### Estratégia
Cada teste cria um usuário `*@e2e-tests.invalid` via `auth.admin.createUser` (email_confirm: true), faz login via UI com email+senha clássico, e deleta o usuário no `afterAll`. Sem dependência de OTP, inbox ou OAuth real.

### Rodar localmente

```bash
SUPABASE_SERVICE_ROLE_KEY=eyJ... \
SUPABASE_URL=https://xxx.supabase.co \
SUPABASE_ANON_KEY=eyJ... \
npm run test:e2e:auth
```

Outros comandos:
```bash
npm run test:e2e          # roda todos os specs em e2e/
npm run test:e2e:ui       # modo UI (debug interativo, traces, time-travel)
```

> ⚠️ Use **service role do projeto de teste**, nunca produção. Os usuários sintéticos são deletados no `afterAll`, mas em caso de falha do hook eles ficam identificáveis pelo TLD `@e2e-tests.invalid`.

### Cenários cobertos
| Cenário | Asserção |
|---------|----------|
| Login válido | Redirect para fora de `/auth` em ≤15s |
| Login inválido | Permanece em `/auth` + mensagem de erro visível |
| Rota protegida sem auth | `/agents` → redirect para `/auth` |
| Sessão persiste em reload | `page.reload()` mantém pathname autenticado |
| Logout | Click em botão sair → redirect para `/auth` |

### Comportamento sem env
Sem `SUPABASE_SERVICE_ROLE_KEY` o suite `auth-flows.spec.ts` faz `test.skip` com mensagem clara. CI continua verde — opt-in só quando o secret estiver disponível no runner. O job `e2e-tests` no CI imprime warning explícito no log quando skip ocorre.

### CI
Para ativar em CI, adicionar 3 secrets ao repo: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`. Recomendado apontar para projeto Supabase **dedicado a testes**.

### Debug
- **UI mode**: `npm run test:e2e:ui` abre o inspector com time-travel de cada step
- **Traces**: configurados em `playwright.config.ts` via `lovable-agent-playwright-config` — gerados on-failure
- **Screenshots**: capturados automaticamente no momento da falha e anexados ao `playwright-report/`
- **CI artifacts**: report HTML disponível em "Artifacts" do run do GitHub Actions (retenção padrão 90 dias)

## Mobile Performance + Runtime A11y (Sprint 23)

### Multi-profile Lighthouse
O CI roda Lighthouse em **dois perfis** via matrix (`desktop`, `mobile`). Cada um upa artifact separado (`lighthouse-report-desktop` / `lighthouse-report-mobile`) e link público no log do PR.

| Métrica | Desktop | Mobile | Razão |
|---------|---------|--------|-------|
| Performance | ≥ 0.85 | ≥ 0.75 | Mobile = CPU 4× mais lenta + rede 3G simulada |
| Accessibility | ≥ 0.95 | ≥ 0.95 | A11y é responsabilidade independente de device |
| Best Practices | ≥ 0.90 | ≥ 0.90 | HTTPS/console errors/etc — independente de device |
| SEO | ≥ 0.90 | ≥ 0.90 | Mantido |
| LCP | ≤ 2500 ms | ≤ 4000 ms | Web Vitals threshold "good" (2.5s) e "needs improvement" (≤4s) |
| CLS | ≤ 0.10 | ≤ 0.10 | Layout não muda por device |
| TBT | ≤ 300 ms | ≤ 600 ms | CPU mobile dobra o budget de blocking |

Comandos locais:
```bash
npm run lhci         # desktop
npm run lhci:mobile  # mobile
npm run lhci:local   # roda os dois sequencialmente (build + ambos)
```

### Runtime A11y via axe-core
Lighthouse audita o DOM **estático**. Para regressões dinâmicas (dialog aberto, focus trap, ARIA dinâmico) usamos `@axe-core/playwright` em cada spec E2E.

Helper: `e2e/helpers/a11y.ts` → `expectNoA11yViolations(page, testInfo, opts?)`.

| Impact | Comportamento |
|--------|---------------|
| `critical` | ❌ Falha o teste |
| `serious` | ❌ Falha o teste |
| `moderate` | ⚠️ Console warning + anexa JSON ao report |
| `minor` | ⚠️ Console warning + anexa JSON ao report |

Configuração padrão: tags `wcag2a + wcag2aa + wcag21aa`. Override via `opts.tags`/`opts.exclude`/`opts.failOn`.

#### Como interpretar uma violation
Cada violation traz:
- `id` — regra axe (ex: `color-contrast`, `button-name`, `label`)
- `helpUrl` — link Deque com fix recomendado
- `nodes[].target` — selector CSS do elemento problemático

Em CI, violations bloqueantes geram `axe-violations.json` anexo ao run do Playwright (em `playwright-report/`).

### Política
- Adicione `await expectNoA11yViolations(page, testInfo)` em **toda nova spec E2E** que renderize tela visualmente significativa
- Para warnings (`moderate`/`minor`): triagem no daily, não bloqueiam merge
- `excludes` só com justificativa em comentário (ex: widget terceiro sem ARIA fix)

## Visual Regression Tests (Sprint 24)

Pixel-diff guard usando `playwright.toHaveScreenshot()`. Baselines commitados em `e2e/__screenshots__/`.

### Quando roda
- A cada PR no job `e2e-tests` (`npx playwright test`)
- Local: `npm run test:e2e:visual`

### Cenários cobertos (`e2e/visual.spec.ts`)
| Cenário | Viewport | Snapshot |
|---|---|---|
| Auth login (desktop) | 1280×720 | `auth-desktop.png` |
| Auth login (mobile) | 375×667 | `auth-mobile.png` |
| Auth signup variant | 1280×720 | `auth-signup-desktop.png` |
| Protected redirect (`/agents` → `/auth`) | 1280×720 | `auth-after-redirect.png` |

### Tolerância
- `threshold: 0.2` (anti-aliasing)
- `maxDiffPixelRatio: 0.01` (1% pixels podem divergir)
- `animations: "disabled"` em todos os shots

### Atualizar baseline (mudança intencional)
```bash
npm run test:e2e:update           # regenera todos os snapshots
git add e2e/__screenshots__/
git commit -m "chore(visual): update baseline — <razão>"
```
**Política:** PR de update de baseline requer 1 reviewer aprovando visualmente cada PNG novo.

### Falha não intencional
- CI falha o job `e2e-tests` com diff
- Artifact `visual-regression-diffs` contém:
  - `test-results/<test>/...-diff.png` (vermelho = pixels diferentes)
  - `test-results/<test>/...-actual.png` (renderização atual)
  - `test-results/<test>/...-expected.png` (baseline)
- Baixar artifact, inspecionar, decidir: bug ou update intencional

### Ignorar resultados ephemerais
`test-results/` e `playwright-report/` são gerados por run e devem ser ignorados pelo VCS (configurado no `.gitignore` global; verificar localmente se `git status` mostra esses dirs sujos).

---

## Load Testing — k6 (Sprint 25)

Performance guard for critical edge functions. Runs in CI per PR (smoke) and on-demand (full load via `load-test` label).

### Critical endpoint coverage
| Function | Why | Script |
|---|---|---|
| `llm-gateway` | Hot path for every chat/agent run; latency directly impacts UX | `tests/load/llm-gateway.k6.js` |

### Thresholds (any breach = exit code 1)
| Metric | Limit |
|---|---|
| `http_req_duration p(95)` | < 2000 ms |
| `http_req_duration p(99)` | < 5000 ms |
| `http_req_failed rate` | < 1 % |
| `checks rate` | > 95 % |
| `llm_gateway_success rate` | > 95 % |

### Modes
| Mode | Profile | When |
|---|---|---|
| Smoke | 1 VU × 30s | Every PR (sanity, ~10s job) |
| Full load | ramp 0→20 VUs / 1m + sustain 3m + ramp-down 30s | Label `load-test` on PR, OR manually before major releases |

### Commands
```bash
npm run test:load:smoke    # 30s sanity check
npm run test:load          # ~5min full ramp
```

### Policy
- **Run full load** before any release that touches `llm-gateway`, `smart-model-router`, or `chat-completion` paths.
- **Re-baseline thresholds** after instance upgrade or model swap (3× runs → median P95 + 20% headroom).
- **CI artifact** `k6-summary` (summary.json) preserved for 90d for trend analysis.

### Reading P95/P99 spikes
- **P95 spike, P99 stable** → tail latency on a subset of VUs (cold-start, auth slow path)
- **P99 spike** → infrastructure issue (DB lock, downstream API throttle)
- **Failed rate > 1%** → endpoint regression — check edge function logs in same window

### Skip behaviour
If `SUPABASE_SERVICE_ROLE_KEY` is missing the script emits a warning and exits early — CI stays green. Add the secret to enable real load coverage.

See full runbook: `tests/load/README.md`.

---

## Distributed Tracing — OpenTelemetry (Sprint 26)

End-to-end trace correlation across **client → edge function → LLM provider** using W3C Trace Context. Closes the observability triangle started in Sprint 16 (client) and Sprint 25 (load metrics).

### Architecture
```
Browser (src/lib/tracing.ts)
  ├─ trace_id: 32-hex
  └─ span: edge.llm-gateway
        ↓ injects header `traceparent: 00-{traceId}-{spanId}-01`
Edge Function (supabase/functions/_shared/otel.ts)
  ├─ continues SAME trace_id (W3C parsing)
  ├─ root span: llm-gateway.handle (kind=server)
  └─ child spans:
       ├─ auth.verify (kind=auth)
       ├─ provider.call (kind=llm) — gen_ai.* attributes
       └─ db.* (kind=db)
        ↓ exports to Supabase tables `traces` + `spans`
```

### Instrumented edge functions
| Function | Root span | Key sub-spans |
|---|---|---|
| `llm-gateway` | `llm-gateway.handle` | `auth.verify`, `provider.call` |
| `agent-workflow-runner` | `agent-workflow-runner.handle` | `auth.verify`, `db.workflow_load`, `node.<type>` per workflow node |

### Naming conventions (OTel semantic)
- **Root span** = `<function>.handle`
- **Sub-spans** = `<domain>.<verb>` (e.g., `auth.verify`, `db.query`, `provider.call`)
- **GenAI attributes** on LLM spans: `gen_ai.system`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`, `cost.usd`
- **HTTP attributes** on root: `http.method`, `http.route`, `http.status_code`

### Response headers
Every instrumented edge function response includes:
- `x-trace-id: <32-hex>` — paste into Langfuse or `traces` table to inspect

### Debugging a slow request
1. Find `trace_id` in response body (`trace_id` field) or `x-trace-id` header
2. Query `SELECT * FROM spans WHERE trace_id = '<id>' ORDER BY start_time` — waterfall sorted
3. Look for: span with highest `duration_ms`, any `status='error'` with `status_message`
4. Cross-reference with `agent_traces` for the same `session_id`/`agent_id`

### Failure modes (graceful)
- Tracing exporter fails → swallowed silently (handler unaffected)
- Client doesn't send `traceparent` → edge generates new `trace_id` (no parent linkage but still traced)
- Malformed `traceparent` → ignored, new `trace_id` generated


---

## SLO Monitoring (Sprint 27)

Real-time view of Service Level Objectives, available at `/observability/slo`.

### SLO Targets

| Metric            | Target          | Warning at | Source                           |
| ----------------- | --------------- | ---------- | -------------------------------- |
| Success rate      | ≥ 99%           | < 99.5%    | `agent_traces.level <> 'error'`  |
| Latency P95       | < 2000 ms       | > 1600 ms  | `agent_traces.latency_ms`        |
| Latency P99       | < 5000 ms       | > 4000 ms  | `agent_traces.latency_ms`        |
| Error budget (mo) | ≤ 1% errors     | > 50% used | rolling 30 day window            |

### Architecture
- **View** `slo_metrics_hourly` — invoker-rights, inherits RLS from `agent_traces`
- **RPC** `get_slo_summary(p_window_hours)` — security-definer; returns aggregated JSON for `auth.uid()` only
- **UI** `src/pages/SLODashboard.tsx` — auto-refreshes every 60s, supports 1h / 6h / 24h / 7d windows
- **Alerts** `src/hooks/useSLOAlerts.ts` — polls every 5 min; toasts on breach with link to dashboard; deduplicates per-session

### Burn rate interpretation
- **Error budget consumed** = (actual error rate / target error rate) × 100
- 0–50% = healthy, on-track for the month
- 50–100% = warning, slow down risky deploys
- 100%+ = breach, freeze non-critical changes; investigate root cause via traces

### Response to a breach
1. Open `/observability/slo` → identify which SLO failed (P95? success rate?)
2. Top 5 worst agents table → click affected agent → `/agents/:id` → review recent runs
3. Cross-reference with traces (`trace_id` from agent runs)
4. If provider issue: check `cost-optimizer` for fallback availability
5. Communicate via status page if user-impacting

### Failure modes
- Empty data (`total_traces = 0`) → empty state with CTA "Ir para Agentes"
- RPC fails → toast error, dashboard remains last good snapshot
- Alert hook fails silently (logger.error) — does not interrupt UX

## Chaos Engineering (Sprint 28)

Injeção controlada de falhas (latência, erros 500/429, timeouts) nas edge functions críticas para validar resiliência: retry, fallback, alertas e SLOs.

### Targets instrumentados

| Edge function            | Falhas suportadas                    |
| ------------------------ | ------------------------------------ |
| `llm-gateway`            | latency, error_500, error_429, timeout |
| `agent-workflow-runner`  | latency, error_500, error_429, timeout |

### Hard safety limits

- **Probabilidade máx**: 50% (CHECK constraint na coluna)
- **Duração máx**: 1 hora (CHECK constraint `expires_at - created_at`)
- **Latência máx**: 10.000ms
- **Auto-expira**: faults com `expires_at < now()` são ignorados pelo middleware
- **Kill switch**: RPC `disable_all_chaos(workspace_id)` desativa tudo em 1 call (admin only)
- **Cache 5s** no edge: minimiza queries em cada request, mas garante que kill switch propaga em ≤5s

### Como executar primeiro experimento

1. Acesse `/observability/chaos` (requer permissão `settings.api_keys`)
2. Crie experimento: target=`llm-gateway`, fault=`latency`, probability=`5%`, latency=`500ms`, duration=`10min`
3. Banner amber aparece em todo app
4. Faça 50+ chamadas reais ao agente
5. Abra `/observability/slo` — P95 deve subir; success rate deve permanecer alto (latency não erra)
6. Para teste de erro: troque `fault_type` para `error_500` — alertas SLO devem disparar

### Validações esperadas

| Falha       | Comportamento esperado                                            |
| ----------- | ------------------------------------------------------------------ |
| latency     | P95 sobe; success rate inalterado; spans `chaos.inject` no trace   |
| error_500   | Trace mostra erro; agent_traces.level=`error`; toast SLO alert     |
| error_429   | Cliente vê 429; backoff/retry deve ativar (se implementado)         |
| timeout     | Request expira em ~30s; trace marcado `error`                      |

### Política operacional

- ❌ Nunca rodar em produção sem comunicação prévia ao time
- ❌ Nunca subir probabilidade > 10% sem rodar smoke a 5% antes
- ✅ Sempre `expires_at` curto (10–30min é típico)
- ✅ Acompanhar SLO Dashboard durante o experimento
- ✅ Usar kill switch ao primeiro sinal de impacto inesperado a usuários

### Failure modes graceful

- Tabela `chaos_experiments` indisponível → `maybeInjectFault` retorna `null`, zero impacto
- RPC `get_active_chaos_faults` falha → cache vazio, próxima tentativa em 5s
- Sem experimentos ativos → 1 query rápida (filtered index `idx_chaos_active`), depois cache

## Synthetic Monitoring (Sprint 29)

Pings periódicos automáticos 24/7 simulando jornadas críticas. Detecta degradação **mesmo sem tráfego real** — fecha o ciclo: chaos (proativo) + SLO (reativo a tráfego) + synthetic (reativo 24/7).

### Como criar um check
1. UI: `/observability/synthetic` → "Novo check"
2. Targets disponíveis: `llm-gateway`, `agent-workflow-runner`, `health` (REST ping)
3. Intervalo: 1–60 minutos (recomendado: 5min)
4. Threshold latência: 100–30000ms (recomendado: 3000ms para LLM, 1000ms para health)

### Como funciona
- pg_cron dispara `synthetic-runner` a cada 1 minuto
- Edge function lê todos os checks `enabled=true` cujo `last_run_at + interval ≤ now()`
- Para cada um: faz request real ao target, mede latência, insere `synthetic_results`
- Falhas (5xx + network errors + latência > threshold) incrementam `consecutive_failures`
- `success=false` é propagado via Supabase Realtime → toast global no app (`SyntheticAlertsMounter`)

### Política de threshold
- LLM endpoints: 3000–5000ms (provider variabilidade alta)
- Workflow runner: 5000ms (pode incluir múltiplas chamadas LLM)
- Health REST: 1000ms (deve ser instantâneo)
- 4xx **não conta como falha** (auth/validation = serviço vivo)

### Troubleshooting
- 0 runs após 5min → verificar `synthetic_runner` cron job: `SELECT * FROM cron.job WHERE jobname='synthetic-runner-every-minute'`
- Falhas constantes mas serviço OK → revisar threshold (latência alta?)
- Toast spam → ajustar threshold para cima ou disable check temporariamente
- Disable individual: switch no card; disable global: `UPDATE synthetic_checks SET enabled=false`

---

## Cost Anomaly Detection (Sprint 30)

Detecção proativa de spikes anormais de custo via z-score estatístico contra baseline rolling de 14 dias.

### Como funciona
1. **Baselines** (`compute_cost_baselines`): cron diário 3h agrega `agent_traces` últimos 14 dias por (workspace, agent, hora-do-dia, dia-da-semana) → calcula avg + stddev
2. **Detecção** (`detect_cost_anomalies`): cron 15min compara spend última hora vs baseline da mesma hora/dia → z-score = (observed - avg) / stddev
3. **Alerta**: se z > 2σ E observed > $0.10 → insere `cost_alerts` (severity warning ≥2σ, critical ≥3σ); dedupe 1h por scope
4. **Realtime**: toast global via `CostAnomalyAlertsMounter`

### Interpretação de z-score
| z-score | Severidade | Significado |
|---------|-----------|-------------|
| < 2σ | — | Dentro do esperado, sem alerta |
| 2σ–3σ | warning | ~5% chance de ser ruído estatístico — investigar |
| > 3σ | critical | <0.3% chance de ruído — quase certeza de anomalia real |

### Causas comuns
- **Loop de retry** em agente (mesma chamada N vezes por timeout/erro)
- **Modelo errado em prod** (gpt-5 vs flash-lite — 50× mais caro)
- **Prompt injection** inflando contexto (usuário malicioso adicionando instruções longas)
- **RAG explosion** (top_k aumentado sem revisão)
- **Spike legítimo** (lançamento, campanha) — acknowledge e ignore

### Resposta a alerta crítico
1. Abrir `/observability/cost-anomalies` → identificar agent/scope
2. Click "Investigar traces" → ver últimas execuções com `cost_usd` alto
3. Se loop de retry → pause agent (`status=paused`) imediatamente
4. Se modelo errado → corrigir config + redeploy
5. Acknowledge alerta após mitigação

### Falsos positivos comuns
- Primeiras 14 dias sem histórico → `sample_count < 3` ignorado pelo detector
- Madrugada com tráfego ~0 → stddev ~0, z indefinido (filtro embutido)
- Pico legítimo recorrente (ex: campanha semanal) → será absorvido pelo baseline em 1–2 semanas

### Operação
- Recomputar baseline manual: `SELECT public.compute_cost_baselines();`
- Detectar agora: botão "Detectar agora" na UI ou `SELECT public.detect_cost_anomalies();`
- Ver crons: `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'cost-%';`
- Acknowledge requer admin do workspace

## Budget Enforcement (Sprint 31)

Sistema de orçamento com bloqueio automático em `/settings/budget`.

### Conceito
- **Soft warning**: ao atingir `soft_threshold_pct` (default 80%) → toast amber + header `X-Budget-Warning`
- **Hard stop**: ao atingir 100% (se `hard_stop=true`) → 402 Payment Required + agentes ativos pausados automaticamente
- Períodos independentes: mensal e diário (qualquer um pode disparar)

### Fluxo de enforcement
1. Cron `enforce-budget-every-5min` chama `enforce_budget()`
2. RPC agrega gasto do período via `agent_traces.cost_usd`
3. Se ≥ limite com `hard_stop`: insere `budget_events.hard_block` + `UPDATE agents SET status='paused'` + insere `agent_paused`
4. Se ≥ threshold: insere `soft_warning` (dedupe 6h)
5. `BudgetEventsMounter` (realtime) emite toast global

### Resposta a hard_block
1. Verificar se gasto é legítimo (revisar traces)
2. Se sim → aumentar limite em `/settings/budget` e clicar "Resetar e reativar agentes"
3. Se não → investigar causa (loop runaway? prompt injection?) ANTES de resetar
4. Reset chama `reset_workspace_budget()`: reativa agents + registra evento

### Operação
- Verificação manual: `SELECT public.check_budget('WORKSPACE_ID');`
- Forçar enforce: `SELECT public.enforce_budget();`
- Reset: `SELECT public.reset_workspace_budget('WORKSPACE_ID');` (requer admin)
- Ver crons: `SELECT jobname, schedule FROM cron.job WHERE jobname LIKE '%budget%';`

### Boas práticas
- Sempre configurar limite diário ~ 1/15 do mensal (evita queima do mês em 1 dia)
- Manter `hard_stop=false` em dev/staging, `true` em produção
- Threshold 80% dá ~6h de margem para reagir antes do hard block

## Game Days

Drills programados de resposta a incidentes em `/observability/game-days`. Treinam a equipe sob pressão controlada.

### Cadência recomendada
- **Mensal**: 1 game day por mês, alternando cenários (provider_outage → cost_spike → db_slowdown → auth_failure)
- **Pré-release**: drill antes de releases major
- **Pós-incidente**: replay do incidente real como game day para validar fix do runbook

### Cenários disponíveis
| Cenário | Chaos automático | Runbook section |
|---|---|---|
| `provider_outage` | `llm-gateway` × `error_500` × 50% | "LLM Provider Falhou" |
| `db_slowdown` | `agent-workflow-runner` × `latency` × 2s | Resposta a degradação |
| `auth_failure` | `llm-gateway` × `error_429` × 50% | "Rate limit / 429" |
| `cost_spike` | sem chaos auto (manual via cost-anomalies) | "Anomalia de Custo" |
| `custom` | sem chaos auto | livre |

### Fluxo de execução
1. **Agendar** com 48h+ de antecedência, notificar participantes
2. **Iniciar** (botão "Iniciar"): muda status → running, opcionalmente injeta chaos
3. **War room** em `/observability/game-days/:id/live`:
   - Timer ao vivo
   - Botões: "Detectado" / "Mitigando" / "Resolvido" / "Adicionar nota"
   - Timeline em realtime (todos veem ao mesmo tempo)
4. **Encerrar**: gera scorecard com MTTR/MTTD calculados automaticamente

### Critérios de score (1-10)
- **9-10**: MTTR < 5min, runbook seguido 100%, zero gaps
- **7-8**: MTTR < 15min, runbook seguido com pequenos desvios, 1-2 gaps menores
- **5-6**: MTTR < 30min, alguns passos improvisados, gaps em ferramentas
- **1-4**: MTTR > 30min OU runbook insuficiente OU gap crítico (sem alerta, sem permissão, etc.)

### Obrigatório no scorecard
- Listar TODOS os gaps (mesmo cosméticos): tooling, runbook, alerta, comunicação
- Retrospectiva com ações concretas + dono + prazo
- Score honesto: prefira 6 com lições aprendidas a 10 inflado

### Operação
- Iniciar via SQL: `SELECT public.start_game_day('GAMEDAY_ID', true);` (true = injeta chaos)
- Encerrar manualmente: `SELECT public.complete_game_day('GAMEDAY_ID', true, ARRAY['gap1','gap2'], 8, 'notas');`
- Limpar chaos após game day: chaos_experiment é desabilitado automaticamente no `complete_game_day`

## Sprint 33 — Incident Response Automation

Playbooks executáveis disparam automaticamente em condições críticas para reduzir MTTR.

### Componentes
- **Playbooks** (`/observability/playbooks`): definição de trigger + actions sequenciais
- **On-Call** (`/observability/oncall`): escala de plantões com ordem de escalação
- **Edge function**: `incident-orchestrator` executa cada action e registra em `incident_runs`

### Tipos de trigger
- `slo_breach` — quando SLO violado (latência ou success rate)
- `synthetic_fail` — quando synthetic check falha N vezes
- `cost_anomaly` — quando z-score de custo > 2σ
- `budget_block` — quando budget hard cap atingido
- `manual` — disparo manual via UI

### Actions disponíveis
- `notify` — toast realtime para todos os usuários conectados
- `disable_chaos` — desativa todos os chaos experiments do workspace
- `pause_agent` — pausa agente específico (config.agent_id) ou todos os ativos
- `switch_provider` — troca provider LLM (logged para config manual)
- `page_oncall` — busca on-call atual via `get_current_oncall`

### Cooldown
Cada playbook tem `cooldown_minutes` (padrão 5min). Não dispara 2× dentro da janela, evita storms.

### Templates pré-prontos
1. **Provider down → switch + notify**: SLO breach → troca provider + notifica
2. **Cost spike → notify + pause runaway**: anomalia crítica → pausa agentes + notifica
3. **Synthetic fail → page on-call**: 3 falhas consecutivas → aciona plantão

### Override manual
Admin pode desativar playbook a qualquer momento via toggle. Para emergências, `disable_all_chaos(workspace_id)` desliga todo chaos.

### Cadência recomendada
- **Mensal**: revisar `incident_runs` e ajustar cooldown/actions
- **Trimestral**: rotacionar on-call e validar cobertura 24/7
