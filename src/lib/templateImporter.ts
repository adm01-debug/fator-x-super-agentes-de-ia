/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Template Importer
 * ═══════════════════════════════════════════════════════════════
 * Importa skills / templates de agentes de fontes externas e converte
 * para `AgentTemplateRaw`. Adaptadores plugáveis:
 *
 * - json_native     — payload já em formato AgentTemplateRaw.
 * - json_url        — fetch remoto (HTTPS + SSRF-safe) e auto-detecção.
 * - markdown_skill  — markdown estilo Claude Skill / awesome-prompts
 *                     (com YAML frontmatter opcional).
 * - dify            — export de app Dify (mapeamento best-effort).
 * - n8n             — workflow n8n com nodes openAi/langchain-agent.
 *
 * O resultado é `ImportResult` com o template, tools não catalogadas e
 * warnings de mapeamentos aproximados.
 */
import { z } from 'zod';
import type { AgentTemplateRaw } from '@/data/agentTemplates';
import { resolveTool } from '@/data/toolCatalog';

// ─── Tipos ───────────────────────────────────────────────────────
export type ImportSource =
  | { kind: 'json_native'; payload: unknown }
  | { kind: 'json_url'; url: string }
  | { kind: 'markdown_skill'; content: string; name?: string; icon?: string }
  | { kind: 'dify'; payload: unknown }
  | { kind: 'n8n'; payload: unknown };

export interface ImportResult {
  template: AgentTemplateRaw;
  unknownTools: string[];
  warnings: string[];
  sourceKind: ImportSource['kind'];
}

export class ImportError extends Error {
  constructor(
    message: string,
    public readonly code:
      | 'invalid_payload'
      | 'invalid_url'
      | 'ssrf_blocked'
      | 'fetch_failed'
      | 'too_large'
      | 'unsupported_format',
  ) {
    super(message);
    this.name = 'ImportError';
  }
}

// ─── Schema Zod para AgentTemplateRaw ──────────────────────────────
const fewShotSchema = z.object({
  input: z.string().min(1),
  expected_output: z.string().min(1),
  tags: z.array(z.string()).optional(),
});

const guardrailSchema = z.object({
  id: z.string().optional(),
  category: z.enum(['input_validation', 'output_safety', 'access_control', 'operational']),
  name: z.string().min(1),
  description: z.string().optional(),
  severity: z.enum(['block', 'warn', 'log']),
  config: z.record(z.unknown()).optional(),
});

const deployChannelSchema = z.object({
  channel: z.enum([
    'api',
    'whatsapp',
    'web_chat',
    'slack',
    'email',
    'bitrix24',
    'telegram',
    'discord',
    'huggingface_space',
  ]),
  config: z.record(z.string()).optional(),
});

const testCaseSchema = z.object({
  name: z.string().min(1),
  input: z.string().min(1),
  expected_behavior: z.string().min(1),
  category: z.enum(['functional', 'safety', 'edge_case', 'regression', 'performance']),
  tags: z.array(z.string()).optional(),
});

export const agentTemplateRawSchema: z.ZodType<AgentTemplateRaw> = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  description: z.string().min(1).max(500),
  icon: z.string().min(1).max(8),
  category: z.string().min(1).max(80),
  tags: z.array(z.string()).default([]),
  config: z.object({
    persona: z.string().min(1),
    model: z.string().min(1),
    temperature: z.number().min(0).max(2),
    system_prompt: z.string().min(10),
    tools: z.array(z.string()).default([]),
    guardrails: z.array(z.string()).default([]),
    memory_types: z.array(z.string()).default([]),
    few_shot_examples: z.array(fewShotSchema).optional(),
    detailed_guardrails: z.array(guardrailSchema).optional(),
    deploy_channels: z.array(deployChannelSchema).optional(),
    test_cases: z.array(testCaseSchema).optional(),
    human_in_loop_triggers: z.array(z.string()).optional(),
    monthly_budget: z.number().positive().optional(),
    budget_alert_threshold: z.number().min(0).max(100).optional(),
    memory_overrides: z
      .object({
        short_term: z.boolean().optional(),
        episodic: z.boolean().optional(),
        semantic: z.boolean().optional(),
        procedural: z.boolean().optional(),
        profile: z.boolean().optional(),
        shared: z.boolean().optional(),
      })
      .optional(),
  }),
}) as unknown as z.ZodType<AgentTemplateRaw>;

