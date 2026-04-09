/**
 * deploymentsService tests — pure functions
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getUser: vi.fn() },
  },
}));

import { getWidgetSnippet, getApiEndpoint } from '@/services/deploymentsService';

describe('deploymentsService pure functions', () => {
  it('getWidgetSnippet returns script tag with agent ID', () => {
    const snippet = getWidgetSnippet('agent-123');
    expect(snippet).toContain('agent-123');
    expect(snippet).toContain('<script');
    expect(snippet).toContain('widget-proxy');
  });

  it('getApiEndpoint returns widget-proxy chat URL', () => {
    const endpoint = getApiEndpoint('agent-123');
    expect(endpoint).toContain('widget-proxy/chat');
  });

  it('getWidgetSnippet includes async attribute', () => {
    const snippet = getWidgetSnippet('x');
    expect(snippet).toContain('async');
  });
});

describe('deploymentsService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/deploymentsService');
    expect(typeof mod.listDeployments).toBe('function');
    expect(typeof mod.createDeployment).toBe('function');
    expect(typeof mod.toggleDeployment).toBe('function');
    expect(typeof mod.deleteDeployment).toBe('function');
    expect(typeof mod.getWidgetSnippet).toBe('function');
    expect(typeof mod.getApiEndpoint).toBe('function');
    expect(typeof mod.listDeployedAgents).toBe('function');
  });

  it('exports at least 7 functions', async () => {
    const mod = await import('@/services/deploymentsService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(7);
  });
});
