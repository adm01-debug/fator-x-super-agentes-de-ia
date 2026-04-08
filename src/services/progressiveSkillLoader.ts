/**
 * Nexus Agents Studio — Progressive Skill Loading Service
 *
 * Inspired by DeerFlow 2.0's progressive skill system.
 * Instead of injecting ALL skills into the LLM context at once,
 * this service loads only relevant skills based on the current task,
 * saving tokens and improving response quality.
 *
 * Key features:
 * - Semantic skill matching based on task description
 * - Dependency resolution (skill A requires skill B)
 * - Token budget awareness (never exceed context window)
 * - Skill priority ranking
 * - Hot-loading during conversation
 * - Skill usage analytics
 * - Supabase persistence (hydrate on load, sync on changes)
 */

import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';

// ──────── Types ────────

export interface Skill {
  id: string;
  name: string;
  description: string;
  /** The actual skill content (system prompt addition, tool definition, etc.) */
  content: string;
  /** Estimated token count of the skill content */
  tokenCount: number;
  /** Keywords for matching */
  keywords: string[];
  /** Category for grouping */
  category: SkillCategory;
  /** Priority (1=lowest, 10=highest) */
  priority: number;
  /** IDs of skills this one depends on */
  dependencies: string[];
  /** Whether this skill is always loaded (core skills) */
  alwaysLoad: boolean;
  /** Timestamp of last use */
  lastUsed?: string;
  /** Number of times this skill has been used */
  useCount: number;
}

export type SkillCategory =
  | 'core'
  | 'data'
  | 'communication'
  | 'analysis'
  | 'automation'
  | 'integration'
  | 'creative'
  | 'security'
  | 'custom';

export interface SkillLoadResult {
  /** Skills that were loaded */
  loaded: Skill[];
  /** Skills that were skipped (over token budget) */
  skipped: Skill[];
  /** Total tokens used by loaded skills */
  totalTokens: number;
  /** Remaining token budget */
  remainingBudget: number;
  /** Loading strategy used */
  strategy: 'exact' | 'semantic' | 'priority' | 'dependency';
}

export interface SkillMatchScore {
  skill: Skill;
  score: number;
  matchedKeywords: string[];
  matchReason: string;
}

export interface SkillLoadOptions {
  /** Maximum tokens to allocate for skills */
  tokenBudget?: number;
  /** Force-include these skill IDs regardless of matching */
  forceInclude?: string[];
  /** Exclude these skill IDs */
  exclude?: string[];
  /** Only load skills from these categories */
  categories?: SkillCategory[];
  /** Minimum match score to include (0-1) */
  minScore?: number;
  /** Maximum number of skills to load */
  maxSkills?: number;
}

// ──────── Skill Registry (In-Memory) ────────

const skillRegistry = new Map<string, Skill>();

/**
 * Register a skill in the registry
 */
export function registerSkill(skill: Skill): void {
  skillRegistry.set(skill.id, skill);
}

/**
 * Register multiple skills
 */
export function registerSkills(skills: Skill[]): void {
  skills.forEach((s) => skillRegistry.set(s.id, s));
}

/**
 * Get a skill by ID
 */
export function getSkill(id: string): Skill | undefined {
  return skillRegistry.get(id);
}

/**
 * Get all registered skills
 */
export function getAllSkills(): Skill[] {
  return Array.from(skillRegistry.values());
}

/**
 * Remove a skill from the registry
 */
export function removeSkill(id: string): boolean {
  return skillRegistry.delete(id);
}

/**
 * Clear the entire registry
 */
export function clearSkillRegistry(): void {
  skillRegistry.clear();
}

// ──────── Token Estimation ────────

/**
 * Estimate token count for a text string.
 * Uses the ~4 chars per token heuristic.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ──────── Skill Matching ────────

/**
 * Match skills against a task description / user message.
 * Returns skills ranked by relevance score.
 */
