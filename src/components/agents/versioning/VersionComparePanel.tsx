import { ArrowRight, Plus, Minus, Pencil, FileEdit, Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PromptDiff } from "@/components/prompts/PromptDiff";
import type { AgentVersion } from "@/services/agentsService";
import {
  generateChangelog,
  getVersionTools,
  getVersionGuardrails,
  getVersionPrompt,
  type ChangelogEntry,
} from "@/lib/agentChangelog";

interface Props {
  versionA: AgentVersion;
  versionB: AgentVersion;
}

function entryIcon(kind: ChangelogEntry['kind']) {
  switch (kind) {
    case 'added': return <Plus className="h-3 w-3 text-nexus-emerald" aria-hidden />;
    case 'removed': return <Minus className="h-3 w-3 text-destructive" aria-hidden />;
    case 'modified': return <Pencil className="h-3 w-3 text-nexus-amber" aria-hidden />;
    case 'prompt_changed': return <FileEdit className="h-3 w-3 text-primary" aria-hidden />;
  }
}

function diffNamedLists(a: string[], b: string[]) {
  const all = Array.from(new Set([...a, ...b])).sort();
  return all.map(name => ({
    name,
    inA: a.includes(name),
    inB: b.includes(name),
  }));
}

export function VersionComparePanel({ versionA, versionB }: Props) {
  const changelog = generateChangelog(versionA, versionB);
  const promptA = getVersionPrompt(versionA);
  const promptB = getVersionPrompt(versionB);
  const toolsDiff = diffNamedLists(getVersionTools(versionA), getVersionTools(versionB));
  const guardrailsDiff = diffNamedLists(getVersionGuardrails(versionA), getVersionGuardrails(versionB));

  return (
    <div className="space-y-4">
      <div className="nexus-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge className="bg-destructive/10 text-destructive font-mono text-xs">v{versionA.version}</Badge>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            <Badge className="bg-nexus-emerald/10 text-nexus-emerald font-mono text-xs">v{versionB.version}</Badge>
          </div>
          <Badge variant="outline" className="text-[11px]">{changelog.length} mudança(s)</Badge>
        </div>

        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Changelog automático</h4>
        {changelog.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-3 text-center">Nenhuma diferença estrutural detectada entre as versões.</p>
        ) : (
          <ul className="space-y-1.5">
            {changelog.map((e, i) => (
              <li key={i} className="flex items-start gap-2 text-xs leading-relaxed">
                <span className="mt-0.5">{entryIcon(e.kind)}</span>
                <span className="text-foreground">
                  <span className="font-medium">{e.label}</span>
                  {e.from !== undefined && e.to !== undefined && (
                    <span className="ml-1.5 font-mono text-muted-foreground">
                      <span className="text-destructive/80">{String(e.from)}</span>
                      <ArrowRight className="inline h-2.5 w-2.5 mx-1" aria-hidden />
                      <span className="text-nexus-emerald">{String(e.to)}</span>
                    </span>
                  )}
                  {e.detail && <span className="ml-1.5 text-[11px] text-primary">{e.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="nexus-card">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Diff do system prompt</h4>
        {promptA === promptB ? (
          <p className="text-xs text-muted-foreground italic py-3 text-center">Prompt idêntico nas duas versões.</p>
        ) : (
          <PromptDiff textA={promptA} textB={promptB} labelA={`v${versionA.version}`} labelB={`v${versionB.version}`} />
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <DiffTable title="Ferramentas" rows={toolsDiff} versionA={versionA.version} versionB={versionB.version} />
        <DiffTable title="Guardrails" rows={guardrailsDiff} versionA={versionA.version} versionB={versionB.version} />
      </div>
    </div>
  );
}

function DiffTable({ title, rows, versionA, versionB }: {
  title: string;
  rows: Array<{ name: string; inA: boolean; inB: boolean }>;
  versionA: number;
  versionB: number;
}) {
  return (
    <div className="nexus-card">
      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">{title}</h4>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Nenhum item nas duas versões.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-1.5 font-medium text-muted-foreground">Nome</th>
                <th className="text-center py-1.5 font-medium text-muted-foreground w-14">v{versionA}</th>
                <th className="text-center py-1.5 font-medium text-muted-foreground w-14">v{versionB}</th>
                <th className="text-left py-1.5 pl-2 font-medium text-muted-foreground">Mudança</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const status = r.inA && r.inB ? 'kept' : r.inB ? 'added' : 'removed';
                return (
                  <tr key={r.name} className="border-b border-border/30 last:border-0 hover:bg-secondary/30">
                    <td className="py-1.5 font-mono text-foreground truncate max-w-[160px]">{r.name}</td>
                    <td className="py-1.5 text-center">
                      {r.inA ? <Check className="h-3 w-3 text-nexus-emerald inline" aria-hidden /> : <X className="h-3 w-3 text-muted-foreground/40 inline" aria-hidden />}
                    </td>
                    <td className="py-1.5 text-center">
                      {r.inB ? <Check className="h-3 w-3 text-nexus-emerald inline" aria-hidden /> : <X className="h-3 w-3 text-muted-foreground/40 inline" aria-hidden />}
                    </td>
                    <td className="py-1.5 pl-2">
                      {status === 'kept' && <span className="text-muted-foreground">=</span>}
                      {status === 'added' && <Badge className="bg-nexus-emerald/10 text-nexus-emerald text-[10px] px-1.5 py-0">+ adicionada</Badge>}
                      {status === 'removed' && <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0">− removida</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
