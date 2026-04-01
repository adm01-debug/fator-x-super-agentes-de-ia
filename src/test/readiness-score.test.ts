import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';

describe('Readiness Score calculation', () => {
  beforeEach(() => {
    useAgentBuilderStore.getState().resetAgent();
  });

  it('empty agent has low score with blockers', () => {
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.total).toBeLessThan(40);
    expect(score.maturity_level).toBe('prototype');
    expect(score.blockers.length).toBeGreaterThan(0);
  });

  it('identity category scores correctly', () => {
    useAgentBuilderStore.getState().updateAgent({
      name: 'Test Agent',
      mission: 'Test mission',
      persona: 'specialist',
      scope: 'This is a detailed scope with more than fifty characters for the agent to understand its boundaries clearly.',
    });
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.categories.identity.score).toBe(10); // 3+3+2+2 = max 10
  });

  it('brain category scores with fallback', () => {
    useAgentBuilderStore.getState().updateAgent({
      model: 'claude-sonnet-4.6',
      model_fallback: 'claude-haiku-4.5',
      reasoning: 'react',
    });
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.categories.brain.score).toBe(12); // 5+3+4 = max 12
  });

  it('guardrails blocker detected when no injection guard', () => {
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.blockers.some(b => b.includes('Injection'))).toBe(true);
  });

  it('testing blocker detected with no test cases', () => {
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.blockers.some(b => b.includes('cenários') || b.includes('teste'))).toBe(true);
  });

  it('observability blocker when logging disabled', () => {
    useAgentBuilderStore.getState().updateAgent({ logging_enabled: false });
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.blockers.some(b => b.includes('Logging'))).toBe(true);
  });

  it('high score agent approaches production_ready', () => {
    useAgentBuilderStore.getState().updateAgent({
      name: 'Full Agent',
      mission: 'Complete mission',
      persona: 'specialist',
      scope: 'Detailed scope with more than fifty characters to get full points on identity.',
      model: 'claude-sonnet-4.6',
      model_fallback: 'claude-haiku-4.5',
      reasoning: 'react',
      memory_short_term: true,
      memory_episodic: true,
      memory_semantic: true,
      memory_consolidation: 'hybrid',
      rag_architecture: 'agentic',
      rag_vector_db: 'qdrant',
      rag_reranker: true,
      rag_hybrid_search: true,
      rag_sources: [{ id: '1', name: 'Test', type: 'pdf', location: '/test', sync_frequency: 'daily', enabled: true }],
      system_prompt: 'A'.repeat(250),
      output_format: 'json',
      prompt_techniques: [
        { id: '1', name: 'Role', enabled: true },
        { id: '2', name: 'CoT', enabled: true },
      ],
      few_shot_examples: [
        { id: '1', input: 'test', expected_output: 'result', tags: [] },
        { id: '2', input: 'test2', expected_output: 'result2', tags: [] },
      ],
      guardrails: [
        { id: '1', category: 'input_validation', name: 'Prompt Injection Detection', description: '', enabled: true, severity: 'block' },
        { id: '2', category: 'input_validation', name: 'PII', description: '', enabled: true, severity: 'block' },
        { id: '3', category: 'output_safety', name: 'Toxicity', description: '', enabled: true, severity: 'block' },
        { id: '4', category: 'access_control', name: 'Audit', description: '', enabled: true, severity: 'log' },
        { id: '5', category: 'operational', name: 'Budget', description: '', enabled: true, severity: 'block' },
      ],
      tools: [
        { id: '1', name: 'Search', description: '', category: 'data', enabled: true, permission_level: 'read_only', requires_approval: false, max_calls_per_session: 50, max_calls_per_day: 500, allowed_conditions: '', output_validation: 'none', cost_per_call: 0, audit_log: true },
        { id: '2', name: 'CRM', description: '', category: 'action', enabled: true, permission_level: 'read_write', requires_approval: false, max_calls_per_session: 20, max_calls_per_day: 200, allowed_conditions: '', output_validation: 'schema', cost_per_call: 0, audit_log: true },
        { id: '3', name: 'Email', description: '', category: 'action', enabled: true, permission_level: 'read_write', requires_approval: true, max_calls_per_session: 10, max_calls_per_day: 50, allowed_conditions: '', output_validation: 'none', cost_per_call: 0, audit_log: true },
      ],
      mcp_servers: [{ id: '1', name: 'Bitrix24', url: 'https://b24.example.com', enabled: true }],
      test_cases: [
        { id: '1', name: 'Test 1', input: 'hello', expected_behavior: 'respond', category: 'functional', tags: [], status: 'passed' },
        { id: '2', name: 'Test 2', input: 'injection', expected_behavior: 'block', category: 'safety', tags: [], status: 'passed' },
        { id: '3', name: 'Test 3', input: 'edge', expected_behavior: 'handle', category: 'edge_case', tags: [], status: 'passed' },
      ],
      last_test_results: { accuracy: 92, latency_p95: 1500, safety_score: 97, relevance: 88, consistency: 85, hallucination_rate: 3, tool_success_rate: 96, groundedness: 91, policy_compliance: 100, citation_quality: 82, cost_per_interaction: 0.03, timestamp: new Date().toISOString(), prompt_version: 1, model_used: 'claude-sonnet-4.6' },
      logging_enabled: true,
      alerting_enabled: true,
    });

    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.total).toBeGreaterThanOrEqual(80);
    expect(score.blockers.length).toBe(0);
    expect(score.maturity_level).toBe('production_ready');
  });

  it('recommendations suggest improvements', () => {
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.recommendations.length).toBeGreaterThan(0);
  });
});
