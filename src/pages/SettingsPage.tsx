import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Globe, Bell, Key, Plus, Trash2, Save, Loader2, RotateCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceId } from "@/lib/agentService";
import { environmentSchema } from "@/lib/validations/agentSchema";
import { useTheme } from "next-themes";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [notifications, setNotifications] = useState({ email: true, errors: true, billing: false, weekly: true });

  // API Keys from workspace_secrets (masked via RPC)
  const { data: secrets = [], isLoading: loadingSecrets } = useQuery({
    queryKey: ['workspace_secrets'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      const { data, error } = await supabase.rpc('get_masked_secrets', { p_workspace_id: wsId });
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; key_name: string; masked_value: string; created_at: string | null; updated_at: string | null }>;
    },
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      if (!newKeyName.trim() || !newKeyValue.trim()) throw new Error('Nome e valor são obrigatórios');
      const wsId = await getWorkspaceId();
      const { error } = await supabase.from('workspace_secrets').insert({
        workspace_id: wsId,
        key_name: newKeyName.trim(),
        key_value: newKeyValue.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API Key adicionada!');
      setNewKeyName(''); setNewKeyValue('');
      queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('workspace_secrets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API Key removida');
      queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] });
    },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async ({ id, newValue }: { id: string; newValue: string }) => {
      if (!newValue.trim()) throw new Error('Novo valor é obrigatório');
      const { error } = await supabase.from('workspace_secrets').update({ key_value: newValue.trim() }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('API Key rotacionada com sucesso!');
      setEditingKey(null);
      setEditValue('');
      queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Workspace info
  const { data: workspace } = useQuery({
    queryKey: ['workspace_settings'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      const { data } = await supabase.from('workspaces').select('*').eq('id', wsId).maybeSingle();
      return data;
    },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1000px] mx-auto">
      <PageHeader title="Settings" description="Configure seu workspace e preferências da plataforma" />

      <Tabs defaultValue="general">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="general" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> Geral</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs gap-1.5"><Palette className="h-3.5 w-3.5" /> Aparência</TabsTrigger>
          <TabsTrigger value="apikeys" className="text-xs gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5"><Bell className="h-3.5 w-3.5" /> Notificações</TabsTrigger>
          <TabsTrigger value="environments" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> Ambientes</TabsTrigger>
          <TabsTrigger value="huggingface" className="text-xs gap-1.5"><Sparkles className="h-3.5 w-3.5" /> HuggingFace</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Workspace</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome do workspace</Label>
                <Input defaultValue={workspace?.name || 'Meu Workspace'} className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Plano</Label>
                <Input value={workspace?.plan || 'free'} disabled className="bg-secondary/50 capitalize" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Idioma</Label>
                <Select defaultValue="pt-BR">
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pt-BR">Português (BR)</SelectItem>
                    <SelectItem value="en-US">English (US)</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Timezone</Label>
                <Select defaultValue="America/Sao_Paulo">
                  <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Sao_Paulo">São Paulo (UTC-3)</SelectItem>
                    <SelectItem value="America/New_York">New York (UTC-5)</SelectItem>
                    <SelectItem value="Europe/London">London (UTC+0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button size="sm" className="nexus-gradient-bg text-primary-foreground gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar
            </Button>
          </div>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Tema</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'dark', label: '🌙 Escuro', desc: 'Padrão — melhor para produtividade' },
                { value: 'light', label: '☀️ Claro', desc: 'Para ambientes bem iluminados' },
                { value: 'system', label: '💻 Sistema', desc: 'Segue a preferência do sistema' },
              ].map(t => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`p-4 rounded-lg border text-left transition-all ${theme === t.value ? 'border-primary bg-primary/10' : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'}`}
                >
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* API Keys */}
        <TabsContent value="apikeys" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
            <p className="text-xs text-muted-foreground">Configure chaves de API para conectar modelos de IA e serviços externos.</p>
            
            {/* Add new key */}
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1">
                <Label className="text-[11px]">Nome da chave</Label>
                <Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="openrouter_api_key" className="bg-secondary/50 text-xs font-mono" />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px]">Valor</Label>
                <Input type="password" value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="sk-..." className="bg-secondary/50 text-xs font-mono" />
              </div>
              <Button size="sm" onClick={() => addKeyMutation.mutate()} disabled={addKeyMutation.isPending} className="gap-1 nexus-gradient-bg text-primary-foreground">
                {addKeyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Adicionar
              </Button>
            </div>

            {/* Existing keys */}
            {loadingSecrets ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : secrets.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Nenhuma API key configurada</p>
            ) : (
              <div className="space-y-2">
                {secrets.map(s => (
                     <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                       <div className="flex-1 min-w-0">
                         <p className="text-xs font-mono font-medium text-foreground">{s.key_name}</p>
                         {editingKey === s.id ? (
                           <div className="flex gap-1.5 mt-1.5">
                             <Input
                               type="password"
                               value={editValue}
                               onChange={e => setEditValue(e.target.value)}
                               placeholder="Novo valor..."
                               className="bg-secondary/50 text-xs font-mono h-7"
                             />
                             <Button size="sm" className="h-7 text-xs" onClick={() => rotateKeyMutation.mutate({ id: s.id, newValue: editValue })} disabled={rotateKeyMutation.isPending}>
                               Salvar
                             </Button>
                             <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingKey(null); setEditValue(''); }}>
                               Cancelar
                             </Button>
                           </div>
                         ) : (
                           <p className="text-[11px] text-muted-foreground font-mono truncate">
                             {s.masked_value}
                           </p>
                         )}
                         <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                           Atualizado: {new Date(s.updated_at ?? s.created_at ?? '').toLocaleDateString('pt-BR')}
                         </p>
                       </div>
                       <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotacionar" onClick={() => { setEditingKey(s.id); setEditValue(''); }}>
                         <RotateCw className="h-3.5 w-3.5 text-nexus-amber" />
                       </Button>
                       <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteKeyMutation.mutate(s.id)}>
                         <Trash2 className="h-3.5 w-3.5" />
                       </Button>
                     </div>
                 ))}

              </div>
            )}

            <div className="rounded-lg bg-secondary/20 p-3 border border-border/30">
              <p className="text-[11px] text-muted-foreground">
                💡 <strong>Dica:</strong> Adicione <code className="font-mono">openrouter_api_key</code> para usar múltiplos modelos via OpenRouter, 
                ou chaves específicas: <code className="font-mono">openai_api_key</code>, <code className="font-mono">anthropic_api_key</code>, <code className="font-mono">google_ai_api_key</code>
              </p>
            </div>
          </div>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Preferências de notificação</h3>
            {[
              { key: 'email', label: 'Notificações por email', desc: 'Receba alertas sobre eventos importantes' },
              { key: 'errors', label: 'Alertas de erro', desc: 'Notificação imediata quando um agente falha' },
              { key: 'billing', label: 'Alertas de custo', desc: 'Quando o uso exceder limites configurados' },
              { key: 'weekly', label: 'Relatório semanal', desc: 'Resumo de uso e performance da semana' },
            ].map(n => (
              <div key={n.key} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm text-foreground">{n.label}</p>
                  <p className="text-[11px] text-muted-foreground">{n.desc}</p>
                </div>
                <Switch
                  checked={notifications[n.key as keyof typeof notifications]}
                  onCheckedChange={v => setNotifications(prev => ({ ...prev, [n.key]: v }))}
                />
              </div>
            ))}
            <Button size="sm" onClick={() => toast.success('Preferências salvas!')} className="nexus-gradient-bg text-primary-foreground gap-1.5">
              <Save className="h-3.5 w-3.5" /> Salvar preferências
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="environments" className="space-y-4 mt-4">
          <EnvironmentsManager />
        </TabsContent>

        <TabsContent value="huggingface" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              <h3 className="font-semibold">HuggingFace Integration</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Modelos open-source gratuitos para guardrails, RAG, classificação e inferência.
              Configure o token HF na aba API Keys com o nome <code className="text-xs bg-muted px-1 py-0.5 rounded">huggingface_api_key</code>.
            </p>

            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium">Funcionalidades Ativas</h4>

              <div className="grid gap-3">
                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Injection Detection ML</p>
                    <p className="text-xs text-muted-foreground">ProtectAI deberta-v3 · Detecta prompt injection com 99.9% precisão</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">RAG Reranker</p>
                    <p className="text-xs text-muted-foreground">BAAI/bge-reranker-v2-m3 · Cross-encoder multilingual gratuito</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Auto-Classificação de Traces</p>
                    <p className="text-xs text-muted-foreground">xlm-roberta-large-xnli · 8 categorias zero-shot em PT</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">NER no Super Cérebro</p>
                    <p className="text-xs text-muted-foreground">bert-base-NER · Extração de entidades 10x mais rápida</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Sentiment Analysis (WhatsApp)</p>
                    <p className="text-xs text-muted-foreground">twitter-roberta-base-sentiment · Análise de sentimento no DataHub</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">LLM Provider (Inference API)</p>
                    <p className="text-xs text-muted-foreground">Qwen3, Mistral Small, Llama 4 Scout · Modelos gratuitos no Agent Builder</p>
                  </div>
                  <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded">Ativo</span>
                </div>

                <div className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                  <div>
                    <p className="text-sm font-medium">Fine-tuning (AutoTrain)</p>
                    <p className="text-xs text-muted-foreground">Treine modelos custom com dados dos seus agentes</p>
                  </div>
                  <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded">Disponível</span>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t space-y-2">
              <h4 className="text-sm font-medium">Self-Hosted (TEI)</h4>
              <p className="text-xs text-muted-foreground">
                Para alto volume, deploy TEI localmente com GPU. Configure os endpoints nas env vars
                <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_ENDPOINT</code> e
                <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_RERANK_ENDPOINT</code>.
              </p>
              <div className="bg-muted/30 p-3 rounded text-xs font-mono text-muted-foreground whitespace-pre-wrap">
{`# Embeddings (BGE-M3)
docker run --gpus all -p 8080:80 -v tei-data:/data \\
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \\
  --model-id BAAI/bge-m3

# Reranker (BGE-reranker-v2-m3)
docker run --gpus all -p 8081:80 -v tei-data:/data \\
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \\
  --model-id BAAI/bge-reranker-v2-m3`}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function EnvironmentsManager() {
  const queryClient = useQueryClient();
  const [newEnvName, setNewEnvName] = useState('');
  const [creating, setCreating] = useState(false);

  const { data: environments = [], isLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: async () => {
      const wsId = await getWorkspaceId();
      const { data } = await supabase.from('environments').select('*').eq('workspace_id', wsId).order('created_at');
      return data ?? [];
    },
  });

  const handleCreate = async () => {
    const result = environmentSchema.safeParse({ name: newEnvName });
    if (!result.success) { toast.error(result.error.errors[0]?.message || 'Nome inválido'); return; }
    setCreating(true);
    const wsId = await getWorkspaceId();
    await supabase.from('environments').insert({ workspace_id: wsId, name: newEnvName.trim() });
    setNewEnvName('');
    setCreating(false);
    queryClient.invalidateQueries({ queryKey: ['environments'] });
    toast.success('Ambiente criado');
  };

  const handleDelete = async (id: string) => {
    await supabase.from('environments').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['environments'] });
    toast.success('Ambiente removido');
  };

  return (
    <div className="nexus-card space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Ambientes de Deploy</h3>
      <p className="text-xs text-muted-foreground">Gerencie ambientes (development, staging, production) para isolamento de configurações.</p>
      <div className="flex gap-2">
        <Input value={newEnvName} onChange={e => setNewEnvName(e.target.value)} placeholder="Ex: staging" className="bg-secondary/50 text-xs" />
        <Button size="sm" onClick={handleCreate} disabled={creating}>Criar</Button>
      </div>
      {isLoading ? <p className="text-xs text-muted-foreground">Carregando...</p> : (
        <div className="space-y-2">
          {environments.map((env) => (
            <div key={env.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30">
              <div>
                <p className="text-sm font-medium text-foreground">{env.name}</p>
                <p className="text-[11px] text-muted-foreground">{new Date(String(env.created_at)).toLocaleDateString('pt-BR')}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(String(env.id))}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {environments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum ambiente criado. Padrão: development.</p>}
        </div>
      )}
    </div>
  );
}
