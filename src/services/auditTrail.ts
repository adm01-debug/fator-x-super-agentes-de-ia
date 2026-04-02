/**
 * Audit Trail — Immutable log of all data mutations
 * SOC2/LGPD compliant: who did what, when, with what data
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { getCorrelationId } from './resilience';

// ═══ TYPES ═══

export interface AuditEntry {
  id: string;
  timestamp: string;
  correlationId: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'read' | 'login' | 'logout' | 'export' | 'deploy' | 'approve' | 'reject';
  resource: string; // e.g., 'agent', 'prompt', 'deployment', 'workflow'
  resourceId: string;
  details: string;
  previousValue?: string; // JSON of previous state (for updates)
  newValue?: string; // JSON of new state
  ipAddress?: string;
  userAgent?: string;
  outcome: 'success' | 'failure' | 'blocked';
  metadata?: Record<string, unknown>;
}

// ═══ STORE (append-only, immutable) ═══

const auditLog: AuditEntry[] = [];
const MAX_ENTRIES = 5000;

// ═══ API ═══

/** Log an audit entry. Append-only — entries cannot be modified or deleted. */
export function log(entry: Omit<AuditEntry, 'id' | 'timestamp' | 'correlationId'>): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    correlationId: getCorrelationId(),
  };

  auditLog.push(full); // Append-only (never unshift — preserves insertion order)
  if (auditLog.length > MAX_ENTRIES) auditLog.splice(0, auditLog.length - MAX_ENTRIES);

  // Async persist to Supabase (non-blocking)
  persistEntry(full);

  logger.info(`Audit: ${entry.action} ${entry.resource}/${entry.resourceId} by ${entry.userName} → ${entry.outcome}`, 'auditTrail');
  return full;
}

/** Query audit log with filters. */
export function query(filters?: {
  userId?: string;
  action?: AuditEntry['action'];
  resource?: string;
  resourceId?: string;
  outcome?: AuditEntry['outcome'];
  since?: string; // ISO date
  limit?: number;
}): AuditEntry[] {
  let result = [...auditLog];
  if (filters?.userId) result = result.filter(e => e.userId === filters.userId);
  if (filters?.action) result = result.filter(e => e.action === filters.action);
  if (filters?.resource) result = result.filter(e => e.resource === filters.resource);
  if (filters?.resourceId) result = result.filter(e => e.resourceId === filters.resourceId);
  if (filters?.outcome) result = result.filter(e => e.outcome === filters.outcome);
  if (filters?.since) result = result.filter(e => e.timestamp >= filters.since);
  return result.slice(-(filters?.limit ?? 100)).reverse(); // Most recent first
}

/** Get audit stats. */
export function getStats(): { total: number; byAction: Record<string, number>; byOutcome: Record<string, number>; uniqueUsers: number } {
  const byAction: Record<string, number> = {};
  const byOutcome: Record<string, number> = {};
  const users = new Set<string>();

  auditLog.forEach(e => {
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    byOutcome[e.outcome] = (byOutcome[e.outcome] ?? 0) + 1;
    users.add(e.userId);
  });

  return { total: auditLog.length, byAction, byOutcome, uniqueUsers: users.size };
}

/** Export audit log as JSON (for compliance). */
export function exportLog(since?: string): string {
  const entries = since ? auditLog.filter(e => e.timestamp >= since) : auditLog;
  return JSON.stringify(entries, null, 2);
}

/** Get entry count (audit logs are never cleared in production). */
export function count(): number { return auditLog.length; }

// ═══ SUPABASE PERSISTENCE ═══

async function persistEntry(entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      id: entry.id,
      user_id: entry.userId,
      action: entry.action,
      resource_type: entry.resource,
      resource_id: entry.resourceId,
      details: entry.details,
      metadata: { correlationId: entry.correlationId, outcome: entry.outcome, previousValue: entry.previousValue, newValue: entry.newValue },
    });
  } catch {
    // Silently fail — table may not exist
  }
}