export function matchSkills(
  taskDescription: string,
  options?: SkillLoadOptions,
): SkillMatchScore[] {
  const allSkills = getAllSkills();
  const minScore = options?.minScore ?? 0.1;
  const excludeSet = new Set(options?.exclude ?? []);
  const categoryFilter = options?.categories ? new Set(options.categories) : null;

  const taskWords = taskDescription
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  const taskSet = new Set(taskWords);

  const scores: SkillMatchScore[] = [];

  for (const skill of allSkills) {
    // Skip excluded skills
    if (excludeSet.has(skill.id)) continue;

    // Filter by category
    if (categoryFilter && !categoryFilter.has(skill.category)) continue;

    // Always-load skills get max score
    if (skill.alwaysLoad) {
      scores.push({
        skill,
        score: 1.0,
        matchedKeywords: ['always-load'],
        matchReason: 'Core skill (always loaded)',
      });
      continue;
    }

    // Force-included skills get high score
    if (options?.forceInclude?.includes(skill.id)) {
      scores.push({
        skill,
        score: 0.95,
        matchedKeywords: ['force-include'],
        matchReason: 'Force-included by configuration',
      });
      continue;
    }

    // Keyword matching
    const matchedKeywords: string[] = [];
    for (const keyword of skill.keywords) {
      const kwLower = keyword.toLowerCase();
      if (taskDescription.toLowerCase().includes(kwLower)) {
        matchedKeywords.push(keyword);
      }
    }

    // Name/description matching
    const nameWords = skill.name.toLowerCase().split(/\s+/);
    const descWords = skill.description
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    const nameOverlap = nameWords.filter((w) => taskSet.has(w)).length;
    const descOverlap = descWords.filter((w) => taskSet.has(w)).length;

    // Calculate composite score
    const keywordScore = matchedKeywords.length / Math.max(skill.keywords.length, 1);
    const nameScore = nameOverlap / Math.max(nameWords.length, 1);
    const descScore = descOverlap / Math.max(descWords.length, 1);
    const recencyBoost = skill.lastUsed
      ? Math.max(0, 0.1 - (Date.now() - new Date(skill.lastUsed).getTime()) / (86400000 * 7))
      : 0;
    const priorityBoost = skill.priority / 100;

    const totalScore = Math.min(
      1.0,
      keywordScore * 0.5 + nameScore * 0.2 + descScore * 0.15 + recencyBoost + priorityBoost,
    );

    if (totalScore >= minScore) {
      scores.push({
        skill,
        score: totalScore,
        matchedKeywords,
        matchReason:
          matchedKeywords.length > 0
            ? `Matched keywords: ${matchedKeywords.join(', ')}`
            : `Semantic match (name/description overlap)`,
      });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

// ──────── Dependency Resolution ────────

/**
 * Resolve skill dependencies (topological sort)
 */
export function resolveDependencies(skillIds: string[]): string[] {
  const resolved: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string): void {
    if (resolved.includes(id)) return;
    if (visiting.has(id)) return; // Circular dependency — skip
    if (visited.has(id)) return;

    visiting.add(id);

    const skill = getSkill(id);
    if (skill) {
      for (const depId of skill.dependencies) {
        visit(depId);
      }
    }

    visiting.delete(id);
    visited.add(id);
    resolved.push(id);
  }

  for (const id of skillIds) {
    visit(id);
  }

  return resolved;
}

// ──────── Progressive Loading ────────

/**
 * Load skills progressively based on task description and token budget.
 * This is the main entry point for the progressive loading system.
 */
export function loadSkillsForTask(
  taskDescription: string,
  options?: SkillLoadOptions,
): SkillLoadResult {
  const tokenBudget = options?.tokenBudget ?? 4000;
  const maxSkills = options?.maxSkills ?? 10;

  // Step 1: Match skills
  const matches = matchSkills(taskDescription, options);

  // Step 2: Select top matches within budget
  const selectedIds: string[] = [];
  const skippedSkills: Skill[] = [];
  let usedTokens = 0;

  for (const match of matches) {
    if (selectedIds.length >= maxSkills) {
      skippedSkills.push(match.skill);
      continue;
    }

    if (usedTokens + match.skill.tokenCount <= tokenBudget) {
      selectedIds.push(match.skill.id);
      usedTokens += match.skill.tokenCount;
    } else {
      skippedSkills.push(match.skill);
    }
  }

  // Step 3: Resolve dependencies
  const resolvedIds = resolveDependencies(selectedIds);

  // Step 4: Load resolved skills (may include deps that weren't in the original match)
  const loadedSkills: Skill[] = [];
  let finalTokens = 0;

  for (const id of resolvedIds) {
    const skill = getSkill(id);
    if (skill && finalTokens + skill.tokenCount <= tokenBudget) {
      loadedSkills.push(skill);
      finalTokens += skill.tokenCount;

      // Update usage stats
      skill.lastUsed = new Date().toISOString();
      skill.useCount += 1;
    }
  }

  return {
    loaded: loadedSkills,
    skipped: skippedSkills,
    totalTokens: finalTokens,
    remainingBudget: tokenBudget - finalTokens,
    strategy: loadedSkills.some((s) => s.alwaysLoad)
      ? 'priority'
      : loadedSkills.length > 0
        ? 'semantic'
        : 'exact',
  };
}

/**
 * Generate the system prompt addition for loaded skills.
 * Combines all loaded skill contents into a single string.
 */
export function generateSkillPrompt(loadResult: SkillLoadResult): string {
  if (loadResult.loaded.length === 0) return '';

  const sections = loadResult.loaded.map((skill) => `## Skill: ${skill.name}\n${skill.content}`);

  return [
    '# Active Skills',
    `_${loadResult.loaded.length} skills loaded (${loadResult.totalTokens} tokens)_`,
    '',
    ...sections,
  ].join('\n\n');
}

/**
 * Hot-load additional skills during a conversation.
 * Called when the conversation topic shifts and new skills are needed.
 */
export function hotLoadSkills(
  currentLoadedIds: string[],
  newTaskDescription: string,
  tokenBudgetRemaining: number,
): SkillLoadResult {
  return loadSkillsForTask(newTaskDescription, {
    tokenBudget: tokenBudgetRemaining,
    exclude: currentLoadedIds,
    minScore: 0.2, // Higher threshold for hot-loading
    maxSkills: 3, // Limit hot-loaded skills
  });
}

// ──────── Analytics ────────

/**
 * Get skill usage statistics
 */
export function getSkillAnalytics(): Array<{
  id: string;
  name: string;
  category: SkillCategory;
  useCount: number;
  lastUsed: string | undefined;
  tokenCount: number;
}> {
  return getAllSkills()
    .map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      useCount: s.useCount,
      lastUsed: s.lastUsed,
      tokenCount: s.tokenCount,
    }))
    .sort((a, b) => b.useCount - a.useCount);
}

