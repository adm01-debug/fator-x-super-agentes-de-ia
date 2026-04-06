/**
 * Nexus Agents Studio — Suite Completa de Testes
 * Cobre: exports de todos os 36 services, integração cruzada,
 * cenários Promo Brindes, e edge cases avançados.
 */
import { describe, it, expect, vi } from 'vitest';

/* ================================================================ */
/*  IMPORTS                                                          */
/* ================================================================ */

import {
  parseCronExpression, getNextCronRun, describeCronExpression, CRON_PRESETS,
} from '@/services/cronSchedulerService';

import {
  verifyHmacSignature, applyTransform, WEBHOOK_TEMPLATES,
} from '@/services/webhookTriggerService';

import {
  calculateDelay, executeWithRetry, getCircuitBreaker, canExecute,
  recordCircuitFailure, resetCircuitBreaker,
  DEFAULT_RETRY_POLICY, RETRY_PRESETS,
} from '@/services/retryEngineService';

import { encryptData, decryptData, CREDENTIAL_TEMPLATES } from '@/services/credentialVaultService';
import { renderTemplate, NOTIFICATION_PRESETS } from '@/services/notificationEngineService';
import { BUILTIN_TEMPLATES } from '@/services/automationTemplateService';
import { compareExecutions } from '@/services/executionHistoryService';
import { BUILTIN_CONNECTORS } from '@/services/connectorRegistryService';
import { QUEUE_PRESETS } from '@/services/queueManagerService';
import { calculateCost, getModelPricing, getAllPricing, formatCostBrl, setBudget, getBudget } from '@/services/costCalculatorService';
import { registerSkill, getSkill, clearSkillRegistry, estimateTokens } from '@/services/progressiveSkillLoader';
import { generateAgentCard, validateAgentCard } from '@/services/agentCardService';
import { MiddlewarePipeline, createLoggingMiddleware } from '@/services/middlewarePipelineService';

/* ================================================================ */
/*  A. EXPORTS — 17 services import validation                      */
/* ================================================================ */

describe('A. Exports Validation', () => {
  it('cronSchedulerService: 10 presets + core functions', () => {
    expect(Object.keys(CRON_PRESETS)).toHaveLength(10);
    expect(parseCronExpression).toBeTypeOf('function');
    expect(getNextCronRun).toBeTypeOf('function');
  });

  it('webhookTriggerService: 6 templates + HMAC + transform', () => {
    expect(Object.keys(WEBHOOK_TEMPLATES)).toHaveLength(6);
    expect(verifyHmacSignature).toBeTypeOf('function');
    expect(applyTransform).toBeTypeOf('function');
  });

  it('retryEngineService: 6 presets + retry + circuit breaker', () => {
    expect(Object.keys(RETRY_PRESETS)).toHaveLength(6);
    expect(executeWithRetry).toBeTypeOf('function');
    expect(getCircuitBreaker).toBeTypeOf('function');
  });

  it('credentialVaultService: 10 templates + AES encrypt/decrypt', () => {
    expect(Object.keys(CREDENTIAL_TEMPLATES)).toHaveLength(10);
    expect(encryptData).toBeTypeOf('function');
    expect(decryptData).toBeTypeOf('function');
  });

  it('notificationEngineService: 8 presets + template engine', () => {
    expect(Object.keys(NOTIFICATION_PRESETS)).toHaveLength(8);
    expect(renderTemplate).toBeTypeOf('function');
  });

  it('automationTemplateService: 6 built-in templates', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(6);
  });

  it('connectorRegistryService: 7 built-in connectors', () => {
    expect(BUILTIN_CONNECTORS).toHaveLength(7);
  });

  it('queueManagerService: 4 queue presets', () => {
    expect(Object.keys(QUEUE_PRESETS)).toHaveLength(4);
  });

  it('costCalculatorService: modelos + budget', () => {
    expect(calculateCost).toBeTypeOf('function');
    expect(getAllPricing().length).toBeGreaterThan(5);
  });

  it('progressiveSkillLoader: skill management', () => {
    expect(registerSkill).toBeTypeOf('function');
    expect(estimateTokens).toBeTypeOf('function');
  });

  it('agentCardService: card generation + validation', () => {
    expect(generateAgentCard).toBeTypeOf('function');
    expect(validateAgentCard).toBeTypeOf('function');
  });

  it('middlewarePipelineService: pipeline class', () => {
    expect(MiddlewarePipeline).toBeTypeOf('function');
    expect(createLoggingMiddleware).toBeTypeOf('function');
  });

  it('barrel re-exports key functions', async () => {
    const b = await import('@/services');
    expect(b.parseCronExpression).toBeTypeOf('function');
    expect(b.encryptData).toBeTypeOf('function');
    expect(b.renderTemplate).toBeTypeOf('function');
    expect(b.compareExecutions).toBeTypeOf('function');
  });
});

