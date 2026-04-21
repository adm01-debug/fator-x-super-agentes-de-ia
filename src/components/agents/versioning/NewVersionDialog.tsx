import { useState, useMemo, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AgentVersion } from "@/services/agentsService";
import { createAgentVersion } from "@/services/agentsService";
import {
  generateChangelog,
  summarizeChangelog,
  getVersionPrompt,
  type VersionLike,
} from "@/lib/agentChangelog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  baseVersion: AgentVersion;
}

interface ToolEntry { name: string; enabled: boolean }

function readTools(v: AgentVersion, key: 'tools' | 'guardrails'): ToolEntry[] {
  const cfg = (v.config ?? {}) as Record<string, unknown>;
  const arr = cfg[key];
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map(x => ({
      name: String(x.name ?? x.id ?? 'unnamed'),
      enabled: (x.enabled as boolean | undefined) ?? true,
    }));
}

export function NewVersionDialog({ open, onOpenChange, agentId, baseVersion }: Props) {
  const queryClient = useQueryClient();

  const baseCfg = (baseVersion.config ?? {}) as Record<string, unknown>;
  const [prompt, setPrompt] = useState<string>(getVersionPrompt(baseVersion));
  const [model, setModel] = useState<string>(baseVersion.model ?? '');
  const [temperature, setTemperature] = useState<string>(String(baseCfg.temperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState<string>(String(baseCfg.max_tokens ?? 2048));
  const [tools, setTools] = useState<ToolEntry[]>(readTools(baseVersion, 'tools'));
  const [guardrails, setGuardrails] = useState<ToolEntry[]>(readTools(baseVersion, 'guardrails'));
  const [summary, setSummary] = useState<string>('');

  // Reset form whenever dialog reopens with a different base version
  useEffect(() => {
    if (open) {
      setPrompt(getVersionPrompt(baseVersion));
      setModel(baseVersion.model ?? '');
      setTemperature(String(baseCfg.temperature ?? 0.7));
      setMaxTokens(String(baseCfg.max_tokens ?? 2048));
      setTools(readTools(baseVersion, 'tools'));
      setGuardrails(readTools(baseVersion, 'guardrails'));
      setSummary('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, baseVersion.id]);

  const nextConfig = useMemo<Record<string, unknown>>(() => ({
    ...baseCfg,
    system_prompt: prompt,
    temperature: Number(temperature) || 0,
    max_tokens: Number(maxTokens) || 0,
    tools: tools.map(t => ({ name: t.name, enabled: t.enabled })),
    guardrails: guardrails.map(g => ({ name: g.name, enabled: g.enabled })),
  }), [baseCfg, prompt, temperature, maxTokens, tools, guardrails]);

  const nextVersion: VersionLike = {
    model,
    persona: baseVersion.persona,
    mission: baseVersion.mission,
    config: nextConfig,
  };

  const changelog = useMemo(() => generateChangelog(baseVersion, nextVersion), [baseVersion, nextVersion]);
  const autoSummary = summarizeChangelog(changelog);

  const createMut = useMutation({
    mutationFn: () => createAgentVersion({
      agentId,
      model: model || null,
      persona: baseVersion.persona,
      mission: baseVersion.mission,
      config: nextConfig,
      change_summary: summary.trim() || autoSummary,
    }),
    onSuccess: (data) => {
      toast.success(`Versão v${data.version} criada!`);
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent_versions', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message || 'Erro ao salvar versão'),
  });

  const toggleTool = (idx: number, list: 'tools' | 'guardrails') => {
    const setter = list === 'tools' ? setTools : setGuardrails;
    const arr = list === 'tools' ? tools : guardrails;
    setter(arr.map((t, i) => i === idx ? { ...t, enabled: !t.enabled } : t));
  };

  const hasChanges = changelog.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            Nova versão (a partir de v{baseVersion.version})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-xs font-medium text-foreground mb-1.5 block">System prompt</Label>
            <Textarea
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={10}
              className="bg-nexus-surface-1 border-border/50 font-mono text-xs leading-relaxed resize-none"
              placeholder="Você é um assistente especializado em..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">{prompt.length} chars · {prompt.split(/\s+/).filter(Boolean).length} palavras</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-medium text-foreground mb-1.5 block">Modelo</Label>
              <Input value={model} onChange={e => setModel(e.target.value)} className="text-xs h-8" />
            </div>
            <div>
              <Label className="text-xs font-medium text-foreground mb-1.5 block">Temperature</Label>
              <Input type="number" min={0} max={2} step={0.1} value={temperature} onChange={e => setTemperature(e.target.value)} className="text-xs h-8 font-mono" />
            </div>
            <div>
              <Label className="text-xs font-medium text-foreground mb-1.5 block">Max tokens</Label>
              <Input type="number" min={1} value={maxTokens} onChange={e => setMaxTokens(e.target.value)} className="text-xs h-8 font-mono" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <ToolList title="Ferramentas" items={tools} onToggle={(i) => toggleTool(i, 'tools')} />
            <ToolList title="Guardrails" items={guardrails} onToggle={(i) => toggleTool(i, 'guardrails')} />
          </div>

          <div className="rounded-lg border border-border/50 bg-secondary/30 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Changelog automático</p>
              <Badge variant="outline" className="text-[10px]">{changelog.length} mudança(s)</Badge>
            </div>
            {changelog.length === 0 ? (
              <p className="text-[11px] text-muted-foreground italic">Sem alterações estruturais — ajuste algum campo para registrar uma nova versão.</p>
            ) : (
              <p className="text-[11px] text-foreground/80 font-mono">{autoSummary}</p>
            )}
          </div>

          <div>
            <Label className="text-xs font-medium text-foreground mb-1.5 block">Resumo da mudança (opcional)</Label>
            <Input
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder={autoSummary}
              className="text-xs h-8"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Se vazio, será usado o resumo automático acima.</p>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            size="sm"
            className="gap-1.5 nexus-gradient-bg text-primary-foreground hover:opacity-90"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !hasChanges}
          >
            {createMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar como nova versão
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ToolList({ title, items, onToggle }: { title: string; items: ToolEntry[]; onToggle: (i: number) => void }) {
  return (
    <div className="rounded-lg border border-border/50 p-3">
      <p className="text-xs font-semibold text-foreground mb-2">{title} <span className="text-muted-foreground font-normal">({items.filter(i => i.enabled).length}/{items.length})</span></p>
      {items.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic">Nenhum item disponível.</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {items.map((it, i) => (
            <label key={`${it.name}-${i}`} className="flex items-center gap-2 text-xs cursor-pointer hover:bg-secondary/30 rounded px-1.5 py-1">
              <Checkbox checked={it.enabled} onCheckedChange={() => onToggle(i)} />
              <span className="font-mono text-foreground/90 truncate">{it.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
