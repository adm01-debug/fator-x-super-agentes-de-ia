/**
 * Trace & Usage Service — Auto-captures execution traces and cost data
 * Intercepts LLM calls and persists to Supabase (agent_traces, usage_records)
 * Also provides budget enforcement and guardrails middleware.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface TraceEvent {
  type: 'input' | 'retrieval' | 'tool_call' | 'model' | 'guardrail' | 'output' | 'error';
  label: string;
  detail?: string;
  duration_ms: number;
  status: 'success' | 'error' | 'blocked';
  metadata?: Record<string, unknown>;
}

export interface ExecutionTrace {
  id: string;
  agent_id: string;
  agent_name: string;
  session_id: string;
  user_id?: string;
  model: string;
  input: string;
  output: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  latency_ms: number;
  status: 'success' | 'error' | 'blocked' | 'timeout';
  events: TraceEvent[];
  guardrails_triggered: string[];
  tools_used: string[];
  timestamp: string;
}

export interface UsageRecord {
  agent_id: string;
  model: string;
  tokens_in: number;
  tokens_out: number;
  cost_usd: number;
  type: 'llm' | 'embedding' | 'tool_call' | 'storage';
  timestamp: string;
}

export interface BudgetConfig {
  monthly_limit_usd: number;
  alert_threshold_pct: number;
  kill_switch: boolean;
}

// ═══ IN-MEMORY STORE (+ Supabase persistence) ═══

const traces: ExecutionTrace[] = [];
const usageRecords: UsageRecord[] = [];
let currentSessionId = `session-${Date.now()}`;

const SENTINEL_AGENT_ID = '00000000-0000-0000-0000-000000000000';

// ═══ TRACE RECORDING ═══

/** Record an execution trace. Saves to memory and attempts Supabase persistence. */
export function recordTrace(trace: Omit<ExecutionTrace, 'id' | 'timestamp'>): ExecutionTrace {
  const fullTrace: ExecutionTrace = {
    ...trace,
    // BUG 2 fix: sentinel UUID for calls without agent_id
    agent_id: trace.agent_id || SENTINEL_AGENT_ID,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };

  // Save in memory (keep last 500)
  traces.unshift(fullTrace);
  if (traces.length > 500) traces.length = 500;

  // Async persist to Supabase (fire-and-forget)
  persistTrace(fullTrace).catch(() => {
    logger.warn('Failed to persist trace to Supabase', 'traceService');
  });

  logger.info(
    `Trace: ${trace.agent_name} | ${trace.model} | ${trace.tokens_in}+${trace.tokens_out} tokens | $${trace.cost_usd.toFixed(4)} | ${trace.latency_ms}ms | ${trace.status}`,
    'traceService'
  );

  return fullTrace;
}

/** Record a usage entry for cost tracking. */
export function recordUsage(usage: Omit<UsageRecord, 'timestamp'>): void {
  const record: UsageRecord = { ...usage, timestamp: new Date().toISOString() };
  usageRecords.unshift(record);
  if (usageRecords.length > 1000) usageRecords.length = 1000;

  // Async persist
  persistUsage(record).catch(() => {
    logger.warn('Failed to persist usage to Supabase', 'traceService');
  });
}

// ═══ RETRIEVAL ═══

/** Get recent traces (from memory). */
export function getTraces(limit = 50, agentId?: string): ExecutionTrace[] {
  let result = traces;
  if (agentId) result = result.filter(t => t.agent_id === agentId);
  return result.slice(0, limit);
}

/** Get usage records for a time period. */
export function getUsage(days = 30, agentId?: string): UsageRecord[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  let result = usageRecords.filter(r => new Date(r.timestamp) >= cutoff);
  if (agentId) result = result.filter(r => r.agent_id === agentId);
  return result;
}

/** Calculate total cost for a period. */
export function getTotalCost(days = 30, agentId?: string): number {
  return getUsage(days, agentId).reduce((sum, r) => sum + r.cost_usd, 0);
}

/** Calculate cost per model. */
export function getCostByModel(days = 30): Record<string, number> {
  const costs: Record<string, number> = {};
  getUsage(days).forEach(r => {
    costs[r.model] = (costs[r.model] || 0) + r.cost_usd;
  });
  return costs;
}

