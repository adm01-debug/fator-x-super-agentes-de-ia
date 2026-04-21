import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, RotateCcw, Copy, Loader2, Wrench, Shield, FileText } from "lucide-react";
import type { AgentVersion } from "@/services/agentsService";
import { getVersionTools, getVersionGuardrails, getVersionPrompt, getVersionScalar } from "@/lib/agentChangelog";

interface Props {
  version: AgentVersion;
  isCurrent: boolean;
  onRestore: () => void;
  onDuplicate: () => void;
  restoring: boolean;
}

export function VersionDetailPanel({ version, isCurrent, onRestore, onDuplicate, restoring }: Props) {
  const [promptOpen, setPromptOpen] = useState(true);
  const tools = getVersionTools(version);
  const guardrails = getVersionGuardrails(version);
  const prompt = getVersionPrompt(version);
  const temperature = getVersionScalar<number>(version, 'temperature');
  const maxTokens = getVersionScalar<number>(version, 'max_tokens');

  return (
    <div className="space-y-4">
      <div className="nexus-card">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-heading font-semibold text-foreground">v{version.version}</h3>
              {isCurrent && <Badge className="bg-primary/10 text-primary text-[11px]">atual</Badge>}
            </div>
            <p className="text-xs text-muted-foreground">
              {version.change_summary || 'Sem resumo de mudanças'}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1">
              Criado em {new Date(version.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="flex gap-1.5">
            {!isCurrent && (
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={onRestore} disabled={restoring}>
                {restoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                Restaurar
              </Button>
            )}
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={onDuplicate}>
              <Copy className="h-3 w-3" /> Duplicar como rascunho
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <Field label="Modelo" value={version.model ?? '—'} />
          <Field label="Persona" value={version.persona ?? '—'} />
          <Field label="Temperature" value={temperature !== undefined ? String(temperature) : '—'} />
          <Field label="Max tokens" value={maxTokens !== undefined ? String(maxTokens) : '—'} />
        </div>
      </div>

      <Collapsible open={promptOpen} onOpenChange={setPromptOpen}>
        <div className="nexus-card">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" aria-hidden />
              <h4 className="text-sm font-semibold text-foreground">System prompt</h4>
              <span className="text-[11px] text-muted-foreground">({prompt.length} chars)</span>
            </div>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${promptOpen ? 'rotate-180' : ''}`} />
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-3">
            {prompt ? (
              <pre className="rounded-lg bg-nexus-surface-1 p-3 text-xs font-mono text-foreground/90 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto">
                {prompt}
              </pre>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem prompt definido nesta versão.</p>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      <div className="grid md:grid-cols-2 gap-4">
        <ListCard icon={<Wrench className="h-4 w-4 text-primary" aria-hidden />} title="Ferramentas" items={tools} emptyHint="Nenhuma ferramenta ativa" />
        <ListCard icon={<Shield className="h-4 w-4 text-primary" aria-hidden />} title="Guardrails" items={guardrails} emptyHint="Nenhum guardrail ativo" />
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-secondary/30 px-2.5 py-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs font-mono text-foreground truncate mt-0.5">{value}</p>
    </div>
  );
}

function ListCard({ icon, title, items, emptyHint }: { icon: React.ReactNode; title: string; items: string[]; emptyHint: string }) {
  return (
    <div className="nexus-card">
      <div className="flex items-center gap-2 mb-2.5">
        {icon}
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant="outline" className="text-[10px] ml-auto">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">{emptyHint}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {items.map(it => (
            <Badge key={it} variant="outline" className="text-[11px] font-mono">{it}</Badge>
          ))}
        </div>
      )}
    </div>
  );
}