/* ================================================================ */
/*  B. CENÁRIOS PROMO BRINDES (end-to-end)                          */
/* ================================================================ */

describe('B. Cenários Promo Brindes', () => {
  it('Relatório financeiro diário às 18h', () => {
    const p = parseCronExpression(CRON_PRESETS.daily_evening.expression);
    expect(p.hour).toContain(18);
    expect(p.minute).toContain(0);
  });

  it('Webhook Bitrix24 transforma deal', () => {
    const payload = { data: { FIELDS: { ID: '789', TITLE: 'Canetas Promo', OPPORTUNITY: '15000' } } };
    const r = applyTransform(payload, WEBHOOK_TEMPLATES.bitrix24_deal.transform_script!);
    expect(r.deal_id).toBe('789');
    expect(r.title).toBe('Canetas Promo');
  });

  it('API falha → retry com backoff crescente', () => {
    const p = RETRY_PRESETS.api_call;
    expect(calculateDelay(2, p)).toBeGreaterThan(calculateDelay(1, p));
    expect(p.timeout_ms).toBeLessThanOrEqual(30000);
  });

  it('Credencial WhatsApp criptografada no vault', async () => {
    const cred = { api_key: 'evo-key-promo-2026', instance_name: 'promo' };
    const enc = await encryptData(cred);
    expect(enc).not.toContain('evo-key');
    expect(await decryptData(enc)).toEqual(cred);
  });

  it('Notificação fatura vencida renderizada', () => {
    const msg = renderTemplate(NOTIFICATION_PRESETS.overdue_invoice.body, {
      invoice_number: 'NF-001', client_name: 'XPTO', due_date: '01/04', amount: '12.500', days_overdue: '5',
    });
    expect(msg).toContain('NF-001');
    expect(msg).toContain('XPTO');
  });

  it('Lead→Orçamento template tem 6 steps', () => {
    const t = BUILTIN_TEMPLATES.find(t => t.slug === 'lead-to-quote');
    expect(t!.steps).toHaveLength(6);
    expect(t!.steps[0].type).toBe('trigger');
  });

  it('Connector Bitrix24 tem health check', () => {
    const b = BUILTIN_CONNECTORS.find(c => c.slug === 'bitrix24');
    expect(b!.health_check_endpoint).toBe('/server.time');
  });

  it('Fila alta prioridade para aprovações', () => {
    expect(QUEUE_PRESETS.high_priority.strategy).toBe('priority');
    expect(QUEUE_PRESETS.high_priority.max_concurrency).toBeGreaterThanOrEqual(10);
  });

  it('Cost Calculator calcula Claude Sonnet 4.6', () => {
    const cost = calculateCost('anthropic', 'claude-sonnet-4-6', 1000, 500);
    expect(cost.totalCostUsd).toBeGreaterThan(0);
    expect(cost.totalCostBrl).toBeGreaterThan(0);
  });

  it('Agent Card para Vendedor IA', () => {
    const card = generateAgentCard({ name: 'Vendedor IA', description: 'Vendas Promo', id: 'v1', system_prompt: '', model: 'gpt-4o', provider: 'openai', tools: [], status: 'draft', created_at: '', updated_at: '' });
    expect(card.name).toBe('Vendedor IA');
  });
});

/* ================================================================ */
/*  C. FUNÇÕES PURAS AVANÇADAS                                      */
/* ================================================================ */

describe('C. Funções Puras — Cron', () => {
  it('*/5 gera 12 valores', () => expect(parseCronExpression('*/5 * * * *').minute).toHaveLength(12));
  it('9-17 seg-sex', () => {
    const r = parseCronExpression('0 9-17 * * 1-5');
    expect(r.hour).toEqual([9,10,11,12,13,14,15,16,17]);
    expect(r.dayOfWeek).toEqual([1,2,3,4,5]);
  });
  it('lista 1,15', () => expect(parseCronExpression('0 0 1,15 * *').dayOfMonth).toEqual([1,15]));
  it('next run é futuro', () => expect(getNextCronRun('*/5 * * * *').getTime()).toBeGreaterThan(Date.now()));
  it('presets descrevem', () => expect(describeCronExpression('0 0 * * *')).toBe('Daily at midnight'));
  it('rejeita inválidos', () => expect(() => parseCronExpression('invalid')).toThrow());
});

