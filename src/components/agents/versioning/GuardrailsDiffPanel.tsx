import { ArrowRight, Plus, Minus, Settings2, ShieldCheck, ArrowUp, ArrowDown, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { useState } from "react";
import {
  diffGuardrails,
  compareSeverity,
  getVersionGuardrailObjects,
  type GuardrailLike,
} from "@/lib/agentChangelog";
import type { AgentVersion } from "@/services/agentsService";

interface Props {
  versionA: AgentVersion;
  versionB: AgentVersion;
}

const CATEGORY_LABEL: Record<string, { label: string; icon: string }> = {
  input_validation: { label: 'Validação de entrada', icon: '🛡' },
  output_safety: { label: 'Segurança de saída', icon: '🚫' },
  access_control: { label: 'Controle de acesso', icon: '🔐' },
  operational: { label: 'Operacional', icon: '⚙' },
  uncategorized: { label: 'Sem categoria', icon: '·' },
};

function severityBadge(sev?: string) {
  if (!sev) return <span className="text-muted-foreground/60">—</span>;
  const map: Record<string, string> = {
    block: 'bg-destructive/10 text-destructive',
    warn: 'bg-nexus-amber/10 text-nexus-amber',
    log: 'bg-muted text-muted-foreground',
  };
  return (
    <Badge className={`${map[sev] ?? 'bg-secondary text-foreground'} text-[10px] px-1.5 py-0 font-mono`}>
      {sev}
    </Badge>
  );
}

function formatValue(v: unknown): string {
  if (v === undefined) return '—';
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number' || typeof v === 'string') return String(v);
  const s = JSON.stringify(v);
  return s.length > 40 ? `${s.slice(0, 40)}…` : s;
}

export function GuardrailsDiffPanel({ versionA, versionB }: Props) {
  const [open, setOpen] = useState(false);
  const diff = diffGuardrails(versionA, versionB);
  const allA = getVersionGuardrailObjects(versionA);
  const allB = getVersionGuardrailObjects(versionB);
  const hasAny = allA.length + allB.length > 0;
  const totalChanges = diff.summary.added + diff.summary.removed + diff.summary.modified;

  if (!hasAny) {
    return (
      <div className="nexus-card">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Guardrails</h4>
        <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhum guardrail configurado em nenhuma das versões.</p>
      </div>
    );
  }

  const categoryEntries = Object.entries(diff.byCategory).sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div className="nexus-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" aria-hidden />
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide">Guardrails</h4>
          <span className="text-[11px] text-muted-foreground">
            {allA.length} → {allB.length} totais · {totalChanges} mudança(s)
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {diff.summary.added > 0 && (
            <Badge className="bg-nexus-emerald/10 text-nexus-emerald text-[10px] px-1.5 py-0 gap-0.5">
              <Plus className="h-2.5 w-2.5" aria-hidden /> {diff.summary.added}
            </Badge>
          )}
          {diff.summary.removed > 0 && (
            <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0 gap-0.5">
              <Minus className="h-2.5 w-2.5" aria-hidden /> {diff.summary.removed}
            </Badge>
          )}
          {diff.summary.modified > 0 && (
            <Badge className="bg-nexus-amber/10 text-nexus-amber text-[10px] px-1.5 py-0 gap-0.5">
              <Settings2 className="h-2.5 w-2.5" aria-hidden /> {diff.summary.modified}
            </Badge>
          )}
          {totalChanges === 0 && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">sem mudanças</Badge>
          )}
        </div>
      </div>

      {/* Por categoria */}
      <div>
        <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">Por categoria</h5>
        <ul className="space-y-1">
          {categoryEntries.map(([cat, c]) => {
            const meta = CATEGORY_LABEL[cat] ?? { label: cat, icon: '·' };
            const deltaColor =
              c.delta > 0 ? 'text-nexus-emerald' : c.delta < 0 ? 'text-destructive' : 'text-muted-foreground';
            const deltaLabel = c.delta === 0 ? '=' : c.delta > 0 ? `+${c.delta}` : `${c.delta}`;
            return (
              <li key={cat} className="flex items-center justify-between text-xs py-1">
                <span className="flex items-center gap-2">
                  <span aria-hidden>{meta.icon}</span>
                  <span className="text-foreground">{meta.label}</span>
                </span>
                <span className="font-mono text-muted-foreground">
                  v{versionA.version}: {c.prev} <ArrowRight className="inline h-2.5 w-2.5 mx-1" aria-hidden /> v{versionB.version}: {c.next}
                  <span className={`ml-2 font-semibold ${deltaColor}`}>({deltaLabel})</span>
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Severidade */}
      {diff.kept.some((k) => k.severityChanged) && (
        <div>
          <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Severidade alterada
          </h5>
          <ul className="space-y-1.5">
            {diff.kept.filter((k) => k.severityChanged).map((k) => {
              const change = k.severityChanged!;
              const cmp = compareSeverity(change.from, change.to);
              const color = cmp === 'stricter' ? 'text-nexus-emerald' : cmp === 'looser' ? 'text-destructive' : 'text-muted-foreground';
              const Icon = cmp === 'stricter' ? ArrowUp : cmp === 'looser' ? ArrowDown : ArrowRight;
              const judgment = cmp === 'stricter' ? 'mais estrito' : cmp === 'looser' ? 'mais leve' : 'lateral';
              return (
                <li key={k.key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-foreground truncate max-w-[200px]">{k.key}</span>
                  <span className="flex items-center gap-2">
                    {severityBadge(change.from)}
                    <Icon className={`h-3 w-3 ${color}`} aria-hidden />
                    {severityBadge(change.to)}
                    <span className={`text-[10px] ${color}`}>{judgment}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Thresholds / config */}
      {diff.kept.some((k) => k.configChanges.length > 0) && (
        <div>
          <h5 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Thresholds / config
          </h5>
          <ul className="space-y-1">
            {diff.kept.flatMap((k) =>
              k.configChanges.map((c) => (
                <li key={`${k.key}.${c.key}`} className="flex items-center justify-between text-xs py-0.5">
                  <span className="text-foreground">
                    <span className="font-mono">{k.key}</span>
                    <span className="text-muted-foreground"> · {c.key}</span>
                  </span>
                  <span className="font-mono text-[11px]">
                    <span className="text-destructive/80">{formatValue(c.from)}</span>
                    <ArrowRight className="inline h-2.5 w-2.5 mx-1 text-muted-foreground" aria-hidden />
                    <span className="text-nexus-emerald">{formatValue(c.to)}</span>
                  </span>
                </li>
              )),
            )}
          </ul>
        </div>
      )}

      {/* Adicionados / removidos rápidos */}
      {(diff.added.length > 0 || diff.removed.length > 0) && (
        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-border/40">
          {diff.added.length > 0 && (
            <div>
              <h5 className="text-[11px] font-semibold text-nexus-emerald uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Plus className="h-3 w-3" aria-hidden /> Adicionadas
              </h5>
              <ul className="space-y-1">
                {diff.added.map((g) => (
                  <li key={g.name || g.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-foreground truncate max-w-[160px]">{g.name || g.id}</span>
                    {severityBadge(g.severity)}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {diff.removed.length > 0 && (
            <div>
              <h5 className="text-[11px] font-semibold text-destructive uppercase tracking-wide mb-1.5 flex items-center gap-1">
                <Minus className="h-3 w-3" aria-hidden /> Removidas
              </h5>
              <ul className="space-y-1">
                {diff.removed.map((g) => (
                  <li key={g.name || g.id} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-foreground truncate max-w-[160px]">{g.name || g.id}</span>
                    {severityBadge(g.severity)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Detalhes */}
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex items-center gap-1 text-[11px] text-primary hover:underline">
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
          {open ? 'Ocultar detalhes' : 'Ver detalhes de todos os guardrails'}
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3">
          <FullTable a={allA} b={allB} versionA={versionA.version} versionB={versionB.version} diff={diff} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function FullTable({
  a, b, versionA, versionB, diff,
}: {
  a: GuardrailLike[];
  b: GuardrailLike[];
  versionA: number;
  versionB: number;
  diff: ReturnType<typeof diffGuardrails>;
}) {
  const allKeys = Array.from(new Set([...a, ...b].map((g) => g.name || g.id || ''))).filter(Boolean).sort();
  const aMap = new Map(a.map((g) => [g.name || g.id || '', g]));
  const bMap = new Map(b.map((g) => [g.name || g.id || '', g]));
  const modifiedKeys = new Set(diff.kept.map((k) => k.key));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border/50">
            <th className="text-left py-1.5 font-medium text-muted-foreground">Nome</th>
            <th className="text-left py-1.5 font-medium text-muted-foreground">Categoria</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">v{versionA}</th>
            <th className="text-center py-1.5 font-medium text-muted-foreground">v{versionB}</th>
            <th className="text-left py-1.5 pl-2 font-medium text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {allKeys.map((key) => {
            const ga = aMap.get(key);
            const gb = bMap.get(key);
            const status = ga && gb ? (modifiedKeys.has(key) ? 'modified' : 'kept') : gb ? 'added' : 'removed';
            const cat = (gb?.category || ga?.category || 'uncategorized');
            const catMeta = CATEGORY_LABEL[cat] ?? { label: cat, icon: '·' };
            return (
              <tr key={key} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                <td className="py-1.5 font-mono text-foreground truncate max-w-[180px]">{key}</td>
                <td className="py-1.5 text-muted-foreground">
                  <span aria-hidden className="mr-1">{catMeta.icon}</span>{catMeta.label}
                </td>
                <td className="py-1.5 text-center">{severityBadge(ga?.severity)}</td>
                <td className="py-1.5 text-center">{severityBadge(gb?.severity)}</td>
                <td className="py-1.5 pl-2">
                  {status === 'kept' && <span className="text-muted-foreground">=</span>}
                  {status === 'added' && <Badge className="bg-nexus-emerald/10 text-nexus-emerald text-[10px] px-1.5 py-0">+ adicionada</Badge>}
                  {status === 'removed' && <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0">− removida</Badge>}
                  {status === 'modified' && <Badge className="bg-nexus-amber/10 text-nexus-amber text-[10px] px-1.5 py-0">⚙ alterada</Badge>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
