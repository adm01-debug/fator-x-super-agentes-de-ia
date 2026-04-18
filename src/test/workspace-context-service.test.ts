import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client BEFORE importing the service
vi.mock('@/integrations/supabase/client', () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
      auth: { getUser: vi.fn() },
    },
    __builder: builder,
  };
});

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  getWorkspaceIdForUser,
  getFirstWorkspaceId,
  isWorkspaceOwner,
  getCurrentUserWorkspace,
} from '@/services/workspaceContextService';
import { supabase } from '@/integrations/supabase/client';

const fromMock = supabase.from as unknown as ReturnType<typeof vi.fn>;
const getUserMock = (supabase.auth.getUser as unknown as ReturnType<typeof vi.fn>);

function buildResolver(payload: { data: unknown; error: unknown }) {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(payload),
  };
  fromMock.mockReturnValue(builder);
  return builder;
}

describe('workspaceContextService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getWorkspaceIdForUser', () => {
    it('returns workspace id when found', async () => {
      buildResolver({ data: { id: 'ws-1' }, error: null });
      const id = await getWorkspaceIdForUser('user-1');
      expect(id).toBe('ws-1');
      expect(fromMock).toHaveBeenCalledWith('workspaces');
    });

    it('returns null when no workspace owned', async () => {
      buildResolver({ data: null, error: null });
      const id = await getWorkspaceIdForUser('user-1');
      expect(id).toBeNull();
    });

    it('throws and logs when supabase returns error', async () => {
      buildResolver({ data: null, error: { message: 'rls denied' } });
      await expect(getWorkspaceIdForUser('user-1')).rejects.toBeDefined();
    });
  });

  describe('getFirstWorkspaceId', () => {
    it('returns first workspace id', async () => {
      buildResolver({ data: { id: 'ws-first' }, error: null });
      const id = await getFirstWorkspaceId();
      expect(id).toBe('ws-first');
    });

    it('returns null when no workspaces exist', async () => {
      buildResolver({ data: null, error: null });
      expect(await getFirstWorkspaceId()).toBeNull();
    });
  });

  describe('isWorkspaceOwner', () => {
    it('returns true when owner_id matches', async () => {
      buildResolver({ data: { owner_id: 'user-1' }, error: null });
      expect(await isWorkspaceOwner('ws-1', 'user-1')).toBe(true);
    });

    it('returns false when owner_id differs', async () => {
      buildResolver({ data: { owner_id: 'user-2' }, error: null });
      expect(await isWorkspaceOwner('ws-1', 'user-1')).toBe(false);
    });

    it('returns false when workspace not found', async () => {
      buildResolver({ data: null, error: null });
      expect(await isWorkspaceOwner('ws-x', 'user-1')).toBe(false);
    });
  });

  describe('getCurrentUserWorkspace', () => {
    it('returns null when user is not authenticated', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: null });
      expect(await getCurrentUserWorkspace()).toBeNull();
    });

    it('returns workspace summary for authenticated user', async () => {
      getUserMock.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
      buildResolver({ data: { id: 'ws-1', name: 'Promo' }, error: null });
      const ws = await getCurrentUserWorkspace();
      expect(ws).toEqual({ id: 'ws-1', name: 'Promo' });
    });

    it('throws when auth returns error', async () => {
      getUserMock.mockResolvedValue({ data: { user: null }, error: { message: 'jwt expired' } });
      await expect(getCurrentUserWorkspace()).rejects.toBeDefined();
    });
  });
});
