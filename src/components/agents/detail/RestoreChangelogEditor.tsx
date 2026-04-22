/**
 * RestoreChangelogEditor — exibe um changelog ao vivo do rollback (contagem por
 * grupo + linha de descrição padrão) e permite ao usuário editar o texto antes
 * de confirmar a criação de v{N+1}. O texto editado é injetado como
 * `customSummary` em RestoreOptions.
 */
import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCcw, FileText, Wrench, Cpu, Sparkles } from "lucide-react";
import type { RestoreDiff } from "./restoreDiffHelpers";

interface Props {
  sourceVersion: number;
  nextVersion: number;
  diff: RestoreDiff;
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
  value: string;
  /** Atualiza o texto controlado pelo pai (vai para customSummary). */
  onChange: (next: string) => void;
  /** Marca o estado interno como "personalizado" (para travar o auto-update). */
  edited: boolean;
  onEditedChange: (edited: boolean) => void;
  disabled?: boolean;
}

export function buildAutoSummary(
  sourceVersion: number,
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean },
): string {
  const parts: string[] = [];
  if (options.copyPrompt) parts.push("prompt");
  if (options.copyTools) parts.push("ferramentas");
  if (options.copyModel) parts.push("modelo");
  return parts.length > 0
    ? `Restaurado de v${sourceVersion} (${parts.join(" + ")})`
    : `Restaurado de v${sourceVersion} (sem alterações)`;
}

export function RestoreChangelogEditor({
  sourceVersion,
  nextVersion,
  diff,
  options,
  value,
  onChange,
  edited,
  onEditedChange,
  disabled,
}: Props) {
  const auto = useMemo(() => buildAutoSummary(sourceVersion, options), [sourceVersion, options]);

  // Quando o usuário ainda não editou, mantém o texto sincronizado com as
  // opções selecionadas (desmarcar "ferramentas" remove o termo do summary).
  useEffect(() => {
    if (!edited) onChange(auto);
  }, [auto, edited, onChange]);

  // Contagem por grupo a partir do diff já calculado.
  const counts = useMemo(() => {
    const c = { prompt: 0, tools: 0, model: 0 };
    for (const ch of diff.changes) c[ch.group]++;
    return c;
  }, [diff]);

  const totalChanges = diff.changes.length;

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Changelog para v{nextVersion}
          </span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {totalChanges} {totalChanges === 1 ? "alteração" : "alterações"}
        </span>
      </div>

      {/* Mini-stats por grupo */}
      <div className="grid grid-cols-3 gap-1.5">
        <ChangelogStat
          icon={<FileText className="h-3 w-3" aria-hidden />}
          label="Prompt"
          count={counts.prompt}
          active={options.copyPrompt}
          delta={diff.promptDeltaChars}
        />
        <ChangelogStat
          icon={<Wrench className="h-3 w-3" aria-hidden />}
          label="Tools"
          count={counts.tools}
          active={options.copyTools}
          extra={
            options.copyTools && (diff.toolsAdded.length || diff.toolsRemoved.length)
              ? `+${diff.toolsAdded.length}/-${diff.toolsRemoved.length}`
              : undefined
          }
        />
        <ChangelogStat
          icon={<Cpu className="h-3 w-3" aria-hidden />}
          label="Modelo"
          count={counts.model}
          active={options.copyModel}
        />
      </div>

      {/* Editor de texto do summary */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="restore-summary-editor"
            className="text-[10px] uppercase tracking-wider text-muted-foreground"
          >
            Descrição (editável){edited && <span className="text-primary normal-case ml-1.5 tracking-normal">· personalizado</span>}
          </label>
          {edited && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => {
                onEditedChange(false);
                onChange(auto);
              }}
              disabled={disabled}
            >
              <RotateCcw className="h-2.5 w-2.5" aria-hidden />
              Resetar para automático
            </Button>
          )}
        </div>
        <Textarea
          id="restore-summary-editor"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!edited) onEditedChange(true);
          }}
          placeholder={auto}
          disabled={disabled}
          maxLength={240}
          rows={2}
          className="text-xs font-mono resize-none bg-background/60"
        />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Aparecerá no histórico da v{nextVersion}</span>
          <span className="font-mono">{value.length}/240</span>
        </div>
      </div>
    </div>
  );
}

function ChangelogStat({
  icon,
  label,
  count,
  active,
  delta,
  extra,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  active: boolean;
  delta?: number;
  extra?: string;
}) {
  return (
    <div
      className={`rounded-md border px-2 py-1.5 text-[10px] transition-colors ${
        active
          ? count > 0
            ? "border-primary/40 bg-primary/10 text-foreground"
            : "border-border bg-background/40 text-muted-foreground"
          : "border-border/50 bg-background/20 text-muted-foreground/60"
      }`}
    >
      <div className="flex items-center gap-1 mb-0.5">
        <span className={active && count > 0 ? "text-primary" : ""}>{icon}</span>
        <span className="font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-sm font-mono font-bold text-foreground">{active ? count : "—"}</span>
        {active && extra && <span className="font-mono text-[9px] text-muted-foreground">{extra}</span>}
        {active && delta !== undefined && delta !== 0 && (
          <span
            className={`font-mono text-[9px] ${
              delta > 0 ? "text-nexus-emerald" : "text-nexus-amber"
            }`}
          >
            {delta > 0 ? "+" : ""}
            {delta}c
          </span>
        )}
      </div>
    </div>
  );
}
