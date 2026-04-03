/**
 * OpenClaw Integration Service
 * Generates SOUL.md + SKILL.md from agent config for deployment to OpenClaw runtime.
 * Also provides API bridge for OpenClaw Gateway communication.
 *
 * Architecture: OpenClaw is a deploy channel (ADR 005), not core infrastructure.
 * Agent config → SOUL.md (personality) + SKILL.md (capabilities) → OpenClaw runtime
 */
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface OpenClawConfig {
  agentId: string;
  agentName: string;
  soulMd: string;
  skills: OpenClawSkill[];
  gatewayUrl?: string;
  apiToken?: string;
  channels: ('whatsapp' | 'telegram' | 'slack' | 'discord' | 'web')[];
}

export interface OpenClawSkill {
  name: string;
  description: string;
  endpoint?: string;
  parameters: { name: string; type: string; description: string; required: boolean }[];
  authentication?: { type: 'bearer' | 'api_key' | 'none'; headerName?: string };
}

export interface SoulMdConfig {
  name: string;
  persona: string;
  mission: string;
  scope: string;
  rules: string[];
  tone: string;
  language: string;
  constraints: string[];
  fallback: string;
}

// ═══ SOUL.MD GENERATOR ═══

/**
 * Generate SOUL.md content from agent configuration.
 * SOUL.md defines the agent's personality, tone, and behavioral rules.
 */
export function generateSoulMd(config: SoulMdConfig): string {
  const rules = config.rules.map((r, i) => `${i + 1}. ${r}`).join('\n');
  const constraints = config.constraints.map(c => `- ${c}`).join('\n');

  return `# ${config.name}

## Persona
${config.persona}

## Mission
${config.mission}

## Scope
${config.scope}

## Rules
${rules}

## Tone
${config.tone}

## Language
${config.language}

## Constraints
${constraints}

## Fallback
${config.fallback}
`;
}

/**
 * Generate SOUL.md from a Nexus agent's full config.
 */
export function agentConfigToSoulMd(agent: {
  name: string;
  persona?: string;
  mission?: string;
  scope?: string;
  system_prompt?: string;
  formality?: number;
  verbosity?: number;
}): string {
  const tone = (agent.formality ?? 50) > 70 ? 'Formal e profissional' : (agent.formality ?? 50) > 40 ? 'Equilibrado' : 'Casual e amigável';
  const verbosity = (agent.verbosity ?? 50) > 70 ? 'Respostas detalhadas e completas' : 'Respostas concisas e diretas';

  return generateSoulMd({
    name: agent.name,
    persona: agent.persona ?? 'Assistente profissional',
    mission: agent.mission ?? 'Ajudar o usuário com suas necessidades',
    scope: agent.scope ?? 'Responder perguntas e executar tarefas dentro do escopo definido',
    rules: [
      'Sempre responda na língua do usuário',
      'Nunca invente informações — se não souber, diga',
      'Escale para humano quando fora do escopo',
      `Tom: ${tone}`,
      `Estilo: ${verbosity}`,
    ],
    tone,
    language: 'pt-BR',
    constraints: [
      'Não revelar dados pessoais de terceiros (LGPD)',
      'Não executar ações destrutivas sem confirmação',
      'Respeitar limites de escopo definidos',
    ],
    fallback: 'Desculpe, não consigo ajudar com isso. Vou encaminhar para um atendente humano.',
  });
}

// ═══ SKILL.MD GENERATOR ═══

/**
 * Generate SKILL.md for a specific tool/capability.
 * SKILL.md files define API integrations that the OpenClaw agent can call.
 */
export function generateSkillMd(skill: OpenClawSkill): string {
  const params = skill.parameters.map(p =>
    `- **${p.name}** (${p.type}${p.required ? ', required' : ', optional'}): ${p.description}`
  ).join('\n');

  const auth = skill.authentication?.type === 'bearer'
    ? `\n## Authentication\nBearer token in Authorization header`
    : skill.authentication?.type === 'api_key'
      ? `\n## Authentication\nAPI key in ${skill.authentication.headerName ?? 'X-API-Key'} header`
      : '';

  return `# ${skill.name}

## Description
${skill.description}

## Endpoint
${skill.endpoint ?? 'N/A'}

## Parameters
${params}
${auth}
`;
}

/**
 * Generate SKILL.md files from agent's enabled tools.
 */
export function agentToolsToSkills(tools: { name: string; type: string; description: string; enabled: boolean }[]): OpenClawSkill[] {
  return tools.filter(t => t.enabled).map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: [
      { name: 'query', type: 'string', description: `Input for ${tool.name}`, required: true },
    ],
    authentication: { type: 'none' as const },
  }));
}

// ═══ OPENCLAW GATEWAY API BRIDGE ═══

const DEFAULT_GATEWAY = 'http://localhost:3007';

