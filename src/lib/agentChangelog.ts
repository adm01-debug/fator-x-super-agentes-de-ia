/**
 * Nexus Agents Studio — Agent Changelog
 * Generates structured diff entries between two agent versions.
 * Used by the versioning page to power both the auto-summary on save
 * and the visual comparison panel.
 */

export type ChangelogKind = 'added' | 'removed' | 'modified' | 'prompt_changed';

export interface ChangelogEntry {
  kind: ChangelogKind;
  /** Short label, e.g. "Modelo", "Tool: web_search" */
  label: string;
  from?: string | number | null;
  to?: string | number | null;
  /** Optional extra context, e.g. "+42%" */
  detail?: string;
}

export interface VersionLike {
  model?: string | null;
  persona?: string | null;
  mission?: string | null;
  config?: Record<string, unknown> | null;
}

interface ToolLike { name?: string; id?: string; enabled?: boolean }

function getCfg(v: VersionLike): Record<string, unknown> {
  const cfg = v?.config;
  if (!cfg) return {};
  if (typeof cfg === 'string') {
    try { return JSON.parse(cfg) as Record<string, unknown>; } catch { return {}; }
  }
  return cfg;
}

function enabledNames(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x: unknown) => x && typeof x === 'object' && ((x as ToolLike).enabled ?? true))
    .map((x) => String((x as ToolLike).name ?? (x as ToolLike).id ?? ''))
    .filter(Boolean);
}

function compareNamedList(
  prev: string[],
  next: string[],
  prefix: string,
): ChangelogEntry[] {
  const prevSet = new Set(prev);
  const nextSet = new Set(next);
  const out: ChangelogEntry[] = [];
  for (const name of nextSet) if (!prevSet.has(name)) out.push({ kind: 'added', label: `${prefix}: ${name}` });
  for (const name of prevSet) if (!nextSet.has(name)) out.push({ kind: 'removed', label: `${prefix}: ${name}` });
  return out;
}

/**
 * Generate a structured changelog comparing prev → next.
 * Returns an empty array when versions are identical.
 */
export function generateChangelog(prev: VersionLike, next: VersionLike): ChangelogEntry[] {
  const out: ChangelogEntry[] = [];
  const cprev = getCfg(prev);
  const cnext = getCfg(next);

  // Top-level scalars
  if ((prev.model ?? null) !== (next.model ?? null)) {
    out.push({ kind: 'modified', label: 'Modelo', from: prev.model ?? '—', to: next.model ?? '—' });
  }
  if ((prev.persona ?? null) !== (next.persona ?? null)) {
    out.push({ kind: 'modified', label: 'Persona', from: prev.persona ?? '—', to: next.persona ?? '—' });
  }
  if ((prev.mission ?? null) !== (next.mission ?? null)) {
    out.push({ kind: 'modified', label: 'Missão', from: 'alterada', to: 'nova' });
  }

  // Config scalars
  const scalarKeys: { key: string; label: string }[] = [
    { key: 'temperature', label: 'Temperature' },
    { key: 'max_tokens', label: 'Max tokens' },
    { key: 'top_p', label: 'Top-p' },
  ];
  for (const { key, label } of scalarKeys) {
    const a = cprev[key];
    const b = cnext[key];
    if (a !== b && (a !== undefined || b !== undefined)) {
      out.push({ kind: 'modified', label, from: (a as string | number | null) ?? '—', to: (b as string | number | null) ?? '—' });
    }
  }

  // System prompt
  const promptA = String(cprev.system_prompt ?? '');
  const promptB = String(cnext.system_prompt ?? '');
  if (promptA !== promptB) {
    const lenA = promptA.length;
    const lenB = promptB.length;
    const delta = lenA === 0 ? 100 : Math.round(((lenB - lenA) / lenA) * 100);
    out.push({
      kind: 'prompt_changed',
      label: 'System prompt',
      from: `${lenA} chars`,
      to: `${lenB} chars`,
      detail: `${delta >= 0 ? '+' : ''}${delta}%`,
    });
  }

  // Tools and guardrails
  out.push(...compareNamedList(enabledNames(cprev.tools), enabledNames(cnext.tools), 'Tool'));
  out.push(...compareNamedList(enabledNames(cprev.guardrails), enabledNames(cnext.guardrails), 'Guardrail'));

  return out;
}

/** One-line summary suitable for the `change_summary` column. */
export function summarizeChangelog(entries: ChangelogEntry[]): string {
  if (entries.length === 0) return 'Sem alterações estruturais';
  const counts = { added: 0, removed: 0, modified: 0, prompt_changed: 0 };
  for (const e of entries) counts[e.kind]++;
  const parts: string[] = [];
  if (counts.added) parts.push(`${counts.added} adição(ões)`);
  if (counts.removed) parts.push(`${counts.removed} remoção(ões)`);
  if (counts.modified) parts.push(`${counts.modified} alteração(ões)`);
  if (counts.prompt_changed) parts.push('prompt revisado');
  return parts.join(' · ');
}

/** Helper: extract enabled tool names from a version (for table rendering). */
export function getVersionTools(v: VersionLike): string[] {
  return enabledNames(getCfg(v).tools);
}

