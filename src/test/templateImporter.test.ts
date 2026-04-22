import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportError, assertPublicHttpsUrl, importAgentTemplate } from '@/lib/templateImporter';

// ─── Fixtures ─────────────────────────────────────────────────────
const nativeTemplate = {
  id: 'test_native',
  name: 'Template Nativo',
  description: 'Um template de teste',
  icon: '🧪',
  category: 'Teste',
  tags: ['t'],
  config: {
    persona: 'assistant',
    model: 'claude-sonnet-4-6',
    temperature: 0.3,
    system_prompt: 'Você é um agente de teste com prompt suficientemente longo.',
    tools: ['search_knowledge', 'not_a_real_tool'],
    guardrails: [],
    memory_types: ['episodic'],
  },
};

const difyPayload = {
  app: { name: 'Dify Chatbot', description: 'Um chatbot do Dify' },
  model_config: {
    pre_prompt: 'Você é um assistente Dify. Seja gentil e útil.',
    model: { name: 'claude-sonnet-4-6', temperature: 0.5 },
    tools: [{ tool_name: 'web_search' }, { tool_name: 'custom_dify_tool' }],
    user_input_form: [{ type: 'text' }],
  },
};

const n8nPayload = {
  name: 'WF Atendimento',
  nodes: [
    {
      type: '@n8n/n8n-nodes-langchain.agent',
      name: 'AI Agent',
      parameters: {
        systemMessage: 'Você é um agente n8n para atender clientes via WhatsApp.',
        model: { name: 'claude-sonnet-4-6' },
        temperature: 0.4,
      },
    },
    {
      type: 'n8n-nodes-base.httpRequest',
      name: 'call-api',
      parameters: {},
    },
  ],
};

// ─── json_native ──────────────────────────────────────────────────
describe('importAgentTemplate: json_native', () => {
  it('imports a valid payload and flags unknown tools', async () => {
    const res = await importAgentTemplate({ kind: 'json_native', payload: nativeTemplate });
    expect(res.sourceKind).toBe('json_native');
    expect(res.template.id).toBe('test_native');
    expect(res.unknownTools).toEqual(['not_a_real_tool']);
    expect(res.warnings.length).toBeGreaterThan(0); // sem few_shot / test_cases / guardrails
  });

  it('throws ImportError with invalid_payload when required fields are missing', async () => {
    await expect(
      importAgentTemplate({ kind: 'json_native', payload: { id: 'x' } }),
    ).rejects.toMatchObject({ name: 'ImportError', code: 'invalid_payload' });
  });

  it('throws when system_prompt is too short', async () => {
    const bad = {
      ...nativeTemplate,
      config: { ...nativeTemplate.config, system_prompt: 'oi' },
    };
    await expect(importAgentTemplate({ kind: 'json_native', payload: bad })).rejects.toBeInstanceOf(
      ImportError,
    );
  });
});

// ─── markdown_skill ───────────────────────────────────────────────
describe('importAgentTemplate: markdown_skill', () => {
  it('parses frontmatter + body into a raw template', async () => {
    const md = [
      '---',
      'name: Revisor de Código',
      'model: claude-sonnet-4-6',
      'icon: 🔍',
      'category: Dev',
      'tags: code-review, quality',
      '---',
      '',
      '# Revisor',
      '',
      'Você é um revisor de código experiente que analisa PRs.',
    ].join('\n');
    const res = await importAgentTemplate({ kind: 'markdown_skill', content: md });
    expect(res.sourceKind).toBe('markdown_skill');
    expect(res.template.name).toBe('Revisor de Código');
    expect(res.template.icon).toBe('🔍');
    expect(res.template.category).toBe('Dev');
    expect(res.template.tags).toContain('code-review');
    expect(res.template.config.system_prompt).toContain('revisor');
    expect(res.template.config.tools).toEqual([]);
  });

  it('uses H1 as name when frontmatter has none', async () => {
    const md = '# Agente de Teste\n\nVocê é um agente de teste simples.';
    const res = await importAgentTemplate({ kind: 'markdown_skill', content: md });
    expect(res.template.name).toBe('Agente de Teste');
    expect(res.template.config.system_prompt).toContain('Você é um agente de teste');
  });

  it('rejects empty markdown body', async () => {
    await expect(
      importAgentTemplate({ kind: 'markdown_skill', content: '' }),
    ).rejects.toBeInstanceOf(ImportError);
  });
});

