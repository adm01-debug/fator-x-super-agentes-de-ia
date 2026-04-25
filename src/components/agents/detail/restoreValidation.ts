/**
 * restoreValidation — valida a configuração resultante de um rollback ANTES
 * que o usuário confirme. Bloqueia (errors) quando o estado pós-restore seria
 * inválido/incompatível; alerta (warnings) quando o restore é tecnicamente
 * possível mas arriscado.
 *
 * Estratégia: simulamos o merge que `restoreAgentVersion` fará (current ←
 * source apenas para os grupos marcados) e rodamos checagens estruturais
 * sobre o objeto resultante, mais checagens cruzadas (ex.: parâmetro válido
 * para o modelo escolhido).
 */
import type { AgentVersion } from '@/services/agentsService';

export type IssueSeverity = 'error' | 'warning';

/**
 * Ação de correção rápida emitida junto com uma `ValidationIssue`.
 *
 * O `kind` é discriminado para que o handler na página possa rotear
 * para a operação correta (atualizar checkbox de grupo OU registrar um
 * override numérico/string que será aplicado por `restoreAgentVersion`).
 *
 * Cada fix carrega um `label` curto (texto do botão) e um `description`
 * opcional (tooltip explicando o efeito) — dispostos lado a lado abaixo
 * do detalhe da issue no `RestoreValidationPanel`.
 */
export type QuickFix =
  | { kind: 'uncheck-prompt'; label: string; description?: string }
  | { kind: 'uncheck-tools'; label: string; description?: string }
  | { kind: 'uncheck-model'; label: string; description?: string }
  | { kind: 'set-temperature'; value: number; label: string; description?: string }
  | { kind: 'set-max-tokens'; value: number; label: string; description?: string }
  | { kind: 'clear-reasoning'; label: string; description?: string }
  | { kind: 'set-model'; value: string; label: string; description?: string };

export interface ValidationIssue {
  /** ID estável — usado para keys de lista e para deduplicação. */
  id: string;
  severity: IssueSeverity;
  /** Grupo de origem do problema — facilita destacar o checkbox. */
  group: 'prompt' | 'tools' | 'model' | 'general';
  title: string;
  /** Texto longo explicando o problema e como resolver. */
  detail: string;
  /** Sugestão acionável curta (ex.: "Marque também 'Modelo'"). */
  hint?: string;
  /** Correções rápidas aplicáveis com 1 clique. */
  quickFixes?: QuickFix[];
}

