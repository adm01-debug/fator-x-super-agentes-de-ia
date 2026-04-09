/**
 * datahubService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import type { DatahubHealthReport, DatahubProjectHealth } from '@/services/datahubService';

describe('datahubService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/datahubService');
    expect(typeof mod.queryEntity).toBe('function');
    expect(typeof mod.getEntityDetail).toBe('function');
    expect(typeof mod.getDatahubStats).toBe('function');
    expect(typeof mod.testDatahubConnections).toBe('function');
    expect(typeof mod.listDatahubEntities).toBe('function');
    expect(typeof mod.listDatahubTables).toBe('function');
    expect(typeof mod.getDatahubHealth).toBe('function');
    expect(typeof mod.getDatahubRlsPolicies).toBe('function');
    expect(typeof mod.invokeDatahubMCPTool).toBe('function');
  });
});

describe('datahubService types', () => {
  it('DatahubHealthReport shape is valid', () => {
    const report: DatahubHealthReport = {
      timestamp: '2026-04-09T00:00:00Z',
      projects: [],
      overall_status: 'healthy',
      reachable_count: 0,
      total_count: 0,
    };
    expect(report.overall_status).toBe('healthy');
  });

  it('DatahubProjectHealth shape is valid', () => {
    const health: DatahubProjectHealth = {
      project: 'test',
      ref: 'ref-1',
      reachable: true,
      latency_ms: 50,
      table_count: 10,
      total_rows: 100,
      last_checked: '2026-04-09T00:00:00Z',
    };
    expect(health.reachable).toBe(true);
  });

  it('overall_status has 3 valid values', () => {
    const statuses: DatahubHealthReport['overall_status'][] = ['healthy', 'degraded', 'critical'];
    expect(statuses).toHaveLength(3);
  });
});
