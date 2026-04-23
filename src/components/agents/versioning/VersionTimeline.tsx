import { useEffect, useRef, useState } from "react";
import { GitBranch, CircleDot, Circle, Link2, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { AgentVersion } from "@/services/agentsService";

interface Props {
  versions: AgentVersion[];
  selectedId: string | null;
  selectedAId: string | null;
  selectedBId: string | null;
  onSelect: (id: string) => void;
  onPickA: (id: string) => void;
  onPickB: (id: string) => void;
  /** Quando definido, rola até o item correspondente e aplica destaque temporário (pulse + ring). */
  highlightId?: string | null;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = (now.getTime() - d.getTime()) / 1000;
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
  return d.toLocaleDateString('pt-BR');
}

export function VersionTimeline({
  versions, selectedId, selectedAId, selectedBId, onSelect, onPickA, onPickB, highlightId,
}: Props) {
  // Refs para rolar automaticamente até a versão alvo logo após um restore.
  const itemRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!highlightId) return;
    const el = itemRefs.current[highlightId];
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    }
  }, [highlightId, versions]);

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Linha do tempo</h3>
        <Badge variant="outline" className="text-[11px]">{versions.length} versões</Badge>
      </div>

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
        {versions.map((v, idx) => {
          const isCurrent = idx === 0;
          const isSelected = v.id === selectedId;
          const isA = v.id === selectedAId;
          const isB = v.id === selectedBId;
          const isHighlighted = v.id === highlightId;
          return (
            <div
              key={v.id}
              ref={(el) => { itemRefs.current[v.id] = el; }}
              className={`relative scroll-mt-4 ${isHighlighted ? 'animate-pulse-once' : ''}`}
            >
              <button
                type="button"
                onClick={() => onSelect(v.id)}
                aria-pressed={isSelected}
                className={`w-full text-left rounded-lg border px-3 py-2.5 transition-all ${
                  isHighlighted
                    ? 'border-nexus-emerald/60 bg-nexus-emerald/10 ring-2 ring-nexus-emerald/40 shadow-[0_0_24px_-6px_hsl(var(--nexus-emerald)/0.5)]'
                    : isSelected
                    ? 'border-primary/50 bg-primary/5 ring-1 ring-primary/30'
                    : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5">
                    {isCurrent
                      ? <CircleDot className="h-3.5 w-3.5 text-primary" aria-hidden />
                      : <Circle className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-mono font-semibold text-foreground">v{v.version}</span>
                      {isCurrent && <Badge className="bg-primary/10 text-primary text-[10px] px-1.5 py-0">atual</Badge>}
                      {isA && <Badge className="bg-destructive/10 text-destructive text-[10px] px-1.5 py-0">A</Badge>}
                      {isB && <Badge className="bg-nexus-emerald/10 text-nexus-emerald text-[10px] px-1.5 py-0">B</Badge>}
                    </div>
                    <p className="text-xs text-foreground/80 truncate">
                      {v.change_summary || 'Sem resumo'}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {formatWhen(v.created_at)} · {String(v.model ?? '—')}
                    </p>
                  </div>
                </div>
              </button>

              <div className="flex gap-1 mt-1 mb-2 pl-6">
                <Button
                  variant="ghost" size="sm"
                  className={`h-5 px-2 text-[10px] gap-1 ${isA ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground'}`}
                  onClick={(e) => { e.stopPropagation(); onPickA(v.id); }}
                >
                  <GitBranch className="h-2.5 w-2.5" /> A
                </Button>
                <Button
                  variant="ghost" size="sm"
                  className={`h-5 px-2 text-[10px] gap-1 ${isB ? 'bg-nexus-emerald/10 text-nexus-emerald' : 'text-muted-foreground'}`}
                  onClick={(e) => { e.stopPropagation(); onPickB(v.id); }}
                >
                  <GitBranch className="h-2.5 w-2.5" /> B
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
