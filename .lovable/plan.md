

## Painel SLO interativo com metas ajustáveis e timeline de violações

Substituo o `SLOPanel` estático atual por um **InteractiveSLOPanel** rico, no Agent Details, que permite ajustar metas via sliders, mostra p50/p95/p99 e budget burn, e desenha um timeline de violações ao longo dos últimos 14 dias usando os traces já carregados.

### Visão final

```text
┌─ Painel SLO ─────────────────────────── [Resetar] [Salvar metas] ─┐
│                                                                    │
│  ┌─ Latência p50 ────┐ ┌─ Latência p95 ───┐ ┌─ Latência p99 ───┐  │
│  │ 412ms  ✓ Saudável │ │ 1.840ms ⚠ Atenção│ │ 4.210ms ✓ OK     │  │
│  │ alvo: [====●===] │ │ alvo: [======●=] │ │ alvo: [=====●==] │  │
│  │ 1000ms           │ │ 2000ms           │ │ 5000ms           │  │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘  │
│                                                                    │
│  ┌─ Disponibilidade ─┐ ┌─ Error Budget Burn ──────────────────┐   │
│  │ 99.2% ⚠           │ │  Consumido: 80% do budget mensal     │   │
│  │ alvo: [======●==] │ │  ████████████████░░░░ 0.8% / 1.0%    │   │
│  │ 99.5%             │ │  Em ritmo de exaustão em ~3 dias  ⚠ │   │
│  └──────────────────┘ └──────────────────────────────────────┘   │
│                                                                    │
│  ─── Timeline de violações (últimos 14 dias) ────────────────────  │
│  12/04 ▮▮▮▯▯▯▯▯▯▯▯▯▯▯  3 violações p95                            │
│  13/04 ▯▯▯▯▯▯▯▯▯▯▯▯▯▯  sem violações                              │
│  14/04 ▮▮▮▮▮▮▮▮▯▯▯▯▯▯  8 violações (p95 + erro)  ← pior dia      │
│  ...                                                              │
│                                                                    │
│  Hover em qualquer dia → tooltip com nº de violações por tipo     │
│  Clique em um dia → abre o DayDrillDownDrawer existente           │
└────────────────────────────────────────────────────────────────────┘
```

### Componentes novos

1. **`InteractiveSLOPanel.tsx`** (substitui `SLOPanel` na tela de detalhes; o antigo permanece para outros usos):
   - 5 cards de meta (p50, p95, p99, disponibilidade, error budget)
   - Cada card com slider (`@/components/ui/slider`) para ajustar a meta em tempo real
   - Cores semânticas: `--nexus-emerald` (saudável), `--nexus-amber` (atenção), `--destructive` (crítico)
   - Status calculado pelo helper `sloHealth` existente
   - Budget burn card mostra: % do budget consumido + barra + ETA de exaustão (extrapolação linear)
   - Botões "Resetar" (volta para alvos default) e "Salvar metas" (persiste em `localStorage` por agentId)

2. **`SLOViolationTimeline.tsx`**:
   - Recebe `traces` e `targets`, agrupa por dia
   - Para cada dia calcula violações: latência > p95-target, latência > p99-target, level=error/critical
   - Renderiza linha por dia com mini-barras horizontais (14 segmentos representando "intensidade" da violação)
   - Tooltip on hover (`@/components/ui/tooltip`) com breakdown por tipo
   - Click → reusa `setSelectedDay` do parent → abre `DayDrillDownDrawer`

### Helpers novos em `agentMetricsHelpers.ts`

```typescript
// Calcula budget burn mensal e ETA de exaustão
export function computeBudgetBurn(slo: SLOMetrics, errorBudgetPct: number): {
  consumedPct: number;
  daysToExhaustion: number | null;
  status: 'healthy' | 'warning' | 'critical';
}

// Agrupa violações por dia para o timeline
export function buildViolationTimeline(
  traces: AgentTrace[],
  targets: { p95: number; p99: number },
  days: number
): Array<{ date: string; label: string; p95Violations: number; p99Violations: number; errors: number; total: number }>
```

### Persistência das metas ajustáveis

- Chave: `nexus-slo-targets-${agentId}` em `localStorage`
- Schema: `{ p50: number; p95: number; p99: number; availability: number; errorBudget: number }`
- Hook custom `useAgentSLOTargets(agentId)` retorna `{ targets, setTargets, reset }`
- Defaults vêm de `SLO_TARGETS` em `@/lib/slo/sloTargets.ts` (já existe)

### Integração

- **`AgentRichMetrics.tsx`**: troca `<SLOPanel targets={sloTargets} />` por `<InteractiveSLOPanel agentId={agentId} slo={slo} traces={traces} onDayClick={setSelectedDay} daily={daily} />`. O grid `lg:grid-cols-3` passa para layout vertical (timeline ocupa toda a largura abaixo dos cards de meta).
- O card "Distribuição de traces" continua ao lado dos cards SLO (ou logo abaixo em mobile).

### Detalhes técnicos

- **Sliders**: `min/max` ajustados por métrica (p50: 100–3000ms, p95: 500–5000ms, p99: 1000–10000ms, disponibilidade: 95–100%, errorBudget: 0.1–5%). `step` apropriado.
- **Debounce 150ms** ao ajustar slider para evitar re-render do timeline em cada pixel.
- **Acessibilidade**: cada slider com `aria-label`, cards com `role="region"`, timeline com `role="list"` e cada linha `role="listitem"` + `tabIndex={0}` + `onKeyDown` (Enter/Space).
- **Tokens semânticos** apenas: `--nexus-emerald`, `--nexus-amber`, `--destructive`, `--secondary`, `--muted-foreground`. Sem cores hard-coded.
- **Sem migração, sem schema, sem rotas novas**. Tudo client-side com dados já carregados pelos `useQuery` existentes.

### Arquivos

- **Criar**: `src/components/agents/detail/InteractiveSLOPanel.tsx`
- **Criar**: `src/components/agents/detail/SLOViolationTimeline.tsx`
- **Criar**: `src/hooks/useAgentSLOTargets.ts`
- **Editar**: `src/components/agents/detail/agentMetricsHelpers.ts` (adicionar `computeBudgetBurn` e `buildViolationTimeline`)
- **Editar**: `src/components/agents/detail/AgentRichMetrics.tsx` (trocar `SLOPanel` por `InteractiveSLOPanel`, repassar `traces`/`daily`/`onDayClick`)

### Impacto

- Usuário pode calibrar SLOs por agente sem deploy, ver o impacto imediatamente nos cards e no timeline.
- Timeline visual evidencia os "piores dias" e abre drill-down direto via drawer existente.
- Budget burn alerta antes da exaustão (não só pós-violação).
- Zero backend, reusa `DayDrillDownDrawer`, `sloHealth`, `SLO_TARGETS` e dados já em cache.

