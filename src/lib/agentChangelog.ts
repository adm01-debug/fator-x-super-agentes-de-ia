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
