import { PageHeader } from "@/components/shared/PageHeader";
import { InfoHint } from "@/components/shared/InfoHint";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Loader2, Wrench, Globe, Database, Mail, FileSearch, Code, Webhook, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceId } from "@/lib/agentService";

import { toast } from "sonner";

const builtInTools = [
  { name: 'Web Search', category: 'Pesquisa', icon: Globe, desc: 'Busca na web em tempo real' },
  { name: 'Knowledge Search', category: 'RAG', icon: FileSearch, desc: 'Busca semântica nas bases de conhecimento' },
  { name: 'SQL Query', category: 'Database', icon: Database, desc: 'Consultas SQL no banco de dados' },
  { name: 'Email Send', category: 'Comunicação', icon: Mail, desc: 'Envio de emails transacionais' },
  { name: 'Code Executor', category: 'Código', icon: Code, desc: 'Execução de código Python/JS' },
  { name: 'Webhook', category: 'Integração', icon: Webhook, desc: 'Chamadas HTTP para APIs externas' },
];

const iconMap: Record<string, React.ElementType> = {
  api: Globe, webhook: Webhook, database: Database, custom: Wrench,
};

export default function ToolsPage() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const [newToolOpen, setNewToolOpen] = useState(false);
  const [toolName, setToolName] = useState('');
  const [toolDesc, setToolDesc] = useState('');
  const [toolType, setToolType] = useState('api');
  const [saving, setSaving] = useState(false);

  // Tool integrations from DB
  const { data: toolIntegrations = [], isLoading } = useQuery({
    queryKey: ['tool_integrations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tool_integrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleCreateTool = async () => {
    if (!toolName.trim()) { toast.error('Nome é obrigatório'); return; }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      const { error } = await supabase.from('tool_integrations').insert({
        name: toolName.trim(),
        description: toolDesc.trim(),
        type: toolType,
        workspace_id: wsId,
      });
      if (error) throw error;
      toast.success('Integração criada!');
      setNewToolOpen(false);
      setToolName(''); setToolDesc('');
      queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTool = async (id: string, enabled: boolean) => {
    const { error } = await supabase.from('tool_integrations').update({ is_enabled: enabled }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
  };

  const handleDeleteTool = async (id: string) => {
    const { error } = await supabase.from('tool_integrations').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Integração removida');
    queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
  };

  const allItems = [
    ...builtInTools.map(t => ({ ...t, built_in: true, id: t.name, is_enabled: true })),
    ...toolIntegrations.map(t => ({
      name: t.name,
      category: t.type,
      icon: iconMap[t.type] || Wrench,
      desc: t.description || '',
      built_in: false,
      id: t.id,
      is_enabled: t.is_enabled ?? true,
    })),
  ];

  const filtered = allItems.filter(t =>
    t.name.toLowerCase().includes(search.toLowerCase()) ||
    t.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Tools & Integrations"
        description="Ferramentas disponíveis e integrações configuradas"
        actions={
          <Dialog open={newToolOpen} onOpenChange={setNewToolOpen}>
            <DialogTrigger asChild>
              <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                <Plus className="h-4 w-4" /> Nova integração
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[420px]">
              <DialogHeader><DialogTitle>Nova Integração</DialogTitle></DialogHeader>
              <div className="space-y-3 mt-2">
                <div className="space-y-1"><Label className="text-xs">Nome *</Label><Input value={toolName} onChange={e => setToolName(e.target.value)} className="bg-secondary/50" placeholder="Ex: Slack Notifier" /></div>
                <div className="space-y-1"><Label className="text-xs">Descrição</Label><Input value={toolDesc} onChange={e => setToolDesc(e.target.value)} className="bg-secondary/50" /></div>
                <div className="space-y-1">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={toolType} onValueChange={setToolType}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="webhook">Webhook</SelectItem>
                      <SelectItem value="database">Database</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreateTool} disabled={saving} className="w-full nexus-gradient-bg text-primary-foreground">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <InfoHint title="O que são tools?">
        Tools são capacidades que os agentes podem usar: buscar na web, consultar bancos, enviar emails, chamar APIs. Cada tool é uma função que o agente pode invocar durante uma conversação para obter dados ou executar ações.
      </InfoHint>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar ferramentas..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-secondary/50 border-border/50" />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool) => (
            <div key={tool.id} className="nexus-card group">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-foreground truncate">{tool.name}</h3>
                    {tool.built_in && <Badge variant="outline" className="text-[8px] shrink-0">Built-in</Badge>}
                  </div>
                  <p className="text-[11px] text-muted-foreground">{tool.category}</p>
                </div>
                {!tool.built_in && (
                  <Switch
                    checked={tool.is_enabled}
                    onCheckedChange={(v) => handleToggleTool(tool.id, v)}
                    className="shrink-0"
                  />
                )}
              </div>
              <p className="text-xs text-muted-foreground">{tool.desc}</p>
              {!tool.built_in && (
                <div className="mt-3 pt-2 border-t border-border/30">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="gap-1 text-xs text-destructive h-7 opacity-0 group-hover:opacity-100">
                        <Trash2 className="h-3 w-3" /> Remover
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Remover integração?</AlertDialogTitle><AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteTool(tool.id)} className="bg-destructive text-destructive-foreground">Remover</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// P3-14: Tool Policies — managed via agent builder ToolsModule
// tool_policies table is written when agent config is saved with per-tool permissions
