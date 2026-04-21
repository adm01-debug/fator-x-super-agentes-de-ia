import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { type SLOTarget, sloHealth } from './agentMetricsHelpers';

const HEALTH_STYLES = {
  healthy: { color: 'text-nexus-emerald', bg: 'bg-nexus-emerald/10', border: 'border-nexus-emerald/30', Icon: CheckCircle2, label: 'Saudável' },
  warning: { color: 'text-nexus-amber', bg: 'bg-nexus-amber/10', border: 'border-nexus-amber/30', Icon: AlertTriangle, label: 'Atenção' },
  critical: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30', Icon: XCircle, label: 'Crítico' },
} as const;

interface Props {
  targets: SLOTarget[];
}

export function SLOPanel({ targets }: Props) {
  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground">Painel SLO</h3>
          <p className="text-[11px] text-muted-foreground">Service Level Objectives — janela atual de traces</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {targets.map((t) => {
          const health = sloHealth(t);
          const style = HEALTH_STYLES[health];
          const ratio = t.inverted
            ? Math.min(100, (t.target / Math.max(t.value, 0.001)) * 100)
            : Math.min(100, (t.value / t.target) * 100);

          return (
            <div key={t.label} className={`rounded-lg border ${style.border} ${style.bg} p-3`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-foreground">{t.label}</p>
                <div className={`flex items-center gap-1 text-[10px] font-semibold ${style.color}`}>
                  <style.Icon className="h-3 w-3" />
                  {style.label}
                </div>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-xl font-heading font-extrabold text-foreground tabular-nums">
                  {t.unit === '%' ? t.value.toFixed(2) : Math.round(t.value).toLocaleString('pt-BR')}
                </span>
                <span className="text-[11px] text-muted-foreground">{t.unit}</span>
                <span className="text-[10px] text-muted-foreground ml-auto font-mono">
                  alvo: {t.unit === '%' ? t.target : t.target.toLocaleString('pt-BR')}{t.unit}
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-secondary/60 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    health === 'healthy' ? 'bg-nexus-emerald' : health === 'warning' ? 'bg-nexus-amber' : 'bg-destructive'
                  }`}
                  style={{ width: `${ratio}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
