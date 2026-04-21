

## Botão "Simular run de teste" no Agent Details com dialog de resultados

Adiciono um botão de ação na barra do `PageHeader` em `AgentDetailPage` que dispara uma simulação client-side (usando os traces/usage já carregados como base estatística) e abre um dialog com **resumo de latência, custo estimado, taxa de sucesso e tabela das execuções simuladas**.

### Visão final

```text
[ Cartão ] [ Ver traces ] [ Alertas ] [▶ Simular run] [ Editar no Builder ]

  ↓ clique abre dialog ↓

┌─ Resultado da simulação ──────────────── 10 execuções ─ x ─┐
│  ✓ 9 OK   ✕ 1 erro     Sucesso 90%                          │
│                                                              │
│  ┌─ Latência ─┐ ┌─ Custo est. ─┐ ┌─ Tokens ──┐ ┌─ p95 ────┐ │
│  │ avg 1.2s   │ │ $0,0420       │ │ 12.430    │ │ 2.1s     │ │
│  └────────────┘ └───────────────┘ └───────────┘ └──────────┘ │
│                                                              │
│  #  Status  Input            Latência  Tokens  Custo         │
│  1  ✓ ok    "Olá, preciso…"  980ms     1.120  $0,0038        │
│  2  ✓ ok    "Quanto custa…"  1.340ms   1.580  $0,0054        │
│  3  ✕ err   "Comprar 500…"   3.220ms   0      $0,0000        │
│  ...                                                         │
│                                                              │
│  [Repetir simulação]                          [Fechar]       │
└──────────────────────────────────────────────────────────────┘
```

### Componentes / mudanças

**1. Novo `src/services/agentTestSimulationService.ts`** (puro, client-side, sem rede):
```ts
export interface SimulatedRun {
  id: number;
  input: string;
  status: 'success' | 'error';
  latency_ms: number;
  tokens_used: number;
  cost_usd: number;
}
export interface SimulationSummary {
  runs: SimulatedRun[];
  total: number;
  passed: number;
  failed: number;
  successRate: number;     // %
  avgLatency: number;      // ms
  p95Latency: number;
  totalCost: number;
  totalTokens: number;
}
export function simulateAgentRun(
  agent: Pick<AgentDetail, 'id' | 'name' | 'model'>,
  baseTraces: AgentTrace[],
  count = 10,
): SimulationSummary
```

- Deriva latência/custo/tokens de base a partir das estatísticas reais dos traces (média + desvio). Se traces vazios, usa defaults razoáveis (~800ms, ~1k tokens, custo via `llmPricing` se disponível, senão $0,003/req).
- Taxa de erro mockada a partir da `errorRate` real dos traces (mín 5%, máx 25%) — quando há erros zero nos traces, mantém ~5% para realismo.
- Inputs mockados: 8 prompts curtos pré-definidos em PT (rotativo): "Olá, preciso de ajuda", "Quanto custa o produto X?", "Pode me mandar um orçamento?", etc.
- Cada run sorteia latência via `base ± 30%`, tokens via `base ± 20%`, custo proporcional.

**2. Novo `src/components/agents/detail/SimulationResultDialog.tsx`**:
- Usa `Dialog` do shadcn (já existente no projeto).
- Recebe `open`, `onOpenChange`, `summary: SimulationSummary | null`, `running: boolean`, `onRerun: () => void`.
- Header: título + chip "X execuções".
- Bloco de status: "✓ N OK · ✕ M erro" + badge grande de Taxa de sucesso colorida (verde ≥90%, amber 70-89%, vermelho <70%).
- 4 mini-cards (avg latency, custo total, tokens totais, p95) usando `nexus-card` inline simples.
- Tabela compacta (max-h scroll) com #, ícone status, input truncado, latência, tokens, custo.
- Footer: botão "Repetir simulação" (chama `onRerun`) e "Fechar".
- Estado loading: spinner centralizado com texto "Executando 10 simulações…".

**3. Editar `src/pages/AgentDetailPage.tsx`**:
- Importar `simulateAgentRun`, `SimulationResultDialog`, ícone `Play` de lucide.
- Adicionar estados: `simOpen`, `simRunning`, `simSummary`.
- Adicionar `handleSimulate()`:
  - Set `simRunning=true`, `simOpen=true`, busca traces via `queryClient.getQueryData(['agent_traces_rich', id]) ?? []` ou refetch leve via `getAgentDetailTraces`.
  - `setTimeout(() => { setSimSummary(simulateAgentRun(agent, traces, 10)); setSimRunning(false); }, 900)` para sensação de execução.
- Adicionar botão `<Button variant="outline" size="sm" onClick={handleSimulate}><Play /> Simular run</Button>` na barra de ações.
- Renderizar `<SimulationResultDialog ... />` ao final.

### Detalhes técnicos

- **Tokens semânticos** somente: `--nexus-emerald`, `--nexus-amber`, `--destructive`, `--muted-foreground`, `--primary`. Sem cor hard-coded.
- **Acessibilidade**: dialog herda focus-trap do shadcn; tabela com `<th scope="col">`; ícones com `aria-hidden`; status badges trazem texto, não só cor.
- **Performance**: simulação puramente em memória (~10 runs); reusa cache do React Query para os traces base; sem refetch ao reabrir.
- **Reuso**: serviço fica desacoplado e pode ser usado depois em `AgentBuilder` como "smoke test" rápido.
- **Sem backend, sem migração, sem schema novo**, sem chamada à edge function `test-runner` (que exige agente salvo + auth + custo real). Esta é a versão "preview" mockada.

### Arquivos

- **Criar**: `src/services/agentTestSimulationService.ts`
- **Criar**: `src/components/agents/detail/SimulationResultDialog.tsx`
- **Editar**: `src/pages/AgentDetailPage.tsx` — botão de ação + estados + dialog.

### Impacto

- Usuário consegue, em 1 clique no Agent Details, ver como o agente "se comportaria" em uma rajada de 10 execuções típicas, com números coerentes com seus traces reais.
- Fornece sensação tangível de QA sem custo real de LLM.
- Zero impacto em outras telas; dialog isolado, dispensável.

