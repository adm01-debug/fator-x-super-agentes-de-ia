import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { SectionTitle, NexusBadge, ToggleField, SliderField, SelectField, InputField } from '../ui';
import { CollapsibleCard } from '../ui/CollapsibleCard';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import type { AgentTool, MCPServer, CustomAPI } from '@/types/agentTypes';

const TOOL_CATEGORIES = [
  { id: 'data', label: '📊 Dados', description: 'Consultas, leitura de bancos e APIs de dados.' },
  { id: 'action', label: '⚡ Ações', description: 'Enviar email, criar ticket, postar mensagem.' },
  { id: 'compute', label: '🖥️ Compute', description: 'Executar código, cálculos, transformações.' },
  { id: 'integration', label: '🔌 Integrações', description: 'Conectores com serviços externos.' },
];

const DEFAULT_TOOL: Omit<AgentTool, 'id'> = {
  name: '',
  description: '',
  category: 'data',
  enabled: true,
  permission_level: 'read_only',
  requires_approval: false,
  max_calls_per_session: 50,
  max_calls_per_day: 500,
  allowed_conditions: '',
  output_validation: 'none',
  cost_per_call: 0,
  audit_log: true,
};

const DEFAULT_MCP: Omit<MCPServer, 'id'> = {
  name: '',
  url: '',
  enabled: true,
};

const DEFAULT_API: Omit<CustomAPI, 'id'> = {
  name: '',
  method: 'GET',
  url: '',
  auth_type: 'none',
  description: '',
};

