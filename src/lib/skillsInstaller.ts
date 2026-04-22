/**
 * Skills Installer — `src/lib/skillsInstaller.ts`
 *
 * Converte uma `AgentSkillDefinition` do registry num **patch** de
 * `AgentConfig`: adiciona tools, guardrails, prompts e canais novos,
 * sem sobrescrever o que já existe.
 *
 * Idempotente: instalar a mesma skill duas vezes deixa o agente igual.
 *
 * Os recursos da skill vêm em `skill_config` (shape tipado abaixo).
 * Tools desconhecidas (fora do TOOL_CATALOG) são devolvidas em
 * `unknown_tools` como warning.
 */
import { resolveTool, toAgentTool } from '@/data/toolCatalog';
import type { AgentConfig, AgentTool, GuardrailConfig } from '@/types/agentTypes';
import type { AgentSkillDefinition } from '@/services/skillsRegistryService';

export interface SkillConfigPayload {
  tools?: string[];
  guardrails?: Array<Omit<GuardrailConfig, 'id' | 'enabled'> & { enabled?: boolean }>;
  system_prompt_append?: string;
  deploy_channels?: string[];
  tags?: string[];
}

export interface InstallResult {
  agent: AgentConfig;
  added_tools: string[];
  unknown_tools: string[];
  added_guardrails: string[];
  appended_prompt: boolean;
  applied_tags: string[];
}

function toSkillPayload(skill: AgentSkillDefinition): SkillConfigPayload {
  const raw = (skill.skill_config ?? {}) as Record<string, unknown>;
  return {
    tools: Array.isArray(raw.tools) ? (raw.tools as string[]) : undefined,
    guardrails: Array.isArray(raw.guardrails)
      ? (raw.guardrails as SkillConfigPayload['guardrails'])
      : undefined,
    system_prompt_append:
      typeof raw.system_prompt_append === 'string' ? raw.system_prompt_append : undefined,
    deploy_channels: Array.isArray(raw.deploy_channels)
      ? (raw.deploy_channels as string[])
      : undefined,
    tags: Array.isArray(raw.tags) ? (raw.tags as string[]) : undefined,
  };
}

export function installSkill(agent: AgentConfig, skill: AgentSkillDefinition): InstallResult {
  const payload = toSkillPayload(skill);
  const next = { ...agent };
  const addedTools: string[] = [];
  const unknownTools: string[] = [];
  const addedGuardrails: string[] = [];
  const appliedTags: string[] = [];

  // Tools ──────────────────────────────────────────
  if (payload.tools?.length) {
    const existingIds = new Set(agent.tools.map((t) => t.id));
    const newTools: AgentTool[] = [];
    for (const toolId of payload.tools) {
      if (existingIds.has(toolId)) continue;
      const resolved = toAgentTool(toolId);
      if (resolved) {
        newTools.push(resolved);
        addedTools.push(toolId);
        existingIds.add(toolId);
      } else if (resolveTool(toolId) === null) {
        unknownTools.push(toolId);
      }
    }
    if (newTools.length > 0) next.tools = [...agent.tools, ...newTools];
  }

  // Guardrails ─────────────────────────────────────
  if (payload.guardrails?.length) {
    const existingNames = new Set(agent.guardrails.map((g) => g.name));
    const added: GuardrailConfig[] = [];
    for (const g of payload.guardrails) {
      if (existingNames.has(g.name)) continue;
      added.push({
        id: `skill_${skill.slug}_${g.name}`.replace(/\s+/g, '_').toLowerCase(),
        category: g.category,
        name: g.name,
        description: g.description ?? '',
        enabled: g.enabled ?? true,
        severity: g.severity,
        config: g.config,
      });
      addedGuardrails.push(g.name);
      existingNames.add(g.name);
    }
    if (added.length > 0) next.guardrails = [...agent.guardrails, ...added];
  }

  // Prompt append ─────────────────────────────────
  let appended = false;
  if (payload.system_prompt_append) {
    const marker = `\n<!-- skill:${skill.slug}@${skill.version} -->\n`;
    if (!agent.system_prompt.includes(marker)) {
      next.system_prompt = `${agent.system_prompt}\n\n${marker}${payload.system_prompt_append.trim()}\n`;
      appended = true;
    }
  }

  // Tags ──────────────────────────────────────────
  const nextTags = new Set<string>(agent.tags ?? []);
  for (const tag of payload.tags ?? []) {
    if (!nextTags.has(tag)) {
      nextTags.add(tag);
      appliedTags.push(tag);
    }
  }
  nextTags.add(`skill:${skill.slug}`);
  next.tags = Array.from(nextTags);

  return {
    agent: next,
    added_tools: addedTools,
    unknown_tools: unknownTools,
    added_guardrails: addedGuardrails,
    appended_prompt: appended,
    applied_tags: appliedTags,
  };
}

export function uninstallSkill(agent: AgentConfig, skill: AgentSkillDefinition): AgentConfig {
  const tagToRemove = `skill:${skill.slug}`;
  const marker = `<!-- skill:${skill.slug}@${skill.version} -->`;
  const guardrailIdPrefix = `skill_${skill.slug}_`;
  return {
    ...agent,
    tags: (agent.tags ?? []).filter((t) => t !== tagToRemove),
    guardrails: agent.guardrails.filter((g) => !g.id.startsWith(guardrailIdPrefix)),
    system_prompt: agent.system_prompt.split(marker)[0].trimEnd(),
  };
}
