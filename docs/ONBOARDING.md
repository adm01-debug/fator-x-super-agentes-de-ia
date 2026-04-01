# Onboarding — Novo Desenvolvedor

## Objetivo: Produtivo em < 4 horas

## 1. Setup (30 min)

```bash
git clone https://github.com/adm01-debug/fator-x-super-agentes-de-ia.git
cd fator-x-super-agentes-de-ia
npm install
cp .env.example .env  # Preencher com credenciais do Supabase
npm run dev            # http://localhost:8080
```

## 2. Entender a Arquitetura (1h)

Leia nesta ordem:
1. `README.md` — Visao geral
2. `docs/adr/` — Decisoes arquiteturais (5 ADRs)
3. `src/types/agentTypes.ts` — Modelo de dados (395 linhas)
4. `src/stores/agentBuilderStore.ts` — Estado global
5. `src/services/agentService.ts` — Camada de persistencia

## 3. Fluxo Principal (30 min)

```
Usuario abre /builder
  → AgentBuilder.tsx carrega (lazy) o modulo ativo
  → Modulo usa useAgentBuilderStore() para ler/escrever
  → updateAgent() seta isDirty = true
  → useAutoSave dispara saveAgent() apos 5s
  → agentService.saveAgent() faz upsert no Supabase
  → Supabase RLS garante que so o workspace vê
```

## 4. Rodar Testes (15 min)

```bash
npx vitest run           # 62 testes
npx tsc --noEmit         # Type check
npm run build            # Build de producao
```

## 5. Fazer Primeira Mudanca (1h)

Sugestao: Adicionar um novo campo ao IdentityModule.

1. Adicionar campo em `src/types/agentTypes.ts` (AgentConfig)
2. Adicionar default em `src/data/agentBuilderData.ts` (DEFAULT_AGENT)
3. Adicionar UI em `src/components/agent-builder/modules/IdentityModule.tsx`
4. Verificar que auto-save persiste o novo campo
5. Rodar testes: `npx vitest run`

## 6. Estrutura de Pastas

```
src/
├── pages/           # Paginas (25) — lazy loaded no App.tsx
├── components/
│   ├── agent-builder/modules/  # 17 modulos do builder
│   ├── agent-builder/ui/       # 16 componentes reutilizaveis
│   ├── layout/                 # AppLayout, Sidebar
│   └── shared/                 # MetricCard, StatusBadge
├── stores/          # Zustand store
├── services/        # Supabase CRUD
├── types/           # TypeScript interfaces
├── config/          # DataHub blacklist, entity mappings
├── hooks/           # useAutoSave, useAuth
├── lib/             # utils, validation (Zod), normalize, logger
└── test/            # 11 arquivos de teste
```

## 7. Convencoes

- **Codigo em ingles**, UI em portugues
- **TypeScript strict** — zero `any`
- **CSS Tailwind** — sem CSS customizado (exceto index.css)
- **Shadcn/UI** como base de componentes
- **Commits semanticos**: feat:, fix:, docs:, perf:, chore:

## Duvidas?

- Arquitetura: ler ADRs em `docs/adr/`
- Deploy: ler `docs/RUNBOOK.md`
- Banco: ler `supabase/migrations/` na ordem
