import { logger } from '@/lib/logger';
/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — MCP Client
 * ═══════════════════════════════════════════════════════════════
 * Client implementation for Model Context Protocol.
 * Connects to any MCP server via Streamable HTTP transport.
 * Reference: @modelcontextprotocol/sdk, MCP Roadmap 2026
 */

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  transport: 'streamable-http' | 'sse' | 'stdio';
  status: 'connected' | 'disconnected' | 'error';
  tools: MCPTool[];
  resources: MCPResource[];
  lastConnected?: string;
  error?: string;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface MCPResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface MCPCallResult {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
}

/**
 * MCP Client — connects to a single MCP server.
 */
export class NexusMCPClient {
  private serverUrl: string;
  private sessionId: string | null = null;
  private tools: MCPTool[] = [];
  private resources: MCPResource[] = [];

  constructor(serverUrl: string) {
    this.serverUrl = serverUrl.replace(/\/$/, '');
  }

  /**
   * Initialize connection — discover tools and resources.
   */
  async connect(): Promise<{ tools: MCPTool[]; resources: MCPResource[] }> {
    // Initialize session
    const initResponse = await this.sendRequest('initialize', {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {},
        resources: { subscribe: true },
      },
      clientInfo: {
        name: 'Nexus Agents Studio',
        version: '1.0.0',
      },
    });

    this.sessionId = (initResponse as Record<string, Record<string, string>>)?._meta?.sessionId || null;

    // Send initialized notification
    await this.sendNotification('notifications/initialized', {});

    // Discover tools
    try {
      const toolsResponse = await this.sendRequest('tools/list', {});
      this.tools = (toolsResponse.tools || []) as MCPTool[];
    } catch (err) { logger.error("Operation failed:", err);
      this.tools = [];
    }

    // Discover resources
    try {
      const resourcesResponse = await this.sendRequest('resources/list', {});
      this.resources = (resourcesResponse.resources || []) as MCPResource[];
    } catch (err) { logger.error("Operation failed:", err);
      this.resources = [];
    }

    return { tools: this.tools, resources: this.resources };
  }

  /**
   * Call a tool on the MCP server.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    const response = await this.sendRequest('tools/call', {
      name,
      arguments: args,
    });

    return response as unknown as MCPCallResult;
  }

  /**
   * Read a resource from the MCP server.
   */
  async readResource(uri: string): Promise<MCPCallResult> {
    const response = await this.sendRequest('resources/read', { uri });
    return response as unknown as MCPCallResult;
  }

  /**
   * Get discovered tools.
   */
  getTools(): MCPTool[] {
    return this.tools;
  }

  /**
   * Get discovered resources.
   */
  getResources(): MCPResource[] {
    return this.resources;
  }

  // ═══ Internal ═══

  private async sendRequest(method: string, params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const body = {
      jsonrpc: '2.0',
      id: crypto.randomUUID(),
      method,
      params,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    const response = await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`MCP request failed: ${response.status} ${response.statusText}`);
    }

    // Check for session ID in response headers
    const newSessionId = response.headers.get('Mcp-Session-Id');
    if (newSessionId) this.sessionId = newSessionId;

    const result = await response.json();

    if ((result as Record<string, unknown>).error) {
      const error = (result as Record<string, Record<string, string>>).error;
      throw new Error(`MCP error: ${error.message || JSON.stringify(error)}`);
    }

    return (result as Record<string, Record<string, unknown>>).result || {};
  }

  private async sendNotification(method: string, params: Record<string, unknown>): Promise<void> {
    const body = {
      jsonrpc: '2.0',
      method,
      params,
    };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.sessionId) {
      headers['Mcp-Session-Id'] = this.sessionId;
    }

    await fetch(this.serverUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    }).catch(() => {}); // Notifications are fire-and-forget
  }
}