// ──────── Supabase Persistence ────────

/**
 * Hydrate the in-memory registry from the skills table in Supabase.
 * Call this once on app startup to load previously registered skills.
 */
export async function hydrateSkillsFromDB(): Promise<number> {
  try {
    const { data, error } = await fromTable('agent_skills').select('*').eq('is_active', true);

    if (error) {
      logger.warn('Failed to hydrate skills from DB — running in-memory only', {
        error: error.message,
      });
      return 0;
    }

    const rows = (data ?? []) as Array<Record<string, unknown>>;
    for (const row of rows) {
      const skill: Skill = {
        id: String(row.id),
        name: String(row.name ?? ''),
        description: String(row.description ?? ''),
        content: String(row.content ?? ''),
        tokenCount: Number(row.token_count ?? 0) || estimateTokens(String(row.content ?? '')),
        keywords: Array.isArray(row.keywords) ? (row.keywords as string[]) : [],
        category: String(row.category ?? 'custom') as SkillCategory,
        priority: Number(row.priority ?? 5),
        dependencies: Array.isArray(row.dependencies) ? (row.dependencies as string[]) : [],
        alwaysLoad: Boolean(row.always_load),
        lastUsed: row.last_used_at ? String(row.last_used_at) : undefined,
        useCount: Number(row.use_count ?? 0),
      };
      registerSkill(skill);
    }

    return rows.length;
  } catch (e) {
    logger.warn('Skills hydration failed — running in-memory only', { error: e });
    return 0;
  }
}

/**
 * Persist a skill to the database after registration or usage update.
 */
export async function syncSkillToDB(skill: Skill): Promise<void> {
  try {
    await fromTable('agent_skills').upsert({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      content: skill.content,
      token_count: skill.tokenCount,
      keywords: skill.keywords,
      category: skill.category,
      priority: skill.priority,
      dependencies: skill.dependencies,
      always_load: skill.alwaysLoad,
      last_used_at: skill.lastUsed ?? null,
      use_count: skill.useCount,
      is_active: true,
    });
  } catch {
    // Best-effort persistence — in-memory registry is the source of truth
  }
}