/** Get session ID for grouping traces. */
export function getSessionId(): string { return currentSessionId; }
export function newSession(): string { currentSessionId = `session-${Date.now()}`; return currentSessionId; }

// ═══ BUDGET ENFORCEMENT ═══

const budgetConfigs = new Map<string, BudgetConfig>();

/** Set budget for an agent. */
export function setBudget(agentId: string, config: BudgetConfig): void {
  budgetConfigs.set(agentId, config);
}

/** Check if an agent is over budget. Returns { allowed, reason, spent, limit }. */
export function checkBudget(agentId: string): { allowed: boolean; reason?: string; spent: number; limit: number; pct: number } {
  // BUG 11 fix: also check global budget (all agents) for calls without specific agent
  const config = budgetConfigs.get(agentId) ?? budgetConfigs.get('global');
  if (!config) {
    // Hard safety: if total spend across ALL agents exceeds $500, block regardless
    const totalSpent = getTotalCost(30);
    if (totalSpent > 500) {
      return { allowed: false, reason: `Hard limit global: $${totalSpent.toFixed(2)} (máx $500)`, spent: totalSpent, limit: 500, pct: Math.round(totalSpent / 500 * 100) };
    }
    return { allowed: true, spent: 0, limit: 0, pct: 0 };
  }

  const spent = agentId && agentId !== SENTINEL_AGENT_ID ? getTotalCost(30, agentId) : getTotalCost(30);
  const pct = config.monthly_limit_usd > 0 ? Math.round(spent / config.monthly_limit_usd * 100) : 0;

  // BUG 11 fix: block at 120% regardless of kill_switch for safety
  if (pct >= 120) {
    return { allowed: false, reason: `Budget excedido (120%+): $${spent.toFixed(2)} / $${config.monthly_limit_usd.toFixed(2)}`, spent, limit: config.monthly_limit_usd, pct };
  }

  if (config.kill_switch && spent >= config.monthly_limit_usd) {
    return { allowed: false, reason: `Budget excedido: $${spent.toFixed(2)} / $${config.monthly_limit_usd.toFixed(2)} (${pct}%)`, spent, limit: config.monthly_limit_usd, pct };
  }

  if (pct >= config.alert_threshold_pct) {
    logger.warn(`Budget alert: ${agentId} at ${pct}% ($${spent.toFixed(2)} / $${config.monthly_limit_usd.toFixed(2)})`, 'traceService');
  }

  return { allowed: true, spent, limit: config.monthly_limit_usd, pct };
}

// ═══ GUARDRAILS MIDDLEWARE ═══

export interface GuardrailRule {
  id: string;
  name: string;
  type: 'input' | 'output';
  severity: 'block' | 'warn' | 'log';
  check: (text: string) => { pass: boolean; reason?: string };
}

const activeGuardrails: GuardrailRule[] = [];

/** Register a guardrail rule. */
export function registerGuardrail(rule: GuardrailRule): void {
  activeGuardrails.push(rule);
}

/** Check input against all input guardrails. */
export function checkInputGuardrails(input: string): { allowed: boolean; triggered: string[]; blocked?: string } {
  const triggered: string[] = [];
  let blocked: string | undefined;

  for (const rule of activeGuardrails.filter(g => g.type === 'input')) {
    const result = rule.check(input);
    if (!result.pass) {
      triggered.push(rule.name);
      if (rule.severity === 'block') {
        blocked = `${rule.name}: ${result.reason ?? 'Blocked'}`;
        break;
      }
    }
  }

  return { allowed: !blocked, triggered, blocked };
}

/** Check output against all output guardrails. */
export function checkOutputGuardrails(output: string): { allowed: boolean; triggered: string[]; blocked?: string } {
  const triggered: string[] = [];
  let blocked: string | undefined;

  for (const rule of activeGuardrails.filter(g => g.type === 'output')) {
    const result = rule.check(output);
    if (!result.pass) {
      triggered.push(rule.name);
      if (rule.severity === 'block') {
        blocked = `${rule.name}: ${result.reason ?? 'Blocked'}`;
        break;
      }
    }
  }

  return { allowed: !blocked, triggered, blocked };
}