/**
 * Send a message to an OpenClaw agent via its Gateway API.
 */
export async function sendMessage(
  message: string,
  config: { gatewayUrl?: string; apiToken?: string; sessionId?: string }
): Promise<{ response: string; sessionId: string; error?: string }> {
  const url = config.gatewayUrl ?? DEFAULT_GATEWAY;
  const sessionId = config.sessionId ?? 'main';

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;

    const resp = await fetch(`${url}/api/sessions/${sessionId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return { response: '', sessionId, error: `OpenClaw Gateway ${resp.status}: ${errText}` };
    }

    const data = await resp.json();
    logger.info(`OpenClaw message sent: "${message.slice(0, 50)}..." → response received`, 'openClaw');
    return { response: data.response ?? data.content ?? JSON.stringify(data), sessionId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Connection failed';
    logger.error(`OpenClaw Gateway error: ${errorMsg}`, err, 'openClaw');
    return { response: '', sessionId, error: `Falha ao conectar com OpenClaw Gateway: ${errorMsg}` };
  }
}

/**
 * Get session history from OpenClaw Gateway.
 */
export async function getSessionHistory(
  config: { gatewayUrl?: string; apiToken?: string; sessionId?: string }
): Promise<{ messages: { role: string; content: string }[]; error?: string }> {
  const url = config.gatewayUrl ?? DEFAULT_GATEWAY;
  const sessionId = config.sessionId ?? 'main';

  try {
    const headers: Record<string, string> = {};
    if (config.apiToken) headers['Authorization'] = `Bearer ${config.apiToken}`;

    const resp = await fetch(`${url}/api/sessions/${sessionId}`, { headers });
    if (!resp.ok) return { messages: [], error: `${resp.status}` };

    const data = await resp.json();
    return { messages: data.messages ?? [] };
  } catch (err) {
    return { messages: [], error: err instanceof Error ? err.message : 'Connection failed' };
  }
}

/**
 * Check if OpenClaw Gateway is running and accessible.
 */
export async function healthCheck(gatewayUrl?: string): Promise<{ online: boolean; version?: string }> {
  try {
    const resp = await fetch(`${gatewayUrl ?? DEFAULT_GATEWAY}/api/health`, { signal: AbortSignal.timeout(5000) });
    if (resp.ok) {
      const data = await resp.json();
      return { online: true, version: data.version };
    }
    return { online: false };
  } catch {
    return { online: false };
  }
}

// ═══ FULL EXPORT PACKAGE ═══

/**
 * Generate a complete OpenClaw deployment package from a Nexus agent.
 */
export function generateDeployPackage(agent: {
  id: string;
  name: string;
  persona?: string;
  mission?: string;
  scope?: string;
  system_prompt?: string;
  formality?: number;
  verbosity?: number;
  tools?: { name: string; type: string; description: string; enabled: boolean }[];
}): { soulMd: string; skills: { name: string; content: string }[]; instructions: string } {
  const soulMd = agentConfigToSoulMd(agent);
  const skills = agentToolsToSkills(agent.tools ?? []);
  const skillFiles = skills.map(s => ({ name: `${s.name.toLowerCase().replace(/\s+/g, '-')}.md`, content: generateSkillMd(s) }));

  const instructions = `# Deploy ${agent.name} no OpenClaw

## Pré-requisitos
1. Instale OpenClaw: \`npx openclaw@latest\`
2. Configure seu LLM provider no OpenClaw

## Passos
1. Copie o SOUL.md para a pasta do seu OpenClaw agent
2. Copie os SKILL.md files para a pasta skills/
3. Reinicie o OpenClaw: \`openclaw restart\`
4. Teste: envie uma mensagem pelo canal configurado

## Arquivos gerados
- SOUL.md — Personalidade e regras do agente
${skillFiles.map(s => `- skills/${s.name} — Skill: ${s.name}`).join('\n')}

## Canais suportados
WhatsApp, Telegram, Slack, Discord, Web Chat
`;

  logger.info(`OpenClaw package generated for "${agent.name}": SOUL.md + ${skillFiles.length} skills`, 'openClaw');

  return { soulMd, skills: skillFiles, instructions };
}

/**
 * Download the deploy package as a ZIP-like structure (JSON with all files).
 */
export function downloadDeployPackage(agent: Parameters<typeof generateDeployPackage>[0]): void {
  const pkg = generateDeployPackage(agent);

  // Create a combined file for download
  const content = `${pkg.instructions}\n\n---\n\n# SOUL.md\n\n${pkg.soulMd}\n\n---\n\n${pkg.skills.map(s => `# skills/${s.name}\n\n${s.content}`).join('\n\n---\n\n')}`;

  const blob = new Blob([content], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `openclaw-${agent.name.toLowerCase().replace(/\s+/g, '-')}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
