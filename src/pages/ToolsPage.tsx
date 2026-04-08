import { PageHeader } from '@/components/shared/PageHeader';
import { InfoHint } from '@/components/shared/InfoHint';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Loader2,
  Wrench,
  Globe,
  Database,
  Mail,
  FileSearch,
  Code,
  Webhook,
  Plus,
  Trash2,
} from 'lucide-react';
import { AccessControl, DangerousActionDialog } from '@/components/rbac';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listToolIntegrations,
  createToolIntegration,
  toggleToolIntegration,
  deleteToolIntegration,
} from '@/services/toolsService';
import { getWorkspaceId } from '@/lib/agentService';

import { toast } from 'sonner';
import { MCPServerManager } from '@/components/integrations/MCPServerManager';
import { Bitrix24Connect } from '@/components/integrations/Bitrix24Connect';
import { Bitrix24ApiTester } from '@/components/integrations/Bitrix24ApiTester';
import { Bitrix24WebhookPanel } from '@/components/integrations/Bitrix24WebhookPanel';
import { WhatsAppWebhookPanel } from '@/components/integrations/WhatsAppWebhookPanel';
import { ProductMockupPanel } from '@/components/tools/ProductMockupPanel';
import { ImageAnalysisDialog } from '@/components/tools/ImageAnalysisDialog';
import { SKILL_CATEGORIES } from '@/services/skillsRegistryService';

const builtInTools = [
  {
    name: 'Web Search',
    category: 'Pesquisa',
    icon: Globe,
    desc: 'Busca na web em tempo real',
    color: 'text-nexus-blue',
    bg: 'bg-nexus-blue/10',
  },
  {
    name: 'Knowledge Search',
    category: 'RAG',
    icon: FileSearch,
    desc: 'Busca semântica nas bases de conhecimento',
    color: 'text-nexus-purple',
    bg: 'bg-nexus-purple/10',
  },
  {
    name: 'SQL Query',
    category: 'Database',
    icon: Database,
    desc: 'Consultas SQL no banco de dados',
    color: 'text-nexus-emerald',
    bg: 'bg-nexus-emerald/10',
  },
  {
    name: 'Email Send',
    category: 'Comunicação',
    icon: Mail,
    desc: 'Envio de emails transacionais',
    color: 'text-nexus-amber',
    bg: 'bg-nexus-amber/10',
  },
  {
    name: 'Code Executor',
    category: 'Código',
    icon: Code,
    desc: 'Execução de código Python/JS',
    color: 'text-nexus-cyan',
    bg: 'bg-nexus-cyan/10',
  },
  {
    name: 'Webhook',
    category: 'Integração',
    icon: Webhook,
    desc: 'Chamadas HTTP para APIs externas',
    color: 'text-nexus-orange',
    bg: 'bg-nexus-orange/10',
  },
];

