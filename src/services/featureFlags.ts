/**
 * Feature Flags Service — Gradual rollout, kill switches, A/B experiments
 * Stored in localStorage with optional remote override.
 */
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number; // 0-100
  allowedRoles: string[]; // empty = all roles
  createdAt: string;
  updatedAt: string;
}

// ═══ DEFAULT FLAGS ═══

const DEFAULT_FLAGS: FeatureFlag[] = [
  { key: 'voice_agents', name: 'Voice Agents', description: 'Habilita STT/TTS no Playground', enabled: false, rolloutPercentage: 0, allowedRoles: ['admin'], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'graph_rag', name: 'GraphRAG', description: 'Knowledge graph no Super Cérebro', enabled: true, rolloutPercentage: 100, allowedRoles: [], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'agentic_rag', name: 'Agentic RAG', description: 'Self-correcting retrieval loops', enabled: true, rolloutPercentage: 100, allowedRoles: [], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'ab_testing', name: 'A/B Testing', description: 'Statistical prompt comparison', enabled: true, rolloutPercentage: 50, allowedRoles: ['admin', 'editor'], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'advanced_security', name: 'Advanced Security', description: 'PII detection + injection prevention', enabled: true, rolloutPercentage: 100, allowedRoles: [], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'workflow_execution', name: 'Workflow Execution', description: 'Execute visual workflows via engine', enabled: true, rolloutPercentage: 100, allowedRoles: [], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'marketplace', name: 'Marketplace', description: 'Template marketplace page', enabled: true, rolloutPercentage: 100, allowedRoles: [], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
  { key: 'canary_deploy', name: 'Canary Deployments', description: 'Gradual traffic shifting', enabled: false, rolloutPercentage: 0, allowedRoles: ['admin'], createdAt: '2026-04-01', updatedAt: '2026-04-01' },
];

// ═══ STORAGE ═══

const STORAGE_KEY = 'nexus_feature_flags';

function loadFlags(): FeatureFlag[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [...DEFAULT_FLAGS];
}

function saveFlags(flags: FeatureFlag[]): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(flags)); } catch { /* quota */ }
}

// ═══ API ═══

/** Check if a feature is enabled for the current user. */
export function isEnabled(flagKey: string, userRole?: string): boolean {
  const flags = loadFlags();
  const flag = flags.find(f => f.key === flagKey);
  if (!flag) return false;
  if (!flag.enabled) return false;

  // Role check
  if (flag.allowedRoles.length > 0 && userRole && !flag.allowedRoles.includes(userRole)) {
    return false;
  }

  // Rollout percentage (deterministic based on flag key hash)
  if (flag.rolloutPercentage < 100) {
    const hash = flagKey.split('').reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0);
    const bucket = Math.abs(hash) % 100;
    if (bucket >= flag.rolloutPercentage) return false;
  }

  return true;
}

/** Get all feature flags. */
export function getFlags(): FeatureFlag[] {
  return loadFlags();
}

/** Toggle a feature flag. */
export function toggleFlag(flagKey: string): boolean {
  const flags = loadFlags();
  const flag = flags.find(f => f.key === flagKey);
  if (!flag) return false;
  flag.enabled = !flag.enabled;
  flag.updatedAt = new Date().toISOString().slice(0, 10);
  saveFlags(flags);
  logger.info(`Feature flag "${flagKey}" ${flag.enabled ? 'enabled' : 'disabled'}`, 'featureFlags');
  return flag.enabled;
}

/** Set rollout percentage. */
export function setRollout(flagKey: string, percentage: number): void {
  const flags = loadFlags();
  const flag = flags.find(f => f.key === flagKey);
  if (!flag) return;
  flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
  flag.updatedAt = new Date().toISOString().slice(0, 10);
  saveFlags(flags);
}

/** Add a new feature flag. */
export function addFlag(key: string, name: string, description: string): FeatureFlag {
  const flags = loadFlags();
  const flag: FeatureFlag = { key, name, description, enabled: false, rolloutPercentage: 0, allowedRoles: [], createdAt: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString().slice(0, 10) };
  flags.push(flag);
  saveFlags(flags);
  return flag;
}

/** Remove a feature flag. */
export function removeFlag(flagKey: string): void {
  const flags = loadFlags().filter(f => f.key !== flagKey);
  saveFlags(flags);
}

/** Reset to defaults. */
export function resetFlags(): void {
  saveFlags([...DEFAULT_FLAGS]);
}
