import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { FileClock, Save, Trash2, RotateCcw, Inbox } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  type DraftVersion,
  listDraftVersions,
  saveDraftVersion,
  deleteDraftVersion,
} from '@/services/agentDraftVersionsService';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { validateAgentVersion } from '@/lib/validations/agentVersionValidator';
import { VersionValidationPanel } from './VersionValidationPanel';

interface DraftVersionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const d = Math.round(hr / 24);
  return `há ${d}d`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DraftVersionsDialog({ open, onOpenChange }: DraftVersionsDialogProps) {
  const { toast } = useToast();
  const agent = useAgentBuilderStore((s) => s.agent);
  const loadAgent = useAgentBuilderStore((s) => s.loadAgent);

  const [drafts, setDrafts] = useState<DraftVersion[]>([]);
  const [label, setLabel] = useState('');
  const [note, setNote] = useState('');
  const [forceSave, setForceSave] = useState(false);

  const refresh = useCallback(
    () => setDrafts(listDraftVersions(agent.id as string | undefined)),
    [agent.id],
  );

  useEffect(() => {
    if (open) {
      refresh();
      setLabel('');
      setNote('');
      setForceSave(false);
    }
  }, [open, agent.id, refresh]);

  const validation = useMemo(
    () => validateAgentVersion(agent, { label, note }),
    [agent, label, note],
  );

  const handleSave = (opts?: { override?: boolean }) => {
    if (!validation.canSave && !opts?.override) return;
    const draft = saveDraftVersion({ agent, label, note });
    if (opts?.override) {
      toast({
        title: 'Rascunho salvo com erros pendentes',
        description: `${draft.label} — ${validation.errors.length} validação(ões) ignorada(s).`,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Rascunho salvo localmente', description: draft.label });
    }
    setLabel('');
    setNote('');
    setForceSave(false);
    refresh();
  };

  const handleResume = (d: DraftVersion) => {
    loadAgent(d.snapshot);
    toast({ title: 'Rascunho restaurado', description: d.label });
    onOpenChange(false);
  };

  const handleDiscard = (d: DraftVersion) => {
    deleteDraftVersion(d.id);
    toast({ title: 'Rascunho descartado', description: d.label });
    refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileClock className="h-5 w-5 text-primary" aria-hidden />
            Rascunhos de versão
          </DialogTitle>
          <DialogDescription>
            Snapshots locais (não persistidos no servidor) da configuração atual do agente. Útil
            para experimentar mudanças sem perder o ponto de partida.
          </DialogDescription>
        </DialogHeader>

        {/* Save form */}
        <div className="space-y-2 nexus-card !p-3 border-primary/30 bg-primary/5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Salvar estado atual</span>
            <Badge variant="outline" className="text-[10px]">
              local
            </Badge>
          </div>
          <Input
            placeholder='Ex: "Antes de trocar o prompt"'
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-8 text-xs"
            aria-label="Título do rascunho"
          />
          <Textarea
            placeholder="Anotação opcional (o que você está testando?)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="text-xs resize-none"
            aria-label="Anotação"
          />

          <VersionValidationPanel result={validation} />

          <div className="flex justify-end gap-2">
            {!validation.canSave && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setForceSave(true);
                  handleSave({ override: true });
                }}
                className="gap-1.5 text-destructive hover:text-destructive"
                title="Ignorar erros e salvar mesmo assim"
              >
                Salvar mesmo assim
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => handleSave()}
              disabled={!validation.canSave && !forceSave}
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" /> Salvar rascunho
            </Button>
          </div>
        </div>

        {/* List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {drafts.length} {drafts.length === 1 ? 'rascunho' : 'rascunhos'}
            </span>
            <span className="font-mono">limite 20</span>
          </div>

          {drafts.length === 0 ? (
            <div className="nexus-card !p-6 flex flex-col items-center text-center gap-2 text-muted-foreground">
              <Inbox className="h-8 w-8 opacity-50" aria-hidden />
              <p className="text-sm">Nenhum rascunho salvo ainda</p>
              <p className="text-[11px]">
                Use o formulário acima para salvar uma versão de trabalho.
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[280px] pr-2">
              <ul className="space-y-2">
                {drafts.map((d) => (
                  <li
                    key={d.id}
                    className="nexus-card !p-3 flex items-start gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <FileClock className="h-4 w-4 text-primary" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-foreground truncate">
                          {d.label}
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {formatSize(d.size)}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {d.agentName} · {formatRelative(d.createdAt)}
                      </p>
                      {d.note && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.note}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResume(d)}
                        className="gap-1.5 h-7 text-[11px]"
                        aria-label={`Retomar ${d.label}`}
                      >
                        <RotateCcw className="h-3 w-3" /> Retomar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDiscard(d)}
                        className="gap-1.5 h-7 text-[11px] text-destructive hover:text-destructive"
                        aria-label={`Descartar ${d.label}`}
                      >
                        <Trash2 className="h-3 w-3" /> Descartar
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
