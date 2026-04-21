/**
 * Nexus Agents Studio — Agent Version Validator
 *
 * Função pura, reutilizável, executada ANTES de salvar uma versão (rascunho
 * local ou versão real persistida). Detecta:
 *   - Placeholders ausentes ({{var}} não resolvidos pelo compilador).
 *   - Tamanho mínimo/máximo de prompt, label e nota.
 *   - Inconsistências entre módulos do agente (RAG, tools, modelo, memória).
 *
 * Sem dependências de UI. Mensagens em PT-BR, alinhadas a `getPromptIssues`.
 */
import type { AgentConfig } from '@/types/agentTypes';
import {
  analyzePromptStructure,
  PROMPT_LIMITS,
} from '@/lib/validations/promptSanitizer';
import { compilePrompt } from '@/lib/promptCompiler';

export const VERSION_LIMITS = {
  LABEL_MIN: 3,
  LABEL_MAX: 80,
  NOTE_MAX: 500,
} as const;

export type VersionIssueLevel = 'error' | 'warning';

export interface VersionValidationIssue {
  level: VersionIssueLevel;
  code: string;
  field?: 'label' | 'note' | 'system_prompt' | 'rag' | 'tools' | 'model' | 'memory' | 'guardrails';
  message: string;
}

export interface VersionValidationResult {
  errors: VersionValidationIssue[];
  warnings: VersionValidationIssue[];
  canSave: boolean;
}

const EXPENSIVE_MODELS: ReadonlyArray<string> = ['claude-opus-4.6', 'gpt-4o'];

/**
 * Valida o estado atual do agente + metadados do rascunho.
 *
 * @param agent  estado completo do AgentBuilder
 * @param meta   { label, note } digitados pelo usuário no dialog
 */
