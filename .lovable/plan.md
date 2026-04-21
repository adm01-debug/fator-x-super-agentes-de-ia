

## Visualização de Traces por Execução

Crio uma nova página **`/agents/:id/traces`** dedicada a inspecionar as execuções do agente registradas em `agent_traces` (1815 info / 438 warning / 37 error já mockados), com filtros por **nível**, **evento** e **agente**, agrupamento por **session_id** (= execução) e botão **Replay** que abre um modal com o contexto reidratado.

### Visão final da tela

```text
PageHeader: "Traces de execução — {agente}"   [← Detalhes]  [Atualizar]

┌─ Filtros (sticky) ─────────────────────────────────────────┐
│ [🔍 buscar texto]  [Nível ▾]  [Evento ▾]  [Agente ▾]  [⏱ 24h ▾]│
│ Resumo: 47 execuções · 1.2k traces · 34 erros · $0.42      │
└────────────────────────────────────────────────────────────┘

┌─ Lista de execuções (1/3) ─┬─ Detalhe da execução (2/3) ──┐
│ ● exec_a91…  agora · 12    │ Header: session_id · agent     │
│   ✓ 11  ⚠ 1  ✗ 0  · 320ms  │ duração · tokens · custo       │
│ ─────────────────────────  │ [▶ Replay]  [⬇ JSON]           │
│ ● exec_b04…  2min · 8      │                                 │
│   ✓ 7  ⚠ 0  ✗ 1  · 540ms   │ ┌─ Linha do tempo de eventos ─┐│
│ ─────────────────────────  │ │ 14:02:01 ℹ llm.completion   ││
│ ...                        │ │ 14:02:02 ℹ rag.retrieve     ││
│                            │ │ 14:02:02 ⚠ guardrail.check  ││
│                            │ │ 14:02:03 ✗ tool.call FAIL   ││
│                            │ │ ↳ click → input/output JSON ││
│                            │ └─────────────────────────────┘│
└─────────────────────────────┴────────────────────────────────┘

┌─ Modal Replay ─────────────────────────────────────────────┐
│ Replay da execução exec_a91… (12 eventos · 320ms total)    │
│ [⏮][▶ Play][⏸][⏭][⟳ Reset]   Velocidade: 1x ▾   ████░░ 5/12│
│ Atual: ⚠ guardrail.check (passo 5)                          │
│   Input  (JSON, syntax highlight)                           │
│   Output (JSON)                                              │
│   Metadata · latência: 42ms · tokens: 18 · custo: $0.0001   │
└────────────────────────────────────────────────────────────┘
```

### Comportamento do Replay (mock)

- Ordena traces da execução por `created_at` ascendente
- Reproduz cada passo com delay = `latency_ms / velocidade` (capado entre 200–2000ms)
- Mostra Input / Output / Metadata do passo atual em painéis JSON
- Acumula custo / tokens / duração à medida que avança (counter em tempo real)
- Controles: Play, Pause, Step+/−, Reset, slider de velocidade (0.5x / 1x / 2x / 4x), barra de progresso clicável
- 100% client-side — não chama backend, usa o array já carregado

### Arquivos a criar

- `src/services/agentTracesService.ts` — `listAgentTraces({ agentId?, level?, event?, search?, since, limit })`, `groupBySession(traces): Execution[]`, `listAvailableEvents()` (DISTINCT mockado)
- `src/components/agents/traces/TracesFilters.tsx` — barra sticky com 4 selects + busca + range temporal
- `src/components/agents/traces/ExecutionList.tsx` — coluna esquerda agrupada por `session_id` com mini-stats (✓/⚠/✗ contagem, duração agregada)
- `src/components/agents/traces/ExecutionTimeline.tsx` — coluna direita com linha do tempo de eventos clicáveis e detalhe expandível
- `src/components/agents/traces/ReplayDialog.tsx` — modal com player de replay (timer interno, controles, JSON viewer)
- `src/pages/AgentTracesPage.tsx` — página orquestradora

### Arquivos a alterar

- `src/App.tsx` — adicionar rota `/agents/:id/traces` (lazy import)
- `src/pages/AgentDetailPage.tsx` — adicionar botão "Ver traces" no header de ações que navega para `/agents/:id/traces`

### Detalhes técnicos

- **Sem migração**: tabela `agent_traces` já existe com `level` (enum: info/warning/error), `event` (text), `session_id` (text), `input`/`output`/`metadata` (jsonb), `latency_ms`, `tokens_used`, `cost_usd`
- **Agrupamento por execução** = `session_id` (fallback para chunks de 30s quando vazio)
- **Range temporal**: 1h / 24h / 7d / 30d / tudo (default 24h)
- **Filtro Agente**: pré-selecionado a partir da `:id` da rota; opção "Todos" desabilita o filtro e mostra dropdown com `listAgentSummaries()`
- **React Query** com chave `['agent-traces', agentId, filters]` e `staleTime: 30s`
- **Empty states** dedicados para "sem traces", "sem resultados após filtros" e "selecione uma execução"
- **Cores semânticas**: `--nexus-emerald` (info ✓), `--nexus-amber` (warning ⚠), `--destructive` (error ✗), `--primary` (highlights)
- **Acessibilidade**: filtros com `aria-label`, eventos navegáveis via teclado, replay com `aria-live="polite"` para anunciar passo atual
- **Performance**: limit de 500 traces por load, paginação implícita via filtro temporal

### Impacto

- Zero migrações, zero edge functions, zero novas dependências
- Página totalmente nova focada em debugging por execução (complementa a `TracesTimelinePage` global, que opera em `trace_events` workflow-level)
- Replay funcional com dados mockados — base pronta para no futuro disparar re-execução real via edge function

