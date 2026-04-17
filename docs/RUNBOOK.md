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
