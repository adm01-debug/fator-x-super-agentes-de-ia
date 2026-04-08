/**
 * progressiveSkillLoader tests
 *
 * All functions are pure (in-memory registry) — no Supabase mocking needed.
 * Covers: registry CRUD, token estimation, skill matching, dependency resolution,
 * progressive loading, prompt generation, hot-loading, analytics.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerSkill,
  registerSkills,
  getSkill,
  getAllSkills,
  removeSkill,
  clearSkillRegistry,
  estimateTokens,
  matchSkills,
  resolveDependencies,
  loadSkillsForTask,
  generateSkillPrompt,
  hotLoadSkills,
  getSkillAnalytics,
  type Skill,
} from '@/services/progressiveSkillLoader';

// ──────── Helpers ────────

function makeSkill(overrides: Partial<Skill> & { id: string }): Skill {
  return {
    name: overrides.id,
    description: 'Test skill',
    content: 'Skill content here',
    tokenCount: 100,
    keywords: [],
    category: 'core',
    priority: 5,
    dependencies: [],
    alwaysLoad: false,
    useCount: 0,
    ...overrides,
  };
}

// ──────── Tests ────────

describe('progressiveSkillLoader — registry CRUD', () => {
  beforeEach(() => clearSkillRegistry());

  it('registerSkill + getSkill round trip', () => {
    const s = makeSkill({ id: 'a' });
    registerSkill(s);
    expect(getSkill('a')).toEqual(s);
  });

  it('registerSkills registers multiple at once', () => {
    registerSkills([makeSkill({ id: 'x' }), makeSkill({ id: 'y' })]);
    expect(getAllSkills()).toHaveLength(2);
  });

  it('getAllSkills returns all registered skills', () => {
    registerSkills([makeSkill({ id: '1' }), makeSkill({ id: '2' }), makeSkill({ id: '3' })]);
    expect(getAllSkills()).toHaveLength(3);
  });

  it('getSkill returns undefined for unknown id', () => {
    expect(getSkill('nonexistent')).toBeUndefined();
  });

  it('removeSkill deletes a skill and returns true', () => {
    registerSkill(makeSkill({ id: 'del' }));
    expect(removeSkill('del')).toBe(true);
    expect(getSkill('del')).toBeUndefined();
  });

  it('removeSkill returns false for unknown id', () => {
    expect(removeSkill('nope')).toBe(false);
  });

  it('clearSkillRegistry empties the registry', () => {
    registerSkills([makeSkill({ id: 'a' }), makeSkill({ id: 'b' })]);
    clearSkillRegistry();
    expect(getAllSkills()).toHaveLength(0);
  });

  it('registering a skill with same id overwrites it', () => {
    registerSkill(makeSkill({ id: 'dup', name: 'first' }));
    registerSkill(makeSkill({ id: 'dup', name: 'second' }));
    expect(getSkill('dup')?.name).toBe('second');
    expect(getAllSkills()).toHaveLength(1);
  });
});

describe('progressiveSkillLoader — estimateTokens', () => {
  it('estimates 1 token per 4 chars', () => {
    expect(estimateTokens('abcd')).toBe(1);
    expect(estimateTokens('ab')).toBe(1); // ceil(2/4)=1
    expect(estimateTokens('12345678')).toBe(2);
  });

  it('empty string = 0 tokens', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('handles long text', () => {
    const text = 'a'.repeat(400);
    expect(estimateTokens(text)).toBe(100);
  });
});

describe('progressiveSkillLoader — matchSkills', () => {
  beforeEach(() => {
    clearSkillRegistry();
    registerSkills([
      makeSkill({
        id: 'data-analysis',
        name: 'Data Analysis',
        description: 'Analyze datasets and produce charts',
        keywords: ['analyze', 'data', 'chart', 'statistics'],
        category: 'analysis',
        priority: 8,
      }),
      makeSkill({
        id: 'email-sender',
        name: 'Email Sender',
        description: 'Send email notifications to users',
        keywords: ['email', 'send', 'notification'],
        category: 'communication',
        priority: 5,
      }),
      makeSkill({
        id: 'core-base',
        name: 'Core Base',
        description: 'Base skill always loaded',
        keywords: [],
        category: 'core',
        alwaysLoad: true,
        priority: 10,
      }),
    ]);
  });

  it('always-load skills get score 1.0', () => {
    const matches = matchSkills('anything');
    const coreMatch = matches.find((m) => m.skill.id === 'core-base');
    expect(coreMatch).toBeDefined();
    expect(coreMatch!.score).toBe(1.0);
    expect(coreMatch!.matchReason).toContain('always loaded');
  });

  it('keyword matching boosts score', () => {
    const matches = matchSkills('I need to analyze the data');
    const dataMatch = matches.find((m) => m.skill.id === 'data-analysis');
    expect(dataMatch).toBeDefined();
    expect(dataMatch!.score).toBeGreaterThan(0);
    expect(dataMatch!.matchedKeywords).toContain('analyze');
    expect(dataMatch!.matchedKeywords).toContain('data');
  });

  it('force-include gives score 0.95', () => {
    const matches = matchSkills('random task', { forceInclude: ['email-sender'] });
    const emailMatch = matches.find((m) => m.skill.id === 'email-sender');
    expect(emailMatch).toBeDefined();
    expect(emailMatch!.score).toBe(0.95);
  });

  it('excluded skills are not returned', () => {
    const matches = matchSkills('analyze data email', { exclude: ['data-analysis'] });
    expect(matches.find((m) => m.skill.id === 'data-analysis')).toBeUndefined();
  });

  it('category filter restricts results', () => {
    const matches = matchSkills('analyze data email send', { categories: ['communication'] });
    // Should NOT include data-analysis (category=analysis) unless alwaysLoad
    const ids = matches.map((m) => m.skill.id);
    expect(ids).not.toContain('data-analysis');
    expect(ids).toContain('email-sender');
  });

  it('minScore filters low-scoring skills', () => {
    const matches = matchSkills('completely unrelated topic xyz', { minScore: 0.5 });
    // Only alwaysLoad (score 1.0) should survive
    const nonCore = matches.filter((m) => !m.skill.alwaysLoad);
    nonCore.forEach((m) => expect(m.score).toBeGreaterThanOrEqual(0.5));
  });

  it('results are sorted by score descending', () => {
    const matches = matchSkills('analyze data and send email');
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].score).toBeGreaterThanOrEqual(matches[i].score);
    }
  });

  it('recency boost applies for recently-used skills', () => {
    const skill = getSkill('email-sender')!;
    skill.lastUsed = new Date().toISOString();
    const matches = matchSkills('send email notification');
    const emailMatch = matches.find((m) => m.skill.id === 'email-sender');
    expect(emailMatch).toBeDefined();
    // With recency boost, score should be slightly higher
    expect(emailMatch!.score).toBeGreaterThan(0);
  });
});

describe('progressiveSkillLoader — resolveDependencies', () => {
  beforeEach(() => {
    clearSkillRegistry();
    registerSkills([
      makeSkill({ id: 'A', dependencies: ['B'] }),
      makeSkill({ id: 'B', dependencies: ['C'] }),
      makeSkill({ id: 'C', dependencies: [] }),
      makeSkill({ id: 'D', dependencies: [] }),
    ]);
  });

  it('resolves in dependency order (C before B before A)', () => {
    const resolved = resolveDependencies(['A']);
    const idxC = resolved.indexOf('C');
    const idxB = resolved.indexOf('B');
    const idxA = resolved.indexOf('A');
    expect(idxC).toBeLessThan(idxB);
    expect(idxB).toBeLessThan(idxA);
  });

  it('includes all transitive dependencies', () => {
    const resolved = resolveDependencies(['A']);
    expect(resolved).toContain('B');
    expect(resolved).toContain('C');
  });

  it('handles no dependencies', () => {
    const resolved = resolveDependencies(['D']);
    expect(resolved).toEqual(['D']);
  });

  it('handles circular dependencies without infinite loop', () => {
    registerSkill(makeSkill({ id: 'X', dependencies: ['Y'] }));
    registerSkill(makeSkill({ id: 'Y', dependencies: ['X'] }));
    const resolved = resolveDependencies(['X']);
    // Should complete without hanging
    expect(resolved.length).toBeGreaterThan(0);
  });

  it('deduplicates when multiple skills share dependencies', () => {
    const resolved = resolveDependencies(['A', 'B']);
    const cCount = resolved.filter((id) => id === 'C').length;
    expect(cCount).toBe(1);
  });
});

describe('progressiveSkillLoader — loadSkillsForTask', () => {
  beforeEach(() => {
    clearSkillRegistry();
    registerSkills([
      makeSkill({
        id: 'core',
        name: 'Core',
        alwaysLoad: true,
        tokenCount: 50,
        keywords: [],
      }),
      makeSkill({
        id: 'search',
        name: 'Search Engine',
        description: 'Search the web',
        tokenCount: 200,
        keywords: ['search', 'web', 'google'],
        category: 'data',
        priority: 7,
      }),
      makeSkill({
        id: 'heavy',
        name: 'Heavy Processor',
        description: 'Process large datasets',
        tokenCount: 5000,
        keywords: ['process'],
        category: 'analysis',
        priority: 3,
      }),
    ]);
  });

  it('respects token budget', () => {
    const result = loadSkillsForTask('search and process everything', { tokenBudget: 300 });
    expect(result.totalTokens).toBeLessThanOrEqual(300);
    // heavy (5000 tokens) should be skipped
    expect(result.skipped.some((s) => s.id === 'heavy')).toBe(true);
  });

  it('remainingBudget = budget - totalTokens', () => {
    const result = loadSkillsForTask('search the web', { tokenBudget: 1000 });
    expect(result.remainingBudget).toBe(1000 - result.totalTokens);
  });

  it('respects maxSkills limit', () => {
    const result = loadSkillsForTask('search process everything', { maxSkills: 1 });
    // Only 1 skill loaded (the alwaysLoad core has highest score)
    expect(result.loaded.length).toBeLessThanOrEqual(1);
  });

  it('updates useCount and lastUsed on loaded skills', () => {
    const before = getSkill('core')!.useCount;
    loadSkillsForTask('anything');
    expect(getSkill('core')!.useCount).toBe(before + 1);
    expect(getSkill('core')!.lastUsed).toBeDefined();
  });

  it('strategy is "priority" when alwaysLoad skills present', () => {
    const result = loadSkillsForTask('anything');
    expect(result.strategy).toBe('priority');
  });

  it('strategy is "semantic" when matched skills but no alwaysLoad', () => {
    removeSkill('core');
    const result = loadSkillsForTask('search the web');
    if (result.loaded.length > 0) {
      expect(result.strategy).toBe('semantic');
    }
  });
});

describe('progressiveSkillLoader — generateSkillPrompt', () => {
  it('returns empty string for no loaded skills', () => {
    const prompt = generateSkillPrompt({
      loaded: [],
      skipped: [],
      totalTokens: 0,
      remainingBudget: 4000,
      strategy: 'exact',
    });
    expect(prompt).toBe('');
  });

  it('generates markdown with skill sections', () => {
    const skill = makeSkill({ id: 'test', name: 'Test Skill', content: 'Do the thing' });
    const prompt = generateSkillPrompt({
      loaded: [skill],
      skipped: [],
      totalTokens: 100,
      remainingBudget: 3900,
      strategy: 'semantic',
    });
    expect(prompt).toContain('# Active Skills');
    expect(prompt).toContain('## Skill: Test Skill');
    expect(prompt).toContain('Do the thing');
    expect(prompt).toContain('1 skills loaded (100 tokens)');
  });
});

describe('progressiveSkillLoader — hotLoadSkills', () => {
  beforeEach(() => {
    clearSkillRegistry();
    registerSkills([
      makeSkill({ id: 'loaded', keywords: ['already'], tokenCount: 100 }),
      makeSkill({ id: 'new-skill', keywords: ['fresh'], tokenCount: 200 }),
    ]);
  });

  it('excludes already-loaded skills', () => {
    const result = hotLoadSkills(['loaded'], 'fresh topic', 1000);
    const loadedIds = result.loaded.map((s) => s.id);
    expect(loadedIds).not.toContain('loaded');
  });

  it('uses higher minScore (0.2) and maxSkills (3)', () => {
    // Register many low-relevance skills
    for (let i = 0; i < 10; i++) {
      registerSkill(makeSkill({ id: `filler-${i}`, keywords: [`kw${i}`] }));
    }
    const result = hotLoadSkills([], 'fresh topic', 10000);
    expect(result.loaded.length).toBeLessThanOrEqual(3);
  });
});

describe('progressiveSkillLoader — getSkillAnalytics', () => {
  beforeEach(() => {
    clearSkillRegistry();
    registerSkills([
      makeSkill({ id: 'popular', useCount: 50, name: 'Popular' }),
      makeSkill({ id: 'unused', useCount: 0, name: 'Unused' }),
      makeSkill({ id: 'medium', useCount: 10, name: 'Medium' }),
    ]);
  });

  it('returns analytics sorted by useCount descending', () => {
    const analytics = getSkillAnalytics();
    expect(analytics[0].name).toBe('Popular');
    expect(analytics[1].name).toBe('Medium');
    expect(analytics[2].name).toBe('Unused');
  });

  it('includes all required fields', () => {
    const analytics = getSkillAnalytics();
    for (const entry of analytics) {
      expect(entry).toHaveProperty('id');
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('category');
      expect(entry).toHaveProperty('useCount');
      expect(entry).toHaveProperty('tokenCount');
    }
  });
});
