/**
 * Nexus Agents Studio — Cron Scheduler Engine
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';

export type {
  ScheduleFrequency, ScheduleStatus, CronSchedule,
  CreateScheduleInput, ScheduleExecution, ScheduleStats,
  CronExecutorRunResult,
} from './types/cronSchedulerTypes';

import type {
  ScheduleStatus, CronSchedule, CreateScheduleInput,
  ScheduleExecution, ScheduleStats, CronExecutorRunResult,
} from './types/cronSchedulerTypes';

/* ── Cron Expression Parser ── */

interface CronParts { minute: number[]; hour: number[]; dayOfMonth: number[]; month: number[]; dayOfWeek: number[] }

function parseCronField(field: string, min: number, max: number): number[] {
  const values: number[] = [];
  for (const part of field.split(',')) {
    if (part === '*') { for (let i = min; i <= max; i++) values.push(i); }
    else if (part.includes('/')) { const [range, stepStr] = part.split('/'); const step = parseInt(stepStr, 10); const start = range === '*' ? min : parseInt(range, 10); for (let i = start; i <= max; i += step) values.push(i); }
    else if (part.includes('-')) { const [s, e] = part.split('-'); for (let i = parseInt(s, 10); i <= parseInt(e, 10); i++) values.push(i); }
    else values.push(parseInt(part, 10));
  }
  return [...new Set(values)].sort((a, b) => a - b);
}

export function parseCronExpression(expr: string): CronParts {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  return { minute: parseCronField(parts[0], 0, 59), hour: parseCronField(parts[1], 0, 23), dayOfMonth: parseCronField(parts[2], 1, 31), month: parseCronField(parts[3], 1, 12), dayOfWeek: parseCronField(parts[4], 0, 6) };
}

export function getNextCronRun(expr: string, after: Date = new Date()): Date {
  const cron = parseCronExpression(expr);
  const next = new Date(after.getTime()); next.setSeconds(0, 0); next.setMinutes(next.getMinutes() + 1);
  for (let i = 0; i < 366 * 24 * 60; i++) {
    if (cron.month.includes(next.getMonth() + 1) && cron.dayOfMonth.includes(next.getDate()) && cron.dayOfWeek.includes(next.getDay()) && cron.hour.includes(next.getHours()) && cron.minute.includes(next.getMinutes())) return next;
    next.setMinutes(next.getMinutes() + 1);
  }
  throw new Error('Could not find next cron run within 1 year');
}

export function describeCronExpression(expr: string): string {
  const presets: Record<string, string> = { '* * * * *': 'Every minute', '*/5 * * * *': 'Every 5 minutes', '*/15 * * * *': 'Every 15 minutes', '*/30 * * * *': 'Every 30 minutes', '0 * * * *': 'Every hour', '0 */2 * * *': 'Every 2 hours', '0 */6 * * *': 'Every 6 hours', '0 0 * * *': 'Daily at midnight', '0 9 * * *': 'Daily at 9:00 AM', '0 9 * * 1-5': 'Weekdays at 9:00 AM', '0 0 * * 0': 'Weekly on Sunday', '0 0 * * 1': 'Weekly on Monday', '0 0 1 * *': 'Monthly on the 1st', '0 0 1 1 *': 'Yearly on Jan 1st' };
  return presets[expr] ?? `Custom: ${expr}`;
}

/* ── CRUD ── */

