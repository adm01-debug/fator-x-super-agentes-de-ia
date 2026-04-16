
Re-confirmando #2 Replay de Trace pra destravar execução.

## #2 Replay de Trace

**Store (`agentBuilderStore.ts`):**
- State: `playgroundSeed: { input: string; traceId: string } | null`
- Action: `setPlaygroundSeed(seed)` e `clearPlaygroundSeed()`
- Action: `replayTrace(trace)` → seta seed + `setActiveTab('playground')` (ou abre playground existente)

**Observability (`ObservabilityModule.tsx`):**
- Botão `▶ Replay` em cada linha da tabela de traces
- Botão grande no painel de detalhes do trace selecionado
- Toast confirmando "Trace carregado no Playground"

**Playground (`AgentPlayground.tsx`):**
- `useEffect` consome `playgroundSeed` ao montar/mudar
- Pré-popula textarea com `seed.input`
- Banner topo: "🔁 Replay do trace `abc123…` · [Limpar]"
- Badge "REPLAY" enquanto seed ativo

**Arquivos:**
- editar `src/stores/agentBuilderStore.ts`
- editar `src/components/agent-builder/modules/ObservabilityModule.tsx`
- editar `src/components/agent-builder/AgentPlayground.tsx`

**Validação:** abrir agente com traces → Observability → clicar Replay → Playground abre c/ input + banner.

Próximas sem pausar: #8 → #5 → #6 → #9 → #10 → #7.
