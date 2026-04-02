/**
 * Annotation Service — Human review pipeline for agent traces
 * Implements: annotation queues, SME review, feedback loop, quality improvement
 */
import * as traceService from './traceService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface AnnotationItem {
  id: string;
  traceId: string;
  agentId: string;
  agentName: string;
  input: string;
  output: string;
  autoScore: number;
  reason: string; // Why this was flagged for review
  status: 'pending' | 'in_review' | 'approved' | 'rejected' | 'needs_revision';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignedTo?: string;
  annotation?: {
    quality: number; // 1-5
    feedback: string;
    corrections?: string;
    tags: string[];
  };
  createdAt: string;
  reviewedAt?: string;
}

export interface QueueStats {
  total: number;
  pending: number;
  inReview: number;
  approved: number;
  rejected: number;
  avgReviewTime: number;
  avgQuality: number;
}

// ═══ QUEUE ═══

const queue: AnnotationItem[] = [];

/** Auto-flag traces for review based on quality signals. */
export function autoFlagTrace(trace: traceService.ExecutionTrace): AnnotationItem | null {
  let reason = '';
  let priority: AnnotationItem['priority'] = 'low';

  // Flag conditions
  if (trace.guardrails_triggered.length > 0) {
    reason = `Guardrails triggered: ${trace.guardrails_triggered.join(', ')}`;
    priority = 'high';
  } else if (trace.status === 'error') {
    reason = 'Trace ended in error';
    priority = 'medium';
  } else if (trace.cost_usd > 0.1) {
    reason = `High cost: $${trace.cost_usd.toFixed(3)}`;
    priority = 'medium';
  } else if (trace.latency_ms > 10000) {
    reason = `High latency: ${(trace.latency_ms / 1000).toFixed(1)}s`;
    priority = 'low';
  } else if (trace.output.length < 20) {
    reason = 'Very short response (possible failure)';
    priority = 'medium';
  } else {
    // Random sampling: flag 10% of traces
    if (Math.random() > 0.9) {
      reason = 'Random sample for quality assurance';
      priority = 'low';
    } else {
      return null; // Don't flag
    }
  }

  const item: AnnotationItem = {
    id: `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    traceId: trace.id,
    agentId: trace.agent_id,
    agentName: trace.agent_name,
    input: trace.input.slice(0, 500),
    output: trace.output.slice(0, 1000),
    autoScore: trace.status === 'success' ? 70 : 30,
    reason, priority,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };

  queue.unshift(item);
  if (queue.length > 500) queue.length = 500;
  logger.info(`Trace flagged for review: ${reason} (${priority})`, 'annotationService');
  return item;
}

/** Get queue items with optional filters. */
export function getQueue(filters?: { status?: AnnotationItem['status']; priority?: AnnotationItem['priority']; agentId?: string; limit?: number }): AnnotationItem[] {
  let result = [...queue];
  if (filters?.status) result = result.filter(i => i.status === filters.status);
  if (filters?.priority) result = result.filter(i => i.priority === filters.priority);
  if (filters?.agentId) result = result.filter(i => i.agentId === filters.agentId);
  return result.slice(0, filters?.limit ?? 50);
}

/** Assign an item to a reviewer. */
export function assignReviewer(itemId: string, reviewerId: string): boolean {
  const item = queue.find(i => i.id === itemId);
  if (!item) return false;
  item.assignedTo = reviewerId;
  item.status = 'in_review';
  return true;
}

/** Submit annotation for an item. */
export function submitAnnotation(itemId: string, annotation: { quality: number; feedback: string; corrections?: string; tags: string[] }, approved: boolean): boolean {
  const item = queue.find(i => i.id === itemId);
  if (!item) return false;
  item.annotation = annotation;
  item.status = approved ? 'approved' : annotation.corrections ? 'needs_revision' : 'rejected';
  item.reviewedAt = new Date().toISOString();
  logger.info(`Annotation submitted: ${itemId} → ${item.status} (quality: ${annotation.quality}/5)`, 'annotationService');
  return true;
}

/** Get queue statistics. */
export function getStats(): QueueStats {
  const reviewed = queue.filter(i => i.reviewedAt);
  const avgReviewTime = reviewed.length > 0
    ? reviewed.reduce((s, i) => s + (new Date(i.reviewedAt!).getTime() - new Date(i.createdAt).getTime()), 0) / reviewed.length / 60000
    : 0;
  const annotated = queue.filter(i => i.annotation);
  const avgQuality = annotated.length > 0
    ? annotated.reduce((s, i) => s + (i.annotation?.quality ?? 0), 0) / annotated.length
    : 0;

  return {
    total: queue.length,
    pending: queue.filter(i => i.status === 'pending').length,
    inReview: queue.filter(i => i.status === 'in_review').length,
    approved: queue.filter(i => i.status === 'approved').length,
    rejected: queue.filter(i => i.status === 'rejected').length,
    avgReviewTime: Math.round(avgReviewTime * 10) / 10,
    avgQuality: Math.round(avgQuality * 10) / 10,
  };
}

/** Clear reviewed items older than N days. */
export function cleanupOld(days = 30): number {
  const cutoff = Date.now() - days * 86400000;
  const before = queue.length;
  const filtered = queue.filter(i => i.status === 'pending' || i.status === 'in_review' || new Date(i.createdAt).getTime() > cutoff);
  queue.length = 0;
  queue.push(...filtered);
  return before - queue.length;
}
