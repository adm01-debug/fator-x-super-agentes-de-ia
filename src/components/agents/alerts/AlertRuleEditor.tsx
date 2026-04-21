import { useEffect, useMemo, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { CheckCircle2, XCircle } from 'lucide-react';
import { METRIC_CATALOG } from '@/lib/alertMetrics';
import {
  evaluateRule, type AlertRule, type AlertOperator, type AlertSeverity,
  type AlertChannel, type AlertWindowMin,
} from '@/services/alertRulesService';
import type { AgentTraceRow } from '@/services/agentTracesService';
import type { AlertAggregation, AlertMetric } from '@/lib/alertMetrics';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: AlertRule | null;
  agentId: string;
  workspaceId: string | null;
  traces: AgentTraceRow[];
  onSave: (rule: AlertRule) => void;
}

const WINDOWS: Array<[AlertWindowMin, string]> = [
  [5, '5 minutos'],
  [15, '15 minutos'],
  [60, '1 hora'],
  [1440, '24 horas'],
];

const OPERATORS: AlertOperator[] = ['>', '>=', '<', '<=', '=='];
const SEVERITIES: AlertSeverity[] = ['info', 'warning', 'critical'];
const CHANNELS: Array<{ id: AlertChannel; label: string; mock?: boolean }> = [
  { id: 'toast', label: 'Toast no app' },
  { id: 'email', label: 'E-mail', mock: true },
  { id: 'webhook', label: 'Webhook', mock: true },
];

function buildDraft(initial: AlertRule | null, agentId: string, workspaceId: string | null): AlertRule {
  if (initial) return { ...initial };
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
    agent_id: agentId,
    workspace_id: workspaceId,
    name: '',
    description: '',
    metric: 'latency_ms',
    aggregation: 'p95',
    operator: '>',
    threshold: 800,
    window_minutes: 5,
    severity: 'warning',
    channels: ['toast'],
    is_enabled: true,
    created_at: now,
    updated_at: now,
  };
}