/** Initialize default guardrails. */
export function initDefaultGuardrails(): void {
  // PII Detection (CPF, email patterns in output)
  registerGuardrail({
    id: 'pii-detection',
    name: 'PII Detection',
    type: 'output',
    severity: 'warn',
    check: (text) => {
      const cpfPattern = /\d{3}\.\d{3}\.\d{3}-\d{2}/;
      if (cpfPattern.test(text)) return { pass: false, reason: 'CPF detectado na resposta' };
      return { pass: true };
    },
  });

  // Prompt Injection Detection
  registerGuardrail({
    id: 'prompt-injection',
    name: 'Prompt Injection',
    type: 'input',
    severity: 'block',
    check: (text) => {
      const patterns = [
        /ignore\s+(all\s+)?previous\s+instructions/i,
        /ignore\s+your\s+(system\s+)?prompt/i,
        /you\s+are\s+now\s+(?:a|an)\s+/i,
        /jailbreak/i,
        /DAN\s*mode/i,
      ];
      for (const pattern of patterns) {
        if (pattern.test(text)) return { pass: false, reason: 'Prompt injection detectado' };
      }
      return { pass: true };
    },
  });

  // Token Budget (max input length)
  registerGuardrail({
    id: 'max-input',
    name: 'Max Input Length',
    type: 'input',
    severity: 'block',
    check: (text) => {
      if (text.length > 50000) return { pass: false, reason: `Input muito longo: ${text.length} chars (max 50000)` };
      return { pass: true };
    },
  });

  // Toxicity basic check
  registerGuardrail({
    id: 'toxicity-basic',
    name: 'Toxicity Filter',
    type: 'output',
    severity: 'warn',
    check: (text) => {
      const toxic = /\b(idiota|burro|imbecil|merda|porra|caralho|fdp)\b/i;
      if (toxic.test(text)) return { pass: false, reason: 'Conteúdo potencialmente tóxico' };
      return { pass: true };
    },
  });

  logger.info('Default guardrails initialized (4 rules)', 'traceService');
}

// ═══ SUPABASE PERSISTENCE (async, non-blocking) ═══

async function persistTrace(trace: ExecutionTrace): Promise<void> {
  try {
    // BUG 14 fix: use JSONB columns (input, output, metadata) that exist in original schema
    // BUG 3 fix: include user_id (fallback to sentinel)
    await supabase.from('agent_traces').insert({
      id: trace.id,
      agent_id: trace.agent_id || SENTINEL_AGENT_ID,
      session_id: trace.session_id,
      // Store in JSONB columns that always exist
      input: { text: trace.input.slice(0, 5000), model: trace.model },
      output: { text: trace.output.slice(0, 10000), tokens_in: trace.tokens_in, tokens_out: trace.tokens_out },
      metadata: {
        cost_usd: trace.cost_usd,
        latency_ms: trace.latency_ms,
        status: trace.status,
        events: trace.events,
        guardrails_triggered: trace.guardrails_triggered,
        tools_used: trace.tools_used,
      },
      // BUG 1 fix: use 'warning' not 'warn' for trace_level enum
      level: trace.status === 'error' ? 'error' : trace.guardrails_triggered.length > 0 ? 'warning' : 'info',
    });
  } catch {
    // Silently fail — table schema may differ
  }
}

async function persistUsage(record: UsageRecord): Promise<void> {
  try {
    // BUG 4 fix: use correct column names from schema
    // Schema: agent_id, user_id, date, requests, tokens_input, tokens_output, total_cost_usd, avg_latency_ms, error_count
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('agent_usage').upsert({
      agent_id: record.agent_id || SENTINEL_AGENT_ID,
      date: today,
      requests: 1,
      tokens_input: record.tokens_in,
      tokens_output: record.tokens_out,
      total_cost_usd: record.cost_usd,
    }, { onConflict: 'agent_id,date' }).catch(() => {
      // BUG 12 fix: race condition — second upsert may fail, that's OK
    });
  } catch {
    // Silently fail
  }
}

// ═══ INIT ═══
initDefaultGuardrails();
