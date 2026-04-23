import { useMemo, useState } from 'react';
import { ArrowRight, Plus, Minus, Pencil, MessageSquare, Wrench, Cpu, CheckCircle2, Filter, ShieldAlert, AlertTriangle, Info, ShieldCheck } from 'lucide-react';
import type { AgentVersion } from '@/services/agentsService';
import { computeRestoreDiff, type FieldChange, type RiskLevel } from './restoreDiffHelpers';

interface Props {
  current: AgentVersion | null | undefined;
  source: AgentVersion;
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
}

const GROUP_META: Record<FieldChange['group'], { label: string; icon: typeof MessageSquare; tone: string }> = {
  prompt: { label: 'Prompt', icon: MessageSquare, tone: 'text-primary' },
  tools: { label: 'Ferramentas', icon: Wrench, tone: 'text-nexus-amber' },
  model: { label: 'Modelo & parâmetros', icon: Cpu, tone: 'text-nexus-emerald' },
};

const KIND_META: Record<FieldChange['kind'], { icon: typeof Plus; tone: string; label: string }> = {
  added: { icon: Plus, tone: 'text-nexus-emerald bg-nexus-emerald/10 border-nexus-emerald/30', label: 'Adicionado' },
  removed: { icon: Minus, tone: 'text-destructive bg-destructive/10 border-destructive/30', label: 'Removido' },
  modified: { icon: Pencil, tone: 'text-primary bg-primary/10 border-primary/30', label: 'Alterado' },
};

