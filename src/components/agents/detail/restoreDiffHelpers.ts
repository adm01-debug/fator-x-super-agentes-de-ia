/**
 * restoreDiffHelpers — computa exatamente quais campos um rollback alterará,
 * comparando a versão atual com a versão de origem do restore. Reflete a mesma
 * lógica de `restoreAgentVersion` (copyPrompt / copyTools / copyModel).
 */
import type { AgentVersion } from '@/services/agentsService';

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface FieldChange<T = unknown> {
  field: string;
  label: string;
  group: 'prompt' | 'tools' | 'model';
  before: T;
  after: T;
  /** 'added' | 'removed' | 'modified' — facilita ícone/cor na UI. */
  kind: 'added' | 'removed' | 'modified';
  /** Score numérico de impacto (0-100). Quanto maior, mais arriscado. */
  impact: number;
  /** Nível de risco derivado do score, para badges. */
  risk: RiskLevel;
  /** Razão curta do score, exibida como tooltip/legenda. */
  reason: string;
}

export interface RestoreDiff {
  changes: FieldChange[];
  unchangedGroups: Array<'prompt' | 'tools' | 'model'>;
  toolsAdded: string[];
  toolsRemoved: string[];
  promptDeltaChars: number; // length(after) - length(before)
  /** Score agregado (0-100) de toda a restauração. */
  overallImpact: number;
  overallRisk: RiskLevel;
}

export function riskFromImpact(impact: number): RiskLevel {
  if (impact >= 75) return 'critical';
  if (impact >= 50) return 'high';
  if (impact >= 25) return 'medium';
  return 'low';
}

/** Score de impacto para mudança de prompt baseado em delta de chars. */
function scorePrompt(beforeLen: number, afterLen: number): { impact: number; reason: string } {
  const delta = Math.abs(afterLen - beforeLen);
  const base = Math.max(beforeLen, afterLen, 1);
  const ratio = delta / base; // 0..1+
  // Empty → conteúdo (ou vice-versa) é crítico
  if (beforeLen === 0 || afterLen === 0) {
    return { impact: 90, reason: afterLen === 0 ? 'Prompt esvaziado' : 'Prompt criado do zero' };
  }
  if (ratio >= 0.5) return { impact: 85, reason: `Reescrita massiva (${Math.round(ratio * 100)}% do prompt)` };
  if (ratio >= 0.25) return { impact: 65, reason: `Mudança grande (${Math.round(ratio * 100)}% do prompt)` };
  if (ratio >= 0.1) return { impact: 40, reason: `Mudança moderada (${Math.round(ratio * 100)}%)` };
  return { impact: 20, reason: `Pequeno ajuste (${delta} chars)` };
}

function cfg(v?: AgentVersion | null): Record<string, unknown> {
  if (!v) return {};
  const c = v.config;
  if (!c) return {};
  if (typeof c === 'string') {
    try { return JSON.parse(c); } catch { return {}; }
  }
  return c as Record<string, unknown>;
}

function toolName(t: unknown): string {
  if (!t || typeof t !== 'object') return String(t);
  const obj = t as Record<string, unknown>;
  return String(obj.name ?? obj.id ?? obj.type ?? 'tool');
}

function toolKey(t: unknown): string {
  return toolName(t).toLowerCase();
}

function isEnabled(t: unknown): boolean {
  if (!t || typeof t !== 'object') return true;
  const e = (t as Record<string, unknown>).enabled;
  return e === undefined ? true : !!e;
}

