import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { PromptDiff } from "@/components/prompts/PromptDiff";
import { GitCompare } from "lucide-react";

interface Version {
  id: string;
  version: number;
  model: string | null;
  persona: string | null;
  mission: string | null;
  config: any;
  change_summary: string | null;
  created_at: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  versions: Version[];
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
  } catch {
    lines.push(String(v.config));
  }
  return lines.join('\n');
}

export function VersionDiffDialog({ open, onOpenChange, versions }: Props) {
  const [vA, setVA] = useState<string>('');
  const [vB, setVB] = useState<string>('');

  const verA = versions.find(v => v.id === vA);
  const verB = versions.find(v => v.id === vB);

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
            <div className="flex items-center gap-2 flex-wrap">
              {verA.model !== verB.model && (
                <Badge variant="outline" className="text-[11px]">Modelo: {verA.model} → {verB.model}</Badge>
              )}
              {verA.persona !== verB.persona && (
                <Badge variant="outline" className="text-[11px]">Persona alterada</Badge>
              )}
              {verA.mission !== verB.mission && (
                <Badge variant="outline" className="text-[11px]">Missão alterada</Badge>
              )}
            </div>
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
