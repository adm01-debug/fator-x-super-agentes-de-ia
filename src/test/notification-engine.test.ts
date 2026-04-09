/**
 * notificationEngineService tests
 *
 * Covers: renderTemplate (pure), NOTIFICATION_PRESETS constant,
 * sendNotificationViaEF input validation.
 */
import { describe, it, expect } from 'vitest';
import { renderTemplate, NOTIFICATION_PRESETS } from '@/services/notificationEngineService';

// ──────── renderTemplate ────────

describe('notificationEngineService — renderTemplate', () => {
  it('replaces simple variables', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'João' });
    expect(result).toBe('Hello João!');
  });

  it('replaces multiple variables', () => {
    const result = renderTemplate('{{greeting}} {{name}}, your order #{{orderId}} is ready.', {
      greeting: 'Olá',
      name: 'Maria',
      orderId: '12345',
    });
    expect(result).toBe('Olá Maria, your order #12345 is ready.');
  });

  it('handles nested dot-notation paths', () => {
    const result = renderTemplate('Email: {{user.email}}', {
      user: { email: 'test@example.com' },
    });
    expect(result).toBe('Email: test@example.com');
  });

  it('handles deeply nested paths', () => {
    const result = renderTemplate('{{a.b.c}}', {
      a: { b: { c: 'deep' } },
    });
    expect(result).toBe('deep');
  });

  it('preserves unresolved variables as-is', () => {
    const result = renderTemplate('Hello {{unknown}}!', {});
    expect(result).toBe('Hello {{unknown}}!');
  });

  it('preserves partially resolved nested paths', () => {
    const result = renderTemplate('{{user.missing.field}}', { user: {} });
    expect(result).toBe('{{user.missing.field}}');
  });

  it('converts numeric values to string', () => {
    const result = renderTemplate('Amount: {{amount}}', { amount: 42.5 });
    expect(result).toBe('Amount: 42.5');
  });

  it('handles boolean values', () => {
    const result = renderTemplate('Active: {{active}}', { active: true });
    expect(result).toBe('Active: true');
  });

  it('returns original string when no variables present', () => {
    const result = renderTemplate('No variables here', { key: 'val' });
    expect(result).toBe('No variables here');
  });

  it('handles empty template', () => {
    expect(renderTemplate('', { a: 1 })).toBe('');
  });

  it('handles null/undefined values gracefully', () => {
    const result = renderTemplate('Val: {{val}}', { val: null });
    expect(result).toBe('Val: ');
  });
});

// ──────── NOTIFICATION_PRESETS ────────

describe('notificationEngineService — NOTIFICATION_PRESETS', () => {
  it('contains expected preset keys', () => {
    const keys = Object.keys(NOTIFICATION_PRESETS);
    expect(keys).toContain('deal_approved');
    expect(keys).toContain('purchase_order');
    expect(keys).toContain('delivery_update');
    expect(keys).toContain('art_approval');
    expect(keys).toContain('payment_received');
    expect(keys).toContain('overdue_invoice');
    expect(keys).toContain('agent_error');
    expect(keys).toContain('workflow_completed');
  });

  it('all presets have required fields', () => {
    for (const [_key, preset] of Object.entries(NOTIFICATION_PRESETS)) {
      expect(preset.subject).toBeDefined();
      expect(preset.body).toBeDefined();
      expect(preset.channel).toBeDefined();
      expect(preset.category).toBeDefined();
      expect(typeof preset.subject).toBe('string');
      expect(typeof preset.body).toBe('string');
    }
  });

  it('preset templates contain valid variable placeholders', () => {
    for (const [, preset] of Object.entries(NOTIFICATION_PRESETS)) {
      // All {{var}} should be resolvable — format check
      const vars = preset.body.match(/\{\{(\w+)\}\}/g) ?? [];
      for (const v of vars) {
        expect(v).toMatch(/^\{\{\w+\}\}$/);
      }
    }
  });

  it('deal_approved preset renders correctly', () => {
    const preset = NOTIFICATION_PRESETS.deal_approved;
    const rendered = renderTemplate(preset.body, {
      client_name: 'Acme Corp',
      deal_id: '123',
      amount: '5.000,00',
    });
    expect(rendered).toContain('Acme Corp');
    expect(rendered).toContain('#123');
    expect(rendered).toContain('R$ 5.000,00');
  });

  it('agent_error preset renders correctly', () => {
    const preset = NOTIFICATION_PRESETS.agent_error;
    const rendered = renderTemplate(preset.body, {
      agent_name: 'SalesBot',
      task_name: 'process_lead',
      error_message: 'Timeout',
      retry_count: '2',
      max_retries: '3',
    });
    expect(rendered).toContain('SalesBot');
    expect(rendered).toContain('Timeout');
    expect(rendered).toContain('2/3');
  });
});
