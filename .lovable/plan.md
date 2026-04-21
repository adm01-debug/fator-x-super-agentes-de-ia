

## Regras de Alertas Configuráveis (Agentes) — com Prévia & Simulação

Crio uma página dedicada **`/agents/:id/alerts`** para criar, editar e simular regras de alerta por agente, cobrindo as 4 métricas pedidas: **latência (p95/p99/média)**, **custo (por execução / janela)**, **falhas de tool** e **memória excedida**. As regras são persistidas localmente (workspace-scoped) e a prévia/simulação roda **100% client-side** contra os 2.290 traces mockados em `agent_traces`.

### Visão final da tela

```text
PageHeader: "Alertas — {agente}"   [← Detalhes]   [+ Nova regra]

┌─ Resumo ────────────────────────────────────────────────────┐
│  6 regras  •  4 ativas  •  Última checagem: agora           │
│  Disparariam agora: 2 ⚠ warning · 1 ✗ critical              │
└─────────────────────────────────────────────────────────────┘

┌─ Regras (esquerda 1/2) ─────┬─ Detalhe / Simulação (1/2) ──┐
│ ✓ Latência p95 alta         │ Regra: "Latência p95 alta"   │
│   p95 > 800ms · 5min        │  ▸ Editor (live)              │
│   ⚠ warning · ATIVA         │    métrica · agregação        │
│ ─────────────────────────── │    operador · threshold       │
│ ✓ Custo execução estourou   │    janela · severidade        │
│   cost_per_exec > $0.05     │    canais (toast / ...)       │
│ ─────────────────────────── │                                │
│ ⚠ Tool failure rate         │  ▸ Prévia agora              │
│   failure_rate > 10% · 1h   │    Valor atual: 12.4% ✗      │
│   ✗ critical · ATIVA        │    Disparo: SIM (crítico)    │
│ ─────────────────────────── │                                │
│ ⏸ Memória excedida          │  ▸ Simulação 24h             │
│   memory > 800MB · qualquer │    [▶ Rodar simulação]       │
│   info · pausada            │    ┌──────────── chart ─────┐│
│                             │    │ valor por hora c/ línea││
│                             │    │ pontilhada do threshold││
│                             │    └────────────────────────┘│
│                             │    47 disparos em 24h         │
│                             │    Primeiro: 14:22  Último:..│
│                             │    Top eventos correlacionados│
└─────────────────────────────┴────────────────────────────────┘
```

### Catálogo de métricas

| Métrica | Agregação | Origem (mockada) |
|---------|-----------|------------------|
| `latency_ms` | avg / p95 / p99 / max | `agent_traces.latency_ms` |
| `cost_per_exec` | avg / sum / max | soma de `cost_usd` por `session_id` |
| `cost_window` | sum | soma `cost_usd` na janela |
| `tool_failure_rate` | % | traces `event='tool.call' AND level='error'` ÷ total `tool.call` |
| `tool_failures_count` | count | traces `event='tool.call' AND level='error'` |
| `memory_mb` | avg / max | `agent_traces.metadata->>memory_mb` (fallback: gera ruído determinístico) |
| `error_rate` | % | traces `level='error'` ÷ total |

Operadores: `>`, `>=`, `<`, `<=`, `==`. Janelas: 5min / 15min / 1h / 24h. Severidades: `info` / `warning` / `critical`. Canais: `toast` (Sonner — funcional), `email` / `webhook` (mock visual com badge "simulado").

### Fluxos principais

- **Prévia ao vivo (sempre visível no editor)**: a cada keystroke, recalcula o valor atual da métrica na janela escolhida e mostra "Disparo: SIM/NÃO" com cor semântica.
- **Simulação 24h**: percorre traces em buckets (5min ou 1h) e marca buckets que disparariam, plotando linha temporal + linha do threshold + contagem de disparos + amostra dos 5 traces correlacionados.
- **Toggle ATIVA / PAUSADA**: muda a aparência e o status — regras pausadas não entram nos cálculos do badge "disparariam agora".

### Persistência

Persistência **client-side via `localStorage`** chaveado por `workspace_id + agent_id` (chave: `nexus.alert_rules.<workspaceId>.<agentId>`). Justificativa: a tabela `alert_rules` referenciada no código antigo **não existe no banco** — adicionar migração + edge function de avaliação ultrapassa o escopo de "regras configuráveis com prévia". Mantenho o serviço com interface limpa (`alertRulesService`) para no futuro plugar persistência real sem refatorar UI.

### Arquivos a criar

- `src/services/alertRulesService.ts` — tipos `AlertRule`, `AlertMetric`, `AlertAggregation`, `AlertWindow`; CRUD via `localStorage` + funções puras `evaluateRule(rule, traces)`, `simulateRule24h(rule, traces, bucketMin)` e `formatThreshold(rule)`.
- `src/lib/alertMetrics.ts` — implementações de `computeMetric(metric, agg, traces)` com `percentile`, `avg`, `sum`, `max`, `count`, `rate`.
- `src/components/agents/alerts/AlertRuleEditor.tsx` — formulário (Sheet) com `react-hook-form` + Zod (estendendo `alertRuleSchema`) e prévia ao vivo.
- `src/components/agents/alerts/AlertRulesList.tsx` — coluna esquerda com cards das regras (ícone por métrica, badge de severidade, toggle, ações).
- `src/components/agents/alerts/AlertSimulationPanel.tsx` — coluna direita: prévia agora + botão "Rodar simulação" + chart (`recharts` `LineChart` já em uso) + tabela de disparos.
- `src/pages/AgentAlertsPage.tsx` — orquestradora com layout de 2 colunas e header de resumo.

### Arquivos a alterar

- `src/App.tsx` — adicionar rota `/agents/:id/alerts` (lazy).
- `src/pages/AgentDetailPage.tsx` — adicionar botão "Alertas" no header de ações ao lado de "Ver traces".
- `src/lib/validations/agentSchema.ts` — estender `alertRuleSchema` com `aggregation`, `window_minutes`, `channels[]`, `is_enabled`, `agent_id` (mantém compatibilidade).

### Detalhes técnicos

- **Sem migração de banco, sem edge function, sem dependência nova**.
- Reaproveita `useAgentTraces` no padrão do `agentTracesService` (busca uma janela ampla — 24h — uma vez e simula em memória).
- Quando regra dispara na **prévia**, opcionalmente injeta um toast Sonner real (com debounce) para validar comportamento.
- **Acessibilidade**: editor navegável por teclado, prévia com `aria-live="polite"`, chart com tabela equivalente para screen readers.
- **Design tokens semânticos**: `--nexus-emerald` / `--nexus-amber` / `--destructive` para severidade, `--primary` para regras ativas, `--muted` para pausadas. Sem cores hard-coded.
- **Empty states**: lista vazia mostra CTA "Criar primeira regra" com 4 templates pré-prontos (latência alta, custo estourado, tool failures, memória).
- **Templates pré-prontos** (botão "Usar template"): Latência p95 > 800ms (5min, warning) · Custo por execução > $0.05 (1h, warning) · Tool failure rate > 10% (1h, critical) · Memória máxima > 800MB (5min, info).

### Impacto

- Zero breaking changes; a tabela `alert_rules` continua referenciada apenas pelo painel global existente (que já não funcionava por falta da tabela).
- Página totalmente nova focada em agente, complementando os alertas globais (`alerts` table) e cost anomalies (`cost_alerts` table).
- Base limpa para no futuro promover `alertRulesService` a persistência real + avaliador server-side.

