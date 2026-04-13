import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Palette, Globe, Bell, Key, Plus, Trash2, Save, Loader2, RotateCw, Sparkles, Server, Building2 } from "lucide-react";
import { MCPServerManager } from "@/components/integrations/MCPServerManager";
import { Bitrix24Connect } from "@/components/integrations/Bitrix24Connect";
import { AccessControl, DangerousActionDialog } from "@/components/rbac";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listMaskedSecrets, createWorkspaceSecret, deleteWorkspaceSecret, rotateWorkspaceSecret,
  getWorkspace,
} from "@/services/settingsService";
import { getWorkspaceId } from "@/lib/agentService";
import { useTheme } from "next-themes";
import { EnvironmentsManager } from "@/components/settings/EnvironmentsManager";

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [notifications, setNotifications] = useState({ email: true, errors: true, billing: false, weekly: true });

  const { data: secrets = [], isLoading: loadingSecrets } = useQuery({
    queryKey: ['workspace_secrets'],
    queryFn: async () => { const wsId = await getWorkspaceId(); return listMaskedSecrets(wsId); },
  });

  const addKeyMutation = useMutation({
    mutationFn: async () => {
      if (!newKeyName.trim() || !newKeyValue.trim()) throw new Error('Nome e valor são obrigatórios');
      const wsId = await getWorkspaceId();
      await createWorkspaceSecret({ workspaceId: wsId, keyName: newKeyName.trim(), keyValue: newKeyValue.trim() });
    },
    onSuccess: () => { toast.success('API Key adicionada!'); setNewKeyName(''); setNewKeyValue(''); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
    onError: (e: Error) => toast.error(e.message || 'Erro inesperado'),
  });

  const deleteKeyMutation = useMutation({
    mutationFn: deleteWorkspaceSecret,
    onSuccess: () => { toast.success('API Key removida'); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
  });

  const rotateKeyMutation = useMutation({
    mutationFn: async ({ id, newValue }: { id: string; newValue: string }) => { await rotateWorkspaceSecret(id, newValue); },
    onSuccess: () => { toast.success('API Key rotacionada com sucesso!'); setEditingKey(null); setEditValue(''); queryClient.invalidateQueries({ queryKey: ['workspace_secrets'] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: workspace } = useQuery({
    queryKey: ['workspace_settings'],
    queryFn: async () => { const wsId = await getWorkspaceId(); return getWorkspace(wsId); },
  });

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1000px] mx-auto">
      <PageHeader title="Configurações" description="Configure seu workspace e preferências da plataforma" />

      <Tabs defaultValue="general">
        <TabsList className="bg-secondary/50 border border-border/50">
          <TabsTrigger value="general" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> Geral</TabsTrigger>
          <TabsTrigger value="appearance" className="text-xs gap-1.5"><Palette className="h-3.5 w-3.5" /> Aparência</TabsTrigger>
          <TabsTrigger value="apikeys" className="text-xs gap-1.5"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="notifications" className="text-xs gap-1.5"><Bell className="h-3.5 w-3.5" /> Notificações</TabsTrigger>
          <TabsTrigger value="environments" className="text-xs gap-1.5"><Globe className="h-3.5 w-3.5" /> Ambientes</TabsTrigger>
          <TabsTrigger value="huggingface" className="text-xs gap-1.5"><Sparkles className="h-3.5 w-3.5" /> HuggingFace</TabsTrigger>
          <TabsTrigger value="mcp" className="text-xs gap-1.5"><Server className="h-3.5 w-3.5" /> MCP Servers</TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1.5"><Building2 className="h-3.5 w-3.5" /> Integrações</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Workspace</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Nome do workspace</Label><Input defaultValue={workspace?.name || 'Meu Workspace'} className="bg-secondary/50" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Plano</Label><Input value={String(workspace?.plan || 'free')} disabled className="bg-secondary/50 capitalize" /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5"><Label className="text-xs">Idioma</Label><Select defaultValue="pt-BR"><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="pt-BR">Português (BR)</SelectItem><SelectItem value="en-US">English (US)</SelectItem><SelectItem value="es">Español</SelectItem></SelectContent></Select></div>
              <div className="space-y-1.5"><Label className="text-xs">Timezone</Label><Select defaultValue="America/Sao_Paulo"><SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="America/Sao_Paulo">São Paulo (UTC-3)</SelectItem><SelectItem value="America/New_York">New York (UTC-5)</SelectItem><SelectItem value="Europe/London">London (UTC+0)</SelectItem></SelectContent></Select></div>
            </div>
            <Button size="sm" className="nexus-gradient-bg text-primary-foreground gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar</Button>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Tema</h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: 'dark', label: '🌙 Escuro', desc: 'Padrão — melhor para produtividade' },
                { value: 'light', label: '☀️ Claro', desc: 'Para ambientes bem iluminados' },
                { value: 'system', label: '💻 Sistema', desc: 'Segue a preferência do sistema' },
              ].map(t => (
                <button key={t.value} onClick={() => setTheme(t.value)} className={`p-4 rounded-lg border text-left transition-all ${theme === t.value ? 'border-primary bg-primary/10' : 'border-border/50 bg-secondary/30 hover:bg-secondary/50'}`}>
                  <p className="text-sm font-medium text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="apikeys" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">API Keys</h3>
            <p className="text-xs text-muted-foreground">Configure chaves de API para conectar modelos de IA e serviços externos.</p>
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <div className="space-y-1"><Label className="text-[11px]">Nome da chave</Label><Input value={newKeyName} onChange={e => setNewKeyName(e.target.value)} placeholder="openrouter_api_key" className="bg-secondary/50 text-xs font-mono" /></div>
              <div className="space-y-1"><Label className="text-[11px]">Valor</Label><Input type="password" value={newKeyValue} onChange={e => setNewKeyValue(e.target.value)} placeholder="sk-..." className="bg-secondary/50 text-xs font-mono" /></div>
              <Button size="sm" onClick={() => addKeyMutation.mutate()} disabled={addKeyMutation.isPending} className="gap-1 nexus-gradient-bg text-primary-foreground">
                {addKeyMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Adicionar
              </Button>
            </div>
            {loadingSecrets ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> :
             secrets.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">Nenhuma API key configurada</p> : (
              <div className="space-y-2">
                {secrets.map(s => (
                  <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border/30">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono font-medium text-foreground">{s.key_name}</p>
                      {editingKey === s.id ? (
                        <div className="flex gap-1.5 mt-1.5">
                          <Input type="password" value={editValue} onChange={e => setEditValue(e.target.value)} placeholder="Novo valor..." className="bg-secondary/50 text-xs font-mono h-7" />
                          <Button size="sm" className="h-7 text-xs" onClick={() => rotateKeyMutation.mutate({ id: s.id, newValue: editValue })} disabled={rotateKeyMutation.isPending}>Salvar</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingKey(null); setEditValue(''); }}>Cancelar</Button>
                        </div>
                      ) : <p className="text-[11px] text-muted-foreground font-mono truncate">{s.masked_value}</p>}
                      <p className="text-[10px] text-muted-foreground/50 mt-0.5">Atualizado: {new Date(s.updated_at ?? s.created_at ?? '').toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Rotacionar" onClick={() => { setEditingKey(s.id); setEditValue(''); }}><RotateCw className="h-3.5 w-3.5 text-nexus-amber" /></Button>
                    <AccessControl permission="settings.api_keys">
                      <DangerousActionDialog
                        trigger={<Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>}
                        title="Revogar API key" description="A chave será permanentemente removida. Aplicações que dependem dela serão desautorizadas imediatamente."
                        action="revoke" resourceType="workspace_secret" resourceId={s.id} resourceName={s.key_name} minReasonLength={10} confirmLabel="Revogar"
                        onConfirm={async () => { await deleteKeyMutation.mutateAsync(s.id); }}
                      />
                    </AccessControl>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-lg bg-secondary/20 p-3 border border-border/30">
              <p className="text-[11px] text-muted-foreground">💡 <strong>Dica:</strong> Adicione <code className="font-mono">openrouter_api_key</code> para usar múltiplos modelos via OpenRouter, ou chaves específicas: <code className="font-mono">openai_api_key</code>, <code className="font-mono">anthropic_api_key</code>, <code className="font-mono">google_ai_api_key</code></p>
            </div>
          </div>
        </TabsContent>

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
                <div><p className="text-sm text-foreground">{n.label}</p><p className="text-[11px] text-muted-foreground">{n.desc}</p></div>
                <Switch checked={notifications[n.key as keyof typeof notifications]} onCheckedChange={v => setNotifications(prev => ({ ...prev, [n.key]: v }))} />
              </div>
            ))}
            <Button size="sm" onClick={() => toast.success('Preferências salvas!')} className="nexus-gradient-bg text-primary-foreground gap-1.5"><Save className="h-3.5 w-3.5" /> Salvar preferências</Button>
          </div>
        </TabsContent>

        <TabsContent value="environments" className="space-y-4 mt-4"><EnvironmentsManager /></TabsContent>

        <TabsContent value="huggingface" className="space-y-4 mt-4">
          <div className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-nexus-amber" /><h3 className="font-semibold">HuggingFace Integration</h3></div>
            <p className="text-sm text-muted-foreground">Modelos open-source gratuitos para guardrails, RAG, classificação e inferência. Configure o token HF na aba API Keys com o nome <code className="text-xs bg-muted px-1 py-0.5 rounded">huggingface_api_key</code>.</p>
            <div className="space-y-3 pt-2">
              <h4 className="text-sm font-medium">Funcionalidades Ativas</h4>
              <div className="grid gap-3">
                {[
                  { name: 'Injection Detection ML', desc: 'ProtectAI deberta-v3 · Detecta prompt injection com 99.9% precisão', status: 'Ativo' },
                  { name: 'RAG Reranker', desc: 'BAAI/bge-reranker-v2-m3 · Cross-encoder multilingual gratuito', status: 'Ativo' },
                  { name: 'Auto-Classificação de Traces', desc: 'xlm-roberta-large-xnli · 8 categorias zero-shot em PT', status: 'Ativo' },
                  { name: 'NER no Super Cérebro', desc: 'bert-base-NER · Extração de entidades 10x mais rápida', status: 'Ativo' },
                  { name: 'Sentiment Analysis (WhatsApp)', desc: 'twitter-roberta-base-sentiment · Análise de sentimento no DataHub', status: 'Ativo' },
                  { name: 'LLM Provider (Inference API)', desc: 'Qwen3, Mistral Small, Llama 4 Scout · Modelos gratuitos no Agent Builder', status: 'Ativo' },
                  { name: 'Fine-tuning (AutoTrain)', desc: 'Treine modelos custom com dados dos seus agentes', status: 'Disponível' },
                ].map(f => (
                  <div key={f.name} className="flex items-center justify-between p-3 rounded-md bg-muted/50">
                    <div><p className="text-sm font-medium">{f.name}</p><p className="text-xs text-muted-foreground">{f.desc}</p></div>
                    <span className={`text-xs px-2 py-0.5 rounded ${f.status === 'Ativo' ? 'bg-nexus-emerald/12 text-nexus-emerald' : 'bg-primary/12 text-primary'}`}>{f.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="pt-3 border-t space-y-2">
              <h4 className="text-sm font-medium">Self-Hosted (TEI)</h4>
              <p className="text-xs text-muted-foreground">Para alto volume, deploy TEI localmente com GPU. Configure os endpoints nas env vars <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_ENDPOINT</code> e <code className="bg-muted px-1 py-0.5 rounded ml-1">HF_TEI_RERANK_ENDPOINT</code>.</p>
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

        <TabsContent value="mcp" className="mt-4"><MCPServerManager /></TabsContent>

        <TabsContent value="integrations" className="mt-4 space-y-4">
          <div className="nexus-card space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Bitrix24 CRM</h3>
            <p className="text-xs text-muted-foreground">Conecte sua conta Bitrix24 para sincronizar contatos, deals e atividades com seus agentes.</p>
            <Bitrix24Connect />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
