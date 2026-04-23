/**
 * RestoreHistorySection — Lê todas as versões do agente e extrai as que foram
 * geradas via rollback (têm `config.restore_metadata`). Exibe um log compacto
 * com data, origem, opções restauradas e link para a versão criada.
 */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Undo2, FileText, Wrench, Cpu, ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentVersion } from "@/services/agentsService";

interface RestoreMetadata {
  restored_from_version: number;
  restored_from_version_id: string;
  restored_at: string;
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
  custom_summary: string | null;
}

interface Props {
  agentId: string;
  versions: AgentVersion[];
}

interface RestoreEntry {
  versionId: string;
  versionNumber: number;
  changeSummary: string | null;
  meta: RestoreMetadata;
}

function extractRestoreMeta(v: AgentVersion): RestoreMetadata | null {
  const cfg = v.config;
  if (!cfg || typeof cfg !== "object") return null;
  const raw = (cfg as Record<string, unknown>).restore_metadata;
  if (!raw || typeof raw !== "object") return null;
  const m = raw as Record<string, unknown>;
  if (typeof m.restored_from_version !== "number") return null;
  const opts = (m.options ?? {}) as Record<string, unknown>;
  return {
    restored_from_version: m.restored_from_version,
    restored_from_version_id: String(m.restored_from_version_id ?? ""),
    restored_at: String(m.restored_at ?? v.created_at ?? ""),
    options: {
      copyPrompt: !!opts.copyPrompt,
      copyTools: !!opts.copyTools,
      copyModel: !!opts.copyModel,
    },
    custom_summary: typeof m.custom_summary === "string" ? m.custom_summary : null,
  };
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function RestoreHistorySection({ agentId, versions }: Props) {
  const navigate = useNavigate();

  const entries = useMemo<RestoreEntry[]>(() => {
    return versions
      .map((v) => {
        const meta = extractRestoreMeta(v);
        if (!meta) return null;
        return {
          versionId: v.id,
          versionNumber: v.version,
          changeSummary: v.change_summary,
          meta,
        } satisfies RestoreEntry;
      })
      .filter((e): e is RestoreEntry => e !== null)
      .sort((a, b) => new Date(b.meta.restored_at).getTime() - new Date(a.meta.restored_at).getTime());
  }, [versions]);

  if (entries.length === 0) return null;

  return (
    <div className="nexus-card mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Undo2 className="h-3.5 w-3.5 text-nexus-amber" aria-hidden />
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Histórico de Restaurações
          </h3>
          <span className="text-[10px] font-mono text-muted-foreground bg-secondary/50 px-1.5 py-0.5 rounded">
            {entries.length}
          </span>
        </div>
      </div>

      <ol className="space-y-2 max-h-[280px] overflow-y-auto">
        {entries.map((entry) => (
          <li
            key={entry.versionId}
            className="rounded-lg border border-border/60 bg-secondary/20 hover:bg-secondary/30 transition-colors px-3 py-2.5"
          >
            {/* Linha principal: v{src} → v{new} + data */}
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono">
                <span className="text-muted-foreground">v{entry.meta.restored_from_version}</span>
                <ArrowRight className="h-3 w-3 text-nexus-amber" aria-hidden />
                <button
                  type="button"
                  onClick={() => navigate(`/agents/${agentId}/versions/v/${entry.versionId}`)}
                  className="font-bold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
                  title={`Abrir v${entry.versionNumber} no gerenciador de versões`}
                >
                  v{entry.versionNumber}
                </button>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" aria-hidden />
                <time dateTime={entry.meta.restored_at}>{formatDate(entry.meta.restored_at)}</time>
              </div>
            </div>

            {/* Summary (custom ou auto) */}
            {entry.changeSummary && (
              <p className="text-xs text-foreground mb-1.5 truncate" title={entry.changeSummary}>
                {entry.changeSummary}
              </p>
            )}

            {/* Badges das opções restauradas */}
            <div className="flex items-center gap-1 flex-wrap">
              <RestoreOptionBadge
                active={entry.meta.options.copyPrompt}
                icon={<FileText className="h-2.5 w-2.5" aria-hidden />}
                label="prompt"
              />
              <RestoreOptionBadge
                active={entry.meta.options.copyTools}
                icon={<Wrench className="h-2.5 w-2.5" aria-hidden />}
                label="ferramentas"
              />
              <RestoreOptionBadge
                active={entry.meta.options.copyModel}
                icon={<Cpu className="h-2.5 w-2.5" aria-hidden />}
                label="modelo"
              />
              {entry.meta.custom_summary && (
                <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded font-semibold ml-auto">
                  personalizado
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-5 px-1.5 text-[10px] gap-0.5 ml-auto data-[has-custom=true]:ml-1"
                onClick={() => navigate(`/agents/${agentId}/versions?focus=${entry.versionId}`)}
              >
                Ver versão <ArrowRight className="h-2.5 w-2.5" aria-hidden />
              </Button>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function RestoreOptionBadge({
  active,
  icon,
  label,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${
        active
          ? "bg-primary/10 text-primary border border-primary/20"
          : "bg-muted/30 text-muted-foreground/50 border border-border/40 line-through"
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
