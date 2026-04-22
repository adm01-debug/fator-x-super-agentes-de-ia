/**
 * AlertRulesSimulator — Configura regras de alerta e simula seus disparos
 * retroativamente nos traces dos últimos 14 dias.
 */
import { useMemo, useState } from 'react';
import { Bell, Plus, Trash2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  simulateAlertRule,
  ALERT_METRIC_META,
  ALERT_SEVERITY_META,
  type SimulatedAlertRule,
  type AlertMetric,
  type AlertOperator,
  type AlertSeverity,
  type AlertSimulationResult,
} from './alertRulesSimulation';
import type { AgentTrace } from '@/services/agentsService';

interface Props {
  traces: AgentTrace[];
  days?: number;
}

const DEFAULT_RULES: SimulatedAlertRule[] = [
  { id: 'r-default-1', name: 'Latência alta', metric: 'latency_ms', operator: '>', threshold: 3000, severity: 'warning' },
  { id: 'r-default-2', name: 'Custo por trace excessivo', metric: 'cost_usd', operator: '>', threshold: 0.05, severity: 'critical' },
];

const METRIC_OPTIONS: AlertMetric[] = ['latency_ms', 'cost_usd', 'tokens_used', 'error_rate_pct'];
const OPERATORS: AlertOperator[] = ['>', '>=', '<', '<=', '=='];
const SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical'];

