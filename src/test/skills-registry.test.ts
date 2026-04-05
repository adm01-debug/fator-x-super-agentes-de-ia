import { describe, it, expect } from 'vitest';

describe('Skills Registry', () => {
  it('exports skill categories', async () => {
    const { SKILL_CATEGORIES } = await import('@/services/skillsRegistryService');
    expect(SKILL_CATEGORIES).toHaveLength(5);
    expect(SKILL_CATEGORIES[0].id).toBe('tools');
    expect(SKILL_CATEGORIES.map(c => c.id)).toContain('knowledge');
    expect(SKILL_CATEGORIES.map(c => c.id)).toContain('integrations');
  });
});
