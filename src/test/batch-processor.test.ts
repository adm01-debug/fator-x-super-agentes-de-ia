/**
 * batchProcessorService tests (next-frontier coverage expansion #5)
 *
 * Targets: ~532 lines, 0% → 40%+ coverage on processBatch + state machine.
 * Uses mocks for createBatchJob/startBatchJob/reportBatchResults so the
 * client-side processBatch can be exercised end-to-end with a real
 * processor callback.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Track per-test state
let totalItemsForTest = 0;
let processedSoFar = 0;

const buildJob = (status = 'running') => ({
  id: 'job-1',
  name: 'test',
  status,
  total_items: totalItemsForTest,
  processed_items: processedSoFar,
  successful_items: 0,
  failed_items: 0,
  skipped_items: 0,
  batch_size: 50,
  concurrency: 3,
  error_policy: 'continue_all',
  error_threshold_pct: 10,
  current_batch: 0,
  total_batches: 1,
  progress_pct: 0,
  avg_item_ms: 0,
  errors: [],
  metadata: {},
  started_at: new Date(Date.now() - 1000).toISOString(),
  completed_at: null,
  paused_at: null,
  duration_ms: null,
  created_by: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
});

vi.mock('@/lib/supabaseExtended', () => ({
  fromTable: vi.fn(() => {
    // Return a chainable mock where every terminal call returns the
    // current job state (which moves forward each report cycle).
    const chain: Record<string, unknown> = {
      select: vi.fn(() => chain),
      insert: vi.fn(() => chain),
      update: vi.fn((payload: Record<string, unknown>) => {
        // When reportBatchResults updates processed_items, advance the
        // counter so the next .single() call reflects new state.
        if (typeof payload.processed_items === 'number') {
          processedSoFar = payload.processed_items;
        }
        return chain;
      }),
      delete: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      order: vi.fn(() => chain),
      limit: vi.fn(() => chain),
      single: vi.fn(() => Promise.resolve({ data: buildJob(), error: null })),
    };
    return chain;
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }) },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { processBatch } from '@/services/batchProcessorService';

describe('batchProcessorService — processBatch', () => {
  beforeEach(() => {
    processedSoFar = 0;
    totalItemsForTest = 0;
  });

  it('processes a small array with default settings', async () => {
    totalItemsForTest = 5;
    const items = [1, 2, 3, 4, 5];
    const { results } = await processBatch(
      items,
      async (item) => item * 2,
      { name: 'doubling' }
    );
    expect(results.length).toBe(5);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('processor receives the correct index for each item', async () => {
    totalItemsForTest = 4;
    const seenIndices: number[] = [];
    const items = ['a', 'b', 'c', 'd'];
    await processBatch(
      items,
      async (item, idx) => {
        seenIndices.push(idx);
        return item;
      },
      { name: 'index-test', batchSize: 2 }
    );
    expect(seenIndices.sort()).toEqual([0, 1, 2, 3]);
  });

  it('captures errors in result.error without stopping (continue_all)', async () => {
    totalItemsForTest = 3;
    const items = [1, 2, 3];
    const { results } = await processBatch(
      items,
      async (item) => {
        if (item === 2) throw new Error('boom');
        return item;
      },
      { name: 'error-test', errorPolicy: 'continue_all' }
    );
    expect(results.length).toBe(3);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toBe('boom');
    expect(results[2].success).toBe(true);
  });

  it('respects batchSize when chunking items', async () => {
    totalItemsForTest = 10;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const batchCompletions: number[] = [];
    await processBatch(
      items,
      async (item) => item,
      {
        name: 'batch-size-test',
        batchSize: 3,
        onBatchComplete: (n) => batchCompletions.push(n),
      }
    );
    // 10 items / 3 per batch = 4 batches (3, 3, 3, 1)
    expect(batchCompletions).toEqual([1, 2, 3, 4]);
  });

  it('calls onProgress callback for each batch', async () => {
    totalItemsForTest = 4;
    const progressUpdates: number[] = [];
    await processBatch(
      [1, 2, 3, 4],
      async (x) => x,
      {
        name: 'progress-test',
        batchSize: 2,
        onProgress: (p) => progressUpdates.push(p.progress_pct),
      }
    );
    expect(progressUpdates.length).toBeGreaterThan(0);
  });

  it('returns BatchItemResult shape with all fields', async () => {
    totalItemsForTest = 1;
    const { results } = await processBatch(
      [1],
      async (x) => x,
      { name: 'shape-test' }
    );
    const r = results[0];
    expect(r).toHaveProperty('index', 0);
    expect(r).toHaveProperty('success');
    expect(r).toHaveProperty('data');
    expect(r).toHaveProperty('error');
    expect(r).toHaveProperty('duration_ms');
    expect(r.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it('handles empty input array gracefully', async () => {
    totalItemsForTest = 0;
    const { results } = await processBatch(
      [],
      async (x) => x,
      { name: 'empty-test' }
    );
    expect(results.length).toBe(0);
  });

  it('wraps non-object results in {result: ...} envelope', async () => {
    totalItemsForTest = 1;
    const { results } = await processBatch(
      [1],
      async (x) => x * 100,
      { name: 'envelope-test' }
    );
    expect(results[0].data).toEqual({ result: 100 });
  });

  it('passes through object results untouched', async () => {
    totalItemsForTest = 1;
    const { results } = await processBatch(
      [1],
      async () => ({ foo: 'bar', baz: 42 }),
      { name: 'object-result-test' }
    );
    expect(results[0].data).toEqual({ foo: 'bar', baz: 42 });
  });
});
