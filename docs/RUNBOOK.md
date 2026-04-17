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
