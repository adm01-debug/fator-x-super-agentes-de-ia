/**
 * Agent Governance — Handoff patterns, versioning, environment promotion, policies
 * Implements: triage→specialist routing, agent registry, version control, approval workflows
 */
import { logger } from '@/lib/logger';

// ═══ AGENT HANDOFF ═══

export interface AgentCapability {
  agentId: string;
  name: string;
  specialties: string[];
  maxConcurrent: number;
  currentLoad: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface HandoffResult {
  targetAgentId: string;
  targetAgentName: string;
  reason: string;
  confidence: number;
  pattern: 'triage' | 'specialist' | 'escalation' | 'bidirectional';
}

const agentRegistry: AgentCapability[] = [];

export function registerAgent(agent: AgentCapability): void {
  const existing = agentRegistry.findIndex(a => a.agentId === agent.agentId);
  if (existing >= 0) agentRegistry[existing] = agent;
  else agentRegistry.push(agent);
  logger.info(`Agent registered: ${agent.name} (${agent.specialties.join(', ')})`, 'governance');
}

export function getRegistry(): AgentCapability[] { return [...agentRegistry]; }

/** Route a query to the best-suited agent based on specialty matching. */
export function routeToAgent(query: string, excludeAgentId?: string): HandoffResult | null {
  const queryLower = query.toLowerCase();
  const candidates = agentRegistry
    .filter(a => a.agentId !== excludeAgentId && a.currentLoad < a.maxConcurrent)
    .map(agent => {
      const matchCount = agent.specialties.filter(s => queryLower.includes(s.toLowerCase())).length;
      const score = (matchCount / Math.max(agent.specialties.length, 1)) * agent.successRate * (1 - agent.currentLoad / agent.maxConcurrent);
      return { agent, score };
    })
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score);

  if (candidates.length === 0) return null;

  const best = candidates[0];
  return {
    targetAgentId: best.agent.agentId,
    targetAgentName: best.agent.name,
    reason: `Specialty match: ${best.agent.specialties.filter(s => queryLower.includes(s.toLowerCase())).join(', ')}`,
    confidence: Math.round(best.score * 100),
    pattern: 'triage',
  };
}

// ═══ AGENT VERSIONING ═══

export interface AgentVersion {
  id: string;
  agentId: string;
  version: string;
  config: Record<string, unknown>;
  promptHash: string;
  createdAt: string;
  createdBy: string;
  changeSummary: string;
  qualityScore?: number;
  status: 'draft' | 'testing' | 'staging' | 'production' | 'deprecated';
}

const versionHistory = new Map<string, AgentVersion[]>();

export function saveVersion(agentId: string, config: Record<string, unknown>, summary: string, author = 'system'): AgentVersion {
  const versions = versionHistory.get(agentId) ?? [];
  const lastVersion = versions[0];
  const vNum = lastVersion ? incrementVersion(lastVersion.version) : 'v1.0.0';

  const version: AgentVersion = {
    id: `ver-${Date.now()}`, agentId, version: vNum, config: JSON.parse(JSON.stringify(config)),
    promptHash: hashString(JSON.stringify(config).slice(0, 500)),
    createdAt: new Date().toISOString(), createdBy: author, changeSummary: summary,
    status: 'draft',
  };

  versions.unshift(version);
  if (versions.length > 50) versions.length = 50;
  versionHistory.set(agentId, versions);
  logger.info(`Version saved: ${agentId} ${vNum} — "${summary}"`, 'governance');
  return version;
}

export function getVersions(agentId: string): AgentVersion[] {
  return versionHistory.get(agentId) ?? [];
}

export function rollbackToVersion(agentId: string, versionId: string): AgentVersion | null {
  const versions = versionHistory.get(agentId) ?? [];
  const target = versions.find(v => v.id === versionId);
  if (!target) return null;

  // Create new version from rollback
  const rollback = saveVersion(agentId, target.config, `Rollback to ${target.version}`);
  rollback.status = 'staging';
  return rollback;
}

