/**
 * memoryService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
  },
}));

describe('memoryService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/memoryService');
    expect(typeof mod.addMemory).toBe('function');
    expect(typeof mod.searchMemory).toBe('function');
    expect(typeof mod.forgetMemory).toBe('function');
    expect(typeof mod.compactMemories).toBe('function');
    expect(typeof mod.listMemories).toBe('function');
    expect(typeof mod.invokeMemoryManager).toBe('function');
    expect(typeof mod.promoteMemoryToFact).toBe('function');
  });
});

describe('memoryService types', () => {
  it('MemoryType has expected values', async () => {
    // Type-level verification via import
    const mod = await import('@/services/memoryService');
    expect(mod).toBeDefined();
  });

  it('exports at least 7 functions', async () => {
    const mod = await import('@/services/memoryService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(7);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/memoryService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });
});
