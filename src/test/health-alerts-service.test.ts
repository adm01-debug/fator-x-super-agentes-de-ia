import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/stores/notificationStore', () => ({
  useNotificationStore: { getState: () => ({ add: vi.fn() }) },
}));

vi.mock('@/services/healthService', () => ({
  getSystemHealth: vi.fn().mockResolvedValue({
    checks: { db: { status: 'healthy' }, api: { status: 'healthy' } },
  }),
}));

vi.mock('@/services/datahubService', () => ({
  getDatahubHealth: vi.fn().mockResolvedValue({
    timestamp: new Date().toISOString(),
    projects: [{ project: 'test', ref: 'ref1', reachable: true, latency_ms: 50, table_count: 10, total_rows: 100, last_checked: new Date().toISOString() }],
    overall_status: 'healthy',
    reachable_count: 1,
    total_count: 1,
  }),
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe('healthAlertsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checkOnce runs without error', async () => {
    const { checkOnce } = await import('@/services/healthAlertsService');
    await expect(checkOnce()).resolves.not.toThrow();
  });

  it('getCurrentState returns state shape', async () => {
    const { getCurrentState } = await import('@/services/healthAlertsService');
    const state = getCurrentState();
    expect(state).toHaveProperty('systemStatus');
    expect(state).toHaveProperty('datahubStatus');
    expect(state).toHaveProperty('failedDatabases');
    expect(state).toHaveProperty('lastCheckAt');
    expect(state).toHaveProperty('isPolling');
  });

  it('start and stop manage polling', async () => {
    const { start, stop, getCurrentState } = await import('@/services/healthAlertsService');
    start(60000);
    expect(getCurrentState().isPolling).toBe(true);
    stop();
    expect(getCurrentState().isPolling).toBe(false);
  });

  it('start replaces previous timer', async () => {
    const { start, stop, getCurrentState } = await import('@/services/healthAlertsService');
    start(60000);
    start(30000);
    expect(getCurrentState().isPolling).toBe(true);
    stop();
  });
});
