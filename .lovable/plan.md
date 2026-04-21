

## Página de Detalhes do Agente Enriquecida

Refatoro `src/pages/AgentDetailPage.tsx` substituindo o bloco básico `AgentMetrics` por um painel rico de métricas, gráficos diários e SLO usando os dados mockados que já existem em `agent_usage`, `agent_traces` e `alerts`.

### Visão final da página

```text
PageHeader (nome, missão, ações)
Avatar + status + meta (modelo · persona · v#)

[Configuração]   [Tags]                                        ← já existe

═══ NOVO: Métricas Ricas ═══
┌─ MetricCards com sparklines (4 cards) ────────────────────┐
│ Requisições · Custo · Latência p95 · Taxa de sucesso      │
│ + variação % vs semana anterior + sparkline               │
└────────────────────────────────────────────────────────────┘

┌─ Gráficos de tendência (grid 2x2) ────────────────────────┐
│ [Area] Requests/dia          [Bar]  Custo USD/dia         │
│ [Area] Latência média/dia    [Bar]  Tokens/dia            │
└────────────────────────────────────────────────────────────┘

┌─ Painel SLO (2/3) ─────────────┬─ Distribuição (1/3) ────┐
│ Disponibilidade   99.5% target │ ████ Sucesso 87%        │
│ Taxa de erro      <1% target   │ ██   Avisos  8%         │
│ Latência p95      <2000ms      │ █    Erros   5%         │
│ Latência p99      <5000ms      │ Custo médio/req         │
│ (cards coloridos por saúde)    │ Tokens totais           │
└────────────────────────────────┴─────────────────────────┘

┌─ Histórico por dia (tabela) ──────────────────────────────┐
│ Data | Requests | Tokens | Custo | Latência               │
│ (14 linhas, hover, badge de alertas ativos)               │
└────────────────────────────────────────────────────────────┘

[Histórico de Versões]                                        ← já existe
```

### Cálculos (client-side, zero migrações)

- **Percentis p50/p95/p99** sobre `traces[].latency_ms`
- **Série diária preenchida** com zeros para os 14 dias (usa `agent_usage`)
- **Tendência semana vs semana anterior** (variação %)
- **SLO health**: `healthy` / `warning` / `critical` por target padrão da indústria
- **Distribuição de status** dos traces por `level`

### Arquivos a criar

- `src/components/agents/detail/agentMetricsHelpers.ts` — `percentile()`, `buildDailySeries()`, `computeSLO()`, `buildSLOTargets()`, `formatCost()`, `formatNumber()`
- `src/components/agents/detail/SLOPanel.tsx` — 4 cards SLO coloridos por saúde com barra de progresso vs alvo
- `src/components/agents/detail/AgentRichMetrics.tsx` — componente principal: 4 MetricCards + 4 gráficos + SLO + distribuição + tabela diária

### Arquivo a alterar

- `src/pages/AgentDetailPage.tsx` — substituir `<AgentMetrics />` por `<AgentRichMetrics agentId={id!} days={14} />`. Remover a função `AgentMetrics` interna (vira código morto).

### Reaproveitamentos (sem reinventar)

- `MetricCard` com sparkline e trend (já existe em `src/components/shared/`)
- `LightAreaChart` e `LightBarChart` (já existem em `src/components/charts/`)
- `getAgentDetailTraces`, `getAgentUsage`, `getAgentRecentAlerts` (já existem em `agentsService`)
- React Query (cache automático, key separada por `agentId + days`)

### Detalhes técnicos

- **Empty states** elegantes em cada gráfico se não houver dados no período
- **Loading state** unificado (Loader2 spinner) enquanto traces+usage carregam em paralelo
- **Cores semânticas** apenas: `--primary`, `--nexus-amber`, `--nexus-emerald`, `--destructive`, `--muted-foreground`
- **Tabela responsiva** com `overflow-x-auto`, `tabular-nums`, hover state
- **Acessibilidade**: ícones com `aria-hidden`, percentuais formatados em PT-BR, badge de alertas com contagem

### Impacto

- Zero migrações de banco, zero novos serviços, zero alterações em rotas
- Página de detalhes passa de 4 métricas planas → 4 KPIs + 4 gráficos + SLO + tabela
- Carrega 200 traces (vs 50) para percentis mais confiáveis
- Janela de 14 dias permite cálculo de tendência semana vs semana

