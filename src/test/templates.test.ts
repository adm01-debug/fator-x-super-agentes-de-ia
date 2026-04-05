import { describe, it, expect } from 'vitest';
import { AGENT_TEMPLATES, TEMPLATE_CATEGORIES } from '@/data/agentTemplates';

describe('Agent Templates', () => {
  it('has 15 templates', () => {
    expect(AGENT_TEMPLATES.length).toBe(15);
  });

  it('all templates have required fields', () => {
    for (const t of AGENT_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(t.config.system_prompt.length).toBeGreaterThan(10);
      expect(t.config.model).toBeTruthy();
    }
  });

  it('all template IDs are unique', () => {
    const ids = AGENT_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has template categories', () => {
    expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
  });
});