export function AlertRuleEditor({ open, onOpenChange, initial, agentId, workspaceId, traces, onSave }: Props) {
  const [draft, setDraft] = useState<AlertRule>(() => buildDraft(initial, agentId, workspaceId));
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(buildDraft(initial, agentId, workspaceId));
      setNameError(null);
    }
  }, [open, initial, agentId, workspaceId]);

  const metricCfg = METRIC_CATALOG.find((m) => m.metric === draft.metric)!;

  // Auto-fix aggregation if not allowed for the chosen metric
  useEffect(() => {
    if (!metricCfg.allowedAggs.includes(draft.aggregation)) {
      setDraft((d) => ({ ...d, aggregation: metricCfg.defaultAgg }));
    }
  }, [draft.metric, draft.aggregation, metricCfg]);

  const evalResult = useMemo(() => evaluateRule(draft, traces), [draft, traces]);

  const handleMetricChange = (metric: AlertMetric) => {
    const cfg = METRIC_CATALOG.find((m) => m.metric === metric)!;
    setDraft((d) => ({
      ...d,
      metric,
      aggregation: cfg.defaultAgg,
      threshold: cfg.defaultThreshold,
    }));
  };

  const toggleChannel = (id: AlertChannel) => {
    setDraft((d) => ({
      ...d,
      channels: d.channels.includes(id) ? d.channels.filter((c) => c !== id) : [...d.channels, id],
    }));
  };

  const handleSave = () => {
    if (draft.name.trim().length < 2) {
      setNameError('Nome deve ter pelo menos 2 caracteres.');
      return;
    }
    if (draft.threshold < 0 || Number.isNaN(draft.threshold)) {
      setNameError('Threshold deve ser ≥ 0.');
      return;
    }
    if (draft.channels.length === 0) {
      setNameError('Selecione pelo menos um canal.');
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{initial ? 'Editar regra' : 'Nova regra de alerta'}</SheetTitle>
          <SheetDescription>
            Configure a métrica, o limite e a janela. A prévia abaixo recalcula a cada mudança usando os traces atuais.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-5">
          <div>
            <Label htmlFor="rule-name" className="text-xs">Nome</Label>
            <Input
              id="rule-name"
              value={draft.name}
              onChange={(e) => { setDraft((d) => ({ ...d, name: e.target.value })); setNameError(null); }}
              placeholder="Ex: Latência p95 alta"
              className="h-9 text-sm mt-1"
            />
          </div>

          <div>
            <Label htmlFor="rule-desc" className="text-xs">Descrição (opcional)</Label>
            <Textarea
              id="rule-desc"
              value={draft.description ?? ''}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              placeholder="O que esta regra está vigiando..."
              rows={2}
              className="text-sm mt-1"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Métrica</Label>
              <Select value={draft.metric} onValueChange={(v) => handleMetricChange(v as AlertMetric)}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {METRIC_CATALOG.map((m) => (
                    <SelectItem key={m.metric} value={m.metric}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Agregação</Label>
              <Select
                value={draft.aggregation}
                onValueChange={(v) => setDraft((d) => ({ ...d, aggregation: v as AlertAggregation }))}
              >
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {metricCfg.allowedAggs.map((a) => (
                    <SelectItem key={a} value={a}>{a}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-[100px_1fr] gap-3">
            <div>
              <Label className="text-xs">Operador</Label>
              <Select value={draft.operator} onValueChange={(v) => setDraft((d) => ({ ...d, operator: v as AlertOperator }))}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="rule-threshold" className="text-xs">Threshold ({metricCfg.unit || '—'})</Label>
              <Input
                id="rule-threshold"
                type="number"
                step="any"
                value={draft.threshold}
                onChange={(e) => setDraft((d) => ({ ...d, threshold: Number(e.target.value) }))}
                className="h-9 text-sm mt-1 font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Janela</Label>
              <Select
                value={String(draft.window_minutes)}
                onValueChange={(v) => setDraft((d) => ({ ...d, window_minutes: Number(v) as AlertWindowMin }))}
              >
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {WINDOWS.map(([m, label]) => <SelectItem key={m} value={String(m)}>{label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Severidade</Label>
              <Select value={draft.severity} onValueChange={(v) => setDraft((d) => ({ ...d, severity: v as AlertSeverity }))}>
                <SelectTrigger className="h-9 text-xs mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Canais de notificação</Label>
            <div className="mt-2 space-y-2">
              {CHANNELS.map((c) => (
                <label key={c.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={draft.channels.includes(c.id)}
                    onCheckedChange={() => toggleChannel(c.id)}
                    aria-label={c.label}
                  />
                  <span>{c.label}</span>
                  {c.mock && <Badge variant="outline" className="text-[9px] h-4">simulado</Badge>}
                </label>
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div
            className={`rounded-lg border p-3 ${
              evalResult.triggers ? 'border-destructive/40 bg-destructive/5' : 'border-nexus-emerald/40 bg-nexus-emerald/5'
            }`}
            aria-live="polite"
          >
            <div className="flex items-center gap-2 mb-1.5">
              {evalResult.triggers
                ? <XCircle className="h-4 w-4 text-destructive" aria-hidden />
                : <CheckCircle2 className="h-4 w-4 text-nexus-emerald" aria-hidden />}
              <span className="text-xs font-medium text-foreground">
                {evalResult.triggers ? 'Disparo: SIM' : 'Disparo: NÃO'}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Valor atual ({draft.aggregation} em {draft.window_minutes >= 60 ? `${draft.window_minutes / 60}h` : `${draft.window_minutes}min`}):{' '}
              <span className="font-mono text-foreground">{evalResult.formatted}</span>
              {' · threshold: '}
              <span className="font-mono">{draft.operator} {evalResult.formattedThreshold}</span>
            </p>
          </div>

          {nameError && (
            <p className="text-xs text-destructive" role="alert">{nameError}</p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button size="sm" onClick={handleSave}>{initial ? 'Salvar alterações' : 'Criar regra'}</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