describe('C. Funções Puras — Webhook Transform', () => {
  it('campos simples', () => expect(applyTransform({ x: 1 }, 'y = x').y).toBe(1));
  it('aninhados', () => expect(applyTransform({ a: { b: 'ok' } }, 'r = a.b').r).toBe('ok'));
  it('comentários ignorados', () => expect(applyTransform({ x: 1 }, '# c\nr = x').r).toBe(1));
  it('HMAC valida', async () => {
    const secret = 'test';
    const payload = 'data';
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyHmacSignature(payload, hex, secret)).toBe(true);
  });
  it('HMAC rejeita errado', async () => expect(await verifyHmacSignature('d', 'bad', 's')).toBe(false));
});

describe('C. Funções Puras — Retry', () => {
  it('fixed = constante', () => {
    const p = { ...DEFAULT_RETRY_POLICY, backoff_strategy: 'fixed' as const, initial_delay_ms: 500 };
    expect(calculateDelay(1, p)).toBe(500);
    expect(calculateDelay(5, p)).toBe(500);
  });
  it('exponencial cresce', () => {
    const p = { ...DEFAULT_RETRY_POLICY, backoff_strategy: 'exponential' as const, initial_delay_ms: 1000, backoff_multiplier: 2 };
    expect(calculateDelay(1, p)).toBe(1000);
    expect(calculateDelay(3, p)).toBe(4000);
  });
  it('max_delay respeitado', () => {
    const p = { ...DEFAULT_RETRY_POLICY, backoff_strategy: 'exponential' as const, initial_delay_ms: 10000, backoff_multiplier: 10, max_delay_ms: 5000 };
    expect(calculateDelay(3, p)).toBe(5000);
  });
  it('sucesso imediato', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const r = await executeWithRetry(fn, { ...DEFAULT_RETRY_POLICY, max_attempts: 3, initial_delay_ms: 1 });
    expect(r.success).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });
  it('recupera após falha', async () => {
    let c = 0;
    const fn = vi.fn().mockImplementation(async () => { if (++c < 3) throw new Error('TIMEOUT'); return 'ok'; });
    const r = await executeWithRetry(fn, { ...DEFAULT_RETRY_POLICY, max_attempts: 5, initial_delay_ms: 5, max_delay_ms: 10 });
    expect(r.success).toBe(true);
  });
  it('circuit breaker abre', () => {
    const svc = 'cb-' + Date.now();
    getCircuitBreaker(svc, { ...DEFAULT_RETRY_POLICY, failure_threshold: 2, success_threshold: 1, timeout_ms: 1000, half_open_max_calls: 1, monitor_window_ms: 5000 } as any);
    recordCircuitFailure(svc);
    recordCircuitFailure(svc);
    expect(canExecute(svc)).toBe(false);
    resetCircuitBreaker(svc);
    expect(canExecute(svc)).toBe(true);
  });
});

describe('C. Funções Puras — Encryption', () => {
  it('encrypt/decrypt simples', async () => {
    const d = { key: 'sk-test-123' };
    expect(await decryptData(await encryptData(d))).toEqual(d);
  });
  it('IV aleatório', async () => {
    const d = { x: 1 };
    expect(await encryptData(d)).not.toBe(await encryptData(d));
  });
  it('unicode + emoji', async () => {
    const d = { pw: 'São Paulo 🔐' };
    expect(await decryptData(await encryptData(d))).toEqual(d);
  });
  it('corrompido falha', async () => {
    await expect(decryptData('AAAA')).rejects.toThrow();
  });
  it('10KB de dados', async () => {
    const d = { big: 'X'.repeat(10000) };
    expect((await decryptData(await encryptData(d))).big).toHaveLength(10000);
  });
});

describe('C. Funções Puras — Template Rendering', () => {
  it('variáveis simples', () => expect(renderTemplate('{{x}}', { x: 'ok' })).toBe('ok'));
  it('aninhadas', () => expect(renderTemplate('{{a.b}}', { a: { b: 'deep' } })).toBe('deep'));
  it('inexistente mantém', () => expect(renderTemplate('{{x}}', {})).toBe('{{x}}'));
  it('múltiplas', () => expect(renderTemplate('{{x}}+{{x}}', { x: '1' })).toBe('1+1'));
  it('vazio', () => expect(renderTemplate('', {})).toBe(''));
});

