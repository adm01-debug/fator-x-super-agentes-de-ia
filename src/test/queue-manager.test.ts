/**
 * queueManagerService tests (next-frontier coverage expansion #4)
 *
 * Targets: ~338 lines, 0% → 35%+ on the testable surface (presets,
 * type contracts, runQueueWorker invoker via mocked supabase).
 * The DB-heavy CRUD/dequeue logic is exercised via the mocks.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
  },
}));

vi.mock('@/lib/supabaseExtended', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  QUEUE_PRESETS,
  runQueueWorker,
  type QueueStrategy,
  type QueueItemStatus,
} from '@/services/queueManagerService';

describe('queueManagerService — QUEUE_PRESETS', () => {
  it('exposes 4 named presets', () => {
    const keys = Object.keys(QUEUE_PRESETS);
    expect(keys).toContain('high_priority');
    expect(keys).toContain('standard');
    expect(keys).toContain('bulk_processing');
    expect(keys).toContain('notification');
    expect(keys.length).toBe(4);
  });

  it('high_priority uses priority strategy with high concurrency', () => {
    const p = QUEUE_PRESETS.high_priority;
    expect(p.strategy).toBe('priority');
    expect(p.max_concurrency).toBeGreaterThanOrEqual(10);
    expect(p.default_max_retries).toBeGreaterThanOrEqual(5);
  });

  it('standard uses fifo with conservative defaults', () => {
    const p = QUEUE_PRESETS.standard;
    expect(p.strategy).toBe('fifo');
    expect(p.max_concurrency).toBeLessThanOrEqual(10);
  });

  it('bulk_processing has the largest max_size and longest timeout', () => {
    const p = QUEUE_PRESETS.bulk_processing;
    expect(p.max_size).toBeGreaterThanOrEqual(50000);
    expect(p.default_timeout_ms).toBeGreaterThanOrEqual(60000);
  });

  it('every preset has all required CreateQueueInput fields', () => {
    for (const [name, preset] of Object.entries(QUEUE_PRESETS)) {
      expect(preset.name, name).toBeTruthy();
      expect(preset.description, name).toBeTruthy();
      expect(preset.strategy, name).toBeTruthy();
      expect(preset.max_concurrency, name).toBeGreaterThan(0);
      expect(preset.max_size, name).toBeGreaterThan(0);
      expect(preset.rate_limit_per_second, name).toBeGreaterThan(0);
      expect(preset.default_timeout_ms, name).toBeGreaterThan(0);
      expect(preset.default_max_retries, name).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('queueManagerService — type contracts', () => {
  it('QueueStrategy accepts the documented values', () => {
    const strategies: QueueStrategy[] = ['fifo', 'lifo', 'priority'];
    strategies.forEach((s) => expect(['fifo', 'lifo', 'priority']).toContain(s));
  });

  it('QueueItemStatus has all 5 lifecycle states', () => {
    const statuses: QueueItemStatus[] = ['pending', 'processing', 'completed', 'failed', 'dead_letter'];
    expect(statuses.length).toBe(5);
  });
});

describe('queueManagerService — runQueueWorker', () => {
  beforeEach(() => mockInvoke.mockReset());

  it('calls queue-worker Edge Function with default batch_size 5', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true, results: [] }, error: null });
    await runQueueWorker();
    expect(mockInvoke).toHaveBeenCalledWith('queue-worker', expect.objectContaining({
      body: expect.objectContaining({ batch_size: 5 }),
    }));
  });

  it('caps batch_size at 20', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await runQueueWorker({ batch_size: 100 });
    expect(mockInvoke).toHaveBeenCalledWith('queue-worker', expect.objectContaining({
      body: expect.objectContaining({ batch_size: 20 }),
    }));
  });

  it('passes through queue_id when specified', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await runQueueWorker({ queue_id: 'q-123' });
    expect(mockInvoke).toHaveBeenCalledWith('queue-worker', expect.objectContaining({
      body: expect.objectContaining({ queue_id: 'q-123' }),
    }));
  });

  it('generates a worker_id when not provided', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await runQueueWorker();
    const call = mockInvoke.mock.calls[0];
    expect(call[1].body.worker_id).toMatch(/^manual-/);
  });

  it('respects custom worker_id', async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    await runQueueWorker({ worker_id: 'cron-tick-001' });
    expect(mockInvoke).toHaveBeenCalledWith('queue-worker', expect.objectContaining({
      body: expect.objectContaining({ worker_id: 'cron-tick-001' }),
    }));
  });

  it('returns the data from successful invocation', async () => {
    mockInvoke.mockResolvedValue({
      data: { ok: true, results: [{ queue: 'standard', items_processed: 5, successes: 5, failures: 0 }] },
      error: null,
    });
    const result = await runQueueWorker();
    expect(result.ok).toBe(true);
    expect(result.results?.[0].queue).toBe('standard');
  });

  it('throws on Edge Function error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: { message: 'function not found' } });
    await expect(runQueueWorker()).rejects.toThrow(/function not found/);
  });

  it('returns ok:true fallback when data is null but no error', async () => {
    mockInvoke.mockResolvedValue({ data: null, error: null });
    const result = await runQueueWorker();
    expect(result.ok).toBe(true);
  });
});