export function validateAgentVersion(
  agent: AgentConfig,
  meta: { label: string; note?: string },
): VersionValidationResult {
  const errors: VersionValidationIssue[] = [];
  const warnings: VersionValidationIssue[] = [];

  // ─── Label ───────────────────────────────────────────────
  const labelTrim = (meta.label ?? '').trim();
  if (labelTrim.length > 0 && labelTrim.length < VERSION_LIMITS.LABEL_MIN) {
    errors.push({
      level: 'error',
      code: 'label.too_short',
      field: 'label',
      message: `Título do rascunho precisa de ao menos ${VERSION_LIMITS.LABEL_MIN} caracteres (atual: ${labelTrim.length}).`,
    });
  }
  if (labelTrim.length > VERSION_LIMITS.LABEL_MAX) {
    errors.push({
      level: 'error',
      code: 'label.too_long',
      field: 'label',
      message: `Título do rascunho ultrapassa ${VERSION_LIMITS.LABEL_MAX} caracteres (atual: ${labelTrim.length}).`,
    });
  }

  // ─── Nota ────────────────────────────────────────────────
  const noteTrim = (meta.note ?? '').trim();
  if (noteTrim.length > VERSION_LIMITS.NOTE_MAX) {
    errors.push({
      level: 'error',
      code: 'note.too_long',
      field: 'note',
      message: `Anotação ultrapassa ${VERSION_LIMITS.NOTE_MAX} caracteres (atual: ${noteTrim.length}).`,
    });
  }

  // ─── Prompt: tamanho mínimo / máximo / linhas ────────────
  const prompt = (agent.system_prompt ?? '') as string;
  const promptStats = analyzePromptStructure(prompt);

  if (promptStats.belowMin) {
    errors.push({
      level: 'error',
      code: 'prompt.too_short',
      field: 'system_prompt',
      message: `Prompt abaixo do mínimo (${promptStats.charCount}/${PROMPT_LIMITS.MIN_TOTAL} caracteres).`,
    });
  }
  if (promptStats.exceedsCharLimit) {
    errors.push({
      level: 'error',
      code: 'prompt.too_long',
      field: 'system_prompt',
      message: `Prompt excede o máximo de ${PROMPT_LIMITS.MAX_TOTAL.toLocaleString('pt-BR')} caracteres (atual: ${promptStats.charCount.toLocaleString('pt-BR')}).`,
    });
  }
  if (promptStats.exceedsLineLimit) {
    errors.push({
      level: 'error',
      code: 'prompt.too_many_lines',
      field: 'system_prompt',
      message: `Prompt excede ${PROMPT_LIMITS.MAX_LINES} linhas (atual: ${promptStats.lineCount}).`,
    });
  }
  if (promptStats.consecutiveEmptyBlocks > 0) {
    warnings.push({
      level: 'warning',
      code: 'prompt.empty_blocks',
      field: 'system_prompt',
      message: `Mais de ${PROMPT_LIMITS.MAX_EMPTY_BLOCK} linhas em branco consecutivas — considere limpar.`,
    });
  }

  // ─── Placeholders ausentes ──────────────────────────────
  try {
    const compiled = compilePrompt({
      name: (agent.name ?? '') as string,
      emoji: (agent.avatar_emoji ?? '') as string,
      mission: (agent.mission ?? '') as string,
      description: (agent as unknown as Record<string, unknown>).description as string | undefined,
      type: (agent.persona ?? '') as string,
      model: (agent.model ?? '') as string,
      prompt,
    });
    if (compiled.unresolvedVariables.length > 0) {
      const list = compiled.unresolvedVariables.map((v) => `{{${v}}}`).join(', ');
      errors.push({
        level: 'error',
        code: 'prompt.unresolved_vars',
        field: 'system_prompt',
        message: `Placeholders não resolvidos no prompt: ${list}.`,
      });
    }
  } catch {
    // compilePrompt é puro — falha aqui é improvável; ignora silenciosamente.
  }

  // ─── Inconsistências (apenas warnings) ──────────────────
  const ragSources = Array.isArray(agent.rag_sources) ? agent.rag_sources : [];
  const ragArch = (agent as unknown as Record<string, unknown>).rag_architecture as string | undefined;
  if (ragSources.length === 0 && ragArch && ragArch !== 'none' && ragArch !== 'naive') {
    warnings.push({
      level: 'warning',
      code: 'config.rag_no_sources',
      field: 'rag',
      message: `Arquitetura RAG "${ragArch}" ativa, mas nenhuma fonte cadastrada.`,
    });
  }

  const tools = Array.isArray(agent.tools) ? agent.tools : [];
  const enabledTools = tools.filter((t: { enabled?: boolean }) => t?.enabled);
  const reasoning = (agent as unknown as Record<string, unknown>).reasoning as string | undefined;
  if (enabledTools.length === 0 && reasoning === 'react') {
    warnings.push({
      level: 'warning',
      code: 'config.react_without_tools',
      field: 'tools',
      message: 'Padrão de raciocínio ReAct ativo sem nenhuma ferramenta habilitada.',
    });
  }

  const model = (agent.model ?? '') as string;
  if (
    EXPENSIVE_MODELS.includes(model) &&
    enabledTools.length === 0 &&
    promptStats.charCount < 200
  ) {
    warnings.push({
      level: 'warning',
      code: 'config.expensive_for_simple',
      field: 'model',
      message: `Modelo "${model}" é caro para uma configuração simples (sem tools, prompt curto).`,
    });
  }

  const guardrails = Array.isArray(agent.guardrails) ? agent.guardrails : [];
  const enabledGuards = guardrails.filter((g: { enabled?: boolean }) => g?.enabled);
  if (enabledGuards.length === 0 && agent.status === 'production') {
    warnings.push({
      level: 'warning',
      code: 'config.production_no_guardrails',
      field: 'guardrails',
      message: 'Agente em produção sem nenhum guardrail ativo.',
    });
  }

  const a = agent as unknown as Record<string, unknown>;
  const longTermMemory = Boolean(a.memory_episodic) || Boolean(a.memory_semantic);
  const shortTermMemory = Boolean(a.memory_short_term);
  if (longTermMemory && !shortTermMemory) {
    warnings.push({
      level: 'warning',
      code: 'config.long_term_without_short',
      field: 'memory',
      message: 'Memória de longo prazo ativa, mas memória de curto prazo está desligada.',
    });
  }

  const nameLower = ((agent.name ?? '') as string).trim().toLowerCase();
  const promptLower = prompt.toLowerCase();
  if (
    nameLower.length > 0 &&
    !promptLower.includes(nameLower) &&
    !promptLower.includes('{{name}}') &&
    !promptLower.includes('{{agent_name}}')
  ) {
    warnings.push({
      level: 'warning',
      code: 'prompt.no_identity',
      field: 'system_prompt',
      message: 'O prompt não menciona o nome do agente nem o placeholder {{name}}.',
    });
  }

  return {
    errors,
    warnings,
    canSave: errors.length === 0,
  };
}
