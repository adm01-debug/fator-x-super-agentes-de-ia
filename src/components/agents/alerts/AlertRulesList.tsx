import { Activity, AlertTriangle, Bell, Cpu, DollarSign, Pencil, Trash2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import type { AlertRule, AlertSeverity } from '@/services/alertRulesService';
import type { AlertMetric } from '@/lib/alertMetrics';

const METRIC_ICON: Record<AlertMetric, React.ComponentType<{ className?: string }>> = {
  latency_ms: Zap,
  cost_per_exec: DollarSign,
  cost_window: DollarSign,
  tool_failure_rate: AlertTriangle,
  tool_failures_count: AlertTriangle,
  memory_mb: Cpu,
  error_rate: Activity,
};

const SEVERITY_BADGE: Record<AlertSeverity, string> = {
  info: 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30',
  warning: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30',
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
};

interface Props {
  rules: AlertRule[];
  selectedId: string | null;
  triggeredIds: Set<string>;
  onSelect: (rule: AlertRule) => void;
  onToggle: (rule: AlertRule, enabled: boolean) => void;
  onEdit: (rule: AlertRule) => void;
  onDelete: (rule: AlertRule) => void;
  onCreateNew: () => void;
}

export function AlertRulesList({
  rules, selectedId, triggeredIds, onSelect, onToggle, onEdit, onDelete, onCreateNew,
}: Props) {
  if (rules.length === 0) {
    return (
      <div className="p-8 text-center space-y-3">
        <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Bell className="h-5 w-5 text-primary" aria-hidden />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">Nenhuma regra criada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie regras para receber alertas automáticos quando métricas saírem do esperado.
          </p>
        </div>
        <Button size="sm" onClick={onCreateNew}>Criar primeira regra</Button>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-border/40" role="listbox" aria-label="Regras de alerta">
      {rules.map((rule) => {
        const Icon = METRIC_ICON[rule.metric] ?? Bell;
        const active = selectedId === rule.id;
        const triggered = triggeredIds.has(rule.id) && rule.is_enabled;
        return (
          <li key={rule.id}>
            <div
              className={`group p-3 transition-colors ${
                active ? 'bg-primary/8 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent hover:bg-muted/40'
              } ${!rule.is_enabled ? 'opacity-60' : ''}`}
            >
              <button
                onClick={() => onSelect(rule)}
                className="w-full text-left"
                aria-selected={active}
                role="option"
              >
                <div className="flex items-start gap-2.5 mb-2">
                  <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${
                    triggered ? 'bg-destructive/15 text-destructive' : 'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{rule.name}</p>
                    <p className="text-[11px] text-muted-foreground font-mono truncate">
                      {rule.metric} · {rule.aggregation} {rule.operator} {rule.threshold}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap pl-9">
                  <Badge className={`text-[9px] px-1.5 h-4 border ${SEVERITY_BADGE[rule.severity]}`}>
                    {rule.severity}
                  </Badge>
                  <Badge variant="outline" className="text-[9px] px-1.5 h-4">
                    {rule.window_minutes >= 60 ? `${rule.window_minutes / 60}h` : `${rule.window_minutes}min`}
                  </Badge>
                  {triggered && (
                    <Badge className="text-[9px] px-1.5 h-4 bg-destructive/15 text-destructive border-destructive/30 border">
                      🔥 disparando
                    </Badge>
                  )}
                </div>
              </button>
              <div className="flex items-center justify-between pl-9 mt-2.5">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={rule.is_enabled}
                    onCheckedChange={(v) => onToggle(rule, v)}
                    aria-label={`${rule.is_enabled ? 'Desativar' : 'Ativar'} regra ${rule.name}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {rule.is_enabled ? 'Ativa' : 'Pausada'}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(rule)} aria-label="Editar regra">
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDelete(rule)} aria-label="Remover regra">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
