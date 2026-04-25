/**
 * RestoreHistorySection — Lê todas as versões do agente e extrai as que foram
 * geradas via rollback (têm `config.restore_metadata`). Exibe um log compacto
 * com data, origem, opções restauradas e link para a versão criada.
 *
 * Cada entrada também expõe um botão "Desfazer" que cria uma NOVA versão
 * copiando os mesmos campos da versão imediatamente anterior ao rollback
 * (a versão de referência), revertendo o efeito sem apagar histórico.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Undo2, FileText, Wrench, Cpu, ArrowRight, Clock, Loader2, AlertTriangle, TimerOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { restoreAgentVersion, type AgentVersion } from "@/services/agentsService";

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
  /**
   * Versão imediatamente anterior ao rollback (a "referência" para desfazer).
   * Se for `null`, o rollback foi a primeira versão do agente e não há
   * referência para restaurar — botão Desfazer fica indisponível.
   */
  preRollback: AgentVersion | null;
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

const FIELD_LABELS = {
  copyPrompt: "Prompt + missão",
  copyTools: "Ferramentas",
  copyModel: "Modelo + reasoning",
} as const;

export function RestoreHistorySection({ agentId, versions }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [undoTarget, setUndoTarget] = useState<RestoreEntry | null>(null);

  // versions vem ordenado do mais recente para o mais antigo. A versão
  // imediatamente posterior na lista (índice maior) é a "pré-rollback".
  const entries = useMemo<RestoreEntry[]>(() => {
    const result: RestoreEntry[] = [];
    versions.forEach((v, idx) => {
      const meta = extractRestoreMeta(v);
      if (!meta) return;
      result.push({
        versionId: v.id,
        versionNumber: v.version,
        changeSummary: v.change_summary,
        meta,
        preRollback: versions[idx + 1] ?? null,
      });
    });
    return result.sort(
      (a, b) => new Date(b.meta.restored_at).getTime() - new Date(a.meta.restored_at).getTime(),
    );
  }, [versions]);

  // A "versão atual" é sempre a primeira (mais recente) — usada como base do
  // merge ao desfazer, garantindo que campos não restaurados sejam preservados.
  const currentVersion = versions[0];

  const undoMut = useMutation({
    mutationFn: async (entry: RestoreEntry) => {
      if (!entry.preRollback) {
        throw new Error("Sem versão de referência para desfazer este rollback.");
      }
      return restoreAgentVersion(
        agentId,
        entry.preRollback,
        currentVersion,
        {
          copyPrompt: entry.meta.options.copyPrompt,
          copyTools: entry.meta.options.copyTools,
          copyModel: entry.meta.options.copyModel,
          customSummary: `Desfazer rollback v${entry.versionNumber} → restaurado de v${entry.preRollback.version}`,
        },
      );
    },
    onSuccess: (data, entry) => {
      queryClient.invalidateQueries({ queryKey: ["agent_versions", agentId] });
      queryClient.invalidateQueries({ queryKey: ["agent", agentId] });
      setUndoTarget(null);
      toast.success(
        `Rollback desfeito — v${data.version} criada a partir de v${entry.preRollback?.version}`,
        {
          action: {
            label: "Ver na timeline",
            onClick: () => navigate(`/agents/${agentId}/versions/v/${data.id}`),
          },
          duration: 6000,
        },
      );
    },
    onError: (e: Error) => toast.error(e.message || "Falha ao desfazer rollback"),
  });

  if (entries.length === 0) return null;

  const nextVersionNumber = (currentVersion?.version ?? 0) + 1;

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
        {entries.map((entry) => {
          const canUndo = !!entry.preRollback;
          const isUndoingThis = undoMut.isPending && undoTarget?.versionId === entry.versionId;
          return (
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

              {/* Badges das opções restauradas + ações */}
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
                  <span className="text-[9px] uppercase tracking-wider text-primary bg-primary/10 px-1.5 py-0.5 rounded font-semibold">
                    personalizado
                  </span>
                )}
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-0.5 text-nexus-amber hover:text-nexus-amber hover:bg-nexus-amber/10 disabled:opacity-40"
                    onClick={() => setUndoTarget(entry)}
                    disabled={!canUndo || undoMut.isPending}
                    title={
                      canUndo
                        ? `Desfazer este rollback restaurando os mesmos campos de v${entry.preRollback?.version}`
                        : "Sem versão de referência anterior — não é possível desfazer"
                    }
                  >
                    {isUndoingThis ? (
                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                    ) : (
                      <Undo2 className="h-2.5 w-2.5" aria-hidden />
                    )}
                    Desfazer
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-0.5"
                    onClick={() => navigate(`/agents/${agentId}/versions/v/${entry.versionId}`)}
                  >
                    Ver versão <ArrowRight className="h-2.5 w-2.5" aria-hidden />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Modal de confirmação do "Desfazer rollback".
          Mostra: o rollback alvo, a versão de referência (pré-rollback),
          os campos que serão restaurados e a nova versão que será criada. */}
      <AlertDialog
        open={!!undoTarget}
        onOpenChange={(open) => {
          if (!open && !undoMut.isPending) setUndoTarget(null);
        }}
      >
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Undo2 className="h-4 w-4 text-nexus-amber" aria-hidden />
              Desfazer rollback v{undoTarget?.versionNumber}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Será criada uma nova versão{" "}
                  <span className="font-mono font-semibold text-foreground">
                    v{nextVersionNumber}
                  </span>{" "}
                  copiando os mesmos campos do rollback original — mas vindos da versão de
                  referência <span className="font-mono font-semibold text-foreground">
                    v{undoTarget?.preRollback?.version}
                  </span>{" "}
                  (estado anterior ao rollback).
                </p>

                {/* Quadro comparativo: rollback alvo, referência e nova versão */}
                <div className="rounded-lg bg-secondary/40 p-3 text-xs space-y-1.5">
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Rollback que será desfeito</span>
                    <span className="font-mono text-foreground">
                      v{undoTarget?.versionNumber}
                      {undoTarget?.meta.restored_from_version !== undefined && (
                        <span className="text-muted-foreground/70">
                          {" "}(restaurado de v{undoTarget.meta.restored_from_version})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Versão de referência</span>
                    <span className="font-mono text-foreground">
                      v{undoTarget?.preRollback?.version} ·{" "}
                      {String(undoTarget?.preRollback?.model ?? "—")}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Nova versão</span>
                    <span className="font-mono text-nexus-emerald">v{nextVersionNumber}</span>
                  </div>
                </div>

                {/* Lista de campos que serão restaurados — espelha o rollback original */}
                <fieldset className="rounded-lg border border-border bg-card/40 p-3">
                  <legend className="text-[10px] font-semibold uppercase tracking-wider text-foreground px-1">
                    Campos que serão restaurados
                  </legend>
                  <ul className="space-y-1.5 mt-1">
                    {(["copyPrompt", "copyTools", "copyModel"] as const).map((key) => {
                      const active = !!undoTarget?.meta.options[key];
                      const Icon =
                        key === "copyPrompt" ? FileText : key === "copyTools" ? Wrench : Cpu;
                      return (
                        <li
                          key={key}
                          className={`flex items-center gap-2 text-xs ${
                            active ? "text-foreground" : "text-muted-foreground/50 line-through"
                          }`}
                        >
                          <Icon
                            className={`h-3 w-3 ${
                              active ? "text-primary" : "text-muted-foreground/40"
                            }`}
                            aria-hidden
                          />
                          {FIELD_LABELS[key]}
                          {!active && (
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                              (não incluído)
                            </span>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </fieldset>

                {/* Aviso quando o rollback não tem referência (primeira versão do agente) */}
                {!undoTarget?.preRollback && (
                  <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs text-destructive">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                    <span>
                      Não há versão anterior ao rollback para usar como referência — não é
                      possível desfazer.
                    </span>
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Nenhum histórico será apagado — desfazer o rollback é não destrutivo e
                  cria uma nova versão.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={undoMut.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (undoTarget) undoMut.mutate(undoTarget);
              }}
              disabled={undoMut.isPending || !undoTarget?.preRollback}
              className="gap-1.5"
            >
              {undoMut.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" aria-hidden />
              )}
              Confirmar desfazer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