export function AlertRulesSimulator({ traces, days = 14 }: Props) {
  const [rules, setRules] = useState<SimulatedAlertRule[]>(DEFAULT_RULES);
  const [name, setName] = useState('');
  const [metric, setMetric] = useState<AlertMetric>('latency_ms');
  const [operator, setOperator] = useState<AlertOperator>('>');
  const [threshold, setThreshold] = useState('2000');
  const [severity, setSeverity] = useState<AlertSeverity>('warning');

  const simulations: AlertSimulationResult[] = useMemo(
    () => rules.map((r) => simulateAlertRule(r, traces, days)),
    [rules, traces, days],
  );

  const handleAdd = () => {
    const trimmed = name.trim();
    const t = parseFloat(threshold);
    if (!trimmed || Number.isNaN(t)) return;
    const newRule: SimulatedAlertRule = {
      id: `r-${Date.now()}`,
      name: trimmed,
      metric,
      operator,
      threshold: t,
      severity,
    };
    setRules((prev) => [...prev, newRule]);
    setName('');
    setThreshold('2000');
  };

  const handleRemove = (id: string) => setRules((prev) => prev.filter((r) => r.id !== id));

  return (
    <div className="mt-4 pt-4 border-t border-border/50" role="region" aria-label="Simulador de regras de alerta">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <h4 className="text-xs font-heading font-semibold text-foreground">
            Simulação de regras de alerta ({days}d)
          </h4>
        </div>
        <span className="text-[10px] text-muted-foreground">
          As regras são avaliadas sobre os traces existentes para simular disparos retroativos.
        </span>
      </div>

      {/* Form */}
      <div className="grid grid-cols-2 md:grid-cols-12 gap-2 mb-4 items-end">
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Nome</label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: Custo alto"
            className="h-8 text-xs"
          />
        </div>
        <div className="md:col-span-3">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Métrica</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value as AlertMetric)}
            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            {METRIC_OPTIONS.map((m) => (
              <option key={m} value={m}>{ALERT_METRIC_META[m].label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-1">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Op.</label>
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value as AlertOperator)}
            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs font-mono"
          >
            {OPERATORS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Limiar ({ALERT_METRIC_META[metric].unit})
          </label>
          <Input
            type="number"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="h-8 text-xs font-mono"
            step="any"
          />
        </div>
        <div className="md:col-span-2">
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Severidade</label>
          <select
            value={severity}
            onChange={(e) => setSeverity(e.target.value as AlertSeverity)}
            className="w-full h-8 rounded-lg border border-input bg-background px-2 text-xs"
          >
            {SEVERITIES.map((s) => <option key={s} value={s}>{ALERT_SEVERITY_META[s].label}</option>)}
          </select>
        </div>
        <div className="md:col-span-1">
          <Button
            type="button"
            size="sm"
            className="h-8 w-full gap-1 text-xs"
            onClick={handleAdd}
            disabled={!name.trim() || Number.isNaN(parseFloat(threshold))}
          >
            <Plus className="h-3 w-3" /> Add
          </Button>
        </div>
      </div>

      {/* Simulation results */}
      {simulations.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          Nenhuma regra configurada. Adicione uma acima para ver a simulação.
        </p>
      ) : (
        <div className="space-y-3">
          {simulations.map((sim) => (
            <RuleSimulationRow key={sim.rule.id} sim={sim} onRemove={() => handleRemove(sim.rule.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function RuleSimulationRow({
  sim,
  onRemove,
}: {
  sim: AlertSimulationResult;
  onRemove: () => void;
}) {
  const { rule, days, totalFires, daysWithFires, worstDay } = sim;
  const sevMeta = ALERT_SEVERITY_META[rule.severity];
  const metricMeta = ALERT_METRIC_META[rule.metric];
  const ever = daysWithFires > 0;

  return (
    <div className={`rounded-lg border ${sevMeta.tw} p-3`}>
      <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${sevMeta.tw.split(' ')[0]}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${sevMeta.dot}`} />
              {sevMeta.label}
            </span>
            <span className="text-xs font-semibold text-foreground truncate">{rule.name}</span>
          </div>
          <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
            {metricMeta.label} {rule.operator} {metricMeta.format(rule.threshold)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1 text-[10px] font-semibold">
              {ever
                ? <><AlertTriangle className="h-3 w-3 text-nexus-amber" /><span className="text-nexus-amber">Disparou</span></>
                : <><CheckCircle2 className="h-3 w-3 text-nexus-emerald" /><span className="text-nexus-emerald">Nunca disparou</span></>}
            </div>
            <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {totalFires} disparo{totalFires !== 1 ? 's' : ''} em {daysWithFires} dia{daysWithFires !== 1 ? 's' : ''}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={onRemove}
            aria-label={`Remover regra ${rule.name}`}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Heatmap diário de disparos */}
      <div className="flex items-end gap-0.5 h-8" role="img" aria-label={`Disparos diários da regra ${rule.name}`}>
        {days.map((d) => {
          const intensity = d.fireCount === 0 ? 0 : Math.min(1, d.fireCount / Math.max(1, worstDay?.fireCount ?? 1));
          const baseColor = !d.fired
            ? 'bg-secondary/40'
            : rule.severity === 'critical' ? 'bg-destructive'
            : rule.severity === 'warning' ? 'bg-nexus-amber'
            : 'bg-muted-foreground';
          const heightPct = d.fired ? Math.max(20, intensity * 100) : 12;
          return (
            <div
              key={d.date}
              className="flex-1 flex flex-col items-center justify-end group relative"
              style={{ height: '100%' }}
            >
              <div
                className={`w-full rounded-sm ${baseColor} transition-all`}
                style={{ height: `${heightPct}%`, opacity: d.fired ? 0.4 + intensity * 0.6 : 1 }}
              />
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10 pointer-events-none">
                <div className="bg-popover text-popover-foreground text-[10px] rounded-md px-2 py-1 shadow-md whitespace-nowrap border border-border">
                  <div className="font-semibold">{d.label}</div>
                  <div className="font-mono text-muted-foreground">
                    {d.fired ? `${d.fireCount} disparo${d.fireCount !== 1 ? 's' : ''}` : 'sem disparos'}
                  </div>
                  <div className="font-mono text-muted-foreground">
                    obs: {metricMeta.format(d.observedValue)} · {d.total} trace{d.total !== 1 ? 's' : ''}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] font-mono text-muted-foreground mt-1.5">
        <span>{days[0]?.label ?? ''}</span>
        {worstDay && (
          <span>
            Pior: <span className="text-foreground">{worstDay.label}</span> ({worstDay.fireCount} disparo{worstDay.fireCount !== 1 ? 's' : ''})
          </span>
        )}
        <span>{days[days.length - 1]?.label ?? ''}</span>
      </div>
    </div>
  );
}
