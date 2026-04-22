import { describe, it, expect } from 'vitest';
import { installSkill, uninstallSkill } from '@/lib/skillsInstaller';
import { DEFAULT_AGENT } from '@/data/agentBuilderData';
import type { AgentSkillDefinition } from '@/services/skillsRegistryService';
import type { AgentConfig } from '@/types/agentTypes';

function makeSkill(config: Record<string, unknown> = {}): AgentSkillDefinition {
  return {
    id: 'skill-1',
    name: 'Shipping Toolkit',
    slug: 'shipping-toolkit',
    description: 'Adiciona tools de logística',
    version: '1.0.0',
    author: 'test',
    category: 'tools',
    tags: ['logistics'],
    install_count: 0,
    rating: 0,
    skill_config: config,
    is_verified: true,
    is_public: true,
    created_at: new Date().toISOString(),
  };
}

function freshAgent(): AgentConfig {
  return { ...DEFAULT_AGENT, tools: [], guardrails: [], tags: [] };
}

describe('skillsInstaller.installSkill', () => {
  it('adds known tools and reports unknown ones', () => {
    const skill = makeSkill({
      tools: ['calculate_shipping', 'track_delivery', 'does_not_exist'],
    });
    const result = installSkill(freshAgent(), skill);
    expect(result.added_tools).toContain('calculate_shipping');
    expect(result.added_tools).toContain('track_delivery');
    expect(result.unknown_tools).toEqual(['does_not_exist']);
    expect(result.agent.tools.map((t) => t.id).sort()).toEqual(
      ['calculate_shipping', 'track_delivery'].sort(),
    );
  });

  it('is idempotent — installing the same skill twice adds nothing new', () => {
    const skill = makeSkill({ tools: ['calculate_shipping'] });
    const once = installSkill(freshAgent(), skill).agent;
    const twice = installSkill(once, skill);
    expect(twice.added_tools).toHaveLength(0);
    expect(twice.agent.tools).toHaveLength(1);
  });

  it('appends system prompt with marker only once', () => {
    const skill = makeSkill({ system_prompt_append: 'Use sempre o Frenet como fallback.' });
    const once = installSkill(freshAgent(), skill);
    expect(once.appended_prompt).toBe(true);
    expect(once.agent.system_prompt).toContain('<!-- skill:shipping-toolkit@1.0.0 -->');

    const twice = installSkill(once.agent, skill);
    expect(twice.appended_prompt).toBe(false);
  });

  it('tags the agent with skill:<slug>', () => {
    const result = installSkill(freshAgent(), makeSkill({ tags: ['shipping'] }));
    expect(result.agent.tags).toContain('skill:shipping-toolkit');
    expect(result.applied_tags).toContain('shipping');
  });

  it('adds guardrails without duplicating by name', () => {
    const skill = makeSkill({
      guardrails: [
        {
          category: 'operational',
          name: 'Max Shipping Quote',
          severity: 'warn',
          description: 'Alerta em cotações > R$ 5000',
        },
      ],
    });
    const first = installSkill(freshAgent(), skill);
    expect(first.agent.guardrails.some((g) => g.name === 'Max Shipping Quote')).toBe(true);
    expect(first.added_guardrails).toContain('Max Shipping Quote');

    const second = installSkill(first.agent, skill);
    expect(second.added_guardrails).toHaveLength(0);
  });
});

describe('skillsInstaller.uninstallSkill', () => {
  it('removes skill tag and guardrails + prompt marker', () => {
    const skill = makeSkill({
      guardrails: [
        {
          category: 'operational',
          name: 'Max Shipping Quote',
          severity: 'warn',
          description: 'x',
        },
      ],
      system_prompt_append: 'Use o Frenet.',
    });
    const installed = installSkill(freshAgent(), skill).agent;
    const uninstalled = uninstallSkill(installed, skill);
    expect(uninstalled.tags).not.toContain('skill:shipping-toolkit');
    expect(uninstalled.guardrails.some((g) => g.id.startsWith('skill_shipping-toolkit_'))).toBe(
      false,
    );
    expect(uninstalled.system_prompt).not.toContain('Use o Frenet');
  });
});
