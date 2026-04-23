/**
 * RestorePresetMenu — botão único no header do `<fieldset>` de campos do
 * diálogo de rollback. Permite:
 *   - Aplicar um preset salvo (1 clique → atualiza copyPrompt/Tools/Model)
 *   - Marcar como padrão (auto-aplicado ao abrir o diálogo)
 *   - Salvar a seleção atual como novo preset (com nome)
 *   - Apagar presets existentes
 *
 * Persistência via `restorePresetsService` (Supabase, RLS por usuário).
 */
import { Bookmark, BookmarkCheck, Check, Loader2, Plus, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  createRestorePreset,
  deleteRestorePreset,
  listRestorePresets,
  setDefaultRestorePreset,
  type RestorePreset,
} from '@/services/restorePresetsService';
import { toast } from 'sonner';

interface Props {
  current: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean };
  onApply: (p: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean }) => void;
  /** Notifica quando presets são carregados — usado para auto-aplicar default na abertura. */
  onPresetsLoaded?: (presets: RestorePreset[]) => void;
  disabled?: boolean;
}

export function RestorePresetMenu({ current, onApply, onPresetsLoaded, disabled }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAsDefault, setNewAsDefault] = useState(false);

  const { data: presets = [], isLoading } = useQuery({
    queryKey: ['restore-field-presets'],
    queryFn: async () => {
      const list = await listRestorePresets();
      onPresetsLoaded?.(list);
      return list;
    },
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['restore-field-presets'] });

  const createMut = useMutation({
    mutationFn: () => createRestorePreset({
      name: newName,
      copy_prompt: current.copyPrompt,
      copy_tools: current.copyTools,
      copy_model: current.copyModel,
      is_default: newAsDefault,
    }),
    onSuccess: () => {
      invalidate();
      toast.success(`Preset "${newName}" salvo`);
      setNewName('');
      setNewAsDefault(false);
      setCreating(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefaultMut = useMutation({
    mutationFn: (id: string) => setDefaultRestorePreset(id),
    onSuccess: () => { invalidate(); toast.success('Preset padrão atualizado'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteRestorePreset(id),
    onSuccess: () => { invalidate(); toast.success('Preset removido'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const matchesCurrent = (p: RestorePreset) =>
    p.copy_prompt === current.copyPrompt
    && p.copy_tools === current.copyTools
    && p.copy_model === current.copyModel;

  const activePreset = presets.find(matchesCurrent);
  // Sugere salvar quando a combinação atual ainda não está catalogada.
  const canSaveCurrent = current.copyPrompt || current.copyTools || current.copyModel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-6 px-2 text-[10px] gap-1 border-border/60"
          disabled={disabled}
          title="Gerenciar presets de campos"
        >
          {activePreset ? (
            <BookmarkCheck className="h-3 w-3 text-primary" aria-hidden />
          ) : (
            <Bookmark className="h-3 w-3" aria-hidden />
          )}
          {activePreset ? activePreset.name : 'Presets'}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0" onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            Presets de campos
          </span>
          {!creating && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] gap-1"
              onClick={() => setCreating(true)}
              disabled={!canSaveCurrent}
              title={!canSaveCurrent ? 'Marque ao menos um campo' : 'Salvar seleção atual'}
            >
              <Plus className="h-3 w-3" /> Salvar atual
            </Button>
          )}
        </div>

        {creating && (
          <form
            className="p-2.5 space-y-2 border-b border-border/60 bg-muted/20"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName.trim()) return;
              createMut.mutate();
            }}
          >
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome do preset (ex.: Só prompt)"
              maxLength={60}
              className="h-7 text-xs"
              disabled={createMut.isPending}
            />
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <span>Captura:</span>
              {[
                current.copyPrompt && 'prompt',
                current.copyTools && 'tools',
                current.copyModel && 'modelo',
              ].filter(Boolean).join(' · ') || 'nada'}
            </div>
            <label className="flex items-center gap-1.5 text-[11px] text-foreground/90 cursor-pointer">
              <Checkbox
                checked={newAsDefault}
                onCheckedChange={(v) => setNewAsDefault(!!v)}
                disabled={createMut.isPending}
              />
              Aplicar automaticamente ao abrir o diálogo
            </label>
            <div className="flex justify-end gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => { setCreating(false); setNewName(''); setNewAsDefault(false); }}
                disabled={createMut.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-6 px-2 text-[10px] gap-1"
                disabled={!newName.trim() || createMut.isPending}
              >
                {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                Salvar
              </Button>
            </div>
          </form>
        )}

        <div className="max-h-64 overflow-y-auto py-1">
          {isLoading && (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1.5">
              <Loader2 className="h-3 w-3 animate-spin" /> Carregando presets…
            </div>
          )}
          {!isLoading && presets.length === 0 && !creating && (
            <div className="px-3 py-4 text-center text-[11px] text-muted-foreground">
              Nenhum preset salvo. Marque os campos desejados e clique em <strong>Salvar atual</strong>.
            </div>
          )}
          {presets.map((p) => {
            const active = matchesCurrent(p);
            return (
              <div
                key={p.id}
                className={`group flex items-center gap-1 px-2 py-1.5 mx-1 rounded text-[11px] hover:bg-muted/40 transition-colors ${
                  active ? 'bg-primary/10' : ''
                }`}
              >
                <button
                  type="button"
                  className="flex-1 min-w-0 text-left flex items-center gap-1.5"
                  onClick={() => {
                    onApply({
                      copyPrompt: p.copy_prompt,
                      copyTools: p.copy_tools,
                      copyModel: p.copy_model,
                    });
                    setOpen(false);
                    toast.success(`Preset "${p.name}" aplicado`);
                  }}
                >
                  {active ? (
                    <Check className="h-3 w-3 text-primary shrink-0" aria-hidden />
                  ) : (
                    <span className="w-3 shrink-0" />
                  )}
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0">
                    {[
                      p.copy_prompt && 'P',
                      p.copy_tools && 'T',
                      p.copy_model && 'M',
                    ].filter(Boolean).join('')}
                  </span>
                </button>
                <button
                  type="button"
                  className={`p-1 rounded hover:bg-muted/60 ${p.is_default ? 'text-nexus-amber' : 'text-muted-foreground/40 opacity-0 group-hover:opacity-100'}`}
                  onClick={() => !p.is_default && setDefaultMut.mutate(p.id)}
                  disabled={setDefaultMut.isPending || p.is_default}
                  title={p.is_default ? 'Preset padrão (auto-aplicado ao abrir)' : 'Definir como padrão'}
                  aria-label={p.is_default ? 'Preset padrão' : 'Definir como padrão'}
                >
                  <Star className={`h-3 w-3 ${p.is_default ? 'fill-current' : ''}`} aria-hidden />
                </button>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100"
                  onClick={() => {
                    if (confirm(`Apagar o preset "${p.name}"?`)) deleteMut.mutate(p.id);
                  }}
                  disabled={deleteMut.isPending}
                  title="Apagar preset"
                  aria-label={`Apagar preset ${p.name}`}
                >
                  <Trash2 className="h-3 w-3" aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