// Metadados por nível de risco — usados no filtro e no badge de cada item.
// Ordem importa: 'critical' primeiro nos toggles para hierarquia visual.
const RISK_META: Record<RiskLevel, { label: string; tone: string; chipTone: string; icon: typeof ShieldAlert }> = {
  critical: { label: 'Crítico', tone: 'text-destructive', chipTone: 'bg-destructive/15 text-destructive border-destructive/40', icon: ShieldAlert },
  high: { label: 'Alto', tone: 'text-nexus-amber', chipTone: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/40', icon: AlertTriangle },
  medium: { label: 'Médio', tone: 'text-primary', chipTone: 'bg-primary/15 text-primary border-primary/40', icon: Info },
  low: { label: 'Baixo', tone: 'text-muted-foreground', chipTone: 'bg-muted text-muted-foreground border-border/60', icon: ShieldCheck },
};

const RISK_ORDER: RiskLevel[] = ['critical', 'high', 'medium', 'low'];

// Presets do filtro: "Só alto risco" é o pedido principal; "Tudo" e "Só crítico"
// cobrem os extremos. Usuários ainda podem alternar individualmente cada nível.
type RiskPreset = 'all' | 'high_critical' | 'critical_only' | 'medium_low' | 'custom';

const PRESET_SETS: Record<Exclude<RiskPreset, 'custom'>, Set<RiskLevel>> = {
  all: new Set(['critical', 'high', 'medium', 'low']),
  high_critical: new Set(['critical', 'high']),
  critical_only: new Set(['critical']),
  medium_low: new Set(['medium', 'low']),
};

function setsEqual(a: Set<RiskLevel>, b: Set<RiskLevel>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function detectPreset(active: Set<RiskLevel>): RiskPreset {
  for (const key of Object.keys(PRESET_SETS) as Array<Exclude<RiskPreset, 'custom'>>) {
    if (setsEqual(active, PRESET_SETS[key])) return key;
  }
  return 'custom';
}

function preview(v: unknown, max = 70): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) {
    if (v.length === 0) return '[ ]';
    return `[${v.slice(0, 4).map(String).join(', ')}${v.length > 4 ? `, +${v.length - 4}` : ''}]`;
  }
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export function RestoreDiffPreview({ current, source, options }: Props) {
  const diff = useMemo(() => computeRestoreDiff(current, source, options), [current, source, options]);

  // Default: mostrar tudo. Usuário pode focar em alto/crítico para revisar
  // riscos primeiro, ou inverter para auditar mudanças cosméticas (médio/baixo).
  const [activeRisks, setActiveRisks] = useState<Set<RiskLevel>>(() => new Set(RISK_ORDER));

  // Contagem por nível ANTES do filtro — usada nos toggles para mostrar
  // quantos itens existem em cada bucket (ex.: "Crítico (2)").
  const riskCounts = useMemo(() => {
    const counts: Record<RiskLevel, number> = { critical: 0, high: 0, medium: 0, low: 0 };
    diff.changes.forEach((c) => { counts[c.risk] += 1; });
    return counts;
  }, [diff.changes]);

  const filteredChanges = useMemo(
    () => diff.changes.filter((c) => activeRisks.has(c.risk)),
    [diff.changes, activeRisks],
  );

  const grouped = useMemo(() => {
    const map = new Map<FieldChange['group'], FieldChange[]>();
    filteredChanges.forEach((c) => {
      if (!map.has(c.group)) map.set(c.group, []);
      map.get(c.group)!.push(c);
    });
    return map;
  }, [filteredChanges]);

  const currentPreset = detectPreset(activeRisks);
  const hiddenCount = diff.changes.length - filteredChanges.length;

  const applyPreset = (preset: Exclude<RiskPreset, 'custom'>) => {
    setActiveRisks(new Set(PRESET_SETS[preset]));
  };

  const toggleRisk = (level: RiskLevel) => {
    setActiveRisks((prev) => {
      const next = new Set(prev);
      if (next.has(level)) next.delete(level);
      else next.add(level);
      // Garante que sempre haja pelo menos um nível ativo — caso contrário
      // o painel ficaria sem sinal e o usuário precisaria adivinhar como voltar.
      if (next.size === 0) return prev;
      return next;
    });
  };

  if (diff.changes.length === 0) {
    return (
      <div className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-3 flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden="true" />
        <div>
          <p className="text-xs font-semibold text-nexus-emerald">Nenhuma alteração efetiva</p>
          <p className="text-[11px] text-muted-foreground">A versão de origem é idêntica à atual nos campos selecionados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border/60 bg-card/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/40 border-b border-border/50">
        <p className="text-xs font-semibold text-foreground">
          {filteredChanges.length === diff.changes.length
            ? <>{diff.changes.length} alteraç{diff.changes.length === 1 ? 'ão' : 'ões'} a aplicar</>
            : <>{filteredChanges.length} de {diff.changes.length} alteraç{diff.changes.length === 1 ? 'ão' : 'ões'}</>}
        </p>
        <div className="flex items-center gap-1.5 text-[10px]">
          {diff.toolsAdded.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-nexus-emerald/10 text-nexus-emerald font-mono">+{diff.toolsAdded.length} tool</span>
          )}
          {diff.toolsRemoved.length > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono">−{diff.toolsRemoved.length} tool</span>
          )}
          {diff.promptDeltaChars !== 0 && (
            <span className="px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
              {diff.promptDeltaChars > 0 ? '+' : ''}{diff.promptDeltaChars} chars
            </span>
          )}
        </div>
      </div>

      {/* Filtro de risco — presets rápidos + toggles individuais por nível.
          Permite focar em alto/crítico (revisão de risco) ou inverter para
          médio/baixo (auditar mudanças cosméticas). */}
      <div className="px-3 py-2 bg-background/40 border-b border-border/50 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <Filter className="h-3 w-3 text-muted-foreground shrink-0" aria-hidden="true" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">Filtrar por risco</span>
          {(['high_critical', 'critical_only', 'medium_low', 'all'] as const).map((preset) => {
            const labels: Record<typeof preset, string> = {
              high_critical: 'Alto + Crítico',
              critical_only: 'Só crítico',
              medium_low: 'Médio + Baixo',
              all: 'Tudo',
            } as const;
            const active = currentPreset === preset;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium border transition-colors ${
                  active
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-transparent text-muted-foreground border-border/50 hover:bg-muted/40 hover:text-foreground'
                }`}
                aria-pressed={active}
              >
                {labels[preset]}
              </button>
            );
          })}
          {currentPreset === 'custom' && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium border bg-primary/10 text-primary border-primary/30">
              Personalizado
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          {RISK_ORDER.map((level) => {
            const meta = RISK_META[level];
            const RiskIcon = meta.icon;
            const active = activeRisks.has(level);
            const count = riskCounts[level];
            const disabled = count === 0;
            return (
              <button
                key={level}
                type="button"
                onClick={() => toggleRisk(level)}
                disabled={disabled}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-mono transition-colors ${
                  disabled
                    ? 'opacity-40 cursor-not-allowed border-border/40 text-muted-foreground'
                    : active
                      ? meta.chipTone
                      : 'border-border/50 text-muted-foreground hover:bg-muted/40'
                }`}
                aria-pressed={active}
                title={disabled ? `Nenhuma mudança ${meta.label.toLowerCase()}` : `${active ? 'Esconder' : 'Mostrar'} ${meta.label.toLowerCase()}`}
              >
                <RiskIcon className="h-2.5 w-2.5" aria-hidden="true" />
                {meta.label}
                <span className="opacity-70">({count})</span>
              </button>
            );
          })}
          {hiddenCount > 0 && (
            <span className="ml-auto text-[10px] text-muted-foreground italic">
              {hiddenCount} oculta{hiddenCount === 1 ? '' : 's'} pelo filtro
            </span>
          )}
        </div>
      </div>

      <div className="max-h-[280px] overflow-y-auto divide-y divide-border/30">
        {filteredChanges.length === 0 && (
          <div className="p-4 flex items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <Filter className="h-3 w-3" aria-hidden="true" />
            Todas as mudanças foram filtradas. Ajuste os níveis de risco acima.
          </div>
        )}
        {Array.from(grouped.entries()).map(([group, items]) => {
          const meta = GROUP_META[group];
          const GroupIcon = meta.icon;
          return (
            <div key={group} className="p-3 space-y-2">
              <div className="flex items-center gap-1.5">
                <GroupIcon className={`h-3.5 w-3.5 ${meta.tone}`} aria-hidden="true" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{meta.label}</span>
                <span className="text-[10px] text-muted-foreground">({items.length})</span>
              </div>

              <ul className="space-y-1.5">
                {items.map((c) => {
                  const kindMeta = KIND_META[c.kind];
                  const KindIcon = kindMeta.icon;
                  const riskMeta = RISK_META[c.risk];
                  const RiskIcon = riskMeta.icon;
                  const riskBadge = (
                    <span
                      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono ${riskMeta.chipTone}`}
                      title={`Risco ${riskMeta.label.toLowerCase()} — ${c.reason} (impacto ${c.impact}/100)`}
                    >
                      <RiskIcon className="h-2.5 w-2.5" aria-hidden="true" />
                      {riskMeta.label}
                    </span>
                  );
                  // Para ferramentas, mostrar lista detalhada de adições/remoções
                  if (c.field === 'tools') {
                    return (
                      <li key={c.field} className="rounded-md border border-border/40 bg-background/50 p-2 text-[11px] space-y-1.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono ${kindMeta.tone}`}>
                            <KindIcon className="h-2.5 w-2.5" aria-hidden="true" />
                            {kindMeta.label}
                          </span>
                          {riskBadge}
                          <span className="font-medium text-foreground">{c.label}</span>
                        </div>
                        {diff.toolsAdded.length > 0 && (
                          <p className="text-nexus-emerald font-mono text-[10px]">
                            + {diff.toolsAdded.join(', ')}
                          </p>
                        )}
                        {diff.toolsRemoved.length > 0 && (
                          <p className="text-destructive font-mono text-[10px]">
                            − {diff.toolsRemoved.join(', ')}
                          </p>
                        )}
                      </li>
                    );
                  }
                  return (
                    <li key={c.field} className="rounded-md border border-border/40 bg-background/50 p-2 text-[11px]">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border text-[10px] font-mono ${kindMeta.tone}`}>
                          <KindIcon className="h-2.5 w-2.5" aria-hidden="true" />
                          {kindMeta.label}
                        </span>
                        {riskBadge}
                        <span className="font-medium text-foreground">{c.label}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span className="line-through opacity-70 truncate max-w-[40%]" title={String(c.before)}>{preview(c.before)}</span>
                        <ArrowRight className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
                        <span className="text-foreground truncate max-w-[55%]" title={String(c.after)}>{preview(c.after)}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}

        {diff.unchangedGroups.length > 0 && filteredChanges.length > 0 && (
          <div className="px-3 py-2 bg-secondary/20">
            <p className="text-[10px] text-muted-foreground">
              <CheckCircle2 className="h-2.5 w-2.5 inline-block mr-1 text-nexus-emerald" aria-hidden="true" />
              Sem mudanças em: {diff.unchangedGroups.map((g) => GROUP_META[g].label.toLowerCase()).join(', ')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
