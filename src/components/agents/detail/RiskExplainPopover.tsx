import { HelpCircle, Calculator, Plus, Minus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { RiskCriterion, RiskLevel } from './restoreDiffHelpers';

interface Props {
  riskLabel: string;
  riskTone: string; // classes para acento de cor
  level: RiskLevel;
  impact: number;
  criteria: RiskCriterion[];
  reason: string;
}

const LEVEL_THRESHOLDS: Array<{ level: RiskLevel; min: number; label: string }> = [
  { level: 'critical', min: 75, label: 'Crítico' },
  { level: 'high', min: 50, label: 'Alto' },
  { level: 'medium', min: 25, label: 'Médio' },
  { level: 'low', min: 0, label: 'Baixo' },
];

/** Popover explicativo ao lado do badge de risco. Detalha cada critério
 * que contribuiu para o score, mostra o cálculo e a faixa de classificação,
 * para que o usuário entenda exatamente como o nível foi atribuído. */
export function RiskExplainPopover({ riskLabel, riskTone, level, impact, criteria, reason }: Props) {
  const totalPoints = criteria.reduce((s, c) => s + c.points, 0);
  // Quando o impact final é diferente da soma bruta dos critérios, mostramos
  // um ajuste de cap (clamp em 100 ou Math.max no caso do prompt legacy).
  const adjustment = impact - totalPoints;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center justify-center w-4 h-4 rounded-full border transition-colors hover:bg-muted/40 ${riskTone}`}
          aria-label={`Por que o risco é ${riskLabel.toLowerCase()}?`}
          title={`Por que ${riskLabel.toLowerCase()}? (${impact}/100)`}
          onClick={(e) => e.stopPropagation()}
        >
          <HelpCircle className="h-2.5 w-2.5" aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`px-3 py-2 border-b border-border/50 ${riskTone.replace('text-', 'bg-').replace(/border-\S+/, '')} bg-opacity-10`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Calculator className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                Por que esse risco?
              </span>
            </div>
            <span className={`px-1.5 py-0.5 rounded border text-[10px] font-mono ${riskTone}`}>
              {riskLabel} · {impact}/100
            </span>
          </div>
          <p className="text-[11px] text-foreground mt-1 leading-snug">{reason}</p>
        </div>

        <div className="p-3 space-y-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Critérios que somaram
          </p>
          <ul className="space-y-1.5">
            {criteria.map((c, idx) => {
              const positive = c.points >= 0;
              const Icon = positive ? Plus : Minus;
              const pointsTone = positive
                ? c.points === 0
                  ? 'text-muted-foreground bg-muted/40 border-border/60'
                  : 'text-nexus-amber bg-nexus-amber/10 border-nexus-amber/30'
                : 'text-nexus-emerald bg-nexus-emerald/10 border-nexus-emerald/30';
              return (
                <li key={idx} className="flex items-start gap-2 text-[11px]">
                  <span className={`shrink-0 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border font-mono text-[10px] ${pointsTone}`}>
                    <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                    {Math.abs(c.points)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground font-medium leading-snug">{c.label}</p>
                    {c.detail && (
                      <p className="text-[10px] text-muted-foreground leading-snug">{c.detail}</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="pt-2 border-t border-border/40 space-y-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">Soma dos critérios</span>
              <span className="font-mono text-foreground">{totalPoints} pts</span>
            </div>
            {adjustment !== 0 && (
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground italic">
                  {adjustment > 0 ? 'Ajuste mínimo' : 'Cap aplicado'}
                </span>
                <span className="font-mono text-muted-foreground">{adjustment > 0 ? '+' : ''}{adjustment} pts</span>
              </div>
            )}
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-semibold text-foreground">Score final</span>
              <span className={`font-mono font-semibold ${riskTone.split(' ')[0]}`}>{impact}/100</span>
            </div>
          </div>

          <div className="pt-2 border-t border-border/40">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Faixa de classificação
            </p>
            <ul className="space-y-0.5">
              {LEVEL_THRESHOLDS.map((t) => {
                const isCurrent = t.level === level;
                return (
                  <li
                    key={t.level}
                    className={`flex items-center justify-between text-[10px] px-1.5 py-0.5 rounded ${
                      isCurrent ? 'bg-muted/60 font-semibold text-foreground' : 'text-muted-foreground'
                    }`}
                  >
                    <span>{t.label}</span>
                    <span className="font-mono">
                      {t.min}{t.min === 75 ? '–100' : t.min === 0 ? '–24' : t.level === 'high' ? '–74' : '–49'}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
