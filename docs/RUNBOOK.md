# Runbook Operacional — Nexus Agents Studio

## Deploy

### Pre-requisitos
- Node.js 20+
- npm
- Acesso ao Supabase Dashboard (projeto tifbqkyumdxzmxyyoqlu)

### Deploy para producao

```bash
# 1. Verificar que tudo passa
npm run build
npx tsc --noEmit
npx vitest run

# 2. Commitar e pushar
git add -A && git commit -m "release: vX.Y.Z" && git push

# 3. Deploy automatico via Vercel/Netlify (se configurado)
# Ou manual: npm run build && upload dist/ para hosting
```

### Rollback

```bash
# Identificar ultimo commit bom
git log --oneline -10

# Reverter para commit especifico
git revert HEAD --no-edit
git push
```

## SQL Migrations

### Aplicar migration nova

```bash
# No Supabase Dashboard > SQL Editor > New Query
# Colar o conteudo da migration e executar
# Ordem: 001 > 002 > 003 > 004 > 005
```

### Verificar estado do banco

```sql
-- Listar tabelas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Verificar RLS
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';

-- Contar registros
SELECT 'agents' as t, count(*) FROM agents
UNION SELECT 'workspaces', count(*) FROM workspaces
UNION SELECT 'workspace_members', count(*) FROM workspace_members;
```

## Troubleshooting

### Build falha
```bash
# Limpar cache
rm -rf node_modules dist
npm install
npm run build
```

### TypeScript errors
```bash
npx tsc --noEmit 2>&1 | head -20
```

### Testes falhando
```bash
npx vitest run --reporter=verbose
```

### Supabase timeout
- Verificar se o projeto esta ativo no dashboard
- Projetos free hibernam apos 7 dias sem uso
- Clicar "Resume" no dashboard

### API Key invalida
- Verificar na tabela workspace_secrets
- Testar a key diretamente: curl -H "Authorization: Bearer KEY" https://openrouter.ai/api/v1/models

## Contatos

- Repositorio: github.com/adm01-debug/fator-x-super-agentes-de-ia
- Supabase: tifbqkyumdxzmxyyoqlu.supabase.co
- Branch principal: main
- Branch de desenvolvimento: claude/access-repository-7GXcQ
