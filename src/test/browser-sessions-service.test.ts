/**
 * browserAgentService — contract tests with mocked supabase.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const invokeMock = vi.fn();
const fromMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => invokeMock(...args) },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));

import { browserAgentService } from '@/services/browserAgentService';

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
});

describe('browserAgentService', () => {
  it('runAgent invokes browser-agent-run with full input', async () => {
    invokeMock.mockResolvedValueOnce({
      data: { session_id: 's1', status: 'running', steps_count: 0, final_result: null, cost_cents: 0 },
      error: null,
    });
    const r = await browserAgentService.runAgent({ goal: 'g', start_url: 'https://x' });
    expect(invokeMock).toHaveBeenCalledWith('browser-agent-run', {
      body: { goal: 'g', start_url: 'https://x' },
    });
    expect(r.session_id).toBe('s1');
  });

  it('runAgent throws on edge function error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('500') });
    await expect(
      browserAgentService.runAgent({ goal: 'g', start_url: 'u' }),
    ).rejects.toThrow('500');
  });

  it('cancelSession passes session_id', async () => {
    invokeMock.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await browserAgentService.cancelSession('abc');
    expect(invokeMock).toHaveBeenCalledWith('browser-session-cancel', {
      body: { session_id: 'abc' },
    });
  });

  it('listSessions returns rows', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [{ id: '1' }, { id: '2' }], error: null }),
        }),
      }),
    });
    const r = await browserAgentService.listSessions(50);
    expect(r).toHaveLength(2);
  });

  it('listSessions throws on error', async () => {
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: null, error: new Error('rls') }),
        }),
      }),
    });
    await expect(browserAgentService.listSessions()).rejects.toThrow('rls');
  });

  it('getSession uses maybeSingle', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'x' }, error: null });
    fromMock.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({ maybeSingle }),
      }),
    });
    const r = await browserAgentService.getSession('x');
    expect(maybeSingle).toHaveBeenCalled();
    expect(r).toEqual({ id: 'x' });
  });

  it('deleteSession throws when supabase errors', async () => {
    fromMock.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('nope') }),
      }),
    });
    await expect(browserAgentService.deleteSession('x')).rejects.toThrow('nope');
  });
});
