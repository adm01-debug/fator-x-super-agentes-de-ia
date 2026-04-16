import { logger } from '@/lib/logger';
import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PromptDiff } from "@/components/prompts/PromptDiff";
import { GitCompare, RotateCcw, Loader2, ArrowRight } from "lucide-react";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Json } from "@/integrations/supabase/types";

interface Version {
  id: string;
  version: number;
  model: string | null;
  persona: string | null;
  mission: string | null;
  config: Record<string, unknown>;
  change_summary: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Version[];
  agentId?: string;
}

function versionToText(v: Version): string {
  const lines: string[] = [];
  lines.push(`# Versão ${v.version}`);
  lines.push(`Modelo: ${v.model || '—'}`);
  lines.push(`Persona: ${v.persona || '—'}`);
  lines.push(`Missão: ${v.mission || '—'}`);
  if (v.change_summary) lines.push(`Resumo: ${v.change_summary}`);
  lines.push('');
  lines.push('--- Config ---');
  try {
    const cfg = typeof v.config === 'string' ? JSON.parse(v.config) : v.config;
    lines.push(JSON.stringify(cfg, null, 2));
  } catch (err) { logger.error("Operation failed:", err);
    lines.push(String(v.config));
  }
  return lines.join('\n');
}

function getCfg(v: Version): Record<string, unknown> {
  try {
    return (typeof v.config === 'string' ? JSON.parse(v.config) : v.config) || {};
  } catch { return {}; }
}

function countEnabled(arr: unknown): number {
  if (!Array.isArray(arr)) return 0;
  return arr.filter((x: any) => x && (x.enabled ?? true)).length;
}

interface Delta { label: string; from: string | number; to: string | number; }

function computeDeltas(a: Version, b: Version): Delta[] {
  const ca = getCfg(a); const cb = getCfg(b);
  const out: Delta[] = [];
  if (a.model !== b.model) out.push({ label: 'Modelo', from: a.model || '—', to: b.model || '—' });
  const ta = (ca as any).temperature, tb = (cb as any).temperature;
  if (ta !== tb && (ta !== undefined || tb !== undefined)) out.push({ label: 'Temperature', from: ta ?? '—', to: tb ?? '—' });
  const ma = (ca as any).max_tokens, mb = (cb as any).max_tokens;
  if (ma !== mb && (ma !== undefined || mb !== undefined)) out.push({ label: 'Max Tokens', from: ma ?? '—', to: mb ?? '—' });
  const toolsA = countEnabled((ca as any).tools), toolsB = countEnabled((cb as any).tools);
  if (toolsA !== toolsB) out.push({ label: 'Ferramentas ativas', from: toolsA, to: toolsB });
  const grA = countEnabled((ca as any).guardrails), grB = countEnabled((cb as any).guardrails);
  if (grA !== grB) out.push({ label: 'Guardrails ativos', from: grA, to: grB });
  const spA = ((ca as any).system_prompt || '').length, spB = ((cb as any).system_prompt || '').length;
  if (spA !== spB) out.push({ label: 'System prompt (chars)', from: spA, to: spB });
  if (a.persona !== b.persona) out.push({ label: 'Persona', from: 'alterada', to: '—' });
  if (a.mission !== b.mission) out.push({ label: 'Missão', from: 'alterada', to: '—' });
  return out;
}

export function VersionDiffDialog({ open, onOpenChange, versions, agentId }: Props) {
  const [vA, setVA] = useState<string>('');
  const [vB, setVB] = useState<string>('');
  const [restoring, setRestoring] = useState(false);
  const queryClient = useQueryClient();

  // Auto-select last 2 versions when dialog opens
  useEffect(() => {
    if (open && versions.length >= 2 && !vA && !vB) {
      setVA(versions[1].id); // previous
      setVB(versions[0].id); // newest
    }
  }, [open, versions, vA, vB]);

  const verA = versions.find(v => v.id === vA);
  const verB = versions.find(v => v.id === vB);
  const deltas = useMemo(() => (verA && verB ? computeDeltas(verA, verB) : []), [verA, verB]);

  const handleRestore = async (version: Version) => {
    if (!agentId) return;
    setRestoring(true);
    try {
      const { error } = await supabaseExternal.from('agents').update({
        model: version.model,
        persona: version.persona,
        mission: version.mission,
        config: version.config as unknown as Json,
      }).eq('id', agentId);
      if (error) throw error;
      toast.success(`Restaurado para v${version.version}`);
      queryClient.invalidateQueries({ queryKey: ['agent', agentId] });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['agent-versions', agentId] });
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao restaurar');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Comparar Versões
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-2">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Versão A (anterior)</label>
            <Select value={vA} onValueChange={setVA}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.model} ({new Date(v.created_at).toLocaleDateString('pt-BR')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Versão B (nova)</label>
            <Select value={vB} onValueChange={setVB}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {versions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    v{v.version} — {v.model} ({new Date(v.created_at).toLocaleDateString('pt-BR')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {verA && verB && vA !== vB ? (
          <div className="mt-4 space-y-3">
            {/* Resumo de mudanças */}
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-foreground mb-2">
                Resumo de mudanças ({deltas.length})
              </p>
              {deltas.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhuma diferença estrutural detectada.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {deltas.map((d, i) => (
                    <Badge key={i} variant="outline" className="text-[11px] gap-1 font-mono">
                      <span className="text-muted-foreground">{d.label}:</span>
                      <span>{String(d.from)}</span>
                      <ArrowRight className="h-2.5 w-2.5 text-muted-foreground" />
                      <span className="text-primary font-semibold">{String(d.to)}</span>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {agentId && (
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  disabled={restoring}
                  onClick={() => handleRestore(verA)}
                >
                  {restoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Restaurar v{verA.version}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  disabled={restoring}
                  onClick={() => handleRestore(verB)}
                >
                  {restoring ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Restaurar v{verB.version}
                </Button>
              </div>
            )}

            <PromptDiff
              textA={versionToText(verA)}
              textB={versionToText(verB)}
              labelA={`v${verA.version}`}
              labelB={`v${verB.version}`}
            />
          </div>
        ) : vA && vB && vA === vB ? (
          <p className="text-xs text-muted-foreground text-center py-8">Selecione versões diferentes para comparar.</p>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-8">Selecione duas versões para visualizar as diferenças.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
