/**
 * MCP Manifest — `src/lib/mcpManifest.ts`
 *
 * Serializa um `AgentConfig` em **manifesto MCP** (Model Context
 * Protocol) para que nossos agentes sejam consumidos como MCP servers
 * por clientes externos (Claude Desktop, Copilot Studio, Cursor, etc.).
 *
 * O edge `a2a-server` (já no repo) pode expor esse manifesto em
 * `GET /mcp/manifest/:agent_id` e implementar o transport (stdio/SSE).
 *
 * Spec MCP v2025-06-18 (resources, prompts, tools, sampling).
 */
import type { AgentConfig, AgentTool } from '@/types/agentTypes';
import { resolveTool } from '@/data/toolCatalog';

export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface McpPrompt {
  name: string;
  description: string;
  arguments: Array<{ name: string; description: string; required: boolean }>;
}

export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface McpServerManifest {
  protocolVersion: '2025-06-18';
  serverInfo: {
    name: string;
    version: string;
    vendor: 'nexus-agents-studio';
  };
  capabilities: {
    tools: { listChanged: boolean };
    prompts: { listChanged: boolean };
    resources: { listChanged: boolean; subscribe: boolean };
    logging: Record<string, never>;
  };
  tools: McpTool[];
  prompts: McpPrompt[];
  resources: McpResource[];
}

function zodToJsonSchemaLite(_schema: unknown): Record<string, unknown> {
  // Minimalista: declara que é um objeto. O cliente MCP deve chamar
  // `tools/call` e receber erro de validação do Zod real no edge se
  // passar formato errado. Evita dependência do zod-to-json-schema aqui.
  return { type: 'object', additionalProperties: true };
}

function toolToMcp(agentTool: AgentTool): McpTool | null {
  const def = resolveTool(agentTool.id);
  if (!def) return null;
  return {
    name: agentTool.id,
    description: def.description,
    inputSchema: zodToJsonSchemaLite(def.input_schema),
  };
}

export function buildMcpManifest(agent: AgentConfig): McpServerManifest {
  const tools: McpTool[] = [];
  for (const t of agent.tools ?? []) {
    if (!t.enabled) continue;
    const mcpTool = toolToMcp(t);
    if (mcpTool) tools.push(mcpTool);
  }

  const prompts: McpPrompt[] = [
    {
      name: 'invoke_agent',
      description: `Invoca o agente "${agent.name}" com uma pergunta do usuário final.`,
      arguments: [
        { name: 'user_message', description: 'Mensagem do usuário', required: true },
        { name: 'session_id', description: 'Identificador da sessão (sticky)', required: false },
      ],
    },
  ];

  const resources: McpResource[] = (agent.rag_sources ?? [])
    .filter((s) => s.enabled)
    .map((s) => ({
      uri: `nexus://kb/${s.source_id}`,
      name: s.name ?? s.source_id,
      description: `Knowledge Base conectada ao agente "${agent.name}"`,
      mimeType: 'application/vnd.nexus.kb+json',
    }));

  return {
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: `nexus-agent-${(agent as unknown as { id?: string }).id ?? 'unknown'}`,
      version: `v${agent.version ?? 1}`,
      vendor: 'nexus-agents-studio',
    },
    capabilities: {
      tools: { listChanged: false },
      prompts: { listChanged: false },
      resources: { listChanged: true, subscribe: false },
      logging: {},
    },
    tools,
    prompts,
    resources,
  };
}

/**
 * Discovery card no estilo A2A (Agent2Agent, Google/Microsoft 2025).
 * Versão compacta do manifesto para registry/marketplace.
 */
export interface A2ADiscoveryCard {
  id: string;
  name: string;
  emoji: string;
  description: string;
  capabilities: string[]; // tool ids
  models: string[];
  languages: string[];
  vendor: string;
  endpoint_mcp?: string;
  endpoint_a2a?: string;
  signed?: boolean;
}

export function buildDiscoveryCard(
  agent: AgentConfig,
  endpoints: { mcp?: string; a2a?: string } = {},
): A2ADiscoveryCard {
  const id = (agent as unknown as { id?: string }).id ?? agent.name;
  return {
    id,
    name: agent.name,
    emoji: agent.avatar_emoji ?? '🤖',
    description: agent.mission ?? '',
    capabilities: (agent.tools ?? []).filter((t) => t.enabled).map((t) => t.id),
    models: agent.model ? [agent.model] : [],
    languages: ['pt-BR', 'en'],
    vendor: 'nexus-agents-studio',
    endpoint_mcp: endpoints.mcp,
    endpoint_a2a: endpoints.a2a,
    signed: false,
  };
}
