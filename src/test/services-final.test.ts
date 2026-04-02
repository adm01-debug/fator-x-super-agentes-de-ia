import { describe, it, expect, vi } from 'vitest';

// Mock deps
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: () => ({ catch: () => {} }) }) } }));
vi.mock('@/lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

// ═══ resilience.ts ═══
import { checkRateLimit, resetRateLimit, isCircuitOpen, recordSuccess, recordFailure, getCircuitState, evaluateSLOs, SLO_DEFINITIONS, debounce, throttle, getCorrelationId, newCorrelationId } from '@/services/resilience';

describe('resilience — rate limiter', () => {
  it('allows requests under limit', () => {
    resetRateLimit('test-rl');
    const r = checkRateLimit('test-rl', 60);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBeGreaterThan(0);
  });

  it('blocks after exhausting tokens', () => {
    resetRateLimit('test-exhaust');
    for (let i = 0; i < 5; i++) checkRateLimit('test-exhaust', 5);
    const r = checkRateLimit('test-exhaust', 5);
    expect(r.allowed).toBe(false);
    expect(r.retryAfterMs).toBeGreaterThan(0);
  });
});

describe('resilience — circuit breaker', () => {
  it('starts closed', () => {
    expect(isCircuitOpen('test-cb')).toBe(false);
    expect(getCircuitState('test-cb').state).toBe('closed');
  });

  it('opens after threshold failures', () => {
    for (let i = 0; i < 6; i++) recordFailure('test-cb-open');
    expect(isCircuitOpen('test-cb-open')).toBe(true);
    expect(getCircuitState('test-cb-open').state).toBe('open');
  });

  it('success decays failure count', () => {
    recordSuccess('test-cb-decay');
    const state = getCircuitState('test-cb-decay');
    expect(state.failures).toBeLessThanOrEqual(0);
  });
});

describe('resilience — SLOs', () => {
  it('SLO_DEFINITIONS has 8 entries', () => {
    expect(SLO_DEFINITIONS.length).toBe(8);
  });

  it('evaluateSLOs checks against metrics', () => {
    const results = evaluateSLOs({ uptime: 99.95, error_rate: 0.5, latency_p50: 1500 });
    expect(results.length).toBe(8);
    const uptime = results.find(r => r.name === 'Availability');
    expect(uptime?.met).toBe(true);
  });
});

describe('resilience — correlation IDs', () => {
  it('getCorrelationId returns string', () => {
    expect(getCorrelationId()).toBeTruthy();
    expect(typeof getCorrelationId()).toBe('string');
  });

  it('newCorrelationId generates unique ID', () => {
    const id1 = newCorrelationId();
    const id2 = newCorrelationId();
    expect(id1).not.toBe(id2);
  });
});

describe('resilience — debounce/throttle', () => {
  it('debounce returns a function', () => {
    const fn = debounce(() => {}, 100);
    expect(typeof fn).toBe('function');
  });

  it('throttle returns a function', () => {
    const fn = throttle(() => {}, 100);
    expect(typeof fn).toBe('function');
  });
});

// ═══ auditTrail.ts ═══
import * as auditTrail from '@/services/auditTrail';

describe('auditTrail', () => {
  it('log creates entry with id and timestamp', () => {
    const entry = auditTrail.log({
      userId: 'u1', userName: 'Test', action: 'create', resource: 'agent',
      resourceId: 'a1', details: 'Created test agent', outcome: 'success',
    });
    expect(entry.id).toMatch(/^audit-/);
    expect(entry.timestamp).toBeTruthy();
    expect(entry.correlationId).toBeTruthy();
  });

  it('query returns logged entries', () => {
    const results = auditTrail.query({ resource: 'agent' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('getStats returns counts', () => {
    const stats = auditTrail.getStats();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.byAction).toHaveProperty('create');
    expect(stats.uniqueUsers).toBeGreaterThan(0);
  });

  it('exportLog returns JSON string', () => {
    const json = auditTrail.exportLog();
    expect(JSON.parse(json)).toBeInstanceOf(Array);
  });

  it('count returns number', () => {
    expect(auditTrail.count()).toBeGreaterThan(0);
  });
});

// ═══ errorCodes.ts ═══
import { ERROR_CODES, createAppError, getErrorMessage } from '@/lib/errorCodes';

describe('errorCodes', () => {
  it('ERROR_CODES has entries for all categories', () => {
    expect(ERROR_CODES.AUTH_INVALID_CREDENTIALS.code).toBe('E1001');
    expect(ERROR_CODES.LLM_NO_API_KEY.code).toBe('E3001');
    expect(ERROR_CODES.SEC_PROMPT_INJECTION.code).toBe('E4001');
    expect(ERROR_CODES.DB_CONNECTION_FAILED.code).toBe('E7001');
    expect(ERROR_CODES.UNKNOWN_ERROR.code).toBe('E9001');
  });

  it('createAppError returns Error with appError property', () => {
    const err = createAppError('LLM_NO_API_KEY', 'OpenRouter');
    expect(err).toBeInstanceOf(Error);
    expect(err.appError.code).toBe('E3001');
    expect(err.message).toContain('API key');
    expect(err.message).toContain('OpenRouter');
  });

  it('getErrorMessage returns user-friendly message', () => {
    const err = createAppError('AGENT_NOT_FOUND');
    expect(getErrorMessage(err)).toBe('Agente não encontrado');
    expect(getErrorMessage(new Error('raw'))).toBe('raw');
    expect(getErrorMessage('string')).toBe('Erro desconhecido — tente novamente');
  });
});

// ═══ featureFlags.ts ═══
import { isEnabled, getFlags, toggleFlag, resetFlags } from '@/services/featureFlags';

describe('featureFlags', () => {
  it('getFlags returns default flags', () => {
    resetFlags();
    const flags = getFlags();
    expect(flags.length).toBeGreaterThanOrEqual(8);
  });

  it('isEnabled returns boolean', () => {
    expect(typeof isEnabled('graph_rag')).toBe('boolean');
  });

  it('toggleFlag changes state', () => {
    resetFlags();
    // Use a flag with 100% rollout (graph_rag is enabled + 100%)
    const before = isEnabled('graph_rag');
    toggleFlag('graph_rag');
    const after = isEnabled('graph_rag');
    expect(before).not.toBe(after);
    resetFlags();
  });
});

// ═══ i18n.ts ═══
import { t, getLocale, setLocale, getLocales } from '@/lib/i18n';

describe('i18n', () => {
  it('t() translates common.save in pt-BR', () => {
    setLocale('pt-BR');
    expect(t('common.save')).toBe('Salvar');
  });

  it('t() translates common.save in en-US', () => {
    setLocale('en-US');
    expect(t('common.save')).toBe('Save');
    setLocale('pt-BR'); // restore
  });

  it('t() returns key path for missing keys', () => {
    expect(t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('getLocales returns 3 locales', () => {
    expect(getLocales().length).toBe(3);
    expect(getLocales().map(l => l.code)).toContain('pt-BR');
    expect(getLocales().map(l => l.code)).toContain('en-US');
    expect(getLocales().map(l => l.code)).toContain('es-ES');
  });

  it('setLocale + getLocale round-trip', () => {
    setLocale('es-ES');
    expect(getLocale()).toBe('es-ES');
    expect(t('common.save')).toBe('Guardar');
    setLocale('pt-BR'); // restore
  });
});
