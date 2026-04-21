

## Tabela detalhada de falhas e erros no Agent Details

Adiciono uma seção **"Falhas e erros"** ao `AgentRichMetrics` que consolida `alerts` + `agent_traces` (níveis error/critical/warning) em uma tabela única com filtros, busca e paginação client-side.

### Visão final

```text
┌─ Falhas e erros ─────────────────────── 47 resultados de 312 ─┐
│  [3 Críticos] [12 Erros] [29 Avisos] [8 Não resolvidos]        │
│                                                                 │
│  [🔍 buscar mensagem…] [Fontes ▾] [Categoria ▾] [Status ▾] [×] │
│                                                                 │
│  Categoria   Fonte    Mensagem                  Status   Quando│
│  ────────────────────────────────────────────────────────────  │
│  ✕ Erro     🔔 Alert  Timeout no LLM gateway     Aberto  14/04 │
│  ⚠ Aviso    📊 Trace  Latência > 3s               —      14/04 │
│  ✕ Crítico  🔔 Alert  Budget mensal excedido     Resolv. 13/04 │
│  ...                                                           │
│                                                                │
│  Mostrando 1–25 de 47   [Por página: 25 ▾]   ← 1/2 →           │
└────────────────────────────────────────────────────────────────┘
```

### Componente novo

**`src/components/agents/detail/AgentFailuresTable.tsx`**
- Recebe `agentId`, busca via `useQuery(['agent_failures', agentId])`.
- 4 chips de resumo (Críticos, Erros, Avisos, Não resolvidos) calculados sobre o conjunto completo.
- Filtros (estado local):
  - **Busca**: input com ícone, casa em `message + event + category` (case-insensitive).
  - **Fonte**: Todas / Alerts / Traces.
  - **Categoria**: dinâmica a partir das categorias presentes (severity dos alerts + level dos traces).
  - **Status**: Todos / Não resolvidos / Resolvidos (aplica só a alerts; traces ignoram este filtro quando "Todos").
  - Botão **Limpar** aparece quando algum filtro está ativo.
- **Paginação client-side**: tamanhos 10/25/50, contador "X–Y de Z", botões Anterior/Próxima e indicador `página / total`.
- Cada linha mostra: badge colorida da categoria (com ícone), fonte com ícone (Bell/Activity), mensagem truncada com `title` (tooltip nativo) + evento em fonte mono quando trace, status (Aberto/Resolvido/—) e timestamp `dd/MM HH:mm`.
- Estados: skeleton enquanto carrega; vazio diferenciado ("nenhuma falha registrada" vs "nenhum resultado para os filtros").

### Service novo

**`src/services/agentsService.ts`** ganha `getAgentFailures(agentId, perSourceLimit = 200)`:
- Faz **2 queries em paralelo**:
  - `alerts` por `agent_id` selecionando `id, severity, title, message, is_resolved, created_at` (limit 200).
  - `agent_traces` por `agent_id` com `level IN ('error','critical','warning','warn')` selecionando `id, level, event, metadata, created_at` (limit 200).
- Normaliza ambos para `FailureRecord { id, source, category, message, event?, is_resolved?, created_at }`.
- Para traces, prioriza `metadata.error → metadata.message → event` como mensagem.
- Retorna concatenado e ordenado por `created_at desc`.

`AgentTrace` ganha campos opcionais `event?: string | null` e `metadata?: Record<string, unknown> | null` (já existem na tabela; só faltam no tipo TS).

### Integração

`AgentRichMetrics.tsx` ganha `<AgentFailuresTable agentId={agentId} />` logo abaixo do bloco "Histórico por dia" e acima do `<DayDrillDownDrawer>`.

### Detalhes técnicos

- **Tokens semânticos** apenas: `--destructive`, `--nexus-amber`, `--nexus-emerald`, `--secondary`, `--muted-foreground`, `--border`. Sem cores hard-coded.
- **Acessibilidade**: `role="region"` + `aria-label`, `aria-label` na busca, badges com ícone+texto (não dependem só de cor).
- **Performance**: filtros e paginação puramente em memória sobre até ~400 linhas (200 alerts + 200 traces) → `useMemo` para `filtered`, `categories` e `counts`. Sem refetch ao mudar filtros.
- **Responsivo**: filtros usam `flex-wrap`; tabela em `overflow-x-auto`; chips de resumo quebram em mobile.
- **Sem migração, sem schema novo, sem rotas novas.** Reusa `useQuery`, `Input`, `Select`, `Button`.

### Arquivos

- **Criar**: `src/components/agents/detail/AgentFailuresTable.tsx`
- **Editar**: `src/services/agentsService.ts` — adicionar `FailureRecord`, `getAgentFailures`, e ampliar `AgentTrace` com `event?`/`metadata?`.
- **Editar**: `src/components/agents/detail/AgentRichMetrics.tsx` — montar `<AgentFailuresTable>` ao final.

### Impacto

- Usuário tem em um lugar só toda fonte de problema do agente (alerts + traces ruins), com busca textual e drill por categoria/status.
- Zero impacto em outras telas; o service é reusável (Observability, Alerts page, etc).
- Reaproveita o cache do React Query — abrir o Agent Details já dispara o fetch em paralelo aos charts.

