import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Loader2,
  RotateCcw,
  FileText,
  Wrench,
  Cpu,
  GitCompareArrows,
  Plus,
  Minus as MinusIcon,
  Pencil,
  Eye,
  ArrowLeft,
  ShieldAlert,
  ShieldCheck,
  Flame,
  ExternalLink,
} from "lucide-react";
import type { AgentVersion, RestoreOptions } from "@/services/agentsService";
import { getVersionTools, getVersionPrompt, getVersionScalar } from "@/lib/agentChangelog";
import { computeRestoreDiff, type FieldChange, type RiskLevel } from "@/components/agents/detail/restoreDiffHelpers";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: AgentVersion;
  current: AgentVersion;
  nextVersionNumber: number;
  restoring: boolean;
  onConfirm: (options: RestoreOptions) => void;
}

export function RestoreVersionDialog({ open, onOpenChange, source, current, nextVersionNumber, restoring, onConfirm }: Props) {
  const navigate = useNavigate();
  const [copyPrompt, setCopyPrompt] = useState(true);
  const [copyTools, setCopyTools] = useState(true);
  const [copyModel, setCopyModel] = useState(false);

  // Atalhos para ir direto às telas de configuração do agente. Usam deep-link
  // por query param ?tab=... no AgentBuilder. Fechamos o dialog antes de
  // navegar para evitar overlay travado e oferecer uma transição limpa.
  const goToBuilder = (tab: 'prompt' | 'tools' | 'brain') => {
    onOpenChange(false);
    navigate(`/builder/${source.agent_id}?tab=${tab}`);
  };
  // "Ver detalhes" abre uma sub-view dentro do mesmo Dialog para mostrar o
  // diff em texto completo (antes/depois) com realce e rolagem. Mantemos no
  // mesmo Dialog para preservar o estado dos toggles.
  const [showFullDiff, setShowFullDiff] = useState(false);

  const tools = useMemo(() => getVersionTools(source), [source]);
  const prompt = useMemo(() => getVersionPrompt(source), [source]);
  const temperature = getVersionScalar<number>(source, 'temperature');
  const maxTokens = getVersionScalar<number>(source, 'max_tokens');

  const diff = useMemo(
    () => computeRestoreDiff(current, source, { copyPrompt, copyTools, copyModel }),
    [current, source, copyPrompt, copyTools, copyModel],
  );

  const parts: string[] = [];
  if (copyPrompt) parts.push('prompt');
  if (copyTools) parts.push('ferramentas');
  if (copyModel) parts.push('modelo');
  const summary = parts.length > 0
    ? `Restaurado de v${source.version} (${parts.join(' + ')})`
    : `Restaurado de v${source.version} (sem alterações)`;

  const canConfirm = parts.length > 0;
  const sameAsCurrent = source.id === current.id;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setShowFullDiff(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {showFullDiff ? (
          <FullDiffView
            changes={diff.changes}
            sourceVersion={source.version}
            currentVersion={current.version}
            onBack={() => setShowFullDiff(false)}
          />
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4 text-primary" aria-hidden="true" />
                Restaurar v{source.version} → criar v{nextVersionNumber}
              </DialogTitle>
              <DialogDescription>
                Selecione o que copiar de v{source.version} para a nova versão. As demais partes herdam de v{current.version} (atual).
              </DialogDescription>
            </DialogHeader>

            {sameAsCurrent && (
              <div className="text-xs text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-lg px-3 py-2">
                Você está restaurando a versão atual sobre ela mesma — a nova versão será praticamente idêntica.
              </div>
            )}

            <div className="space-y-3">
              <RestoreOption
                id="copy-prompt"
                checked={copyPrompt}
                onChange={setCopyPrompt}
                icon={<FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                label="System prompt"
                meta={`${prompt.length.toLocaleString('pt-BR')} chars`}
                preview={prompt ? `"${prompt.slice(0, 140).replace(/\s+/g, ' ').trim()}${prompt.length > 140 ? '…' : ''}"` : 'Sem prompt definido'}
              />
              <RestoreOption
                id="copy-tools"
                checked={copyTools}
                onChange={setCopyTools}
                icon={<Wrench className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                label="Ferramentas"
                meta={`${tools.length} ativa${tools.length !== 1 ? 's' : ''}`}
                preview={tools.length === 0
                  ? 'Nenhuma ferramenta ativa'
                  : tools.slice(0, 6).join(' · ') + (tools.length > 6 ? ` · +${tools.length - 6}` : '')}
              />
              <RestoreOption
                id="copy-model"
                checked={copyModel}
                onChange={setCopyModel}
                icon={<Cpu className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
                label="Modelo & parâmetros"
                meta={source.model ?? 'sem modelo'}
                preview={`${source.persona ?? '—'} · temp ${temperature ?? '—'} · max ${maxTokens ?? '—'}`}
              />
            </div>

            <LiveDiffPreview
              changes={diff.changes}
              toolsAdded={diff.toolsAdded}
              toolsRemoved={diff.toolsRemoved}
              promptDeltaChars={diff.promptDeltaChars}
              unchangedGroups={diff.unchangedGroups}
              anyOptionSelected={canConfirm}
              sourceVersion={source.version}
              currentVersion={current.version}
              overallImpact={diff.overallImpact}
              overallRisk={diff.overallRisk}
              onShowFullDiff={() => setShowFullDiff(true)}
              onGoToBuilder={goToBuilder}
            />

            <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prévia do changelog</p>
              <p className="text-xs font-mono text-foreground">{summary}</p>
            </div>

            <DialogFooter className="gap-2 sm:gap-2">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={restoring}>
                Cancelar
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => onConfirm({ copyPrompt, copyTools, copyModel })}
                disabled={!canConfirm || restoring}
              >
                {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
                Criar v{nextVersionNumber}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RestoreOption({ id, checked, onChange, icon, label, meta, preview }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  meta: string;
  preview: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-border/50 bg-card hover:border-primary/20 hover:bg-secondary/20'
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {icon}
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">{meta}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{preview}</p>
      </div>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/*  Live diff preview                                                  */
/* ------------------------------------------------------------------ */

function fmtValue(v: unknown, max = 60): string {
  if (v === null || v === undefined || v === '') return '—';
  if (Array.isArray(v)) {
    return v.length === 0 ? '∅' : v.slice(0, 4).join(', ') + (v.length > 4 ? ` +${v.length - 4}` : '');
  }
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  const flat = s.replace(/\s+/g, ' ').trim();
  return flat.length > max ? flat.slice(0, max) + '…' : flat;
}

function ChangeKindBadge({ kind }: { kind: FieldChange['kind'] }) {
  const map = {
    added:    { Icon: Plus,      cls: 'text-nexus-emerald bg-nexus-emerald/10 border-nexus-emerald/30', label: 'add' },
    removed:  { Icon: MinusIcon, cls: 'text-destructive bg-destructive/10 border-destructive/30',       label: 'rem' },
    modified: { Icon: Pencil,    cls: 'text-primary bg-primary/10 border-primary/30',                   label: 'mod' },
  } as const;
  const { Icon, cls, label } = map[kind];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ${cls}`}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Risk badges / banner                                               */
/* ------------------------------------------------------------------ */

const RISK_META: Record<RiskLevel, { label: string; cls: string; Icon: typeof ShieldCheck; ringCls: string }> = {
  critical: {
    label: 'crítico',
    cls: 'text-destructive bg-destructive/15 border-destructive/40',
    Icon: Flame,
    ringCls: 'border-l-destructive',
  },
  high: {
    label: 'alto',
    cls: 'text-nexus-amber bg-nexus-amber/15 border-nexus-amber/40',
    Icon: ShieldAlert,
    ringCls: 'border-l-nexus-amber',
  },
  medium: {
    label: 'médio',
    cls: 'text-primary bg-primary/10 border-primary/30',
    Icon: ShieldAlert,
    ringCls: 'border-l-primary',
  },
  low: {
    label: 'baixo',
    cls: 'text-nexus-emerald bg-nexus-emerald/10 border-nexus-emerald/30',
    Icon: ShieldCheck,
    ringCls: 'border-l-nexus-emerald/60',
  },
};

function RiskBadge({ risk, score, showScore = false }: { risk: RiskLevel; score?: number; showScore?: boolean }) {
  const meta = RISK_META[risk];
  const { Icon } = meta;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-mono font-semibold uppercase ${meta.cls}`}
      title={score !== undefined ? `Score de impacto: ${score}/100` : undefined}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {meta.label}
      {showScore && score !== undefined && <span className="opacity-70">·{score}</span>}
    </span>
  );
}

function RiskBanner({ risk, score, changeCount }: { risk: RiskLevel; score: number; changeCount: number }) {
  const meta = RISK_META[risk];
  const { Icon } = meta;
  const headlines: Record<RiskLevel, string> = {
    critical: 'Restauração de risco crítico',
    high: 'Restauração de risco alto',
    medium: 'Restauração de risco moderado',
    low: 'Restauração de baixo risco',
  };
  const subtitles: Record<RiskLevel, string> = {
    critical: 'Inclui mudanças muito impactantes — revise os destaques abaixo antes de confirmar.',
    high: 'Mudanças significativas detectadas. Verifique os itens com badge alto/crítico.',
    medium: 'Mudanças moderadas no comportamento do agente.',
    low: 'Apenas ajustes menores — comportamento deve permanecer estável.',
  };
  return (
    <div className={`rounded-lg border ${meta.cls} px-3 py-2 flex items-start gap-2`}>
      <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs font-semibold">{headlines[risk]}</p>
          <span className="text-[10px] font-mono opacity-80">
            score {score}/100 · {changeCount} mudança{changeCount === 1 ? '' : 's'}
          </span>
        </div>
        <p className="text-[11px] opacity-90 mt-0.5">{subtitles[risk]}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Live diff preview                                                  */
/* ------------------------------------------------------------------ */

function LiveDiffPreview({
  changes,
  toolsAdded,
  toolsRemoved,
  promptDeltaChars,
  unchangedGroups,
  anyOptionSelected,
  sourceVersion,
  currentVersion,
  overallImpact,
  overallRisk,
  onShowFullDiff,
  onGoToBuilder,
}: {
  changes: FieldChange[];
  toolsAdded: string[];
  toolsRemoved: string[];
  promptDeltaChars: number;
  unchangedGroups: Array<'prompt' | 'tools' | 'model'>;
  anyOptionSelected: boolean;
  sourceVersion: number;
  currentVersion: number;
  overallImpact: number;
  overallRisk: RiskLevel;
  onShowFullDiff: () => void;
  onGoToBuilder: (tab: 'prompt' | 'tools' | 'brain') => void;
}) {
  const groupLabel: Record<'prompt' | 'tools' | 'model', string> = {
    prompt: 'Prompt',
    tools: 'Ferramentas',
    model: 'Modelo & parâmetros',
  };

  // Top-3 mudanças mais impactantes — destaque "Top changes" na UI.
  const topChanges = changes.slice(0, Math.min(3, changes.length));
  const topIds = new Set(topChanges.map((c) => `${c.group}-${c.field}`));

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.03] px-3 py-3 space-y-2.5">
      <div className="flex items-center gap-1.5">
        <GitCompareArrows className="h-3.5 w-3.5 text-primary" aria-hidden="true" />
        <h4 className="text-xs font-semibold text-foreground">Diff em tempo real</h4>
        <span className="text-[10px] text-muted-foreground ml-auto font-mono">
          v{currentVersion} (atual) → v{sourceVersion} (origem)
        </span>
      </div>

      {!anyOptionSelected ? (
        <p className="text-[11px] text-muted-foreground italic">
          Selecione ao menos um campo acima para ver o diff.
        </p>
      ) : changes.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">
          Nenhuma diferença detectada nos campos selecionados — a nova versão será idêntica à atual.
        </p>
      ) : (
        <>
          {/* Banner de risco geral */}
          <RiskBanner risk={overallRisk} score={overallImpact} changeCount={changes.length} />

          {/* Badges resumo */}
          <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
            {toolsAdded.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald px-1.5 py-0.5 font-mono">
                <Plus className="h-2.5 w-2.5" aria-hidden="true" />
                {toolsAdded.length} tool{toolsAdded.length === 1 ? '' : 's'}
              </span>
            )}
            {toolsRemoved.length > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full border border-destructive/30 bg-destructive/10 text-destructive px-1.5 py-0.5 font-mono">
                <MinusIcon className="h-2.5 w-2.5" aria-hidden="true" />
                {toolsRemoved.length} tool{toolsRemoved.length === 1 ? '' : 's'}
              </span>
            )}
            {promptDeltaChars !== 0 && (
              <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 font-mono ${
                promptDeltaChars > 0
                  ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
                  : 'border-destructive/30 bg-destructive/10 text-destructive'
              }`}>
                {promptDeltaChars > 0 ? '+' : ''}{promptDeltaChars.toLocaleString('pt-BR')} chars no prompt
              </span>
            )}

            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onShowFullDiff}
              className="ml-auto h-6 px-2 text-[10px] font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10"
            >
              <Eye className="h-3 w-3" aria-hidden="true" />
              Ver detalhes
            </Button>
          </div>

          {/* Top mudanças (ranking) */}
          {topChanges.length > 0 && (
            <div className="rounded-md border border-border/40 bg-background/30 px-2 py-1.5">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1 font-semibold flex items-center gap-1">
                <Flame className="h-2.5 w-2.5 text-nexus-amber" aria-hidden="true" />
                Top {topChanges.length} mudança{topChanges.length === 1 ? '' : 's'} de maior impacto
              </p>
              <ul className="space-y-0.5">
                {topChanges.map((c, idx) => (
                  <li key={`top-${c.group}-${c.field}`} className="flex items-center gap-1.5 text-[11px]">
                    <span className="font-mono text-[9px] text-muted-foreground/70 w-3.5 shrink-0">#{idx + 1}</span>
                    <RiskBadge risk={c.risk} score={c.impact} showScore />
                    <span className="font-semibold text-foreground truncate">{c.label}</span>
                    <span className="text-[10px] text-muted-foreground truncate" title={c.reason}>· {c.reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Lista completa ranqueada */}
          <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
            {changes.map((c) => {
              const meta = RISK_META[c.risk];
              const isTop = topIds.has(`${c.group}-${c.field}`);
              return (
                <li
                  key={`${c.group}-${c.field}`}
                  className={`grid grid-cols-[auto_1fr] gap-2 items-start rounded-md border bg-background/40 px-2 py-1.5 border-l-4 ${meta.ringCls} ${
                    isTop ? 'border-border/60 shadow-sm' : 'border-border/40'
                  }`}
                >
                  <div className="flex flex-col items-start gap-1 pt-0.5">
                    <ChangeKindBadge kind={c.kind} />
                    <RiskBadge risk={c.risk} score={c.impact} showScore />
                    <span className="text-[9px] font-mono uppercase text-muted-foreground/70">{c.group}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-foreground flex items-center gap-1.5">
                      {c.label}
                      <span className="text-[9px] font-normal text-muted-foreground/80 truncate">· {c.reason}</span>
                    </p>
                    <p className="text-[10px] font-mono text-muted-foreground truncate" title={fmtValue(c.before, 500)}>
                      <span className="text-destructive/80">−</span> {fmtValue(c.before)}
                    </p>
                    <p className="text-[10px] font-mono text-foreground/90 truncate" title={fmtValue(c.after, 500)}>
                      <span className="text-nexus-emerald">+</span> {fmtValue(c.after)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {unchangedGroups.length > 0 && anyOptionSelected && (
        <p className="text-[10px] text-muted-foreground/70 pt-1 border-t border-border/30">
          Sem mudanças em: {unchangedGroups.map((g) => groupLabel[g]).join(' · ')}
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Full text diff view (sub-tela do dialog)                          */
/* ------------------------------------------------------------------ */

/**
 * Converte qualquer valor (string / objeto / número) numa string multilinha
 * adequada para diff por linha. JSON é pretty-printed para que campos
 * estruturados (parâmetros do modelo, listas de tools) tenham uma linha por
 * propriedade — o que torna o realce muito mais útil.
 */
function toDiffText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

type DiffLine = { kind: 'context' | 'add' | 'remove'; text: string };

/**
 * LCS-based line diff. Suficiente para textos curtos/médios (prompts até
 * alguns milhares de chars). Mais informativo do que só "antes / depois"
 * porque preserva linhas de contexto e destaca apenas o que mudou.
 */
function computeLineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n');
  const b = after.split('\n');
  const m = a.length;
  const n = b.length;
  // Build LCS length matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0, j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) { out.push({ kind: 'context', text: a[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ kind: 'remove', text: a[i] }); i++; }
    else { out.push({ kind: 'add', text: b[j] }); j++; }
  }
  while (i < m) { out.push({ kind: 'remove', text: a[i++] }); }
  while (j < n) { out.push({ kind: 'add', text: b[j++] }); }
  return out;
}

function FullDiffView({
  changes,
  sourceVersion,
  currentVersion,
  onBack,
}: {
  changes: FieldChange[];
  sourceVersion: number;
  currentVersion: number;
  onBack: () => void;
}) {
  // "Prompt e campos do modelo" — restringe aos grupos pedidos pelo usuário.
  const relevant = changes.filter((c) => c.group === 'prompt' || c.group === 'model');

  return (
    <>
      <DialogHeader>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="h-7 w-7 p-0 shrink-0"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <div className="min-w-0">
            <DialogTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4 text-primary" aria-hidden="true" />
              Diff detalhado — prompt & modelo
            </DialogTitle>
            <DialogDescription className="text-xs">
              Comparando v{currentVersion} (atual, em vermelho) com v{sourceVersion} (origem, em verde).
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      {relevant.length === 0 ? (
        <div className="rounded-lg border border-border/50 bg-secondary/30 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma diferença em prompt ou campos do modelo nas opções selecionadas.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {relevant.map((c) => (
            <DiffBlock key={`${c.group}-${c.field}`} change={c} />
          ))}
        </div>
      )}

      <DialogFooter>
        <Button variant="outline" size="sm" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
          Voltar para opções
        </Button>
      </DialogFooter>
    </>
  );
}

function DiffBlock({ change }: { change: FieldChange }) {
  const before = toDiffText(change.before);
  const after = toDiffText(change.after);
  const lines = useMemo(() => computeLineDiff(before, after), [before, after]);

  const adds = lines.filter((l) => l.kind === 'add').length;
  const removes = lines.filter((l) => l.kind === 'remove').length;

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-secondary/40 border-b border-border/50">
        <div className="flex items-center gap-2 min-w-0">
          <ChangeKindBadge kind={change.kind} />
          <RiskBadge risk={change.risk} score={change.impact} showScore />
          <span className="text-xs font-semibold text-foreground truncate">{change.label}</span>
          <span className="text-[10px] font-mono uppercase text-muted-foreground/70">{change.group}</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono shrink-0">
          <span className="text-nexus-emerald">+{adds}</span>
          <span className="text-destructive">−{removes}</span>
        </div>
      </div>

      {/* Diff body — rolagem vertical e horizontal preservada para
          conteúdos longos (prompts, JSON de parâmetros). */}
      <div className="max-h-72 overflow-auto bg-background/60">
        {lines.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground italic">Conteúdo vazio dos dois lados.</p>
        ) : (
          <pre className="text-[11px] font-mono leading-relaxed">
            {lines.map((l, idx) => {
              const cls =
                l.kind === 'add'
                  ? 'bg-nexus-emerald/10 text-nexus-emerald border-l-2 border-nexus-emerald/60'
                  : l.kind === 'remove'
                  ? 'bg-destructive/10 text-destructive border-l-2 border-destructive/60'
                  : 'text-muted-foreground border-l-2 border-transparent';
              const sigil = l.kind === 'add' ? '+' : l.kind === 'remove' ? '−' : ' ';
              return (
                <div key={idx} className={`px-3 py-0.5 whitespace-pre ${cls}`}>
                  <span className="select-none opacity-70 mr-2">{sigil}</span>
                  {l.text || '\u00A0'}
                </div>
              );
            })}
          </pre>
        )}
      </div>
    </div>
  );
}