// ─── Helpers ─────────────────────────────────────────────────────
const MAX_PAYLOAD_BYTES = 256 * 1024;
const FETCH_TIMEOUT_MS = 10_000;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60) || `import_${Date.now()}`
  );
}

function collectUnknownTools(toolIds: string[]): string[] {
  const unknown: string[] = [];
  for (const id of toolIds) {
    if (!resolveTool(id)) unknown.push(id);
  }
  return unknown;
}

/**
 * Validação SSRF: bloqueia URLs para IPs privados / loopback.
 * Ref: RFC 1918, RFC 4193, RFC 6890.
 */
export function assertPublicHttpsUrl(urlStr: string): URL {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new ImportError('URL inválida', 'invalid_url');
  }
  if (url.protocol !== 'https:') {
    throw new ImportError('Apenas URLs HTTPS são aceitas', 'invalid_url');
  }
  const host = url.hostname.toLowerCase();
  const blockedHosts = new Set([
    'localhost',
    '0.0.0.0',
    'broadcasthost',
    '::1',
    'ip6-localhost',
    'ip6-loopback',
  ]);
  if (blockedHosts.has(host)) {
    throw new ImportError(`Host bloqueado por política SSRF: ${host}`, 'ssrf_blocked');
  }
  // IPv4 privados / loopback / link-local / metadata.
  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    const privateV4 =
      a === 10 ||
      a === 127 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      a === 0 ||
      a >= 224; // multicast + reserved
    if (privateV4) {
      throw new ImportError(`IP privado bloqueado: ${host}`, 'ssrf_blocked');
    }
  }
  // IPv6 loopback / link-local simples.
  if (
    host.includes(':') &&
    (host.startsWith('fe80') || host.startsWith('fc') || host.startsWith('fd'))
  ) {
    throw new ImportError(`IPv6 privado bloqueado: ${host}`, 'ssrf_blocked');
  }
  return url;
}

async function fetchJsonSafe(urlStr: string): Promise<unknown> {
  const url = assertPublicHttpsUrl(urlStr);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { 'User-Agent': 'Nexus-Agent-Importer/1.0', Accept: 'application/json, text/plain' },
      signal: controller.signal,
      redirect: 'error', // bloqueia redirect para evitar SSRF via redirect
    });
    if (!res.ok) {
      throw new ImportError(`Fetch falhou (${res.status})`, 'fetch_failed');
    }
    const text = await res.text();
    if (text.length > MAX_PAYLOAD_BYTES) {
      throw new ImportError(`Resposta > ${MAX_PAYLOAD_BYTES} bytes`, 'too_large');
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new ImportError('Corpo não é JSON válido', 'invalid_payload');
    }
  } catch (err) {
    if (err instanceof ImportError) throw err;
    const msg = err instanceof Error ? err.message : String(err);
    throw new ImportError(`Falha de rede: ${msg}`, 'fetch_failed');
  } finally {
    clearTimeout(timer);
  }
}