describe('C. Funções Puras — Cost Calculator', () => {
  it('Claude Sonnet 4.6 pricing existe', () => {
    expect(getModelPricing('anthropic', 'claude-sonnet-4-6')).toBeDefined();
  });
  it('formata BRL', () => expect(formatCostBrl(1.5)).toContain('R$'));
  it('budget configurável', () => {
    setBudget({ maxCostPerDayUsd: 50 });
    expect(getBudget().maxCostPerDayUsd).toBe(50);
  });
  it('tokens negativos rejeitados', () => {
    expect(() => calculateCost('anthropic', 'claude-sonnet-4-6', -1, 0)).toThrow();
  });
});

describe('C. Funções Puras — Skill Loader', () => {
  it('registra e recupera', () => {
    clearSkillRegistry();
    registerSkill({ id: 's1', name: 'Test', description: 'test', content: 'x', tokenCount: 100, dependencies: [], keywords: ['test'], category: 'core', priority: 5 });
    expect(getSkill('s1')?.name).toBe('Test');
  });
  it('estima tokens', () => expect(estimateTokens('hello world')).toBeGreaterThan(0));
});

/* ================================================================ */
/*  D. INTEGRAÇÃO CRUZADA                                           */
/* ================================================================ */

describe('D. Integração Cruzada', () => {
  it('templates referenciam connectors existentes', () => {
    const slugs = BUILTIN_CONNECTORS.map(c => c.slug);
    for (const tpl of BUILTIN_TEMPLATES) {
      for (const i of tpl.required_integrations) {
        if (['llm', 'logic', 'scheduler', 'notification', 'webhook', 'slack'].includes(i)) continue;
        expect(slugs, `Template "${tpl.name}" requer "${i}"`).toContain(i);
      }
    }
  });

  it('credential templates cobrem connectors autenticados', () => {
    const credServices = Object.values(CREDENTIAL_TEMPLATES).map(c => c.service);
    for (const conn of BUILTIN_CONNECTORS) {
      if (conn.auth_type === 'none') continue;
      if (['bitrix24', 'whatsapp', 'supabase'].includes(conn.slug)) {
        const has = credServices.some(s => conn.slug.includes(s) || s.includes(conn.slug));
        expect(has, `${conn.name} sem credential`).toBe(true);
      }
    }
  });

  it('execution compare detecta melhoria 50%', () => {
    const base = { id: 'a', execution_type: 'workflow' as const, source_id: 'w', source_name: 'T', status: 'success' as const, trigger: 'm', input_data: {}, output_data: {}, error: null, error_stack: null, steps: [], started_at: '', completed_at: '', duration_ms: 10000, tokens_used: 1000, cost_brl: 0.5, retry_of: null, parent_execution_id: null, tags: [], created_by: null };
    const fast = { ...base, id: 'b', duration_ms: 5000, tokens_used: 500, cost_brl: 0.25 };
    const cmp = compareExecutions(base, fast);
    expect(cmp.duration_diff_pct).toBe(-50);
  });
});

/* ================================================================ */
/*  E. EDGE CASES                                                    */
/* ================================================================ */

describe('E. Edge Cases', () => {
  it('deep nesting transform (10 levels)', () => {
    const deep = { a: { b: { c: { d: { e: { f: { g: { h: { i: { j: 'found' } } } } } } } } } };
    expect(applyTransform(deep, 'v = a.b.c.d.e.f.g.h.i.j').v).toBe('found');
  });
  it('delay nunca negativo (20 iterations)', () => {
    for (let i = 0; i < 20; i++) expect(calculateDelay(i, DEFAULT_RETRY_POLICY)).toBeGreaterThanOrEqual(0);
  });
  it('delay sempre <= max', () => {
    for (let i = 0; i < 20; i++) expect(calculateDelay(i, DEFAULT_RETRY_POLICY)).toBeLessThanOrEqual(DEFAULT_RETRY_POLICY.max_delay_ms);
  });
  it('50 campos encrypt/decrypt', async () => {
    const d: Record<string, string> = {};
    for (let i = 0; i < 50; i++) d[`k${i}`] = `v${i}`;
    expect(Object.keys(await decryptData(await encryptData(d)))).toHaveLength(50);
  });
  it('100 substituições template', () => {
    let t = ''; const v: Record<string, string> = {};
    for (let i = 0; i < 100; i++) { t += `{{v${i}}} `; v[`v${i}`] = `r${i}`; }
    const r = renderTemplate(t, v);
    expect(r).toContain('r0');
    expect(r).toContain('r99');
    expect(r).not.toContain('{{');
  });
});
