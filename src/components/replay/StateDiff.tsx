/**
 * StateDiff — line-by-line JSON diff between two states with add/remove/change highlighting.
 */
import { useMemo } from "react";
import { Plus, Minus, Equal } from "lucide-react";

interface DiffLine {
  type: "add" | "remove" | "context";
  text: string;
}

function diff(before: unknown, after: unknown): DiffLine[] {
  const beforeStr = JSON.stringify(before, null, 2) || "";
  const afterStr = JSON.stringify(after, null, 2) || "";
  const beforeLines = beforeStr.split("\n");
  const afterLines = afterStr.split("\n");
  const result: DiffLine[] = [];
  const max = Math.max(beforeLines.length, afterLines.length);
  for (let i = 0; i < max; i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b === a && b !== undefined) {
      result.push({ type: "context", text: b });
    } else {
      if (b !== undefined) result.push({ type: "remove", text: b });
      if (a !== undefined) result.push({ type: "add", text: a });
    }
  }
  return result;
}

export function StateDiff({ before, after }: { before: unknown; after: unknown }) {
  const lines = useMemo(() => diff(before, after), [before, after]);
  const stats = useMemo(() => ({
    added: lines.filter(l => l.type === "add").length,
    removed: lines.filter(l => l.type === "remove").length,
  }), [lines]);

  if (lines.length === 0) {
    return <div className="text-xs text-muted-foreground p-3">Sem diferenças.</div>;
  }

  return (
    <div className="rounded-md border border-border/50 bg-muted/20 overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border/50 bg-muted/40 text-[11px]">
        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
          <Plus className="h-3 w-3" /> {stats.added} adições
        </span>
        <span className="flex items-center gap-1 text-rose-600 dark:text-rose-400">
          <Minus className="h-3 w-3" /> {stats.removed} remoções
        </span>
        <span className="text-muted-foreground ml-auto">{lines.length} linhas</span>
      </div>
      <pre className="text-[10px] font-mono overflow-auto max-h-[320px] p-2">
        {lines.map((l, i) => (
          <div
            key={i}
            className={
              l.type === "add" ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" :
              l.type === "remove" ? "bg-rose-500/10 text-rose-700 dark:text-rose-300" :
              "text-muted-foreground"
            }
          >
            <span className="inline-block w-4 select-none opacity-60">
              {l.type === "add" ? "+" : l.type === "remove" ? "-" : " "}
            </span>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function EmptyDiff() {
  return (
    <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
      <Equal className="h-3 w-3" /> Nenhuma mudança detectada
    </div>
  );
}
