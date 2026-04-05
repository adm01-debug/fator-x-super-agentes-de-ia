import { describe, it, expect } from 'vitest';

describe('MCP Client', () => {
  it('can import NexusMCPClient', async () => {
    const { NexusMCPClient } = await import('@/lib/mcp/mcpClient');
    expect(NexusMCPClient).toBeDefined();
  });

  it('creates client instance', async () => {
    const { NexusMCPClient } = await import('@/lib/mcp/mcpClient');
    const client = new NexusMCPClient('https://example.com/mcp');
    expect(client).toBeDefined();
    expect(client.getTools()).toEqual([]);
    expect(client.getResources()).toEqual([]);
  });
});