export function ToolsModule() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const updateAgent = useAgentBuilderStore((s) => s.updateAgent);

  const addTool = () => {
    updateAgent({ tools: [...agent.tools, { ...DEFAULT_TOOL, id: crypto.randomUUID() }] });
  };
  const removeTool = (id: string) => {
    updateAgent({ tools: agent.tools.filter((t) => t.id !== id) });
  };
  const updateTool = (id: string, partial: Partial<AgentTool>) => {
    updateAgent({ tools: agent.tools.map((t) => (t.id === id ? { ...t, ...partial } : t)) });
  };

  const addMCP = () => {
    updateAgent({ mcp_servers: [...agent.mcp_servers, { ...DEFAULT_MCP, id: crypto.randomUUID() }] });
  };
  const removeMCP = (id: string) => {
    updateAgent({ mcp_servers: agent.mcp_servers.filter((s) => s.id !== id) });
  };
  const updateMCP = (id: string, partial: Partial<MCPServer>) => {
    updateAgent({ mcp_servers: agent.mcp_servers.map((s) => (s.id === id ? { ...s, ...partial } : s)) });
  };

  const addAPI = () => {
    updateAgent({ custom_apis: [...agent.custom_apis, { ...DEFAULT_API, id: crypto.randomUUID() }] });
  };
  const removeAPI = (id: string) => {
    updateAgent({ custom_apis: agent.custom_apis.filter((a) => a.id !== id) });
  };
  const updateAPI = (id: string, partial: Partial<CustomAPI>) => {
    updateAgent({ custom_apis: agent.custom_apis.map((a) => (a.id === id ? { ...a, ...partial } : a)) });
  };

  const enabledTools = agent.tools.filter((t) => t.enabled).length;

  const toolsByCategory = TOOL_CATEGORIES.map((cat) => ({
    ...cat,
    tools: agent.tools.filter((t) => t.category === cat.id),
  }));

  return (
    <div className="space-y-10">
      {/* Seção A — Ferramentas por Categoria */}
      <section>
        <SectionTitle
          icon="🔧"
          title="Ferramentas"
          subtitle="Capacidades que o agente pode usar durante a execução."
          badge={<NexusBadge color="blue">{enabledTools} ativas</NexusBadge>}
        />
        <div className="space-y-3">
          {toolsByCategory.map((cat) => (
            <CollapsibleCard
              key={cat.id}
              icon={cat.label.slice(0, 2)}
              title={cat.label.slice(2).trim()}
              subtitle={cat.description}
              badge={<NexusBadge color="muted">{cat.tools.length}</NexusBadge>}
            >
              <div className="space-y-3">
                {cat.tools.map((tool) => (
                  <div key={tool.id} className="rounded-lg border border-border bg-muted/10 p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <ToggleField
                          label=""
                          checked={tool.enabled}
                          onCheckedChange={(v) => updateTool(tool.id, { enabled: v })}
                        />
                        <input
                          className="flex-1 bg-transparent border-none text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
                          value={tool.name}
                          onChange={(e) => updateTool(tool.id, { name: e.target.value })}
                          placeholder="Nome da ferramenta"
                        />
                      </div>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeTool(tool.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {tool.enabled && (
                      <div className="space-y-3 pt-2 border-t border-border">
                        <input
                          className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground"
                          value={tool.description}
                          onChange={(e) => updateTool(tool.id, { description: e.target.value })}
                          placeholder="Descrição da ferramenta"
                        />
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <SelectField
                            label="Permissão"
                            value={tool.permission_level}
                            onChange={(v) => updateTool(tool.id, { permission_level: v as AgentTool['permission_level'] })}
                            options={[
                              { value: 'read_only', label: 'Somente leitura' },
                              { value: 'read_write', label: 'Leitura e escrita' },
                              { value: 'admin', label: 'Admin' },
                            ]}
                          />
                          <SelectField
                            label="Validação de Output"
                            value={tool.output_validation}
                            onChange={(v) => updateTool(tool.id, { output_validation: v as AgentTool['output_validation'] })}
                            options={[
                              { value: 'none', label: 'Nenhuma' },
                              { value: 'schema', label: 'Schema JSON' },
                              { value: 'llm_review', label: 'Revisão LLM' },
                            ]}
                          />
                          <SliderField
                            label="Max chamadas/sessão"
                            value={tool.max_calls_per_session}
                            onChange={(v) => updateTool(tool.id, { max_calls_per_session: v })}
                            min={1}
                            max={200}
                            step={1}
                          />
                          <SliderField
                            label="Max chamadas/dia"
                            value={tool.max_calls_per_day}
                            onChange={(v) => updateTool(tool.id, { max_calls_per_day: v })}
                            min={1}
                            max={10000}
                            step={10}
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <ToggleField
                            label="Requer aprovação humana"
                            checked={tool.requires_approval}
                            onCheckedChange={(v) => updateTool(tool.id, { requires_approval: v })}
                          />
                          <ToggleField
                            label="Audit Log"
                            checked={tool.audit_log}
                            onCheckedChange={(v) => updateTool(tool.id, { audit_log: v })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    updateAgent({
                      tools: [...agent.tools, { ...DEFAULT_TOOL, id: crypto.randomUUID(), category: cat.id as AgentTool['category'] }],
                    });
                  }}
                  className="w-full border-dashed"
                >
                  <Plus className="h-4 w-4 mr-2" /> Adicionar em {cat.label.slice(2).trim()}
                </Button>
              </div>
            </CollapsibleCard>
          ))}
          <Button variant="outline" size="sm" onClick={addTool} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar Ferramenta
          </Button>
        </div>
      </section>

      {/* Seção B — MCP Servers */}
      <section>
        <SectionTitle
          icon="🔌"
          title="MCP Servers"
          subtitle="Conecte servidores MCP para estender as capacidades do agente."
          badge={<NexusBadge color="purple">{agent.mcp_servers.length} servidores</NexusBadge>}
        />
        <div className="space-y-3">
          {agent.mcp_servers.map((server) => (
            <div key={server.id} className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <ToggleField
                  label=""
                  checked={server.enabled}
                  onCheckedChange={(v) => updateMCP(server.id, { enabled: v })}
                />
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeMCP(server.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">Nome</label>
                  <input
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                    value={server.name}
                    onChange={(e) => updateMCP(server.id, { name: e.target.value })}
                    placeholder="Ex: Notion MCP"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">URL</label>
                  <input
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                    value={server.url}
                    onChange={(e) => updateMCP(server.id, { url: e.target.value })}
                    placeholder="https://mcp-server.example.com"
                  />
                </div>
              </div>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={addMCP} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar MCP Server
          </Button>
        </div>
      </section>

      {/* Seção C — APIs Customizadas */}
      <section>
        <SectionTitle
          icon="🌐"
          title="APIs Customizadas"
          subtitle="Endpoints REST que o agente pode chamar diretamente."
          badge={<NexusBadge color="orange">{agent.custom_apis.length} APIs</NexusBadge>}
        />
        <div className="space-y-3">
          {agent.custom_apis.map((api) => (
            <CollapsibleCard
              key={api.id}
              icon="🌐"
              title={api.name || 'Nova API'}
              subtitle={`${api.method} ${api.url || '—'}`}
            >
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Nome</label>
                    <input
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                      value={api.name}
                      onChange={(e) => updateAPI(api.id, { name: e.target.value })}
                      placeholder="Nome da API"
                    />
                  </div>
                  <SelectField
                    label="Método"
                    value={api.method}
                    onChange={(v) => updateAPI(api.id, { method: v as CustomAPI['method'] })}
                    options={[
                      { value: 'GET', label: 'GET' },
                      { value: 'POST', label: 'POST' },
                      { value: 'PUT', label: 'PUT' },
                      { value: 'DELETE', label: 'DELETE' },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">URL</label>
                  <input
                    className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                    value={api.url}
                    onChange={(e) => updateAPI(api.id, { url: e.target.value })}
                    placeholder="https://api.example.com/endpoint"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <SelectField
                    label="Autenticação"
                    value={api.auth_type}
                    onChange={(v) => updateAPI(api.id, { auth_type: v as CustomAPI['auth_type'] })}
                    options={[
                      { value: 'none', label: 'Nenhuma' },
                      { value: 'api_key', label: 'API Key' },
                      { value: 'bearer', label: 'Bearer Token' },
                      { value: 'basic', label: 'Basic Auth' },
                      { value: 'oauth2', label: 'OAuth 2.0' },
                    ]}
                  />
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Descrição</label>
                    <input
                      className="w-full rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground"
                      value={api.description}
                      onChange={(e) => updateAPI(api.id, { description: e.target.value })}
                      placeholder="O que este endpoint faz"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button variant="ghost" size="sm" className="text-destructive" onClick={() => removeAPI(api.id)}>
                    <Trash2 className="h-4 w-4 mr-1" /> Remover
                  </Button>
                </div>
              </div>
            </CollapsibleCard>
          ))}
          <Button variant="outline" size="sm" onClick={addAPI} className="w-full border-dashed">
            <Plus className="h-4 w-4 mr-2" /> Adicionar API
          </Button>
        </div>
      </section>
    </div>
  );
}
