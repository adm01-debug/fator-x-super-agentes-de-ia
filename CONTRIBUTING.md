# CONTRIBUTING.md — Fator X / Nexus Agents Studio

## Git Flow

- **main**: producao (protegido, requer PR)
- **claude/\***: branches de desenvolvimento
- Commits seguem Conventional Commits: `feat:`, `fix:`, `docs:`, `refactor:`

## Setup Local

```bash
git clone https://github.com/adm01-debug/fator-x-super-agentes-de-ia.git
cd fator-x-super-agentes-de-ia
npm install
cp .env.example .env  # Configurar VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev            # http://localhost:8080
```

## Checklist de PR

- [ ] `npx tsc --noEmit` sem erros
- [ ] `npx eslint src/` sem warnings
- [ ] `npx vitest run` testes passando
- [ ] Commit message segue Conventional Commits
- [ ] Sem `console.log` no codigo (usar `logger` de `@/lib/logger`)
- [ ] Sem `as any` (usar `fromTable()` de `@/lib/supabaseExtended`)

## Estrutura do Projeto

```
src/
├── components/   # UI components (186 arquivos)
├── services/     # Domain services (42 arquivos)
├── hooks/        # React hooks (22 arquivos)
├── stores/       # Zustand stores (8 arquivos)
├── pages/        # Route pages (33 arquivos)
├── config/       # Configuration files
├── lib/          # Utilities (logger, tracing, MCP)
├── types/        # TypeScript types
└── integrations/ # Supabase client + auto-generated types
supabase/
├── functions/    # 39 Edge Functions
├── migrations/   # 66 SQL migrations
└── _shared/      # Shared EF utilities (auth, cors, rate-limit)
```

## Rollback Procedure

1. Identificar o commit anterior: `git log --oneline -5`
2. Reverter no Lovable ou via PR de revert
3. Edge functions: re-deploy versao anterior via Supabase MCP
4. Database: migrations sao forward-only (sem down migrations)

## Hotfix

1. Branch: `git checkout -b hotfix/descricao`
2. Fix + commit + push
3. PR para main com label `hotfix`
4. Merge e deploy imediato
