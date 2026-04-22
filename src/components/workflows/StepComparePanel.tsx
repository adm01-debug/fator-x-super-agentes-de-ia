/**
 * StepComparePanel — Side-by-side comparison of two workflow checkpoints (steps).
 *
 * Renders Input / Output / Metadata in two columns with line-level diff highlighting:
 *  - Lines only in A → red strike-through (left side)
 *  - Lines only in B → green (right side)
 *  - Unchanged lines → muted, shown on both sides
 *
 * Designed to live inside the WorkflowTimeTravelPanel.
 */

import { useMemo } from "react";
import { diffLines } from "diff";
import { ArrowLeftRight, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { WorkflowCheckpoint } from "@/services/workflowCheckpointService";

interface Props {
  checkpointA: WorkflowCheckpoint;
  checkpointB: WorkflowCheckpoint;
  onClose: () => void;
  /** Swap A/B sides without re-fetching. */
  onSwap?: () => void;
}

type Section = {
  key: "node_input" | "node_output" | "metadata";
  label: string;
  pickA: () => unknown;
  pickB: () => unknown;
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Build a metadata-only object from a checkpoint (everything except input/output/state). */
function buildMetadata(cp: WorkflowCheckpoint) {
  return {
    node_id: cp.node_id,
    node_type: cp.node_type,
    step_index: cp.step_index,
    status: cp.status,
    cost_usd: cp.cost_usd,
    tokens_used: cp.tokens_used,
    duration_ms: cp.duration_ms,
    error: cp.error,
    created_at: cp.created_at,
  };
}

/**
 * Compute a line-level diff and project it onto two arrays so each side keeps
 * its own row indices for visual alignment of the columns.
 */
function buildSideDiff(textA: string, textB: string) {
  const parts = diffLines(textA || "", textB || "");
  const left: Array<{ value: string; kind: "same" | "removed" | "pad" }> = [];
  const right: Array<{ value: string; kind: "same" | "added" | "pad" }> = [];

  for (const part of parts) {
    const lines = part.value.replace(/\n$/, "").split("\n");
    if (part.added) {
      for (const l of lines) {
        right.push({ value: l, kind: "added" });
        left.push({ value: "", kind: "pad" });
      }
    } else if (part.removed) {
      for (const l of lines) {
        left.push({ value: l, kind: "removed" });
        right.push({ value: "", kind: "pad" });
      }
    } else {
      for (const l of lines) {
        left.push({ value: l, kind: "same" });
        right.push({ value: l, kind: "same" });
      }
    }
  }
  return { left, right };
}

function DiffColumn({
  rows,
  side,
}: {
  rows: Array<{ value: string; kind: string }>;
  side: "left" | "right";
}) {
  return (
    <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-all">
      {rows.map((r, i) => {
        let cls = "text-muted-foreground";
        if (r.kind === "removed") cls = "bg-destructive/15 text-destructive line-through";
        else if (r.kind === "added") cls = "bg-nexus-emerald/15 text-nexus-emerald";
        else if (r.kind === "pad") cls = "bg-muted/30 text-transparent select-none";
        else cls = "text-foreground/80";
        return (
          <div key={`${side}-${i}`} className={`px-2 ${cls}`}>
            {r.value || "\u00A0"}
          </div>
        );
      })}
    </pre>
  );
}

export function StepComparePanel({ checkpointA, checkpointB, onClose, onSwap }: Props) {
  const sections: Section[] = [
    {
      key: "node_input",
      label: "Input",
      pickA: () => checkpointA.node_input,
      pickB: () => checkpointB.node_input,
    },
    {
      key: "node_output",
      label: "Output",
      pickA: () => checkpointA.node_output,
      pickB: () => checkpointB.node_output,
    },
    {
      key: "metadata",
      label: "Metadata",
      pickA: () => buildMetadata(checkpointA),
      pickB: () => buildMetadata(checkpointB),
    },
  ];

  // Pre-compute diffs and unchanged flags for all sections.
  const diffs = useMemo(
    () =>
      sections.map((s) => {
        const a = stringify(s.pickA());
        const b = stringify(s.pickB());
        const { left, right } = buildSideDiff(a, b);
        const changed = left.some((r) => r.kind !== "same") || right.some((r) => r.kind !== "same");
        return { ...s, left, right, changed };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [checkpointA, checkpointB],
  );

  const totalChanges = diffs.filter((d) => d.changed).length;

  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm text-foreground">
          <span className="flex items-center gap-2">
            <ArrowLeftRight className="w-4 h-4 text-nexus-purple" />
            Comparação de steps
            <Badge variant="outline" className="text-[10px]">
              {totalChanges === 0 ? "sem diferenças" : `${totalChanges} seção(ões) alteradas`}
            </Badge>
          </span>
          <div className="flex items-center gap-1">
            {onSwap && (
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={onSwap}
              >
                <ArrowLeftRight className="w-3 h-3 mr-1" />
                Inverter A/B
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={onClose}
            >
              <X className="w-3 h-3 mr-1" />
              Fechar
            </Button>
          </div>
        </CardTitle>

        {/* Header row identifying A and B */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-destructive font-semibold">A</p>
            <p className="text-xs text-foreground font-medium">
              #{checkpointA.step_index} · {checkpointA.node_type}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{checkpointA.node_id}</p>
          </div>
          <div className="rounded-md border border-nexus-emerald/30 bg-nexus-emerald/5 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-nexus-emerald font-semibold">B</p>
            <p className="text-xs text-foreground font-medium">
              #{checkpointB.step_index} · {checkpointB.node_type}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">{checkpointB.node_id}</p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {diffs.map((d) => (
          <div key={d.key} className="space-y-1.5">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {d.label}
              </p>
              {d.changed ? (
                <Badge className="bg-nexus-amber/15 text-nexus-amber text-[10px] px-1.5 py-0">
                  alterado
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                  idêntico
                </Badge>
              )}
            </div>
            <div className="rounded-md border border-border overflow-hidden">
              <ScrollArea className="h-[220px]">
                <div className="grid grid-cols-2 divide-x divide-border">
                  <DiffColumn rows={d.left} side="left" />
                  <DiffColumn rows={d.right} side="right" />
                </div>
              </ScrollArea>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
