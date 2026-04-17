
Próxima melhoria: 🟡 **Sprint 1 — Item #2: RLS Persona Tests (pgTAP-style integration tests)**.

## Problema
Temos RLS em todas as tabelas, mas zero testes automatizados que provem que:
- Usuário A não consegue ler dados do workspace de B
- Membro `viewer` não consegue mutar agentes
- `workspace_secrets` continua bloqueado a SELECT
- `workspace_members.email` retorna mascarado para não-owner
- `audit_log` só aceita INSERT via RPC `log_audit_entry`

Sem testes, qualquer migration futura pode silenciosamente abrir um buraco.

## Plano

**1. `tests/rls/personas.test.ts` (novo, vitest + supabase-js):**
- Setup: criar 2 usuários sintéticos via service role + 2 workspaces + roles distintas (owner, member, viewer).
- Cada teste cria 2 clientes Supabase autenticados (`createClient` com JWT de cada user) e valida cross-tenant isolation.

**2. Casos cobertos (8 testes):**
- `agents`: user B não vê agentes do workspace de A (SELECT retorna [])
- `agents`: viewer não consegue UPDATE (erro RLS)
- `workspace_secrets`: nenhum cliente consegue SELECT (mesmo owner) — só RPC `get_masked_secrets`
- `workspace_members`: SELECT por non-owner retorna email mascarado (`***@domain`)
- `audit_log`: INSERT direto falha; `log_audit_entry()` RPC funciona
- `tool_integrations`: SELECT só pelo owner
- `deploy_connections`: SELECT só pelo owner
- `api_keys`: nenhum cliente consegue ler `key_hash`

**3. `tests/rls/setup.ts` (helpers):**
- `createTestUser(email)` — usa service role para `auth.admin.createUser` + retorna JWT.
- `getAuthedClient(jwt)` — `createClient(url, anon, { global: { headers: { Authorization: \`Bearer ${jwt}\` } } })`.
- `cleanup()` — deleta usuários após cada suite via service role.
- Service role key vem de `process.env.SUPABASE_SERVICE_ROLE_KEY` (apenas em CI/local, nunca no bundle).

**4. `vitest.config.ts`:** garantir que `tests/rls/**` rode em `environment: 'node'` separado (não jsdom) — adicionar pattern ou novo project config.

**5. `package.json`:** novo script `"test:rls": "vitest run tests/rls"`.

**6. `docs/RUNBOOK.md`:** seção "RLS Tests" — como rodar local (`SUPABASE_SERVICE_ROLE_KEY=xxx npm run test:rls`) e nota que CI precisa do secret.

**7. Memory update:** `mem://features/audit-improvements` → Sprint 17.

**Decisão sobre service role key:**
- Não pedir agora. Os testes são opt-in por env var. Se ausente, o suite faz `describe.skip` com mensagem clara. Isso permite commit sem bloquear no input do usuário.

**Validação:**
- Rodar `npm run test:rls` localmente após o usuário setar a env (fora do escopo agora — só preparar o terreno).
- Sem env var: suite skipa com warning, build CI continua verde.

**Arquivos:**
- `tests/rls/setup.ts` (novo)
- `tests/rls/personas.test.ts` (novo)
- `vitest.config.ts` (ajuste se necessário)
- `package.json` (script)
- `docs/RUNBOOK.md` (seção)
- `mem://features/audit-improvements` (Sprint 17)
