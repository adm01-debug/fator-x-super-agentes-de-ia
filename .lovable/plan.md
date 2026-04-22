

## Estimativa de custo e tokens ao vivo na prévia

Hoje o `AgentLivePreviewCard` mostra `chars` e `seções X/Y`, mas **não** mostra quanto cada execução do agente vai custar. O usuário só descobre o impacto financeiro do prompt depois de rodar no LLM real — sem feedback durante a edição.

Já temos toda a infraestrutura pronta:
- `useCostEstimate` (hook) — calcula tokens/custo USD/BRL/latência.
- `llmPricing.ts` — tabela de preços dos 9 modelos suportados.
- `QUICK_AGENT_MOCK_INPUTS[type]` — input típico por tipo de agente, pra estimativa realista.

Falta só **plugar isso no preview ao vivo**.

### O que muda na visão do usuário

Novo bloco compacto **"Custo estimado por execução"** dentro do `AgentLivePreviewCard`, logo abaixo da linha "modelo / seções / chars" e antes da Missão:

```
┌─ 💰 Custo estimado por execução ───────────────────────┐
│ ~3.240 tokens · US$ 0.0048 · R$ 0,02  · ~1.2s         │
│ [▓▓▓▓▓░░░░░] entrada 2.140  ·  saída 600              │
│                                                        │
│ Em 100 execuções/dia: ~US$ 0,48/dia · R$ 2,40/dia     │
└────────────────────────────────────────────────────────┘
```

Detalhes:
1. **Linha principal**: total de tokens, custo USD, custo BRL, latência média estimada — em fonte mono compacta.
2. **Barra horizontal segmentada** mostrando proporção entrada/saída (visual rápido pra entender se o prompt está "pesado" no system).
3. **Projeção diária** com base em volume médio (100 exec/dia como default) — ajuda a contextualizar custos minúsculos por chamada que viram contas relevantes em escala.
4. **Cores semânticas**: verde se custo < $0.01, âmbar se $0.01–$0.05, vermelho se > $0.05 por execução.
5. **Tooltip no ícone 💰** explicando: _"Estimativa baseada no prompt atual + input médio de teste do tipo "{type}". Custo real varia conforme o input do usuário e tamanho da resposta."_
6. **Pulso de sincronização**: o bloco participa do mesmo `pulsing` que o resto do card (já existente) — pisca quando o prompt/modelo muda.

### Como funciona (técnico)

**1. Editar `AgentLivePreviewCard.tsx`** — adicionar uso do hook + render do bloco:

```tsx
import { useCostEstimate } from '@/hooks/useCostEstimate';
import { QUICK_AGENT_MOCK_INPUTS } from '@/lib/quickAgentTemplates';
import { Coins } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// Dentro do componente, após `sections`:
const mockInput = QUICK_AGENT_MOCK_INPUTS[debounced.type]?.[0]?.input ?? '';
const cost = useCostEstimate({
  model: debounced.model,
  systemPrompt: debounced.prompt,
  userInput: mockInput,
  maxTokens: 1000,
  toolsCount: 0,
});

const dailyExecs = 100;
const dailyUsd = cost.costUsd * dailyExecs;
const dailyBrl = cost.costBrl * dailyExecs;

const inputPct = Math.round((cost.inputTokens / cost.totalTokens) * 100);

const tier: 'low' | 'mid' | 'high' =
  cost.costUsd < 0.01 ? 'low' : cost.costUsd < 0.05 ? 'mid' : 'high';
const tierColor = {
  low: 'text-nexus-emerald',
  mid: 'text-nexus-amber',
  high: 'text-destructive',
}[tier];
```

**2. Render do bloco** (entre a identidade e a Missão, ~35 linhas):

```tsx
<div className="space-y-2 pt-2 border-t border-border/50">
  <div className="flex items-center gap-1.5">
    <Coins className="h-3 w-3 text-nexus-amber" />
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
      Custo estimado por execução
    </p>
    <Tooltip>
      <TooltipTrigger className="ml-auto text-muted-foreground hover:text-foreground">
        <Info className="h-3 w-3" />
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs">
        Estimativa com base no prompt atual + input médio do tipo "{debounced.type}".
        Custo real varia conforme input do usuário e tamanho da resposta.
      </TooltipContent>
    </Tooltip>
  </div>

  <div className={`font-mono text-xs ${tierColor}`}>
    ~{cost.totalTokens.toLocaleString('pt-BR')} tokens · US$ {cost.costUsd.toFixed(4)} ·
    R$ {cost.costBrl.toFixed(2).replace('.', ',')} · ~{(cost.estLatencyMs / 1000).toFixed(1)}s
  </div>

  {/* Barra entrada/saída */}
  <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary/40" aria-hidden>
    <div className="bg-primary/70" style={{ width: `${inputPct}%` }} />
    <div className="bg-nexus-amber/70" style={{ width: `${100 - inputPct}%` }} />
  </div>
  <div className="flex justify-between text-[10px] font-mono text-muted-foreground">
    <span>entrada {cost.inputTokens.toLocaleString('pt-BR')}</span>
    <span>saída {cost.outputTokens.toLocaleString('pt-BR')}</span>
  </div>

  <p className="text-[10px] text-muted-foreground pt-0.5 border-t border-border/30">
    Em {dailyExecs} execuções/dia: <span className="font-mono">US$ {dailyUsd.toFixed(2)}</span> ·
    <span className="font-mono"> R$ {dailyBrl.toFixed(2).replace('.', ',')}/dia</span>
  </p>
</div>
```

**3. Edge cases**:
- Prompt vazio → custo ~$0.0001 (só system mínimo); bloco renderiza normalmente em verde.
- Modelo não mapeado em `LLM_PRICING` → `getModelPrice` faz fallback pra `gemini-2.5-flash` (já implementado).
- `mockInput` indisponível pro tipo → usa string vazia (custo só do system prompt + output estimado).

### Casos cobertos

| Cenário | O que aparece |
|---|---|
| Prompt curto (500 chars) + Gemini Flash | `~830 tokens · US$ 0.0005 · R$ 0,00 · ~0.9s` (verde). |
| Prompt grande (4.000 chars) + GPT-5 | `~1.700 tokens · US$ 0.0103 · R$ 0,05 · ~3.4s` (âmbar). |
| Prompt enorme + GPT-5.2 + 4 ferramentas | `~3.900 tokens · US$ 0.0234 · R$ 0,12 · ~3.6s` (âmbar/vermelho). |
| Trocou modelo de Pro → Flash | Bloco pulsa, valores caem na hora. |
| Adicionou 1.000 chars no prompt | Tokens de entrada sobem em ~250, custo recalcula. |

### Arquivos tocados

- **Editar** `src/components/agents/wizard/quickSteps/AgentLivePreviewCard.tsx` — 3 imports + ~50 linhas de hook/render.

### Impacto

- **Zero schema/backend, zero dependência nova.**
- **Zero quebra**: 100% aditivo no card existente; reaproveita `useCostEstimate` + `llmPricing` + `QUICK_AGENT_MOCK_INPUTS` sem tocá-los.
- Resolve o ponto cego financeiro: o usuário vê **na hora** que trocar Gemini Flash por GPT-5.2 multiplica o custo por 20x — e decide com dado, não no susto da fatura.