export function getVersionGuardrails(v: VersionLike): string[] {
  return enabledNames(getCfg(v).guardrails);
}

export function getVersionPrompt(v: VersionLike): string {
  return String(getCfg(v).system_prompt ?? '');
}

export function getVersionScalar<T = unknown>(v: VersionLike, key: string): T | undefined {
  return getCfg(v)[key] as T | undefined;
}

// ───────── Guardrails rich diff ─────────

export interface GuardrailLike {
  id?: string;
  name?: string;
  category?: string;
  severity?: string;
  enabled?: boolean;
  config?: Record<string, unknown>;
}

export interface GuardrailConfigChange {
  key: string;
  from: unknown;
  to: unknown;
}

export interface GuardrailKeptDiff {
  key: string;
  prev: GuardrailLike;
  next: GuardrailLike;
  severityChanged?: { from: string; to: string };
  configChanges: GuardrailConfigChange[];
}

export interface GuardrailDiff {
  added: GuardrailLike[];
  removed: GuardrailLike[];
  kept: GuardrailKeptDiff[];
  byCategory: Record<string, { prev: number; next: number; delta: number }>;
  summary: { added: number; removed: number; modified: number; total: number };
}

const SEVERITY_RANK: Record<string, number> = { log: 1, warn: 2, block: 3 };

export function compareSeverity(from?: string, to?: string): 'stricter' | 'looser' | 'same' | 'unknown' {
  if (!from || !to) return 'unknown';
  const a = SEVERITY_RANK[from] ?? 0;
  const b = SEVERITY_RANK[to] ?? 0;
  if (a === 0 || b === 0) return 'unknown';
  if (a === b) return 'same';
  return b > a ? 'stricter' : 'looser';
}

export function getVersionGuardrailObjects(v: VersionLike): GuardrailLike[] {
  const arr = getCfg(v).guardrails;
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x): x is GuardrailLike => !!x && typeof x === 'object' && ((x as GuardrailLike).enabled ?? true))
    .map((x) => ({
      id: x.id ? String(x.id) : undefined,
      name: x.name ? String(x.name) : undefined,
      category: x.category ? String(x.category) : undefined,
      severity: x.severity ? String(x.severity) : undefined,
      enabled: x.enabled ?? true,
      config: (x.config && typeof x.config === 'object' ? (x.config as Record<string, unknown>) : undefined),
    }));
}

function guardrailKey(g: GuardrailLike): string {
  return g.name || g.id || '';
}

function diffConfig(
  a?: Record<string, unknown>,
  b?: Record<string, unknown>,
): GuardrailConfigChange[] {
  const out: GuardrailConfigChange[] = [];
  const keys = new Set<string>([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
  for (const k of keys) {
    const av = a?.[k];
    const bv = b?.[k];
    const equal = JSON.stringify(av) === JSON.stringify(bv);
    if (!equal) out.push({ key: k, from: av, to: bv });
  }
  return out.sort((x, y) => x.key.localeCompare(y.key));
}

export function diffGuardrails(prev: VersionLike, next: VersionLike): GuardrailDiff {
  const prevList = getVersionGuardrailObjects(prev);
  const nextList = getVersionGuardrailObjects(next);
  const prevMap = new Map<string, GuardrailLike>(
    prevList.map((g) => [guardrailKey(g), g] as const).filter(([k]) => !!k),
  );
  const nextMap = new Map<string, GuardrailLike>(
    nextList.map((g) => [guardrailKey(g), g] as const).filter(([k]) => !!k),
  );

  const added: GuardrailLike[] = [];
  const removed: GuardrailLike[] = [];
  const kept: GuardrailKeptDiff[] = [];

  for (const [k, g] of nextMap) if (!prevMap.has(k)) added.push(g);
  for (const [k, g] of prevMap) if (!nextMap.has(k)) removed.push(g);
  for (const [k, gPrev] of prevMap) {
    const gNext = nextMap.get(k);
    if (!gNext) continue;
    const severityChanged =
      gPrev.severity && gNext.severity && gPrev.severity !== gNext.severity
        ? { from: gPrev.severity, to: gNext.severity }
        : undefined;
    const configChanges = diffConfig(gPrev.config, gNext.config);
    if (severityChanged || configChanges.length > 0) {
      kept.push({ key: k, prev: gPrev, next: gNext, severityChanged, configChanges });
    }
  }

  const byCategory: Record<string, { prev: number; next: number; delta: number }> = {};
  const allCats = new Set<string>([
    ...prevList.map((g) => g.category || 'uncategorized'),
    ...nextList.map((g) => g.category || 'uncategorized'),
  ]);
  for (const cat of allCats) {
    const p = prevList.filter((g) => (g.category || 'uncategorized') === cat).length;
    const n = nextList.filter((g) => (g.category || 'uncategorized') === cat).length;
    byCategory[cat] = { prev: p, next: n, delta: n - p };
  }

  return {
    added,
    removed,
    kept,
    byCategory,
    summary: {
      added: added.length,
      removed: removed.length,
      modified: kept.length,
      total: nextList.length,
    },
  };
}