export async function createSchedule(input: CreateScheduleInput): Promise<CronSchedule> {
  let next_run_at: string | null = null;
  if (input.frequency === 'once' && input.start_at) next_run_at = input.start_at;
  else if (input.frequency === 'cron' && input.cron_expression) next_run_at = getNextCronRun(input.cron_expression).toISOString();
  else if (input.frequency === 'interval' && input.interval_seconds) { const n = new Date(); n.setSeconds(n.getSeconds() + input.interval_seconds); next_run_at = n.toISOString(); }
  else if (input.frequency === 'daily') next_run_at = getNextCronRun('0 0 * * *').toISOString();
  else if (input.frequency === 'weekly') next_run_at = getNextCronRun('0 0 * * 1').toISOString();
  else if (input.frequency === 'monthly') next_run_at = getNextCronRun('0 0 1 * *').toISOString();
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await fromTable('cron_schedules').insert({
    name: input.name, description: input.description ?? '', frequency: input.frequency,
    cron_expression: input.cron_expression ?? null, interval_seconds: input.interval_seconds ?? null,
    timezone: input.timezone ?? 'America/Sao_Paulo', next_run_at, status: 'active' as ScheduleStatus,
    target_type: input.target_type, target_id: input.target_id, target_config: input.target_config ?? {},
    retry_on_failure: input.retry_on_failure ?? true, max_retries: input.max_retries ?? 3,
    max_runs: input.max_runs ?? null, run_count: 0, created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;
  return data as CronSchedule;
}

export async function listSchedules(status?: ScheduleStatus): Promise<CronSchedule[]> {
  let query = fromTable('cron_schedules').select('*').order('next_run_at', { ascending: true });
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CronSchedule[];
}

export async function getSchedule(id: string): Promise<CronSchedule | null> {
  const { data, error } = await fromTable('cron_schedules').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as CronSchedule | null;
}

export async function updateSchedule(id: string, updates: Partial<CreateScheduleInput> & { status?: ScheduleStatus }): Promise<CronSchedule> {
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };
  if (updates.cron_expression) patch.next_run_at = getNextCronRun(updates.cron_expression).toISOString();
  const { data, error } = await fromTable('cron_schedules').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as CronSchedule;
}

export async function pauseSchedule(id: string): Promise<CronSchedule> { return updateSchedule(id, { status: 'paused' }); }
export async function resumeSchedule(id: string): Promise<CronSchedule> { return updateSchedule(id, { status: 'active' }); }
export async function deleteSchedule(id: string): Promise<void> { const { error } = await fromTable('cron_schedules').delete().eq('id', id); if (error) throw error; }

/* ── Execution History ── */

export async function recordExecution(scheduleId: string, status: ScheduleExecution['status'], result?: Record<string, unknown>, errorMsg?: string, durationMs?: number, attempt?: number): Promise<ScheduleExecution> {
  const { data, error } = await fromTable('cron_schedule_executions').insert({ schedule_id: scheduleId, status, result: result ?? null, error: errorMsg ?? null, duration_ms: durationMs ?? null, attempt: attempt ?? 1, completed_at: status !== 'running' ? new Date().toISOString() : null }).select().single();
  if (error) throw error;
  if (status === 'success' || status === 'failed') {
    const schedule = await getSchedule(scheduleId);
    if (schedule) {
      const newRunCount = schedule.run_count + 1;
      const shouldComplete = schedule.max_runs !== null && newRunCount >= schedule.max_runs;
      const updatePayload: Record<string, unknown> = { run_count: newRunCount, last_run_at: new Date().toISOString(), updated_at: new Date().toISOString() };
      if (shouldComplete) { updatePayload.status = 'completed'; updatePayload.next_run_at = null; }
      else if (schedule.cron_expression) updatePayload.next_run_at = getNextCronRun(schedule.cron_expression).toISOString();
      else if (schedule.interval_seconds) { const n = new Date(); n.setSeconds(n.getSeconds() + schedule.interval_seconds); updatePayload.next_run_at = n.toISOString(); }
      await fromTable('cron_schedules').update(updatePayload).eq('id', scheduleId);
    }
  }
  return data as ScheduleExecution;
}

export async function getScheduleExecutions(scheduleId: string, limit: number = 50): Promise<ScheduleExecution[]> {
  const { data, error } = await fromTable('cron_schedule_executions').select('*').eq('schedule_id', scheduleId).order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data ?? []) as ScheduleExecution[];
}

/* ── Stats ── */

export async function getScheduleStats(): Promise<ScheduleStats> {
  const allSchedules = await listSchedules();
  const active = allSchedules.filter((s: any) => s.status === 'active');
  const paused = allSchedules.filter((s: any) => s.status === 'paused');
  const { data: executions, error } = await fromTable('cron_schedule_executions').select('status, duration_ms').order('started_at', { ascending: false }).limit(1000);
  if (error) throw error;
  const execs = executions ?? [];
  const successCount = execs.filter((e: any) => e.status === 'success').length;
  const durations = execs.map((e: any) => e.duration_ms).filter((d: any): d is number => d !== null);
  const upcoming = active.filter((s: any) => s.next_run_at !== null).sort((a: any, b: any) => new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime()).slice(0, 5);
  return { total_schedules: allSchedules.length, active_schedules: active.length, paused_schedules: paused.length, total_executions: execs.length, success_rate: execs.length > 0 ? (successCount / execs.length) * 100 : 0, avg_duration_ms: durations.length > 0 ? durations.reduce((a: any, b: any) => a + b, 0) / durations.length : 0, next_upcoming: upcoming };
}

/* ── Presets & Edge Function ── */

export { CRON_PRESETS } from './presets/cronPresets';

export async function runCronExecutor(): Promise<CronExecutorRunResult> {
  const { data, error } = await supabaseExternal.functions.invoke('cron-executor', { body: { manual: true, source: 'frontend-panel' } });
  if (error) { logger.error('cron-executor invoke failed', { error: error.message }); throw new Error(error.message); }
  return (data as CronExecutorRunResult) ?? { ok: true };
}
