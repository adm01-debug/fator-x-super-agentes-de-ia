/**
 * automationTemplateService tests
 *
 * Covers: BUILTIN_TEMPLATES constant validation.
 */
import { describe, it, expect } from 'vitest';
import { BUILTIN_TEMPLATES } from '@/services/automationTemplateService';

// ──────── BUILTIN_TEMPLATES ────────

describe('automationTemplateService — BUILTIN_TEMPLATES', () => {
  it('has 6 built-in templates', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(6);
  });

  it('all templates have required fields', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(tmpl.name).toBeDefined();
      expect(tmpl.slug).toBeDefined();
      expect(tmpl.description).toBeDefined();
      expect(tmpl.long_description).toBeDefined();
      expect(tmpl.category).toBeDefined();
      expect(tmpl.difficulty).toBeDefined();
      expect(tmpl.steps).toBeDefined();
      expect(Array.isArray(tmpl.steps)).toBe(true);
      expect(tmpl.steps.length).toBeGreaterThan(0);
    }
  });

  it('templates have unique slugs', () => {
    const slugs = BUILTIN_TEMPLATES.map((t) => t.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('steps have proper ordering', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      for (let i = 0; i < tmpl.steps.length; i++) {
        expect(tmpl.steps[i].order).toBe(i + 1);
      }
    }
  });

  it('all steps have required fields', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      for (const step of tmpl.steps) {
        expect(step.order).toBeDefined();
        expect(step.name).toBeDefined();
        expect(step.type).toBeDefined();
        expect(step.service).toBeDefined();
        expect(step.operation).toBeDefined();
        expect(step.on_error).toBeDefined();
        expect(['stop', 'retry', 'continue']).toContain(step.on_error);
      }
    }
  });

  it('first step of each template is always a trigger', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(tmpl.steps[0].type).toBe('trigger');
    }
  });

  it('difficulty is one of expected values', () => {
    const validDifficulties = ['beginner', 'intermediate', 'advanced'];
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(validDifficulties).toContain(tmpl.difficulty);
    }
  });

  it('categories cover different business areas', () => {
    const categories = new Set(BUILTIN_TEMPLATES.map((t) => t.category));
    expect(categories.size).toBeGreaterThanOrEqual(4);
    // Check some expected categories
    expect(categories.has('vendas')).toBe(true);
    expect(categories.has('financeiro')).toBe(true);
  });

  it('all templates have tags', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(Array.isArray(tmpl.tags)).toBe(true);
      expect(tmpl.tags.length).toBeGreaterThan(0);
    }
  });

  it('estimated_setup_minutes is reasonable', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(tmpl.estimated_setup_minutes).toBeGreaterThan(0);
      expect(tmpl.estimated_setup_minutes).toBeLessThanOrEqual(60);
    }
  });

  it('all templates are active', () => {
    for (const tmpl of BUILTIN_TEMPLATES) {
      expect(tmpl.is_active).toBe(true);
    }
  });

  it('includes Promo Brindes-specific templates', () => {
    // Check for specific templates mentioned in the docs
    const slugs = BUILTIN_TEMPLATES.map((t) => t.slug);
    expect(slugs).toContain('lead-to-quote');
    expect(slugs).toContain('deal-approved-to-purchase');
    expect(slugs).toContain('tracking-to-notification');
  });
});
