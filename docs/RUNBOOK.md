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
