import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';

describe('agentBuilderStore', () => {
  beforeEach(() => {
    useAgentBuilderStore.getState().resetAgent();
  });

  it('starts with default agent', () => {
    const { agent } = useAgentBuilderStore.getState();
    expect(agent.name).toBe('');
    expect(agent.model).toBe('claude-sonnet-4.6');
    expect(agent.status).toBe('draft');
  });

  it('updateAgent sets isDirty', () => {
    useAgentBuilderStore.getState().updateAgent({ name: 'Test Agent' });
    const { agent, isDirty } = useAgentBuilderStore.getState();
    expect(agent.name).toBe('Test Agent');
    expect(isDirty).toBe(true);
  });

  it('resetAgent clears everything', () => {
    useAgentBuilderStore.getState().updateAgent({ name: 'Modified' });
    useAgentBuilderStore.getState().resetAgent();
    const { agent, isDirty } = useAgentBuilderStore.getState();
    expect(agent.name).toBe('');
    expect(isDirty).toBe(false);
  });

  it('getCompleteness returns low score for empty agent', () => {
    const score = useAgentBuilderStore.getState().getCompleteness();
    expect(score).toBeLessThanOrEqual(20); // model default gives some points
  });

  it('getCompleteness increases with filled fields', () => {
    useAgentBuilderStore.getState().updateAgent({ name: 'Agent', mission: 'Do stuff' });
    const score = useAgentBuilderStore.getState().getCompleteness();
    expect(score).toBeGreaterThan(0);
  });

  it('getReadinessScore returns blockers for empty agent', () => {
    const score = useAgentBuilderStore.getState().getReadinessScore();
    expect(score.blockers.length).toBeGreaterThan(0);
    expect(score.maturity_level).toBe('prototype');
  });

  it('getActiveMemoryTypes returns short_term by default', () => {
    const types = useAgentBuilderStore.getState().getActiveMemoryTypes();
    expect(types).toContain('short_term');
  });

  it('getActiveToolsCount returns 0 for empty agent', () => {
    expect(useAgentBuilderStore.getState().getActiveToolsCount()).toBe(0);
  });

  it('getActiveGuardrailsCount returns 0 for empty agent', () => {
    expect(useAgentBuilderStore.getState().getActiveGuardrailsCount()).toBe(0);
  });

  it('getEstimatedMonthlyCost returns value based on model', () => {
    const cost = useAgentBuilderStore.getState().getEstimatedMonthlyCost();
    expect(cost).toBeGreaterThan(0);
  });

  it('exportJSON returns valid JSON', () => {
    const json = useAgentBuilderStore.getState().exportJSON();
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('exportMarkdown returns markdown with sections', () => {
    useAgentBuilderStore.getState().updateAgent({ name: 'Test', mission: 'Testing' });
    const md = useAgentBuilderStore.getState().exportMarkdown();
    expect(md).toContain('# 🤖 Test');
    expect(md).toContain('Testing');
  });

  it('tab navigation works', () => {
    const store = useAgentBuilderStore.getState();
    expect(store.activeTab).toBe('identity');
    store.nextTab();
    expect(useAgentBuilderStore.getState().activeTab).toBe('brain');
    useAgentBuilderStore.getState().prevTab();
    expect(useAgentBuilderStore.getState().activeTab).toBe('identity');
  });

  it('duplicateAgent creates copy', () => {
    useAgentBuilderStore.getState().updateAgent({ name: 'Original' });
    useAgentBuilderStore.getState().duplicateAgent('');
    const { agent } = useAgentBuilderStore.getState();
    expect(agent.name).toBe('Original (cópia)');
    expect(agent.status).toBe('draft');
  });
});
