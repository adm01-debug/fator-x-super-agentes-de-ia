import { useMemo, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle2, Pencil, Play, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LightLineChart } from '@/components/charts/LightLineChart';
import { evaluateRule, simulateRule24h, type AlertRule } from '@/services/alertRulesService';
import { formatMetricValue } from '@/lib/alertMetrics';
import type { AgentTraceRow } from '@/services/agentTracesService';

interface Props {
  rule: AlertRule | null;
  traces: AgentTraceRow[];
  onEdit: (rule: AlertRule) => void;
}

export function AlertSimulationPanel({ rule, traces, onEdit }: Props) {
  const [simRun, setSimRun] = useState(0);

  const evalResult = useMemo(() => (rule ? evaluateRule(rule, traces) : null), [rule, traces]);

  const sim = useMemo(() => {
    if (!rule || simRun === 0) return null;
    return simulateRule24h(rule, traces, 60);
  }, [rule, traces, simRun]);

  if (!rule) {
    return (
      <div className="h-[560px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
        <Activity className="h-8 w-8 opacity-40" />
        Selecione uma regra à esquerda para ver a prévia e simular o comportamento.
      </div>
    );
  }

  const triggers = evalResult?.triggers ?? false;
  const windowLabel = rule.window_minutes >= 60 ? `${rule.window_minutes / 60}h` : `${rule.window_minutes}min`;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-foreground truncate">{rule.name}</h3>
          {rule.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
          )}
          <p className="text-[11px] text-muted-foreground font-mono mt-1">
            {rule.metric} · {rule.aggregation} {rule.operator} {rule.threshold} · janela {windowLabel}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => onEdit(rule)}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
        </Button>
      </div>

      {/* Live preview card */}
      <Card className={triggers ? 'border-destructive/40' : 'border-nexus-emerald/40'}>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center gap-2">
            {triggers
              ? <XCircle className="h-4 w-4 text-destructive" aria-hidden />
              : <CheckCircle2 className="h-4 w-4 text-nexus-emerald" aria-hidden />}
            <span className="text-sm font-medium text-foreground">
              Prévia agora — {triggers ? 'disparando' : 'OK'}
            </span>
            {!rule.is_enabled && (
              <Badge variant="outline" className="text-[10px]">regra pausada</Badge>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Valor atual</p>
              <p className="font-mono text-foreground text-base font-semibold tabular-nums">
                {evalResult?.formatted ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Threshold</p>
              <p className="font-mono text-foreground text-base font-semibold tabular-nums">
                {rule.operator} {evalResult?.formattedThreshold ?? '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Simulation */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Simulação 24h (buckets de 1h)</p>
              <p className="text-[11px] text-muted-foreground">
                Roda a regra retroativamente sobre os traces mockados para estimar quantos disparos teria gerado.
              </p>
            </div>
            <Button size="sm" onClick={() => setSimRun((n) => n + 1)}>
              <Play className="h-3.5 w-3.5 mr-1.5" /> {sim ? 'Rodar novamente' : 'Rodar simulação'}
            </Button>
          </div>

          {sim && <SimulationBody rule={rule} sim={sim} />}
        </CardContent>
      </Card>
    </div>
  );
}

function SimulationBody({ rule, sim }: { rule: AlertRule; sim: NonNullable<ReturnType<typeof simulateRule24h>> }) {
  const chartData = sim.buckets.map((b) => ({
    hour: b.hour,
    valor: Number(b.value.toFixed(4)),
    threshold: rule.threshold,
  }));

  const triggeredBuckets = sim.buckets.filter((b) => b.triggered);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Disparos" value={String(sim.triggers)} accent={sim.triggers > 0 ? 'destructive' : 'ok'} />
        <Stat label="Pico" value={formatMetricValue(rule.metric, sim.max_value)} />
        <Stat
          label="Última ocorrência"
          value={sim.last_trigger ? new Date(sim.last_trigger).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'}
        />
      </div>

      <div className="border border-border/40 rounded-md p-2">
        <LightLineChart
          data={chartData}
          xKey="hour"
          height={200}
          series={[
            { dataKey: 'valor', name: 'Valor da métrica', stroke: 'hsl(var(--primary))', strokeWidth: 2, dotRadius: 2 },
            { dataKey: 'threshold', name: 'Threshold', stroke: 'hsl(var(--destructive))', strokeWidth: 1.5, strokeDasharray: '4 4', dotRadius: 0 },
          ]}
          yFormatter={(v) => formatMetricValue(rule.metric, v)}
        />
      </div>

      {triggeredBuckets.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <AlertTriangle className="h-3 w-3 text-destructive" />
            Buckets que dispararam
          </p>
          <ul className="space-y-1 max-h-40 overflow-y-auto pr-2" aria-label="Buckets disparados">
            {triggeredBuckets.map((b) => (
              <li
                key={b.ts}
                className="flex items-center justify-between text-[11px] py-1.5 px-2 rounded bg-destructive/5 border border-destructive/20"
              >
                <span className="font-mono text-foreground">{new Date(b.ts).toLocaleString('pt-BR')}</span>
                <span className="font-mono tabular-nums text-destructive">{formatMetricValue(rule.metric, b.value)}</span>
                <Badge variant="outline" className="text-[9px] h-4">{b.trace_ids.length} traces</Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-2">
          Nenhum bucket dispararia nas últimas 24h com este threshold. Tente reduzir o limite.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: 'ok' | 'destructive' }) {
  const color =
    accent === 'destructive' ? 'text-destructive' :
    accent === 'ok' ? 'text-nexus-emerald' : 'text-foreground';
  return (
    <div className="rounded-md border border-border/40 p-2 bg-card/40">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