// ─── Adaptadores ─────────────────────────────────────────────────
function adaptNativeJson(payload: unknown): ImportResult {
  const parsed = agentTemplateRawSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ImportError(
      `Payload inválido: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
      'invalid_payload',
    );
  }
  const template = parsed.data;
  const unknownTools = collectUnknownTools(template.config.tools ?? []);
  const warnings: string[] = [];
  if (!template.config.few_shot_examples?.length) warnings.push('Sem few_shot_examples.');
  if (!template.config.test_cases?.length) warnings.push('Sem test_cases.');
  if (!template.config.detailed_guardrails?.length) warnings.push('Sem detailed_guardrails.');
  return { template, unknownTools, warnings, sourceKind: 'json_native' };
}

/**
 * Parseia markdown com frontmatter YAML simples (key: value).
 * Não usamos `js-yaml` para evitar dependência extra.
 */
function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const match = raw.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: raw.trim() };
  const [, fm, body] = match;
  const meta: Record<string, string> = {};
  for (const line of fm.split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.+?)\s*$/);
    if (m) meta[m[1].toLowerCase()] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: body.trim() };
}

function adaptMarkdownSkill(
  source: Extract<ImportSource, { kind: 'markdown_skill' }>,
): ImportResult {
  const warnings: string[] = [];
  const { meta, body } = parseFrontmatter(source.content);
  // Nome: frontmatter.name > primeiro H1 > source.name > "Skill Importada"
  const h1 = body.match(/^#\s+(.+?)\s*$/m)?.[1];
  const name = meta.name || h1 || source.name || 'Skill Importada';
  const description =
    meta.description || body.split(/\n\n/)[0].replace(/^#.+$/m, '').trim().slice(0, 300) || name;
  const icon = meta.icon || source.icon || '🧩';
  const category = meta.category || 'Importados';
  const tags = meta.tags
    ? meta.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : ['importado'];
  const model = meta.model || 'claude-sonnet-4-6';
  const persona = meta.persona || 'assistant';

  // Remove H1 inicial e frontmatter do corpo para virar system_prompt.
  const systemPrompt = body.replace(/^#\s+.+?\s*$/m, '').trim() || body.trim();
  if (systemPrompt.length < 10) {
    throw new ImportError('Markdown vazio ou sem corpo utilizável', 'invalid_payload');
  }

  warnings.push('Markdown-skill → template "raso": tools/guardrails/test_cases ficam vazios.');
  if (systemPrompt.length > 8000)
    warnings.push('Prompt > 8000 chars — considere dividir em few-shot.');

  const template: AgentTemplateRaw = {
    id: meta.id || slugify(name),
    name,
    description,
    icon,
    category,
    tags,
    config: {
      persona,
      model,
      temperature: meta.temperature ? Number(meta.temperature) : 0.4,
      system_prompt: systemPrompt,
      tools: [],
      guardrails: [],
      memory_types: [],
    },
  };
  return { template, unknownTools: [], warnings, sourceKind: 'markdown_skill' };
}

/** Dify app export (JSON). Formato: `{ app: { name, ... }, model_config: { prompt_template, ... } }`. */
function adaptDify(payload: unknown): ImportResult {
  const warnings: string[] = [];
  const p = payload as Record<string, unknown>;
  const app = (p?.app ?? p) as Record<string, unknown>;
  const modelConfig = (p?.model_config ?? p?.modelConfig ?? {}) as Record<string, unknown>;

  const name = String(app.name ?? 'Dify Importado');
  const description = String(app.description ?? `Importado do Dify — ${name}`);
  const systemPrompt = String(
    modelConfig.pre_prompt ?? modelConfig.prompt_template ?? modelConfig.system ?? '',
  ).trim();
  if (systemPrompt.length < 10) {
    throw new ImportError('Dify: prompt_template / pre_prompt vazio ou ausente', 'invalid_payload');
  }

  const model = String((modelConfig.model as Record<string, unknown>)?.name ?? 'claude-sonnet-4-6');
  const temperature = Number((modelConfig.model as Record<string, unknown>)?.temperature ?? 0.4);

  // Tools do Dify: array de { tool_name } ou { provider_id, tool_name }.
  const difyTools = Array.isArray(modelConfig.tools)
    ? (modelConfig.tools as Array<Record<string, unknown>>)
    : [];
  const toolIds: string[] = [];
  for (const t of difyTools) {
    const toolName = String(t.tool_name ?? t.name ?? '');
    if (!toolName) continue;
    // Heurística: mapear nome exato se existir no catálogo, senão adicionar como unknown.
    toolIds.push(slugify(toolName));
  }

  if ((modelConfig as Record<string, unknown>).user_input_form) {
    warnings.push('Dify user_input_form descartado (sem equivalente direto).');
  }
  if ((modelConfig as Record<string, unknown>).dataset_configs) {
    warnings.push('Dify dataset_configs detectado — configure RAG manualmente após importar.');
  }

  const template: AgentTemplateRaw = {
    id: slugify(`dify_${name}`),
    name,
    description: description.slice(0, 500),
    icon: '🧩',
    category: 'Importados',
    tags: ['dify', 'importado'],
    config: {
      persona: 'assistant',
      model,
      temperature,
      system_prompt: systemPrompt,
      tools: toolIds,
      guardrails: [],
      memory_types: ['episodic'],
    },
  };

  const unknownTools = collectUnknownTools(toolIds);
  return { template, unknownTools, warnings, sourceKind: 'dify' };
}

/** n8n workflow JSON: extrai system prompt do primeiro node de agente. */
function adaptN8n(payload: unknown): ImportResult {
  const warnings: string[] = [];
  const p = payload as Record<string, unknown>;
  const nodes = Array.isArray(p?.nodes) ? (p.nodes as Array<Record<string, unknown>>) : [];
  if (!nodes.length) {
    throw new ImportError('n8n: workflow sem nodes', 'invalid_payload');
  }
  const agentNodeTypes = ['@n8n/n8n-nodes-langchain.agent', 'n8n-nodes-base.openAi'];
  const agentNode = nodes.find((n) => agentNodeTypes.includes(String(n.type ?? '')));
  if (!agentNode) {
    throw new ImportError(
      'n8n: nenhum node de agente (langchain.agent / openAi) encontrado',
      'unsupported_format',
    );
  }
  const params = (agentNode.parameters ?? {}) as Record<string, unknown>;
  const systemPrompt = String(
    params.systemMessage ?? params.system ?? params.prompt ?? params.messages ?? '',
  ).trim();
  if (systemPrompt.length < 10) {
    throw new ImportError('n8n: systemMessage vazio no node de agente', 'invalid_payload');
  }
  const name = String(p.name ?? agentNode.name ?? 'n8n Importado');

  // Tools: outros nodes que não são o agent (best-effort).
  const toolIds: string[] = [];
  for (const n of nodes) {
    if (n === agentNode) continue;
    const t = String(n.type ?? '');
    if (!t) continue;
    // Simplificado: nome do node → slug. Usuário decide mapeamento real.
    toolIds.push(
      slugify(
        String(n.name ?? t)
          .split('.')
          .pop() ?? 'unknown_tool',
      ),
    );
  }
  warnings.push(
    'n8n: tools extraídas por nome de node — revise cada mapeamento com o TOOL_CATALOG.',
  );
  warnings.push('n8n: credentials e bindings de workflow descartados.');

  const template: AgentTemplateRaw = {
    id: slugify(`n8n_${name}`),
    name,
    description: `Importado do n8n — ${name}`,
    icon: '🔗',
    category: 'Importados',
    tags: ['n8n', 'importado'],
    config: {
      persona: 'assistant',
      model: String((params.model as Record<string, unknown>)?.name ?? 'claude-sonnet-4-6'),
      temperature: Number((params.temperature as number) ?? 0.4),
      system_prompt: systemPrompt,
      tools: toolIds,
      guardrails: [],
      memory_types: ['episodic'],
    },
  };
  const unknownTools = collectUnknownTools(toolIds);
  return { template, unknownTools, warnings, sourceKind: 'n8n' };
}

/** Tenta identificar o formato por heurística das chaves presentes. */
function detectFormat(payload: unknown): 'native' | 'dify' | 'n8n' | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  if (
    'config' in p &&
    'id' in p &&
    'name' in p &&
    typeof (p.config as Record<string, unknown>)?.system_prompt === 'string'
  ) {
    return 'native';
  }
  if (('model_config' in p || 'modelConfig' in p) && ('app' in p || 'name' in p)) {
    return 'dify';
  }
  if (
    Array.isArray(p.nodes) &&
    p.nodes.some((n: Record<string, unknown>) => String(n.type ?? '').includes('n8n'))
  ) {
    return 'n8n';
  }
  return null;
}

// ─── API pública ─────────────────────────────────────────────────
export async function importAgentTemplate(source: ImportSource): Promise<ImportResult> {
  switch (source.kind) {
    case 'json_native':
      return adaptNativeJson(source.payload);
    case 'markdown_skill':
      return adaptMarkdownSkill(source);
    case 'dify':
      return adaptDify(source.payload);
    case 'n8n':
      return adaptN8n(source.payload);
    case 'json_url': {
      const payload = await fetchJsonSafe(source.url);
      const fmt = detectFormat(payload);
      if (fmt === 'native') return adaptNativeJson(payload);
      if (fmt === 'dify') return adaptDify(payload);
      if (fmt === 'n8n') return adaptN8n(payload);
      throw new ImportError(
        'Não foi possível detectar o formato do JSON (native / dify / n8n)',
        'unsupported_format',
      );
    }
    default: {
      // Exaustividade para futuras variantes.
      const _never: never = source;
      throw new ImportError(
        `Fonte não suportada: ${String((_never as ImportSource).kind)}`,
        'unsupported_format',
      );
    }
  }
}
