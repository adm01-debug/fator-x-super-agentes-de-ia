import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      single: vi.fn().mockResolvedValue({ data: { id: 'k1', name: 'test' }, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}));

describe('securityService', () => {
  it('exports listApiKeys', async () => {
    const { listApiKeys } = await import('@/services/securityService');
    expect(listApiKeys).toBeDefined();
  });

  it('exports getSecurityEvents', async () => {
    const { getSecurityEvents } = await import('@/services/securityService');
    expect(getSecurityEvents).toBeDefined();
  });

  it('exports getAuditLog', async () => {
    const { getAuditLog } = await import('@/services/securityService');
    expect(getAuditLog).toBeDefined();
  });
});