const iconMap: Record<string, React.ElementType> = {
  api: Globe,
  webhook: Webhook,
  database: Database,
  custom: Wrench,
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
    queryFn: listToolIntegrations,
  });

  const handleCreateTool = async () => {
    if (!toolName.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    setSaving(true);
    try {
      const wsId = await getWorkspaceId();
      await createToolIntegration({
        workspaceId: wsId,
        name: toolName,
        description: toolDesc,
        type: toolType,
      });
      toast.success('Integração criada!');
      setNewToolOpen(false);
      setToolName('');
      setToolDesc('');
      queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro inesperado');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleTool = async (id: string, enabled: boolean) => {
    try {
      await toggleToolIntegration(id, enabled);
      queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar');
    }
  };

  const handleDeleteTool = async (id: string) => {
    try {
      await deleteToolIntegration(id);
      toast.success('Integração removida');
      queryClient.invalidateQueries({ queryKey: ['tool_integrations'] });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao remover');
    }
  };

  const allItems = [
    ...builtInTools.map((t) => ({ ...t, built_in: true, id: t.name, is_enabled: true })),
    ...toolIntegrations.map((t) => ({
      name: t.name,
      category: t.type,
      icon: iconMap[t.type] || Wrench,
      desc: t.description || '',
      built_in: false,
      id: t.id,
      is_enabled: t.is_enabled ?? true,
      color: 'text-primary',
      bg: 'bg-primary/10',
    })),
  ];

  const filtered = allItems.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title="Ferramentas & Integrações"
        description="Ferramentas disponíveis e integrações configuradas"
        actions={
          <div className="flex items-center gap-2">
            <AccessControl permission="tools.read">
              <ImageAnalysisDialog />
            </AccessControl>
            <Dialog open={newToolOpen} onOpenChange={setNewToolOpen}>
              <DialogTrigger asChild>
                <Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
                  <Plus className="h-4 w-4" /> Nova integração
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                  <DialogTitle>Nova Integração</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 mt-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Nome *</Label>
                    <Input
                      value={toolName}
                      onChange={(e) => setToolName(e.target.value)}
                      className="bg-secondary/50"
                      placeholder="Ex: Slack Notifier"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Descrição</Label>
                    <Input
                      value={toolDesc}
                      onChange={(e) => setToolDesc(e.target.value)}
                      className="bg-secondary/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo</Label>
                    <Select value={toolType} onValueChange={setToolType}>
                      <SelectTrigger className="bg-secondary/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="api">API</SelectItem>
                        <SelectItem value="webhook">Webhook</SelectItem>
                        <SelectItem value="database">Database</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleCreateTool}
                    disabled={saving}
                    className="w-full nexus-gradient-bg text-primary-foreground"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Criar
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        }
      />

      <InfoHint title="O que são tools?">
        Tools são capacidades que os agentes podem usar: buscar na web, consultar bancos, enviar
        emails, chamar APIs. Cada tool é uma função que o agente pode invocar durante uma
        conversação para obter dados ou executar ações.
      </InfoHint>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar ferramentas..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-secondary/50 border-border/50"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((tool) => (
            <div key={tool.id} className="nexus-card group">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`h-10 w-10 rounded-xl ${tool.bg} flex items-center justify-center`}>
                  <tool.icon className={`h-5 w-5 ${tool.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-sm font-semibold text-foreground truncate">{tool.name}</h3>
                    {tool.built_in && (
                      <Badge variant="outline" className="text-[8px] shrink-0">
                        Built-in
                      </Badge>
                    )}
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
                  <AccessControl permission="agents.delete">
                    <DangerousActionDialog
                      trigger={
                        <Button
                          variant="ghost"
                          size="sm"
                          className="gap-1 text-xs text-destructive h-7 opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="h-3 w-3" /> Remover
                        </Button>
                      }
                      title="Remover integração de ferramenta"
                      description="A integração será desconectada e todos os agentes que dependem dela perderão acesso. Essa ação não pode ser desfeita."
                      action="delete"
                      resourceType="tool_integration"
                      resourceId={tool.id}
                      resourceName={tool.name}
                      minReasonLength={8}
                      confirmLabel="Remover Integração"
                      onConfirm={async () => {
                        await handleDeleteTool(tool.id);
                      }}
                    />
                  </AccessControl>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Integrações */}
      <div className="nexus-card p-6 space-y-4">
        <h3 className="text-sm font-bold text-white">Integrações Externas</h3>
        <AccessControl permission="integrations.write">
          <Bitrix24Connect />
        </AccessControl>
        <AccessControl permission="integrations.read">
          <Bitrix24ApiTester />
        </AccessControl>
        <Bitrix24WebhookPanel />
        <WhatsAppWebhookPanel />
      </div>

      {/* MCP Servers */}
      <div className="nexus-card p-6">
        <MCPServerManager />
      </div>

      {/* Promo Brindes — Estúdio de Imagens (product-mockup EF) */}
      <AccessControl permission="tools.write">
        <ProductMockupPanel />
      </AccessControl>

      {/* Skills Marketplace Preview */}
      <div className="nexus-card p-6 space-y-3">
        <h3 className="text-sm font-bold text-white">Skills Marketplace</h3>
        <p className="text-xs text-muted-foreground">
          Instale habilidades pré-construídas nos seus agentes
        </p>
        <div className="grid grid-cols-5 gap-2">
          {SKILL_CATEGORIES.map((cat) => (
            <div
              key={cat.id}
              className="bg-background rounded-lg p-3 text-center cursor-pointer hover:border-primary border border-border transition-colors"
            >
              <div className="text-2xl mb-1">{cat.icon}</div>
              <div className="text-[10px] font-medium text-white">{cat.name}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// P3-14: Tool Policies — managed via agent builder ToolsModule
// tool_policies table is written when agent config is saved with per-tool permissions