function eqLoose(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

export function computeRestoreDiff(
  current: AgentVersion | null | undefined,
  source: AgentVersion,
  options: { copyPrompt: boolean; copyTools: boolean; copyModel: boolean },
): RestoreDiff {
  const cur = current ?? source;
  const cfgCur = cfg(cur);
  const cfgSrc = cfg(source);
  const changes: FieldChange[] = [];
  const unchangedGroups: Array<'prompt' | 'tools' | 'model'> = [];

  // ── Prompt group ──────────────────────────────────────────────
  let promptHasChange = false;
  let promptDeltaChars = 0;
  if (options.copyPrompt) {
    const sysBefore = String(cfgCur.system_prompt ?? '');
    const sysAfter = String(cfgSrc.system_prompt ?? '');
    if (sysBefore !== sysAfter) {
      changes.push({
        field: 'system_prompt',
        label: 'System prompt',
        group: 'prompt',
        before: sysBefore,
        after: sysAfter,
        kind: sysAfter ? (sysBefore ? 'modified' : 'added') : 'removed',
      });
      promptDeltaChars = sysAfter.length - sysBefore.length;
      promptHasChange = true;
    }
    if (!eqLoose(cfgCur.prompt, cfgSrc.prompt)) {
      changes.push({
        field: 'prompt',
        label: 'Prompt (legacy)',
        group: 'prompt',
        before: cfgCur.prompt ?? '',
        after: cfgSrc.prompt ?? '',
        kind: cfgSrc.prompt ? (cfgCur.prompt ? 'modified' : 'added') : 'removed',
      });
      promptHasChange = true;
    }
    if (cur.mission !== source.mission) {
      changes.push({
        field: 'mission',
        label: 'Missão',
        group: 'prompt',
        before: cur.mission ?? '—',
        after: source.mission ?? '—',
        kind: source.mission ? (cur.mission ? 'modified' : 'added') : 'removed',
      });
      promptHasChange = true;
    }
    if (!promptHasChange) unchangedGroups.push('prompt');
  }

  // ── Tools group ──────────────────────────────────────────────
  const toolsAdded: string[] = [];
  const toolsRemoved: string[] = [];
  let toolsHasChange = false;
  if (options.copyTools) {
    const curTools = Array.isArray(cfgCur.tools) ? (cfgCur.tools as unknown[]) : [];
    const srcTools = Array.isArray(cfgSrc.tools) ? (cfgSrc.tools as unknown[]) : [];
    const curMap = new Map(curTools.filter(isEnabled).map((t) => [toolKey(t), t]));
    const srcMap = new Map(srcTools.filter(isEnabled).map((t) => [toolKey(t), t]));

    srcMap.forEach((t, k) => { if (!curMap.has(k)) toolsAdded.push(toolName(t)); });
    curMap.forEach((t, k) => { if (!srcMap.has(k)) toolsRemoved.push(toolName(t)); });

    if (toolsAdded.length || toolsRemoved.length) {
      changes.push({
        field: 'tools',
        label: 'Ferramentas',
        group: 'tools',
        before: Array.from(curMap.keys()),
        after: Array.from(srcMap.keys()),
        kind: toolsAdded.length && !toolsRemoved.length ? 'added'
          : !toolsAdded.length && toolsRemoved.length ? 'removed'
          : 'modified',
      });
      toolsHasChange = true;
    }
    if (!toolsHasChange) unchangedGroups.push('tools');
  }

  // ── Model group ──────────────────────────────────────────────
  let modelHasChange = false;
  if (options.copyModel) {
    if (cur.model !== source.model) {
      changes.push({
        field: 'model',
        label: 'Modelo',
        group: 'model',
        before: cur.model ?? '—',
        after: source.model ?? '—',
        kind: 'modified',
      });
      modelHasChange = true;
    }
    if (cur.persona !== source.persona) {
      changes.push({
        field: 'persona',
        label: 'Persona',
        group: 'model',
        before: cur.persona ?? '—',
        after: source.persona ?? '—',
        kind: 'modified',
      });
      modelHasChange = true;
    }
    const params: Array<[string, string]> = [
      ['temperature', 'Temperature'],
      ['max_tokens', 'Max tokens'],
      ['reasoning', 'Reasoning'],
    ];
    for (const [key, label] of params) {
      const a = cfgCur[key];
      const b = cfgSrc[key];
      if (!eqLoose(a, b) && (a !== undefined || b !== undefined)) {
        changes.push({
          field: key,
          label,
          group: 'model',
          before: a ?? '—',
          after: b ?? '—',
          kind: b === undefined ? 'removed' : a === undefined ? 'added' : 'modified',
        });
        modelHasChange = true;
      }
    }
    if (!modelHasChange) unchangedGroups.push('model');
  }

  return { changes, unchangedGroups, toolsAdded, toolsRemoved, promptDeltaChars };
}