// ─── dify ─────────────────────────────────────────────────────────
describe('importAgentTemplate: dify', () => {
  it('maps pre_prompt + tools + warns about user_input_form', async () => {
    const res = await importAgentTemplate({ kind: 'dify', payload: difyPayload });
    expect(res.sourceKind).toBe('dify');
    expect(res.template.name).toBe('Dify Chatbot');
    expect(res.template.config.system_prompt).toContain('assistente Dify');
    expect(res.template.config.tools).toEqual(['web_search', 'custom_dify_tool']);
    expect(res.unknownTools).toContain('custom_dify_tool');
    expect(res.warnings.some((w) => w.includes('user_input_form'))).toBe(true);
  });

  it('throws when dify payload has no prompt', async () => {
    await expect(
      importAgentTemplate({
        kind: 'dify',
        payload: { app: { name: 'x' }, model_config: {} },
      }),
    ).rejects.toMatchObject({ code: 'invalid_payload' });
  });
});

// ─── n8n ──────────────────────────────────────────────────────────
describe('importAgentTemplate: n8n', () => {
  it('extracts systemMessage from the first agent node', async () => {
    const res = await importAgentTemplate({ kind: 'n8n', payload: n8nPayload });
    expect(res.sourceKind).toBe('n8n');
    expect(res.template.config.system_prompt).toContain('atender clientes');
    expect(res.template.config.tools).toEqual(['call_api']);
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  it('throws when no agent node present', async () => {
    await expect(
      importAgentTemplate({
        kind: 'n8n',
        payload: { nodes: [{ type: 'n8n-nodes-base.httpRequest' }] },
      }),
    ).rejects.toMatchObject({ code: 'unsupported_format' });
  });

  it('throws when no nodes at all', async () => {
    await expect(importAgentTemplate({ kind: 'n8n', payload: {} })).rejects.toMatchObject({
      code: 'invalid_payload',
    });
  });
});

// ─── SSRF & URL guards ────────────────────────────────────────────
describe('assertPublicHttpsUrl', () => {
  it('accepts public HTTPS', () => {
    expect(() =>
      assertPublicHttpsUrl('https://raw.githubusercontent.com/x/y/z.json'),
    ).not.toThrow();
  });

  it('rejects HTTP', () => {
    expect(() => assertPublicHttpsUrl('http://example.com/x.json')).toThrow(ImportError);
  });

  it('rejects localhost', () => {
    expect(() => assertPublicHttpsUrl('https://localhost/x')).toThrow(/SSRF|bloqueado/i);
  });

  it('rejects 127.0.0.1', () => {
    expect(() => assertPublicHttpsUrl('https://127.0.0.1/x')).toThrow(/privado|bloqueado/i);
  });

  it('rejects private 10.0.0.0/8', () => {
    expect(() => assertPublicHttpsUrl('https://10.1.2.3/x')).toThrow(/privado/i);
  });

  it('rejects 192.168.x.x', () => {
    expect(() => assertPublicHttpsUrl('https://192.168.1.1/x')).toThrow(/privado/i);
  });

  it('rejects 169.254.x.x (metadata IMDS)', () => {
    expect(() => assertPublicHttpsUrl('https://169.254.169.254/latest/meta-data')).toThrow(
      /privado/i,
    );
  });

  it('rejects malformed URL', () => {
    expect(() => assertPublicHttpsUrl('not-a-url')).toThrow(/URL inválida/i);
  });
});

// ─── json_url (com fetch mockado) ─────────────────────────────────
describe('importAgentTemplate: json_url', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects URL that fails SSRF guard', async () => {
    await expect(
      importAgentTemplate({ kind: 'json_url', url: 'http://localhost/x.json' }),
    ).rejects.toMatchObject({ code: 'invalid_url' });
  });

  it('fetches and auto-detects native format', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify(nativeTemplate), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    const res = await importAgentTemplate({
      kind: 'json_url',
      url: 'https://raw.githubusercontent.com/foo/bar/template.json',
    });
    expect(res.sourceKind).toBe('json_native');
    expect(res.template.id).toBe('test_native');
  });

  it('surfaces fetch_failed on non-2xx', async () => {
    global.fetch = vi.fn(
      async () => new Response('not found', { status: 404 }),
    ) as unknown as typeof fetch;

    await expect(
      importAgentTemplate({ kind: 'json_url', url: 'https://example.com/missing.json' }),
    ).rejects.toMatchObject({ code: 'fetch_failed' });
  });

  it('rejects when body is not JSON', async () => {
    global.fetch = vi.fn(
      async () => new Response('<html>', { status: 200 }),
    ) as unknown as typeof fetch;

    await expect(
      importAgentTemplate({ kind: 'json_url', url: 'https://example.com/x.json' }),
    ).rejects.toMatchObject({ code: 'invalid_payload' });
  });

  it('rejects unrecognized JSON format', async () => {
    global.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ foo: 'bar' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    ) as unknown as typeof fetch;

    await expect(
      importAgentTemplate({ kind: 'json_url', url: 'https://example.com/unknown.json' }),
    ).rejects.toMatchObject({ code: 'unsupported_format' });
  });
});
