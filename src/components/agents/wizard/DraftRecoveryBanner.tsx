import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Check, FileClock, FolderOpen, Minus, Pencil, RotateCcw, Trash2, X } from 'lucide-react';
import { quickIdentitySchema } from '@/lib/validations/quickAgentSchema';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';

function discardCopy(name: string) {
  const label = name.trim() ? `"${name.trim()}"` : 'sem nome ainda';
  return {
    title: 'Descartar este rascunho?',
    description: `O rascunho ${label} será removido permanentemente. Esta ação não pode ser desfeita.`,
  };
}

export interface DraftSummary {
  name: string;
  hasIdentity: boolean;
  hasType: boolean;
  hasModel: boolean;
  hasPrompt: boolean;
}

export interface DraftBannerEntry {
  id: string;
  savedAt: string;
  summary: DraftSummary;
  typeLabel?: string;
  restorable?: boolean;
  restoreBlockedReason?: string;
}

interface DraftRecoveryBannerProps {
  drafts: DraftBannerEntry[];
  onRestore: (id: string) => void;
  onDiscardOne: (id: string) => void;
  onDiscardAll: () => void;
  onRename: (id: string, newName: string) => void;
}

function validateDraftName(value: string): string | null {
  const r = quickIdentitySchema.shape.name.safeParse(value.trim());
  return r.success ? null : (r.error.errors[0]?.message ?? 'Nome inválido');
}

interface NameEditorProps {
  draft: DraftBannerEntry;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onConfirm: (newName: string) => void;
}

function NameLabelOrEditor({ draft, isEditing, onStartEdit, onCancel, onConfirm }: NameEditorProps) {
  const [value, setValue] = useState(draft.summary.name);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // Skip blur-save when the blur was caused by clicking the explicit
  // Confirm/Cancel buttons (they handle the action themselves) — otherwise
  // we'd double-fire onConfirm or fight the cancel.
  const skipNextBlurRef = useRef(false);

  useEffect(() => {
    if (isEditing) {
      setValue(draft.summary.name);
      setError(null);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [isEditing, draft.summary.name]);

  const submit = () => {
    const err = validateDraftName(value);
    if (err) { setError(err); return; }
    onConfirm(value.trim());
  };

  const onKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    if (e.key === 'Escape') { e.preventDefault(); skipNextBlurRef.current = true; onCancel(); }
  };

  // Auto-save on blur when the value is valid and actually changed.
  // - Invalid → silently revert to previous name (don't trap the user with a stale edit).
  // - Unchanged → just close the editor without firing a useless save.
  // - Valid + changed → commit, same as pressing Enter.
  const handleBlur = () => {
    if (skipNextBlurRef.current) { skipNextBlurRef.current = false; return; }
    const trimmed = value.trim();
    if (trimmed === draft.summary.name.trim()) { onCancel(); return; }
    if (validateDraftName(value)) { onCancel(); return; }
    onConfirm(trimmed);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => { setValue(e.target.value); if (error) setError(null); }}
            onKeyDown={onKey}
            onBlur={handleBlur}
            maxLength={60}
            aria-invalid={!!error}
            aria-label="Novo nome do agente"
            className="h-7 text-sm py-1"
          />
          <button
            type="button"
            // onMouseDown fires before blur — set the skip flag so the blur
            // handler doesn't race the click handler.
            onMouseDown={() => { skipNextBlurRef.current = true; }}
            onClick={submit}
            className="h-7 w-7 rounded-md flex items-center justify-center text-nexus-emerald hover:bg-nexus-emerald/10 shrink-0"
            aria-label="Confirmar novo nome"
            title="Confirmar (Enter)"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onMouseDown={() => { skipNextBlurRef.current = true; }}
            onClick={onCancel}
            className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
            aria-label="Cancelar renomear"
            title="Cancelar (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {error && <p className="text-[11px] text-destructive">{error}</p>}
      </div>
    );
  }

  const display = draft.summary.name.trim() ? `"${draft.summary.name.trim()}"` : 'sem nome ainda';
  return (
    <span className="inline-flex items-center gap-1 min-w-0">
      <span className="text-sm font-medium text-foreground truncate">{display}</span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onStartEdit(); }}
        className="opacity-60 hover:opacity-100 hover:text-primary transition shrink-0 p-1 rounded-md hover:bg-primary/10"
        aria-label="Renomear rascunho"
        title="Renomear"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </span>
  );
}


