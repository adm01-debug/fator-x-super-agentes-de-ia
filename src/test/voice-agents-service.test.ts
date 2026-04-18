/**
 * voiceAgentService — error/contract tests with mocked supabase.
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

import * as svc from '@/services/voiceAgentService';

beforeEach(() => {
  invokeMock.mockReset();
  fromMock.mockReset();
});

describe('voiceAgentService', () => {
  it('startSession invokes voice-session with action=start', async () => {
    invokeMock.mockResolvedValueOnce({ data: { id: 'sess-1' }, error: null });
    const r = await svc.startSession('agent-1');
    expect(invokeMock).toHaveBeenCalledWith('voice-session', {
      body: { action: 'start', agent_id: 'agent-1' },
    });
    expect(r).toEqual({ id: 'sess-1' });
  });

  it('endSession throws when error returned', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('boom') });
    await expect(svc.endSession('s1')).rejects.toThrow('boom');
  });

  it('transcribeAudio base64-encodes blob and forwards', async () => {
    invokeMock.mockResolvedValueOnce({ data: { text: 'hi', duration_seconds: 1 }, error: null });
    const blob = new Blob(['hello'], { type: 'audio/webm' });
    const r = await svc.transcribeAudio(blob, 'sess');
    expect(invokeMock).toHaveBeenCalledWith('voice-transcribe', expect.objectContaining({
      body: expect.objectContaining({ session_id: 'sess', mime_type: 'audio/webm' }),
    }));
    expect(r.text).toBe('hi');
  });

  it('synthesizeReply throws on supabase error', async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: new Error('rate limit') });
    await expect(svc.synthesizeReply('hi', 's', null)).rejects.toThrow('rate limit');
  });

  it('listSessions queries voice_sessions with limit', async () => {
    const order = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [{ id: 'a' }], error: null }),
    });
    fromMock.mockReturnValue({ select: vi.fn().mockReturnValue({ order }) });
    const r = await svc.listSessions(10);
    expect(fromMock).toHaveBeenCalledWith('voice_sessions');
    expect(r).toEqual([{ id: 'a' }]);
  });

  it('deleteSession throws when error', async () => {
    fromMock.mockReturnValue({
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: new Error('forbidden') }),
      }),
    });
    await expect(svc.deleteSession('x')).rejects.toThrow('forbidden');
  });

  it('exposes speech helpers', () => {
    expect(typeof svc.speakText).toBe('function');
    expect(typeof svc.stopSpeaking).toBe('function');
  });
});
