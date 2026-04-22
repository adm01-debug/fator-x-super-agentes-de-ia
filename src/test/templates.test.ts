import { describe, it, expect } from 'vitest';
import { AGENT_TEMPLATES, TEMPLATE_CATEGORIES } from '@/data/agentTemplates';
import {
  TOOL_CATALOG,
  resolveTool,
  toAgentTool,
  toAgentTools,
  listTools,
} from '@/data/toolCatalog';

// ═══ Templates existentes ═══════════════════════════════════════════
describe('Agent Templates', () => {
  it('has at least 37 templates', () => {
    expect(AGENT_TEMPLATES.length).toBeGreaterThanOrEqual(37);
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
    const ids = AGENT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has template categories', () => {
    expect(TEMPLATE_CATEGORIES.length).toBeGreaterThan(0);
  });
});

// ═══ Tool Catalog ═══════════════════════════════════════════════════
describe('Tool Catalog', () => {
  it('exports non-empty catalog', () => {
    expect(Object.keys(TOOL_CATALOG).length).toBeGreaterThan(0);
    expect(listTools().length).toBe(Object.keys(TOOL_CATALOG).length);
  });

  it('every tool has a unique id matching its key', () => {
    for (const [key, tool] of Object.entries(TOOL_CATALOG)) {
      expect(tool.id).toBe(key);
    }
  });

  it('every tool has at least one of edge_function or mcp_server', () => {
    for (const tool of listTools()) {
      expect(tool.edge_function || tool.mcp_server).toBeTruthy();
    }
  });

  it('resolveTool returns null for unknown id', () => {
    expect(resolveTool('does_not_exist_123')).toBeNull();
  });

  it('toAgentTool returns a valid AgentTool shape', () => {
    const tool = toAgentTool('search_knowledge');
    expect(tool).not.toBeNull();
    expect(tool?.id).toBe('search_knowledge');
    expect(tool?.enabled).toBe(true);
    expect(['read_only', 'read_write', 'admin']).toContain(tool?.permission_level);
    expect(['data', 'action', 'compute', 'integration']).toContain(tool?.category);
  });

  it('toAgentTools filters unknowns and reports them', () => {
    const result = toAgentTools(['search_knowledge', 'nope_123', 'query_datahub']);
    expect(result.tools).toHaveLength(2);
    expect(result.unknown).toEqual(['nope_123']);
  });
});

// ═══ Enriched templates de Vendas ═══════════════════════════════════
const ENRICHED_IDS = [
  'customer_support',
  'lead_qualifier',
  'quote_generator',
  'sales_assistant',
  'spec_vendas_sdr',
  'spec_vendas_closer',
  'spec_vendas_intel',
];

describe('Enriched sales templates', () => {
  for (const id of ENRICHED_IDS) {
    describe(id, () => {
      const t = AGENT_TEMPLATES.find((x) => x.id === id);

      it('exists', () => {
        expect(t).toBeTruthy();
      });

      if (!t) return;

      it('has rich system_prompt (>= 300 chars)', () => {
        expect(t.config.system_prompt.length).toBeGreaterThanOrEqual(300);
      });

      it('has few_shot_examples', () => {
        expect(t.config.few_shot_examples?.length).toBeGreaterThan(0);
      });

      it('has detailed_guardrails with severity', () => {
        expect(t.config.detailed_guardrails?.length).toBeGreaterThan(0);
        for (const g of t.config.detailed_guardrails ?? []) {
          expect(['block', 'warn', 'log']).toContain(g.severity);
          expect(['input_validation', 'output_safety', 'access_control', 'operational']).toContain(
            g.category,
          );
        }
      });

      it('has test_cases across categories', () => {
        const cases = t.config.test_cases ?? [];
        expect(cases.length).toBeGreaterThanOrEqual(3);
        for (const c of cases) {
          expect(['functional', 'safety', 'edge_case', 'regression', 'performance']).toContain(
            c.category,
          );
          expect(c.name.length).toBeGreaterThan(0);
          expect(c.input.length).toBeGreaterThan(0);
          expect(c.expected_behavior.length).toBeGreaterThan(0);
        }
      });

      it('has human_in_loop_triggers', () => {
        expect(t.config.human_in_loop_triggers?.length).toBeGreaterThan(0);
      });

      it('has deploy_channels', () => {
        expect(t.config.deploy_channels?.length).toBeGreaterThan(0);
      });

      it('has budget config', () => {
        expect(typeof t.config.monthly_budget).toBe('number');
        expect(t.config.monthly_budget).toBeGreaterThan(0);
      });

      it('every referenced tool exists in TOOL_CATALOG', () => {
        for (const toolId of t.config.tools ?? []) {
          const resolved = resolveTool(toolId);
          expect(resolved, `Tool "${toolId}" not in TOOL_CATALOG`).not.toBeNull();
        }
      });

      it('reasoning (when set) is a known pattern', () => {
        if (t.config.reasoning) {
          expect(['react', 'cot', 'tot', 'reflection', 'plan_execute', 'smolagent']).toContain(
            t.config.reasoning,
          );
        }
      });

      it('is flagged as enriched', () => {
        expect(t.enriched).toBe(true);
      });
    });
  }
});

// ═══ Reasoning upgrades específicos aplicados no follow-up 5 ═════════
describe('Reasoning upgrades (follow-up #5)', () => {
  it('lead_qualifier has output_validation_schema + json output', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'lead_qualifier');
    expect(t?.config.output_format).toBe('json');
    expect(t?.config.output_validation_schema).toBe(true);
    expect(t?.config.reasoning).toBe('cot');
  });

  it('spec_vendas_closer uses reflection reasoning', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_closer');
    expect(t?.config.reasoning).toBe('reflection');
  });

  it('spec_vendas_intel uses plan_execute reasoning', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_intel');
    expect(t?.config.reasoning).toBe('plan_execute');
  });

  it('quote_generator enables procedural memory for price learning', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'quote_generator');
    expect(t?.config.memory_overrides?.procedural).toBe(true);
  });
});

// ═══ Sub-agents composition (follow-up #3) ═══════════════════════════
describe('Sub-agents composition (follow-up #3)', () => {
  it('spec_vendas_closer declares delegate_to_agent tool', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_closer');
    expect(t?.config.tools).toContain('delegate_to_agent');
  });

  it('spec_vendas_sdr declares delegate_to_agent tool', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_sdr');
    expect(t?.config.tools).toContain('delegate_to_agent');
  });

  it('closer prompt documents its sub-agent delegation', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_closer');
    expect(t?.config.system_prompt).toMatch(/Sub-agentes/i);
    expect(t?.config.system_prompt).toMatch(/quote_generator/);
    expect(t?.config.system_prompt).toMatch(/spec_vendas_intel/);
  });

  it('SDR prompt documents delegation to lead_qualifier', () => {
    const t = AGENT_TEMPLATES.find((x) => x.id === 'spec_vendas_sdr');
    expect(t?.config.system_prompt).toMatch(/lead_qualifier/);
  });
});
