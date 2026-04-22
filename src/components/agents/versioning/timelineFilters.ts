import type { AgentVersion } from '@/services/agentsService';

/**
 * Tags semânticas extraídas de uma versão para filtragem rápida na timeline.
 * Inferidas a partir de `change_summary` (texto livre criado pelo serviço de
 * versionamento, ex.: "Restaurado de v3 (prompt + ferramentas)") e da config.
 */
export type TimelineTag =
  | 'prompt'
  | 'tools'
  | 'model'
  | 'guardrails'
  | 'rollback'
  | 'failure';

export interface TimelinePreset {
  id: string;
  label: string;
  description: string;
  tags: TimelineTag[];
  /** Se true, exige TODAS as tags; senão, qualquer uma. */
  matchAll?: boolean;
}

export const TIMELINE_PRESETS: TimelinePreset[] = [
  {
    id: 'all',
    label: 'Todas',
    description: 'Sem filtro — mostra o histórico completo.',
    tags: [],
  },
  {
    id: 'failures-tools',
    label: 'Falhas + Tool',
    description: 'Versões marcadas como falha/regressão que envolvem mudanças em ferramentas.',
    tags: ['failure', 'tools'],
    matchAll: true,
  },
  {
    id: 'guardrails-only',
    label: 'Guardrails apenas',
    description: 'Apenas versões que alteram guardrails.',
    tags: ['guardrails'],
  },
  {
    id: 'prompt-changes',
    label: 'Prompt',
    description: 'Mudanças no system prompt.',
    tags: ['prompt'],
  },
  {
    id: 'model-changes',
    label: 'Modelo',
    description: 'Trocas de modelo ou parâmetros (temperature, max_tokens).',
    tags: ['model'],
  },
  {
    id: 'rollbacks',
    label: 'Rollbacks',
    description: 'Versões criadas a partir de uma restauração.',
    tags: ['rollback'],
  },
];

/**
 * Extrai tags de uma versão. Combinação de heurísticas em texto + inspeção
 * leve do config — propositalmente tolerante para evitar falsos negativos.
 */
export function getVersionTags(v: AgentVersion): Set<TimelineTag> {
  const tags = new Set<TimelineTag>();
  const summary = (v.change_summary ?? '').toLowerCase();
  const changes = (v.changes ?? '').toLowerCase();
  const haystack = `${summary} ${changes}`;

  if (/prompt|persona|miss(ã|a)o/.test(haystack)) tags.add('prompt');
  if (/tool|ferramenta/.test(haystack)) tags.add('tools');
  if (/model|gpt|claude|gemini|llama|temperature|max[_ ]tokens|par(â|a)metro/.test(haystack)) tags.add('model');
  if (/guardrail|policy|pol(í|i)tica|safety|seguran(ç|c)a/.test(haystack)) tags.add('guardrails');
  if (/restaurad|rollback|revert/.test(haystack)) tags.add('rollback');
  if (/falha|fail|regress|erro|bug/.test(haystack)) tags.add('failure');

  // Heurística adicional baseada no config
  const cfg = (v.config ?? {}) as Record<string, unknown>;
  if (Array.isArray(cfg.tools) && cfg.tools.length > 0) {
    // Não força "tools" sozinho — só adiciona se já houver indicação textual,
    // para não marcar TODAS as versões com tools=true.
  }
  if (Array.isArray(cfg.guardrails) && cfg.guardrails.length > 0) {
    // Mesmo princípio.
  }

  return tags;
}

export function matchesPreset(v: AgentVersion, preset: TimelinePreset): boolean {
  if (preset.tags.length === 0) return true;
  const vTags = getVersionTags(v);
  return preset.matchAll
    ? preset.tags.every((t) => vTags.has(t))
    : preset.tags.some((t) => vTags.has(t));
}

export function getPresetById(id: string | null | undefined): TimelinePreset {
  if (!id) return TIMELINE_PRESETS[0];
  return TIMELINE_PRESETS.find((p) => p.id === id) ?? TIMELINE_PRESETS[0];
}
