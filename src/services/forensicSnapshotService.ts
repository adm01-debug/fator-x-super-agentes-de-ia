/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Forensic Snapshot Service
 * ═══════════════════════════════════════════════════════════════
 * Immutable state snapshots with SHA-256 hash integrity at each
 * autonomous agent decision point. Creates a tamper-evident
 * chain of evidence for compliance auditing.
 *
 * Key concepts:
 * - Each snapshot captures full agent state at decision time
 * - SHA-256 hash chain makes tampering detectable
 * - Previous hash is included to create linked chain (like blockchain)
 * - Supports verification of entire execution history
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ──────── Types ────────

export interface ForensicSnapshot {
  id: string;
  execution_id: string;
  agent_id: string;
  step_index: number;
  decision_type: ForensicDecisionType;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  decision_rationale: string;
  input_hash: string;
  output_hash: string;
  chain_hash: string;       // SHA-256(prev_hash + input_hash + output_hash)
  previous_hash: string;    // Previous snapshot's chain_hash
  metadata: Record<string, unknown>;
  created_at: string;
}

export type ForensicDecisionType =
  | 'tool_call'
  | 'llm_inference'
  | 'workflow_step'
  | 'handoff'
  | 'approval_request'
  | 'guardrail_check'
  | 'state_mutation'
  | 'external_api_call'
  | 'data_access'
  | 'escalation';

export interface SnapshotChainVerification {
  valid: boolean;
  totalSnapshots: number;
  verifiedCount: number;
  brokenAt?: number;       // step_index where chain breaks
  brokenHash?: string;     // expected vs actual
  details: string;
}

export interface CreateSnapshotInput {
  execution_id: string;
  agent_id: string;
  step_index: number;
  decision_type: ForensicDecisionType;
  state_before: Record<string, unknown>;
  state_after: Record<string, unknown>;
  decision_rationale: string;
  metadata?: Record<string, unknown>;
}

// ──────── SHA-256 Hashing ────────

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function canonicalize(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, Object.keys(obj).sort());
}

// ──────── Core Functions ────────

/**
 * Create an immutable forensic snapshot at a decision point.
 * Automatically computes SHA-256 hashes and links to previous snapshot.
 */