// ═══ ENVIRONMENT PROMOTION ═══

export function promoteVersion(agentId: string, versionId: string, targetEnv: AgentVersion['status']): boolean {
  const versions = versionHistory.get(agentId) ?? [];
  const version = versions.find(v => v.id === versionId);
  if (!version) return false;

  // Demote current version in target env
  versions.filter(v => v.status === targetEnv).forEach(v => { v.status = 'deprecated'; });

  version.status = targetEnv;
  logger.info(`Version promoted: ${agentId} ${version.version} → ${targetEnv}`, 'governance');
  return true;
}

// ═══ ACTION POLICIES ═══

export interface ActionPolicy {
  id: string;
  name: string;
  agentId: string;
  action: string; // e.g., 'refund', 'delete_data', 'send_email', 'modify_record'
  maxAmount?: number; // For financial actions
  requiresApproval: boolean;
  approverRole: string;
  conditions: string;
}

const policies: ActionPolicy[] = [];

export function addPolicy(policy: ActionPolicy): void {
  policies.push(policy);
}

export function getPolicies(agentId?: string): ActionPolicy[] {
  return agentId ? policies.filter(p => p.agentId === agentId || p.agentId === '*') : policies;
}

/** Check if an action is allowed by policies. */
export function checkActionPolicy(agentId: string, action: string, amount?: number): { allowed: boolean; requiresApproval: boolean; policy?: ActionPolicy } {
  const applicablePolicies = policies.filter(p => (p.agentId === agentId || p.agentId === '*') && p.action === action);

  for (const policy of applicablePolicies) {
    if (policy.maxAmount !== undefined && amount !== undefined && amount > policy.maxAmount) {
      return { allowed: false, requiresApproval: true, policy };
    }
    if (policy.requiresApproval) {
      return { allowed: true, requiresApproval: true, policy };
    }
  }

  return { allowed: true, requiresApproval: false };
}

// ═══ APPROVAL WORKFLOW ═══

export interface ApprovalRequest {
  id: string;
  agentId: string;
  action: string;
  details: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
}

const approvalQueue: ApprovalRequest[] = [];

export function requestApproval(agentId: string, action: string, details: string): ApprovalRequest {
  const req: ApprovalRequest = {
    id: `approval-${Date.now()}`, agentId, action, details,
    requestedAt: new Date().toISOString(), status: 'pending',
  };
  approvalQueue.push(req);
  logger.warn(`Approval requested: ${action} by agent ${agentId}`, 'governance');
  return req;
}

export function getPendingApprovals(): ApprovalRequest[] {
  return approvalQueue.filter(a => a.status === 'pending');
}

export function reviewApproval(requestId: string, approved: boolean, reviewer: string): boolean {
  const req = approvalQueue.find(a => a.id === requestId);
  if (!req) return false;
  req.status = approved ? 'approved' : 'rejected';
  req.reviewedBy = reviewer;
  req.reviewedAt = new Date().toISOString();
  return true;
}

// ═══ AUDIT LOG ═══

export interface AuditEntry {
  id: string;
  timestamp: string;
  agentId: string;
  userId: string;
  action: string;
  details: string;
  outcome: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
}

const auditLog: AuditEntry[] = [];

export function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  auditLog.unshift({ ...entry, id: `audit-${Date.now()}`, timestamp: new Date().toISOString() });
  if (auditLog.length > 1000) auditLog.length = 1000;
}

export function getAuditLog(limit = 100, agentId?: string): AuditEntry[] {
  const filtered = agentId ? auditLog.filter(a => a.agentId === agentId) : auditLog;
  return filtered.slice(0, limit);
}

// ═══ HELPERS ═══

function incrementVersion(v: string): string {
  const parts = v.replace('v', '').split('.').map(Number);
  parts[2] = (parts[2] ?? 0) + 1;
  return `v${parts.join('.')}`;
}

function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
