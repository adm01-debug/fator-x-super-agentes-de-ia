
Próxima melhoria: 🔴 **Wave 1 — Quick Win #3: Habilitar `strict: true` no `tsconfig.json` raiz**.

## Problema
Auditoria identificou que `tsconfig.app.json` já tem strict, mas o root `tsconfig.json` não força — permite que arquivos fora do escopo `app` (configs, scripts) escapem da checagem. Sem strict no root, o type-check global (`tsc --noEmit`) não pega tudo.

## Plano

**1. `tsconfig.json` (root):**
- Adicionar/garantir `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true`, `"noFallthroughCasesInSwitch": true` em `compilerOptions`.
- Manter `skipLibCheck: true` (libs externas).

**2. Validação:**
- Rodar `tsc --noEmit` mentalmente via grep de `: any` em arquivos não-app (vite.config.ts, tailwind.config.ts, etc.) — corrigir tipagens explícitas se quebrar.
- Garantir que `tsconfig.app.json` continua estendendo corretamente.

**3. Atualizar memória:**
- `mem://features/audit-improvements`: adicionar Sprint 15 — strict root tsconfig.

**Arquivos:**
- `tsconfig.json` (1 edição)
- `mem://features/audit-improvements` (append)

Próximas após esta: Sentry SDK, RLS persona tests, vitest coverage gate 70%.
