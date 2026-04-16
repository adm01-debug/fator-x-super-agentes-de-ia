import { diffWords } from "diff";
import { useMemo } from "react";

interface DiffViewerProps {
  oldText: string;
  newText: string;
}

export function ArticleDiffViewer({ oldText, newText }: DiffViewerProps) {
  const diff = useMemo(() => diffWords(oldText || "", newText || ""), [oldText, newText]);

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <div className="nexus-card">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Versão anterior</p>
        <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
          {diff.map((part, i) => part.added ? null : (
            <span key={i} className={part.removed ? "bg-destructive/20 text-destructive line-through" : ""}>{part.value}</span>
          ))}
        </div>
      </div>
      <div className="nexus-card">
        <p className="text-xs text-muted-foreground mb-2 font-medium">Versão atual</p>
        <div className="text-sm whitespace-pre-wrap leading-relaxed text-foreground">
          {diff.map((part, i) => part.removed ? null : (
            <span key={i} className={part.added ? "bg-nexus-emerald/20 text-nexus-emerald" : ""}>{part.value}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
