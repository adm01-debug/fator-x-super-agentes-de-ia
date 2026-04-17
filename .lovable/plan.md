
Sprint 21 (Lighthouse CI) completo ✅. Score 10/10 mantido. Última candidata da fila: 🟢 **Sprint 22 — Playwright auth E2E expansion (último item da auditoria)**.

## Por que esta agora
É o único item restante. Fecha o ciclo de auditoria com cobertura E2E real do fluxo crítico (auth = porta de entrada). Estratégia para evitar fricção de credenciais OTP/Google: usar **service role do Supabase para criar usuário sintético**, fazer login via senha (provider `email` clássico) — sem depender de OAuth real ou inbox.

## Plano

**1. `tests/e2e/auth.spec.ts` (novo):**
- `beforeAll`: cria usuário sintético via service role (`*@e2e-tests.invalid`, senha aleatória) — reusa padrão de `tests/rls/setup.ts`
- `afterAll`: deleta o usuário
- Cenários:
  - **Login válido**: preenche email+senha → submit → assert redirect para `/dashboard` ou `/agents`
  - **Login inválido**: senha errada → assert toast/mensagem de erro → permanece em `/auth`
  - **Logout**: após login, click no botão logout → assert redirect para `/auth`
  - **Rota protegida sem auth**: `goto('/agents')` direto → assert redirect para `/auth`
  - **Sessão persiste em reload**: login → `page.reload()` → continua autenticado

**2. `tests/e2e/helpers/auth-fixtures.ts` (novo):**
- `createE2EUser()` / `deleteE2EUser()` — wrapper sobre service role admin API
- `loginViaUI(page, email, password)` — helper reutilizável
- Auto-skip se `SUPABASE_SERVICE_ROLE_KEY` ausente (espelha padrão RLS tests)

**3. `playwright.config.ts`:** verificar/ajustar:
- `baseURL` aponta para preview server local (`http://localhost:8080` ou similar do Vite)
- `webServer` config: `npm run preview` com `reuseExistingServer: !process.env.CI`
- `testDir: "tests/e2e"`

**4. `package.json`:** scripts:
- `"test:e2e": "playwright test"`
- `"test:e2e:ui": "playwright test --ui"`
- `"test:e2e:auth": "playwright test tests/e2e/auth.spec.ts"`

**5. `.github/workflows/ci.yml`:** ajustar job `e2e-tests`:
- Adicionar env: `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY` (do secrets do repo)
- Step: `npm run build && npm run preview &` (background) + wait + `npx playwright test`
- Sem secrets → step skipa graciosamente (mensagem clara no log)

**6. `docs/RUNBOOK.md`:** seção "Auth E2E Tests":
- Como rodar local (env + `npm run test:e2e`)
- Cenários cobertos (tabela)
- Política: usuário sintético dedicado, nunca produção
- Como debugar (UI mode, traces, screenshots on failure)

**7. `mem://features/audit-improvements`:** Sprint 22 logged + **`Next candidates` zerado** — auditoria 100% completa.

## Arquivos
- `tests/e2e/auth.spec.ts` (novo)
- `tests/e2e/helpers/auth-fixtures.ts` (novo)
- `playwright.config.ts` (ajuste se necessário)
- `package.json` (3 scripts)
- `.github/workflows/ci.yml` (env + ajuste do job e2e)
- `docs/RUNBOOK.md` (seção)
- `.lovable/memory/features/audit-improvements.md` (append final)

## Validação
- `npm run test:e2e` local com env passa todos os 5 cenários
- Sem env: suite skipa com warning, CI verde
- Após merge, fila de auditoria = vazia, score 10/10 consolidado
