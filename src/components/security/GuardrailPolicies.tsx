import { Shield, ShieldAlert, ShieldCheck, Loader2, Plus, Trash2, FlaskConical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkspaceId } from "@/lib/agentService";
import { toast } from "sonner";
import { listGuardrailPolicies, createGuardrailPolicy, toggleGuardrailPolicy, deleteGuardrailPolicy, testGuardrails } from "@/services/securityService";

const typeLabels: Record<string, string> = {
  content_filter: 'Filtro de conteúdo',
  pii_detection: 'Detecção de PII',
  prompt_injection: 'Anti-injection',
  toxicity: 'Toxicidade',
  custom: 'Custom',
};

export function GuardrailPolicies() {
  const queryClient = useQueryClient();
  const [newOpen, setNewOpen] = useState(false);
  const [grName, setGrName] = useState('');
  const [grType, setGrType] = useState('content_filter');
  const [saving, setSaving] = useState(false);

  const { data: guardrails = [], isLoading } = useQuery({
    queryKey: ['guardrail_policies'],
    queryFn: listGuardrailPolicies,
  });

  const handleCreate = async () => {
    if (!grName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      await createGuardrailPolicy(grName.trim(), grType, wsId);
      toast.success('Guardrail criado!');
      setNewOpen(false);
      setGrName('');
      queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    try { await toggleGuardrailPolicy(id, enabled); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); }
    queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
  };

  const handleDelete = async (id: string) => {
    try { await deleteGuardrailPolicy(id); toast.success('Guardrail removido'); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro'); }
    queryClient.invalidateQueries({ queryKey: ['guardrail_policies'] });
  };

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-primary" /> Guardrail Policies <Badge variant="outline" className="text-[11px] ml-1">{guardrails.length}</Badge>
        </h3>
        <Dialog open={newOpen} onOpenChange={setNewOpen}>
          <DialogTrigger asChild>
            <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" size="sm">
              <Plus className="h-4 w-4" /> Novo guardrail
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader><DialogTitle>Novo Guardrail</DialogTitle></DialogHeader>
            <div className="space-y-3 mt-2">
              <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={grName} onChange={e => setGrName(e.target.value)} className="bg-secondary/50" placeholder="Ex: Filtro LGPD" /></div>
              <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={grType} onValueChange={setGrType}>
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="content_filter">Filtro de conteúdo</SelectItem>
                    <SelectItem value="pii_detection">Detecção de PII</SelectItem>
                    <SelectItem value="prompt_injection">Anti-injection</SelectItem>
                    <SelectItem value="toxicity">Toxicidade</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleCreate} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : guardrails.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Shield className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-xs text-muted-foreground">Nenhum guardrail configurado.</p>
          <p className="text-[11px] text-muted-foreground mt-1">Crie guardrails para proteger seus agentes.</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {guardrails.map((g: any) => (
            <div key={g.id}
              className="p-3 rounded-lg bg-secondary/20 border border-border/30 flex items-center gap-3 group"
            >
              <ShieldCheck className={`h-5 w-5 shrink-0 ${g.is_enabled ? 'text-nexus-emerald' : 'text-muted-foreground'}`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{g.name}</p>
                <p className="text-[11px] text-muted-foreground">{typeLabels[g.type] || g.type}</p>
              </div>
              <Switch checked={g.is_enabled ?? true} onCheckedChange={(v) => handleToggle(g.id, v)} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 shrink-0">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader><AlertDialogTitle>Remover guardrail?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                  <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(g.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction></AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ))}
        </div>
      )}

      {/* Guardrail Test Panel */}
      <GuardrailTester />
    </div>
  );
}

// ═══ Guardrail Tester — calls guardrails-engine edge function ═══
function GuardrailTester() {
  const [testInput, setTestInput] = useState('');
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  const handleTest = async () => {
    if (!testInput.trim()) { toast.error('Digite um texto para testar'); return; }
    setTesting(true);
    setResult(null);
    try {
      const data = await testGuardrails(testInput.trim());
      setResult(data as Record<string, unknown>);
      toast.success('Verificação concluída!');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao testar guardrails');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-border/30">
      <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-3">
        <FlaskConical className="h-3.5 w-3.5 text-primary" /> Testar Guardrails Engine
      </h4>
      <div className="space-y-2">
        <Textarea
          value={testInput}
          onChange={e => setTestInput(e.target.value)}
          placeholder="Digite um texto para verificar (PII, injection, toxicidade)..."
          rows={2}
          className="bg-secondary/50 text-xs"
        />
        <Button size="sm" onClick={handleTest} disabled={testing} className="gap-1.5">
          {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
          Testar
        </Button>
      </div>
      {result && (
        <div className="mt-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant={result.passed ? 'default' : 'destructive'} className="text-[11px]">
              {result.passed ? '✅ Aprovado' : '❌ Bloqueado'}
            </Badge>
            {result.score != null && (
              <span className="text-[11px] text-muted-foreground">Score: {String(result.score)}</span>
            )}
          </div>
          <pre className="text-[11px] text-muted-foreground overflow-auto max-h-[150px]">
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
