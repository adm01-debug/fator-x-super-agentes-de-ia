import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, RotateCcw, FileText, Wrench, Cpu } from "lucide-react";
import type { AgentVersion, RestoreOptions } from "@/services/agentsService";
import { getVersionTools, getVersionPrompt, getVersionScalar } from "@/lib/agentChangelog";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  source: AgentVersion;
  current: AgentVersion;
  nextVersionNumber: number;
  restoring: boolean;
  onConfirm: (options: RestoreOptions) => void;
}

export function RestoreVersionDialog({ open, onOpenChange, source, current, nextVersionNumber, restoring, onConfirm }: Props) {
  const [copyPrompt, setCopyPrompt] = useState(true);
  const [copyTools, setCopyTools] = useState(true);
  const [copyModel, setCopyModel] = useState(false);

  const tools = useMemo(() => getVersionTools(source), [source]);
  const prompt = useMemo(() => getVersionPrompt(source), [source]);
  const temperature = getVersionScalar<number>(source, 'temperature');
  const maxTokens = getVersionScalar<number>(source, 'max_tokens');

  const parts: string[] = [];
  if (copyPrompt) parts.push('prompt');
  if (copyTools) parts.push('ferramentas');
  if (copyModel) parts.push('modelo');
  const summary = parts.length > 0
    ? `Restaurado de v${source.version} (${parts.join(' + ')})`
    : `Restaurado de v${source.version} (sem alterações)`;

  const canConfirm = parts.length > 0;
  const sameAsCurrent = source.id === current.id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" aria-hidden="true" />
            Restaurar v{source.version} → criar v{nextVersionNumber}
          </DialogTitle>
          <DialogDescription>
            Selecione o que copiar de v{source.version} para a nova versão. As demais partes herdam de v{current.version} (atual).
          </DialogDescription>
        </DialogHeader>

        {sameAsCurrent && (
          <div className="text-xs text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-lg px-3 py-2">
            Você está restaurando a versão atual sobre ela mesma — a nova versão será praticamente idêntica.
          </div>
        )}

        <div className="space-y-3">
          <RestoreOption
            id="copy-prompt"
            checked={copyPrompt}
            onChange={setCopyPrompt}
            icon={<FileText className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            label="System prompt"
            meta={`${prompt.length.toLocaleString('pt-BR')} chars`}
            preview={prompt ? `"${prompt.slice(0, 140).replace(/\s+/g, ' ').trim()}${prompt.length > 140 ? '…' : ''}"` : 'Sem prompt definido'}
          />
          <RestoreOption
            id="copy-tools"
            checked={copyTools}
            onChange={setCopyTools}
            icon={<Wrench className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            label="Ferramentas"
            meta={`${tools.length} ativa${tools.length !== 1 ? 's' : ''}`}
            preview={tools.length === 0
              ? 'Nenhuma ferramenta ativa'
              : tools.slice(0, 6).join(' · ') + (tools.length > 6 ? ` · +${tools.length - 6}` : '')}
          />
          <RestoreOption
            id="copy-model"
            checked={copyModel}
            onChange={setCopyModel}
            icon={<Cpu className="h-3.5 w-3.5 text-primary" aria-hidden="true" />}
            label="Modelo & parâmetros"
            meta={source.model ?? 'sem modelo'}
            preview={`${source.persona ?? '—'} · temp ${temperature ?? '—'} · max ${maxTokens ?? '—'}`}
          />
        </div>

        <div className="rounded-lg border border-border/50 bg-secondary/30 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Prévia do changelog</p>
          <p className="text-xs font-mono text-foreground">{summary}</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={restoring}>
            Cancelar
          </Button>
          <Button
            variant="default"
            size="sm"
            onClick={() => onConfirm({ copyPrompt, copyTools, copyModel })}
            disabled={!canConfirm || restoring}
          >
            {restoring ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RotateCcw className="h-3.5 w-3.5 mr-1.5" />}
            Criar v{nextVersionNumber}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreOption({ id, checked, onChange, icon, label, meta, preview }: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  meta: string;
  preview: string;
}) {
  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-colors ${
        checked
          ? 'border-primary/40 bg-primary/[0.04]'
          : 'border-border/50 bg-card hover:border-primary/20 hover:bg-secondary/20'
      }`}
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          {icon}
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono">{meta}</span>
        </div>
        <p className="text-xs text-muted-foreground truncate">{preview}</p>
      </div>
    </label>
  );
}