function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'há pouco tempo';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr} ${hr === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(hr / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

// Data/hora absoluta usada em tooltip e na prévia ("12/04/2026 14:32")
function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// Lista textual dos campos já preenchidos do rascunho.
function filledFieldsList(summary: DraftSummary): string[] {
  const out: string[] = [];
  if (summary.hasIdentity) out.push('Identidade');
  if (summary.hasType) out.push('Tipo');
  if (summary.hasModel) out.push('Modelo');
  if (summary.hasPrompt) out.push('Prompt');
  return out;
}

// Prévia rápida do rascunho — nome, data absoluta e campos preenchidos —
// pra o usuário avaliar antes de clicar em Restaurar.
function DraftPreviewLine({ entry }: { entry: DraftBannerEntry }) {
  const filled = filledFieldsList(entry.summary);
  const name = entry.summary.name.trim() || 'Sem nome';
  const absolute = formatAbsolute(entry.savedAt);
  return (
    <div
      className="rounded-md border border-border/40 bg-background/40 px-2.5 py-2 text-[11px] text-muted-foreground space-y-1"
      aria-label="Prévia do rascunho antes de restaurar"
    >
      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-muted-foreground/70 uppercase tracking-wider text-[10px]">Prévia</span>
        <span className="text-foreground font-medium truncate max-w-[220px]" title={name}>{name}</span>
        <span className="text-muted-foreground/50">·</span>
        <span className="font-mono tabular-nums" title="Salvo em">{absolute}</span>
      </div>
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-muted-foreground/70">Preenchidos:</span>
        {filled.length === 0 ? (
          <span className="italic text-muted-foreground/60">nenhum campo ainda</span>
        ) : (
          filled.map((f, i) => (
            <span key={f} className="inline-flex items-center">
              <span className="text-nexus-emerald font-medium">{f}</span>
              {i < filled.length - 1 && <span className="text-muted-foreground/40 mx-1">·</span>}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
        ok
          ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
          : 'border-border/50 bg-secondary/40 text-muted-foreground'
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {label}
    </span>
  );
}

function subjectOf(summary: DraftSummary): string {
  return summary.name.trim() ? `"${summary.name.trim()}"` : 'sem nome ainda';
}

// 4 etapas iguais — cada uma vale 25%. Mantém o cálculo previsível e
// alinhado com os StatusChips exibidos logo abaixo.
function completionOf(summary: DraftSummary): { done: number; total: number; pct: number } {
  const flags = [summary.hasIdentity, summary.hasType, summary.hasModel, summary.hasPrompt];
  const done = flags.filter(Boolean).length;
  const total = flags.length;
  return { done, total, pct: Math.round((done / total) * 100) };
}

function CompletionMeter({ summary, compact = false }: { summary: DraftSummary; compact?: boolean }) {
  const { done, total, pct } = completionOf(summary);
  // Cor sinaliza maturidade do rascunho: vermelho < 50%, âmbar < 100%, verde = 100%.
  const tone =
    pct === 100
      ? 'bg-nexus-emerald'
      : pct >= 50
      ? 'bg-nexus-amber'
      : 'bg-destructive';
  const toneText =
    pct === 100 ? 'text-nexus-emerald' : pct >= 50 ? 'text-nexus-amber' : 'text-destructive';
  return (
    <div
      className={`flex items-center gap-2 ${compact ? 'min-w-[110px]' : 'min-w-[140px]'}`}
      title={`${done} de ${total} etapas concluídas`}
      aria-label={`Completude: ${pct}% — ${done} de ${total} etapas`}
    >
      <div className="flex-1 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${tone}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`text-[11px] font-mono tabular-nums shrink-0 ${toneText}`}>
        {pct}%
      </span>
    </div>
  );
}

export function DraftRecoveryBanner({
  drafts,
  onRestore,
  onDiscardOne,
  onDiscardAll,
  onRename,
}: DraftRecoveryBannerProps) {
  const [selectedId, setSelectedId] = useState<string>(drafts[0]?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const itemsRef = useRef<Record<string, HTMLDivElement | null>>({});

  const handleConfirmRename = (id: string, newName: string) => {
    onRename(id, newName);
    setEditingId(null);
  };

  useEffect(() => {
    if (!drafts.find((d) => d.id === selectedId)) {
      setSelectedId(drafts[0]?.id ?? '');
    }
  }, [drafts, selectedId]);

  if (drafts.length === 0) return null;

  // ───── Single-draft mode (compat) ─────
  if (drafts.length === 1) {
    const only = drafts[0];
    const blocked = only.restorable === false;
    return (
      <div
        role="status"
        aria-live="polite"
        className="nexus-card animate-page-enter border-primary/30 bg-primary/5 space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <FileClock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-heading font-semibold text-foreground">
              Rascunho encontrado
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você começou um agente {formatRelative(only.savedAt)}. Renomeie ou continue de onde parou.
            </p>
            <div className="mt-2">
              <NameLabelOrEditor
                draft={only}
                isEditing={editingId === only.id}
                onStartEdit={() => setEditingId(only.id)}
                onCancel={() => setEditingId(null)}
                onConfirm={(newName) => handleConfirmRename(only.id, newName)}
              />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground shrink-0">
              Completude
            </span>
            <CompletionMeter summary={only.summary} />
          </div>
          <div className="flex flex-wrap gap-1.5">
            <StatusChip label="Identidade" ok={only.summary.hasIdentity} />
            <StatusChip label="Tipo" ok={only.summary.hasType} />
            <StatusChip label="Modelo" ok={only.summary.hasModel} />
            <StatusChip label="Prompt" ok={only.summary.hasPrompt} />
            {blocked && (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning">
                Incompleto
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label="Excluir este rascunho"
                title="Excluir rascunho"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir rascunho
              </Button>
            }
            {...discardCopy(only.summary.name)}
            confirmLabel="Excluir"
            onConfirm={() => onDiscardOne(only.id)}
          />
          <Button
            size="sm"
            onClick={() => onRestore(only.id)}
            autoFocus
            title={blocked ? (only.restoreBlockedReason ?? 'Rascunho incompleto — vamos pular direto ao primeiro campo pendente') : 'Restaurar e continuar do primeiro campo pendente'}
            className="gap-1.5 nexus-gradient-bg text-primary-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar
          </Button>
        </div>
      </div>
    );
  }

  // ───── Multi-draft mode ─────
  const handleKeyNav = (e: React.KeyboardEvent, currentIdx: number) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowDown'
        ? (currentIdx + 1) % drafts.length
        : (currentIdx - 1 + drafts.length) % drafts.length;
    const nextId = drafts[nextIdx].id;
    setSelectedId(nextId);
    itemsRef.current[nextId]?.focus();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="nexus-card animate-page-enter border-primary/30 bg-primary/5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            {drafts.length} rascunhos encontrados
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione qual deseja retomar. Os outros continuam salvos.
          </p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Rascunhos disponíveis" className="space-y-1.5">
        {drafts.map((d, idx) => {
          const checked = selectedId === d.id;
          return (
            <div
              key={d.id}
              ref={(el) => { itemsRef.current[d.id] = el; }}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setSelectedId(d.id)}
              onKeyDown={(e) => {
                handleKeyNav(e, idx);
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelectedId(d.id);
                }
              }}
              className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                checked
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border/50 bg-background/40 hover:border-border hover:bg-background/60'
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-primary' : 'border-muted-foreground/40'
                }`}
                aria-hidden
              >
                {checked && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <NameLabelOrEditor
                    draft={d}
                    isEditing={editingId === d.id}
                    onStartEdit={() => setEditingId(d.id)}
                    onCancel={() => setEditingId(null)}
                    onConfirm={(newName) => handleConfirmRename(d.id, newName)}
                  />
                  {d.typeLabel && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">
                      {d.typeLabel}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelative(d.savedAt)}
                  </span>
                  {d.restorable === false && (
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning"
                      title={d.restoreBlockedReason ?? 'Incompleto demais para retomar'}
                    >
                      Incompleto
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    <StatusChip label="Identidade" ok={d.summary.hasIdentity} />
                    <StatusChip label="Tipo" ok={d.summary.hasType} />
                    <StatusChip label="Modelo" ok={d.summary.hasModel} />
                    <StatusChip label="Prompt" ok={d.summary.hasPrompt} />
                  </div>
                  <CompletionMeter summary={d.summary} compact />
                </div>
              </div>

              <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      className="opacity-60 hover:opacity-100 hover:text-destructive transition shrink-0 p-1 rounded-md hover:bg-destructive/10"
                      aria-label={`Descartar rascunho ${subjectOf(d.summary)}`}
                      title="Descartar este rascunho"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  }
                  {...discardCopy(d.summary.name)}
                  confirmLabel="Descartar"
                  onConfirm={() => onDiscardOne(d.id)}
                />
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <ConfirmDialog
          trigger={
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive">
              <X className="h-3.5 w-3.5" /> Descartar todos
            </Button>
          }
          title={`Descartar todos os ${drafts.length} rascunhos?`}
          description="Todos os rascunhos serão removidos permanentemente. Esta ação não pode ser desfeita."
          confirmLabel="Descartar todos"
          onConfirm={onDiscardAll}
        />
        {(() => {
          const selected = drafts.find((d) => d.id === selectedId);
          const blocked = selected?.restorable === false;
          return (
            <Button
              size="sm"
              onClick={() => selectedId && onRestore(selectedId)}
              disabled={!selectedId}
              title={blocked ? (selected?.restoreBlockedReason ?? 'Rascunho incompleto — vamos pular direto ao primeiro campo pendente') : 'Restaurar o rascunho selecionado e continuar do primeiro campo pendente'}
              className="gap-1.5 nexus-gradient-bg text-primary-foreground"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Restaurar
            </Button>
          );
        })()}
      </div>
    </div>
  );
}
