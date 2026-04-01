import { describe, it, expect } from 'vitest';

// Test the configToRow and rowToConfig helpers indirectly
// These tests verify the serialization logic without needing Supabase

describe('agentService serialization logic', () => {
  it('DEFAULT_AGENT has all required fields', async () => {
    const { DEFAULT_AGENT } = await import('@/data/agentBuilderData');
    expect(DEFAULT_AGENT.name).toBeDefined();
    expect(DEFAULT_AGENT.model).toBe('claude-sonnet-4.6');
    expect(DEFAULT_AGENT.status).toBe('draft');
    expect(DEFAULT_AGENT.version).toBe(1);
    expect(DEFAULT_AGENT.memory_short_term).toBe(true);
    expect(DEFAULT_AGENT.rag_architecture).toBe('agentic');
    expect(DEFAULT_AGENT.logging_enabled).toBe(true);
  });

  it('DEFAULT_AGENT config is serializable to JSON', async () => {
    const { DEFAULT_AGENT } = await import('@/data/agentBuilderData');
    const json = JSON.stringify(DEFAULT_AGENT);
    expect(json).toBeTruthy();
    const parsed = JSON.parse(json);
    expect(parsed.model).toBe('claude-sonnet-4.6');
  });

  it('all 6 templates exist with full configs', async () => {
    const { AGENT_TEMPLATES } = await import('@/data/agentTemplates');
    expect(AGENT_TEMPLATES.length).toBe(6);
    AGENT_TEMPLATES.forEach(t => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.emoji).toBeTruthy();
      expect(t.prompt.length).toBeGreaterThan(50);
      expect(t.fullConfig).toBeDefined();
    });
  });

  it('templateToConfig produces valid AgentConfig', async () => {
    const { AGENT_TEMPLATES, templateToConfig } = await import('@/data/agentTemplates');
    const config = templateToConfig(AGENT_TEMPLATES[0]);
    expect(config.name).toBe(AGENT_TEMPLATES[0].name);
    expect(config.system_prompt).toBeTruthy();
    expect(config.persona).toBeTruthy();
    expect(config.model).toBeTruthy();
  });

  it('TABS array has correct structure', async () => {
    const { TABS } = await import('@/data/agentBuilderData');
    expect(TABS.length).toBeGreaterThanOrEqual(15);
    TABS.forEach(tab => {
      expect(tab.id).toBeTruthy();
      expect(tab.label).toBeTruthy();
      expect(tab.icon).toBeTruthy();
      expect(tab.order).toBeGreaterThan(0);
    });
  });
});

describe('DataHub config', () => {
  it('blacklist is a Set with entries', async () => {
    const { DATAHUB_TABLE_BLACKLIST } = await import('@/config/datahub-blacklist');
    expect(DATAHUB_TABLE_BLACKLIST).toBeInstanceOf(Set);
    expect(DATAHUB_TABLE_BLACKLIST.size).toBeGreaterThan(10);
    expect(DATAHUB_TABLE_BLACKLIST.has('sales')).toBe(true);
    expect(DATAHUB_TABLE_BLACKLIST.has('company_rfm_scores')).toBe(true);
  });

  it('business facts are structured', async () => {
    const { AUTO_BUSINESS_FACTS } = await import('@/config/datahub-blacklist');
    expect(AUTO_BUSINESS_FACTS.length).toBeGreaterThan(5);
    AUTO_BUSINESS_FACTS.forEach(f => {
      expect(f.source).toBeTruthy();
      expect(f.fact).toBeTruthy();
      expect(f.domain).toBeTruthy();
    });
  });

  it('health scores cover all 5 banks', async () => {
    const { BANK_HEALTH_SCORES } = await import('@/config/datahub-blacklist');
    expect(Object.keys(BANK_HEALTH_SCORES).length).toBe(5);
    expect(BANK_HEALTH_SCORES.bancodadosclientes.score).toBe(69);
    expect(BANK_HEALTH_SCORES.financeiro_promo.score).toBe(0);
  });
});
