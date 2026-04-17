
Próxima melhoria: 🔴 **Wave 1 — Quick Win #2: Injetar headers de segurança (CSP, HSTS, X-Content-Type-Options, Referrer-Policy, Permissions-Policy)**.

## Problema
`index.html` não envia headers de segurança modernos. CSP foi removido anteriormente para destravar o Vite, ficou pendente reintrodução em modo compatível. Sem CSP/HSTS o app fica exposto a XSS reflexivo, clickjacking via iframe terceiro e downgrade TLS.

## Plano

**1. `index.html` — injetar via `<meta http-equiv>` (compatível com Lovable preview):**
- `Content-Security-Policy` permissivo o suficiente para Vite + Supabase + Lovable preview:
  - `default-src 'self'`
  - `script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co https://*.lovable.app https://*.lovable.dev`
  - `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`
  - `font-src 'self' data: https://fonts.gstatic.com`
  - `img-src 'self' data: blob: https:`
  - `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.lovable.app https://*.lovable.dev`
  - `frame-ancestors 'self' https://*.lovable.app https://*.lovable.dev` (permite preview embed)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(), microphone=(self), geolocation=(), payment=()` — microphone permitido pra Voice Agent (#8)
- ⚠️ HSTS e X-Frame-Options **não funcionam via meta** — só via header HTTP. Documentar em `RUNBOOK.md` que produção (Lovable hosting) já injeta HSTS automaticamente via CDN.

**2. `RUNBOOK.md` (criar se não existir):** seção "Security Headers" listando o que está em meta vs o que vem do edge.

**Validação:**
- Abrir DevTools → Network → ver response headers do HTML.
- Console sem erros de CSP bloqueando assets legítimos.
- Re-run security scan.

**Arquivos:**
- `index.html` (injeção de 5 metas)
- `RUNBOOK.md` (nova seção ou criar arquivo)
