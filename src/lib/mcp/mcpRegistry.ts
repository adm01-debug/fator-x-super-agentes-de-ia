/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — MCP Server Registry
 * ═══════════════════════════════════════════════════════════════
 * Manages registered MCP servers, their status, and tool discovery.
 * Persists to Supabase mcp_servers table.
 */

import { fromTable } from '@/lib/supabaseExtended';
import { NexusMCPClient, type MCPServer, type MCPTool } from './mcpClient';

const clients = new Map<string, NexusMCPClient>();

/**
 * List all registered MCP servers for the workspace.
 */
export async function listMCPServers(): Promise<MCPServer[]> {
  const { data, error } = await fromTable('mcp_servers')
    .select('*')
    .order('name', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MCPServer[];
}

/**
 * Register a new MCP server.
 */
export async function registerMCPServer(server: {
  name: string;
  url: string;
  transport?: 'streamable-http' | 'sse';
}): Promise<MCPServer> {
  // Try to connect and discover tools
  const client = new NexusMCPClient(server.url);
  let tools: MCPTool[] = [];
  let status: MCPServer['status'] = 'disconnected';
  let errorMsg: string | undefined;

  try {
    const result = await client.connect();
    tools = result.tools;
    status = 'connected';
    clients.set(server.url, client);
  } catch (err: unknown) {
    status = 'error';
    errorMsg = err instanceof Error ? err.message : 'Connection failed';
  }

  const { data, error } = await fromTable('mcp_servers')
    .insert({
      name: server.name,
      url: server.url,
      transport: server.transport || 'streamable-http',
      status,
      tools_discovered: tools as unknown as Record<string, unknown>[],
      error: errorMsg,
    })
    .select()
    .single();

  if (error) throw error;
  return data as unknown as MCPServer;
}

/**
 * Call a tool on a registered MCP server.
 */
export async function callMCPTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown>
) {
  let client = clients.get(serverUrl);

  if (!client) {
    client = new NexusMCPClient(serverUrl);
    await client.connect();
    clients.set(serverUrl, client);
  }

  return client.callTool(toolName, args);
}

/**
 * Remove an MCP server.
 */
export async function removeMCPServer(serverId: string): Promise<void> {
  const { data } = await fromTable('mcp_servers')
    .select('url')
    .eq('id', serverId)
    .single();

  const url = (data as Record<string, unknown> | null)?.url;
  if (url) clients.delete(String(url));

  await fromTable('mcp_servers').delete().eq('id', serverId);
}

/**
 * Get all tools from all connected MCP servers.
 */
export async function getAllMCPTools(): Promise<Array<MCPTool & { serverName: string; serverUrl: string }>> {
  const servers = await listMCPServers();
  const allTools: Array<MCPTool & { serverName: string; serverUrl: string }> = [];

  for (const server of servers) {
    if (server.status !== 'connected') continue;
    const tools = Array.isArray(server.tools) ? server.tools : [];
    for (const tool of tools) {
      allTools.push({
        ...tool,
        serverName: server.name,
        serverUrl: server.url,
      });
    }
  }

  return allTools;
}
