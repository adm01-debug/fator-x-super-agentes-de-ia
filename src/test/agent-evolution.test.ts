import { describe, it, expect } from 'vitest';

describe('Agent Self-Evolution', () => {
  it('builds skillbook prompt from skills', async () => {
    const { buildSkillbookPrompt } = await import('@/services/agentEvolutionService');
    
    const skills = [
      { id: '1', agent_id: 'a1', skill_name: 'web_search', description: 'Search web', pattern: 'Use DuckDuckGo for broad searches', success_count: 8, failure_count: 2, confidence: 0.8, created_at: '', updated_at: '' },
      { id: '2', agent_id: 'a1', skill_name: 'code_review', description: 'Review code', pattern: 'Check types first', success_count: 3, failure_count: 7, confidence: 0.3, created_at: '', updated_at: '' },
    ];
    
    const prompt = buildSkillbookPrompt(skills);
    expect(prompt).toContain('learned_skills');
    expect(prompt).toContain('web_search');
    expect(prompt).not.toContain('code_review'); // Low confidence excluded
  });

  it('returns empty for no skills', async () => {
    const { buildSkillbookPrompt } = await import('@/services/agentEvolutionService');
    expect(buildSkillbookPrompt([])).toBe('');
  });

  it('reflects on traces', async () => {
    const { reflectOnTraces } = await import('@/services/agentEvolutionService');
    const traces = [
      { input: 'search web', output: 'found results', success: true, tools_used: ['web_search', 'summarize'] },
      { input: 'search docs', output: 'found docs', success: true, tools_used: ['web_search', 'extract'] },
      { input: 'calc math', output: 'error: timeout', success: false, tools_used: ['calculator'] },
      { input: 'calc stats', output: 'error: timeout', success: false, tools_used: ['calculator'] },
    ];
    
    const result = await reflectOnTraces('agent1', traces);
    expect(result.lessons_learned.length).toBeGreaterThan(0);
    expect(result.failure_patterns.length).toBeGreaterThan(0);
  });
});
