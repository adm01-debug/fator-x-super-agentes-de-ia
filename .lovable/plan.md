

## Comparação automática 7d vs 7d anteriores em todos os KPIs

Estendo o painel `AgentRichMetrics` para que **todos os 4 cards de KPI** mostrem comparação automática entre os últimos 7 dias e os 7 dias anteriores, com delta percentual, ícone de tendência e uma faixa de **insights textuais** acima dos cards destacando as mudanças mais relevantes.

### Visão final

```text
┌─ Insights de tendência (7d vs 7d ant.) ───────────────────────┐
│  ↗ Volume cresceu +18,4% (1.2k → 1.4k req)                     │
│  ↘ Custo caiu -12,1% (boa eficiência)                          │
│  ⚠ Latência p95 piorou +24% (1.6s → 2.0s)                      │
└────────────────────────────────────────────────────────────────┘

┌─ Requisições ──┐ ┌─ Custo ────────┐ ┌─ Latência p95 ─┐ ┌─ Sucesso ──────┐
│ 1.420          │ │ $12,40         │ │ 1.980ms        │ │ 98,2%          │
│ ↗ +18,4%       │ │ ↘ -12,1% bom   │ │ ↗ +24% ruim    │ │ ↘ -0,4% ruim   │
│ vs 1.200 (7d)  │ │ vs $14,11 (7d) │ │ vs 1.598ms (7d)│ │ vs 98,6% (7d)  │
│ ▁▂▃▅▇          │ │ ▇▅▃▂▁          │ │ ▂▃▄▆▇          │ │ ▇▇▆▇▇          │
└────────────────┘ └────────────────┘ └────────────────┘ └────────────────┘
```

### Mudanças

**1. `agentMetricsHelpers.ts`** — adicionar utilitário puro de comparação:

```ts
export interface KPIComparison {
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number;          // 0 quando previous=0 e current=0; null-safe via `hasPrev`
  hasPrev: boolean;
  trend: 'up' | 'down' | 'flat';   // baseado em |deltaPct| > 1
  isPositive: boolean;        // true = bom, false = ruim (respeita `inverted`)
}

export function compareWindows(
  daily: DailyPoint[],
  pick: (d: DailyPoint) => number,
  opts?: { inverted?: boolean; window?: number },
): KPIComparison
```

- Agrega `last7` e `prev7` via `daily.slice(-7)` / `daily.slice(-14, -7)`.
- `inverted=true` para latência e erro (menor é melhor).
- `trend='flat'` quando |delta%| ≤ 1.
- Para taxa de sucesso, calcular separado a partir de `traces` agrupados por dia (helper `computeSuccessRateByWindow(traces)` que retorna `{ current, previous }`) — será uma função adicional no mesmo arquivo.

**2. `AgentRichMetrics.tsx`** — ampliar o `useMemo` `totals` para produzir 4 `KPIComparison` (req, cost, latency p95 via daily.avgLatency, success via traces) e usar nos 4 cards. Cada card recebe um `trend` rico:

```tsx
trend={cmp.hasPrev ? {
  value: `${cmp.deltaPct >= 0 ? '+' : ''}${cmp.deltaPct.toFixed(1)}% vs 7d ant.`,
  positive: cmp.isPositive,
} : undefined}
```

**3. Novo componente `TrendInsightsBanner.tsx`** (em `src/components/agents/detail/`):

- Recebe os 4 `KPIComparison` + nomes/formatadores.
- Gera até 3 frases priorizadas por **magnitude de impacto** (|deltaPct|), filtrando `trend !== 'flat'`.
- Ordem de prioridade quando empate: erros/sucesso → latência → custo → volume.
- Cada linha: ícone (`TrendingUp`/`TrendingDown`), texto curto com cor semântica (`text-nexus-emerald` quando positivo, `text-destructive` quando negativo).
- Se nenhum delta relevante: mostra "Métricas estáveis nos últimos 7 dias vs 7 dias anteriores."
- Quando não há dado prévio (`!hasPrev` em todos): banner não renderiza.

Renderizado **acima** dos 4 cards de KPI no `AgentRichMetrics`.

**4. `MetricCard`** (sem mudança de API) — já aceita `trend.positive` para colorir verde/vermelho. Apenas confirmar que quando `inverted=true` invertemos `positive` corretamente em `compareWindows`.

### Detalhes técnicos

- **Tokens semânticos**: `--nexus-emerald` (positivo), `--destructive` (negativo), `--muted-foreground` (neutro/flat). Sem cor hard-coded.
- **Acessibilidade**: banner com `role="status"` + `aria-label="Insights de tendência"`. Ícones com `aria-hidden`. Direção descrita por texto, não só cor.
- **Performance**: tudo client-side em `useMemo` sobre os 14 pontos já carregados — zero refetch, zero query nova.
- **Edge cases**: período sem dados prévios oculta o trend chip; divisão por zero protegida via `hasPrev`; `traces` sem `created_at` ignorados na comparação de sucesso.

### Arquivos

- **Editar**: `src/components/agents/detail/agentMetricsHelpers.ts` — adicionar `KPIComparison`, `compareWindows`, `computeSuccessByWindow`.
- **Criar**: `src/components/agents/detail/TrendInsightsBanner.tsx`.
- **Editar**: `src/components/agents/detail/AgentRichMetrics.tsx` — usar `compareWindows` para 4 KPIs, renderizar `TrendInsightsBanner` acima dos cards, passar `trend` rico em todos os 4 `MetricCard`.

### Impacto

- Usuário identifica em segundos se a semana atual está melhor/pior que a anterior em cada métrica chave.
- Banner de insights resume o que importa em 1–3 frases, sem precisar comparar números mentalmente.
- Reusa estrutura existente (`MetricCard.trend`, `daily`, `traces`) — zero backend, zero schema, zero migração.