export async function createForensicSnapshot(input: CreateSnapshotInput): Promise<ForensicSnapshot> {
  // Compute content hashes
  const inputHash = await sha256(canonicalize(input.state_before));
  const outputHash = await sha256(canonicalize(input.state_after));

  // Get previous snapshot's chain hash for linking
  const { data: prevSnapshots } = await db
    .from('forensic_snapshots')
    .select('chain_hash')
    .eq('execution_id', input.execution_id)
    .order('step_index', { ascending: false })
    .limit(1);

  const previousHash = prevSnapshots?.[0]?.chain_hash ?? 'genesis';

  // Compute chain hash: SHA-256(previous_hash + input_hash + output_hash + rationale)
  const chainInput = `${previousHash}:${inputHash}:${outputHash}:${input.decision_rationale}`;
  const chainHash = await sha256(chainInput);

  const { data, error } = await db
    .from('forensic_snapshots')
    .insert({
      execution_id: input.execution_id,
      agent_id: input.agent_id,
      step_index: input.step_index,
      decision_type: input.decision_type,
      state_before: input.state_before,
      state_after: input.state_after,
      decision_rationale: input.decision_rationale,
      input_hash: inputHash,
      output_hash: outputHash,
      chain_hash: chainHash,
      previous_hash: previousHash,
      metadata: input.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    logger.error('Failed to create forensic snapshot', { error: error.message });
    throw error;
  }

  logger.info('Forensic snapshot created', {
    execution_id: input.execution_id,
    step: input.step_index,
    decision: input.decision_type,
    chain_hash: chainHash.substring(0, 12),
  });

  return data as ForensicSnapshot;
}

/**
 * List all forensic snapshots for a given execution, in order.
 */
export async function listExecutionSnapshots(executionId: string): Promise<ForensicSnapshot[]> {
  const { data, error } = await db
    .from('forensic_snapshots')
    .select('*')
    .eq('execution_id', executionId)
    .order('step_index', { ascending: true });

  if (error) throw error;
  return (data ?? []) as ForensicSnapshot[];
}

/**
 * Get a single snapshot by ID.
 */
export async function getSnapshot(snapshotId: string): Promise<ForensicSnapshot | null> {
  const { data, error } = await db
    .from('forensic_snapshots')
    .select('*')
    .eq('id', snapshotId)
    .maybeSingle();

  if (error) throw error;
  return data as ForensicSnapshot | null;
}

/**
 * Verify the integrity of an entire execution's snapshot chain.
 * Re-computes each SHA-256 hash and validates linkage.
 */
export async function verifySnapshotChain(executionId: string): Promise<SnapshotChainVerification> {
  const snapshots = await listExecutionSnapshots(executionId);

  if (snapshots.length === 0) {
    return { valid: true, totalSnapshots: 0, verifiedCount: 0, details: 'No snapshots found' };
  }

  let previousHash = 'genesis';
  let verifiedCount = 0;

  for (const snapshot of snapshots) {
    // Verify previous_hash linkage
    if (snapshot.previous_hash !== previousHash) {
      return {
        valid: false,
        totalSnapshots: snapshots.length,
        verifiedCount,
        brokenAt: snapshot.step_index,
        brokenHash: `expected previous_hash=${previousHash.substring(0, 12)}, got=${snapshot.previous_hash.substring(0, 12)}`,
        details: `Chain broken at step ${snapshot.step_index}: previous_hash mismatch`,
      };
    }

    // Re-compute chain hash
    const inputHash = await sha256(canonicalize(snapshot.state_before));
    const outputHash = await sha256(canonicalize(snapshot.state_after));
    const chainInput = `${previousHash}:${inputHash}:${outputHash}:${snapshot.decision_rationale}`;
    const expectedChainHash = await sha256(chainInput);

    if (snapshot.chain_hash !== expectedChainHash) {
      return {
        valid: false,
        totalSnapshots: snapshots.length,
        verifiedCount,
        brokenAt: snapshot.step_index,
        brokenHash: `expected chain_hash=${expectedChainHash.substring(0, 12)}, got=${snapshot.chain_hash.substring(0, 12)}`,
        details: `Integrity violation at step ${snapshot.step_index}: content was tampered`,
      };
    }

    // Also verify individual content hashes
    if (snapshot.input_hash !== inputHash || snapshot.output_hash !== outputHash) {
      return {
        valid: false,
        totalSnapshots: snapshots.length,
        verifiedCount,
        brokenAt: snapshot.step_index,
        brokenHash: 'Content hash mismatch',
        details: `State data modified at step ${snapshot.step_index}`,
      };
    }

    previousHash = snapshot.chain_hash;
    verifiedCount++;
  }

  return {
    valid: true,
    totalSnapshots: snapshots.length,
    verifiedCount,
    details: `All ${verifiedCount} snapshots verified — chain integrity confirmed`,
  };
}

/**
 * Get summary statistics for an execution's forensic trail.
 */
export async function getExecutionForensicSummary(executionId: string) {
  const snapshots = await listExecutionSnapshots(executionId);
  const verification = await verifySnapshotChain(executionId);

  const decisionCounts = snapshots.reduce((acc, s) => {
    acc[s.decision_type] = (acc[s.decision_type] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    executionId,
    totalDecisions: snapshots.length,
    decisionTypes: decisionCounts,
    chainIntegrity: verification.valid ? 'verified' : 'broken',
    firstDecision: snapshots[0]?.created_at ?? null,
    lastDecision: snapshots[snapshots.length - 1]?.created_at ?? null,
    verification,
  };
}

/**
 * Export forensic trail as a signed JSON report for compliance.
 */
export async function exportForensicReport(executionId: string): Promise<{
  report: Record<string, unknown>;
  reportHash: string;
}> {
  const snapshots = await listExecutionSnapshots(executionId);
  const verification = await verifySnapshotChain(executionId);

  const report = {
    version: '1.0',
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    total_snapshots: snapshots.length,
    chain_integrity: verification,
    snapshots: snapshots.map(s => ({
      step: s.step_index,
      decision_type: s.decision_type,
      rationale: s.decision_rationale,
      chain_hash: s.chain_hash,
      timestamp: s.created_at,
    })),
  };

  const reportHash = await sha256(JSON.stringify(report));

  return { report: { ...report, report_hash: reportHash }, reportHash };
}
