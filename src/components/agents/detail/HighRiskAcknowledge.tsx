/**
 * HighRiskAcknowledge — etapa extra de confirmação exigida quando o overall
 * risk de um rollback é "high" ou "critical". Lista todos os itens marcados
 * com badge vermelho (critical) ou âmbar (high) e força o usuário a marcar
 * um checkbox "Eu revisei" antes que o botão "Confirmar rollback" libere.
 *
 * Não bloqueia rollbacks de risco low/medium — esses seguem o fluxo normal.
 *
 * O estado de "ack" vive no parent (AgentDetailPage) para que possa ser
 * resetado quando: (a) o diálogo fecha, (b) a versão de origem muda, ou
 * (c) as opções (prompt/tools/modelo) mudam — qualquer uma dessas invalida
 * a revisão anterior.
 */
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { RestoreDiff, FieldChange } from './restoreDiffHelpers';

interface Props {
  diff: RestoreDiff;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  disabled?: boolean;
}

const RISK_META: Record<FieldChange['risk'], { label: string; chip: string; dot: string }> = {
  critical: {
    label: 'Crítico',
    chip: 'bg-destructive/15 text-destructive border-destructive/40',
    dot: 'bg-destructive',
  },
  high: {
    label: 'Alto',
    chip: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/40',
    dot: 'bg-nexus-amber',
  },
  medium: { label: 'Médio', chip: '', dot: '' },
  low: { label: 'Baixo', chip: '', dot: '' },
};

export function HighRiskAcknowledge({ diff, acknowledged, onAcknowledgedChange, disabled }: Props) {
  // Só aparece quando o risco agregado é alto ou crítico.
  if (diff.overallRisk !== 'high' && diff.overallRisk !== 'critical') return null;

  const flagged = diff.changes
    .filter((c) => c.risk === 'high' || c.risk === 'critical')
    .sort((a, b) => {
      // critical primeiro, depois por impacto desc
      if (a.risk !== b.risk) return a.risk === 'critical' ? -1 : 1;
      return b.impact - a.impact;
    });

  const isCritical = diff.overallRisk === 'critical';
  const headerColor = isCritical ? 'text-destructive' : 'text-nexus-amber';
  const borderColor = isCritical ? 'border-destructive/40' : 'border-nexus-amber/40';
  const bgColor = isCritical ? 'bg-destructive/5' : 'bg-nexus-amber/5';

  return (
    <div className={`rounded-lg border-2 ${borderColor} ${bgColor} overflow-hidden`}>
      <div className={`flex items-center gap-2 px-3 py-2 border-b ${borderColor} ${bgColor}`}>
        <ShieldAlert className={`h-4 w-4 ${headerColor}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-bold ${headerColor}`}>
            {isCritical ? 'Risco crítico — revisão obrigatória' : 'Risco alto — revisão obrigatória'}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight">
            Revise os {flagged.length} item(s) abaixo antes de continuar.
          </p>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
          isCritical ? 'bg-destructive/20 text-destructive border-destructive/50' : 'bg-nexus-amber/20 text-nexus-amber border-nexus-amber/50'
        }`}>
          {diff.overallImpact}/100
        </span>
      </div>

      <ul className="divide-y divide-border/40">
        {flagged.map((c, idx) => {
          const meta = RISK_META[c.risk];
          return (
            <li key={`${c.field}-${idx}`} className="px-3 py-2 flex items-start gap-2">
              <span
                className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${meta.dot}`}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-foreground">{c.label}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${meta.chip}`}>
                    {meta.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    impacto {c.impact}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{c.reason}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <label
        htmlFor="ack-high-risk"
        className={`flex items-start gap-2 px-3 py-2.5 border-t-2 ${borderColor} cursor-pointer transition-colors ${
          acknowledged ? 'bg-nexus-emerald/10' : 'bg-background/40 hover:bg-secondary/40'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : ''}`}
      >
        <Checkbox
          id="ack-high-risk"
          checked={acknowledged}
          onCheckedChange={(v) => onAcknowledgedChange(v === true)}
          disabled={disabled}
          className="mt-0.5"
        />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1">
            {!acknowledged && <AlertTriangle className="h-3 w-3 text-destructive" aria-hidden />}
            Revisei explicitamente os itens marcados acima
          </p>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Confirme que entendeu o impacto antes de prosseguir. Esta opção é resetada se você
            mudar a versão de origem ou os campos selecionados.
          </p>
        </div>
      </label>
    </div>
  );
}