export interface RestoreValidation {
  issues: ValidationIssue[];
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  /** True se algum erro bloqueante foi encontrado. */
  blocked: boolean;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Catálogo de capacidades por família de modelo                      */
/* ─────────────────────────────────────────────────────────────────── */

interface ModelCaps {
  /** Aceita parâmetro `reasoning` (Claude 3.7+, GPT-5, Gemini 2.5 Thinking). */
  supportsReasoning: boolean;
  /** Aceita `temperature` customizada (alguns reasoning models não aceitam). */
  supportsTemperature: boolean;
  /** Limite máximo prático de `max_tokens` para resposta. */
  maxTokensCap: number;
  /** Família/provider canônico para detectar troca cross-provider. */
  family: string;
}

/** Heurística baseada no nome — basta para travar combinações claramente quebradas. */
function detectModelCaps(modelRaw: string | null | undefined): ModelCaps {
  const m = String(modelRaw ?? '').toLowerCase();

  // Reasoning models — não aceitam temperature customizada
  if (/^o[1-9]|gpt-5|gpt-4\.5/.test(m)) {
    return { supportsReasoning: true, supportsTemperature: false, maxTokensCap: 100_000, family: 'openai' };
  }
  if (/^gpt/.test(m)) {
    return { supportsReasoning: false, supportsTemperature: true, maxTokensCap: 16_384, family: 'openai' };
  }
  if (/claude/.test(m)) {
    // Claude 3.7+ aceita extended thinking
    const hasThinking = /3\.7|sonnet-4|opus-4|claude-4/.test(m);
    return { supportsReasoning: hasThinking, supportsTemperature: true, maxTokensCap: 64_000, family: 'anthropic' };
  }
  if (/gemini/.test(m)) {
    const isThinking = /2\.5|thinking|3\./.test(m);
    return { supportsReasoning: isThinking, supportsTemperature: true, maxTokensCap: 65_536, family: 'google' };
  }
  if (/llama|mistral|qwen|gemma/.test(m)) {
    return { supportsReasoning: false, supportsTemperature: true, maxTokensCap: 8_192, family: 'opensource' };
  }
  // Desconhecido — modo permissivo, mas marcamos família como 'unknown' para alertar trocas.
  return { supportsReasoning: true, supportsTemperature: true, maxTokensCap: 32_000, family: 'unknown' };
}

/**
 * Sugere um modelo "drop-in" da MESMA família que cobre a capacidade
 * faltante (ex.: reasoning). Retorna `null` quando já estamos no melhor
 * candidato ou quando a família é desconhecida.
 *
 * Mantemos a lista mínima e estável — quick fixes não devem expor um
 * catálogo grande, só um "bom default" por família.
 */
function suggestModelForReasoning(currentModel: string | null | undefined): string | null {
  const m = String(currentModel ?? '').toLowerCase();
  if (/claude/.test(m) && !/3\.7|sonnet-4|opus-4|claude-4/.test(m)) {
    return 'claude-3-7-sonnet-latest';
  }
  if (/^gpt-[34]/.test(m) && !/gpt-4\.5|gpt-5/.test(m)) {
    return 'gpt-5';
  }
  if (/gemini/.test(m) && !/2\.5|3\./.test(m)) {
    return 'gemini-2.5-flash';
  }
  return null;
}
/* ─────────────────────────────────────────────────────────────────── */
/*  Helpers de extração                                                */
/* ─────────────────────────────────────────────────────────────────── */

function cfgOf(v?: AgentVersion | null): Record<string, unknown> {
  if (!v) return {};
  const c = v.config;
  if (!c) return {};
  if (typeof c === 'string') {
    try { return JSON.parse(c); } catch { return {}; }
  }
  return c as Record<string, unknown>;
}

function isToolEnabled(t: unknown): boolean {
  if (!t || typeof t !== 'object') return true;
  const e = (t as Record<string, unknown>).enabled;
  return e === undefined ? true : !!e;
}

function toolNameOf(t: unknown): string {
  if (!t || typeof t !== 'object') return '';
  const o = t as Record<string, unknown>;
  return String(o.name ?? o.id ?? o.type ?? '').toLowerCase();
}

/** Extrai menções a tools dentro do prompt — heurística simples por palavra. */
function extractPromptToolMentions(prompt: string, knownTools: string[]): string[] {
  if (!prompt || knownTools.length === 0) return [];
  const lower = prompt.toLowerCase();
  return knownTools.filter((name) => name && lower.includes(name));
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Validador principal                                                */
/* ─────────────────────────────────────────────────────────────────── */

export function validateRestore(
  current: AgentVersion | null | undefined,
  source: AgentVersion | null | undefined,
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean },
): RestoreValidation {
  const issues: ValidationIssue[] = [];

  if (!source) {
    issues.push({
      id: 'no-source',
      severity: 'error',
      group: 'general',
      title: 'Versão de origem ausente',
      detail: 'Não há uma versão anterior para restaurar.',
    });
    return finalize(issues);
  }

  const anySelected = options.copyPrompt || options.copyTools || options.copyModel;
  if (!anySelected) {
    issues.push({
      id: 'no-fields',
      severity: 'error',
      group: 'general',
      title: 'Nenhum campo selecionado',
      detail: 'Marque ao menos um grupo (Prompt, Ferramentas ou Modelo) para que o rollback tenha efeito.',
    });
    return finalize(issues);
  }

  // Estado pós-restore simulado (mesma lógica de `restoreAgentVersion`)
  const cfgCur = cfgOf(current);
  const cfgSrc = cfgOf(source);
  const merged: Record<string, unknown> = { ...cfgCur };
  let mergedModel = current?.model ?? null;
  let mergedPersona = current?.persona ?? null;

  if (options.copyPrompt) {
    merged.system_prompt = cfgSrc.system_prompt;
    merged.prompt = cfgSrc.prompt;
  }
  if (options.copyTools) {
    merged.tools = cfgSrc.tools;
  }
  if (options.copyModel) {
    merged.temperature = cfgSrc.temperature;
    merged.max_tokens = cfgSrc.max_tokens;
    merged.reasoning = cfgSrc.reasoning;
    mergedModel = source.model ?? mergedModel;
    mergedPersona = source.persona ?? mergedPersona;
  }

  const caps = detectModelCaps(mergedModel);

  /* ── Prompt ─────────────────────────────────────────────────── */
  if (options.copyPrompt) {
    const sp = String(merged.system_prompt ?? '').trim();
    const legacy = typeof merged.prompt === 'string' ? merged.prompt.trim() : '';
    if (!sp && !legacy) {
      issues.push({
        id: 'prompt-empty',
        severity: 'error',
        group: 'prompt',
        title: 'System prompt ficaria vazio',
        detail: 'A versão de origem não tem system prompt nem prompt legado. Sem prompt o agente não tem instruções para operar.',
        hint: 'Desmarque "Prompt" para preservar o prompt atual.',
        quickFixes: [
          { kind: 'uncheck-prompt', label: 'Desmarcar Prompt', description: 'Mantém o prompt atual e libera o rollback.' },
        ],
      });
    } else if (sp.length < 20 && !legacy) {
      issues.push({
        id: 'prompt-too-short',
        severity: 'warning',
        group: 'prompt',
        title: 'Prompt muito curto',
        detail: `O prompt da origem tem apenas ${sp.length} caracteres — pode não ser suficiente para guiar o agente.`,
        quickFixes: [
          { kind: 'uncheck-prompt', label: 'Desmarcar Prompt' },
        ],
      });
    }
  }

  /* ── Modelo & parâmetros ────────────────────────────────────── */
  if (options.copyModel) {
    if (!mergedModel || !String(mergedModel).trim()) {
      issues.push({
        id: 'model-missing',
        severity: 'error',
        group: 'model',
        title: 'Modelo obrigatório ausente',
        detail: 'A versão de origem não define um modelo. Restaurar deixaria o agente sem LLM configurado.',
        hint: 'Desmarque "Modelo & parâmetros" para manter o modelo atual.',
        quickFixes: [
          { kind: 'uncheck-model', label: 'Desmarcar Modelo & parâmetros', description: 'Preserva o modelo atual.' },
        ],
      });
    }
    if (!mergedPersona || !String(mergedPersona).trim()) {
      issues.push({
        id: 'persona-missing',
        severity: 'warning',
        group: 'model',
        title: 'Persona não definida',
        detail: 'O agente ficará sem persona após o restore — comportamento padrão será aplicado.',
      });
    }

    // Temperature
    const temp = merged.temperature;
    if (temp !== undefined && temp !== null) {
      if (!isFiniteNumber(temp) || temp < 0 || temp > 2) {
        issues.push({
          id: 'temp-invalid',
          severity: 'error',
          group: 'model',
          title: `Temperature inválida (${String(temp)})`,
          detail: 'Temperature precisa ser um número entre 0 e 2.',
          quickFixes: [
            { kind: 'set-temperature', value: 0.7, label: 'Redefinir para 0.7', description: 'Valor padrão equilibrado.' },
            { kind: 'set-temperature', value: 1, label: 'Redefinir para 1' },
            { kind: 'uncheck-model', label: 'Desmarcar Modelo & parâmetros' },
          ],
        });
      } else if (!caps.supportsTemperature && temp !== 1) {
        issues.push({
          id: 'temp-unsupported',
          severity: 'error',
          group: 'model',
          title: 'Modelo não aceita temperature customizada',
          detail: `O modelo "${mergedModel}" é um reasoning model e ignora/rejeita temperature ≠ 1. A versão de origem define temperature=${temp}.`,
          hint: 'Restaure também o prompt para revisar — ou edite manualmente após o rollback.',
          quickFixes: [
            { kind: 'set-temperature', value: 1, label: 'Redefinir temperature para 1', description: 'Único valor aceito por reasoning models.' },
            { kind: 'uncheck-model', label: 'Desmarcar Modelo & parâmetros' },
          ],
        });
      }
    }

    // Max tokens
    const mx = merged.max_tokens;
    if (mx !== undefined && mx !== null) {
      if (!isFiniteNumber(mx) || mx <= 0 || !Number.isInteger(mx)) {
        issues.push({
          id: 'max-tokens-invalid',
          severity: 'error',
          group: 'model',
          title: `max_tokens inválido (${String(mx)})`,
          detail: 'max_tokens precisa ser um inteiro positivo.',
        });
      } else if (mx > caps.maxTokensCap) {
        issues.push({
          id: 'max-tokens-cap',
          severity: 'error',
          group: 'model',
          title: `max_tokens acima do limite do modelo`,
          detail: `O modelo "${mergedModel}" suporta no máximo ${caps.maxTokensCap.toLocaleString('pt-BR')} tokens, mas a origem define ${mx.toLocaleString('pt-BR')}.`,
          hint: 'O modelo recusará a requisição. Edite o agente após o rollback ou escolha outra versão de origem.',
        });
      } else if (mx > caps.maxTokensCap * 0.8) {
        issues.push({
          id: 'max-tokens-near-cap',
          severity: 'warning',
          group: 'model',
          title: 'max_tokens próximo do teto',
          detail: `${mx} tokens está perto do limite (${caps.maxTokensCap}) — respostas longas podem ser truncadas e o custo cresce linearmente.`,
        });
      }
    }

    // Reasoning
    const rsn = merged.reasoning;
    if (rsn !== undefined && rsn !== null && String(rsn).trim() && String(rsn).toLowerCase() !== 'none') {
      if (!caps.supportsReasoning) {
        issues.push({
          id: 'reasoning-unsupported',
          severity: 'error',
          group: 'model',
          title: 'Modelo não suporta reasoning estendido',
          detail: `O parâmetro reasoning="${rsn}" é incompatível com "${mergedModel}". Apenas modelos com extended thinking (Claude 3.7+, GPT-5/o-series, Gemini 2.5 Thinking) aceitam esse campo.`,
          hint: 'Desmarque "Modelo & parâmetros" ou troque a versão de origem.',
        });
      }
    }

    // Cross-provider — quando muda família + parâmetros provider-específicos
    const curCaps = detectModelCaps(current?.model);
    if (
      current?.model && mergedModel
      && curCaps.family !== caps.family
      && curCaps.family !== 'unknown' && caps.family !== 'unknown'
    ) {
      issues.push({
        id: 'cross-provider',
        severity: 'warning',
        group: 'model',
        title: `Troca de provider (${curCaps.family} → ${caps.family})`,
        detail: 'Mudar de provider pode alterar drasticamente comportamento, custo e latência. Tokenização, formatos de tool-call e suporte a recursos diferem entre famílias.',
        hint: 'Considere rodar uma simulação antes de aplicar em produção.',
      });
    }
  }

  /* ── Tools ──────────────────────────────────────────────────── */
  if (options.copyTools) {
    const srcToolsRaw = Array.isArray(cfgSrc.tools) ? (cfgSrc.tools as unknown[]) : [];
    const enabledSrcTools = srcToolsRaw.filter(isToolEnabled).map(toolNameOf).filter(Boolean);

    // Detecta nomes duplicados na origem — bug latente
    const dupCheck = new Map<string, number>();
    enabledSrcTools.forEach((n) => dupCheck.set(n, (dupCheck.get(n) ?? 0) + 1));
    const dups = Array.from(dupCheck.entries()).filter(([, c]) => c > 1).map(([n]) => n);
    if (dups.length) {
      issues.push({
        id: 'tools-duplicate',
        severity: 'warning',
        group: 'tools',
        title: 'Tools duplicadas na origem',
        detail: `Tool(s) "${dups.join(', ')}" aparecem mais de uma vez. Pode causar comportamento ambíguo no agente.`,
      });
    }

    // Se o prompt menciona tools que não existirão pós-restore → erro acionável
    const promptText = options.copyPrompt
      ? String(merged.system_prompt ?? '') + ' ' + String(merged.prompt ?? '')
      : String(cfgCur.system_prompt ?? '') + ' ' + String(cfgCur.prompt ?? '');
    const curEnabledNames = Array.isArray(cfgCur.tools)
      ? (cfgCur.tools as unknown[]).filter(isToolEnabled).map(toolNameOf).filter(Boolean)
      : [];
    // Universo de tools mencionáveis = união dos dois lados (heurística para detectar referências).
    const universe = Array.from(new Set([...curEnabledNames, ...enabledSrcTools]));
    const mentioned = extractPromptToolMentions(promptText, universe);
    const missing = mentioned.filter((n) => !enabledSrcTools.includes(n));
    if (missing.length) {
      issues.push({
        id: 'tools-prompt-mismatch',
        severity: 'error',
        group: 'tools',
        title: 'Prompt referencia tools que serão removidas',
        detail: `O prompt menciona "${missing.join('", "')}" mas essas tools não estão na versão de origem. O agente tentará chamá-las e falhará.`,
        hint: 'Desmarque "Ferramentas" ou desmarque "Prompt" para evitar a inconsistência.',
      });
    }
  }

  return finalize(issues);
}

function finalize(issues: ValidationIssue[]): RestoreValidation {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  return {
    issues,
    errors,
    warnings,
    blocked: errors.length > 0,
  };
}
