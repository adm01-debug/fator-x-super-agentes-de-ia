/**
 * Nexus Agents Studio — Cron Scheduler Engine
 *
 * Provides cron-based scheduling, one-time schedules, delay timers,
 * and timezone-aware execution for workflow automations.
 *
 * Inspired by: n8n Cron Triggers, Temporal Scheduled Workflows,
 * Activepieces Scheduling, Windmill Schedulers.
 *
 * Gap 1/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ScheduleFrequency =
  | 'once'
  | 'interval'
  | 'cron'
  | 'daily'
  | 'weekly'
  | 'monthly';

export type ScheduleStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'expired';

export interface CronSchedule {
  id: string;
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  cron_expression: string | null;
  interval_seconds: number | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  run_count: number;
  max_runs: number | null;
  status: ScheduleStatus;
  target_type: 'workflow' | 'agent' | 'edge_function' | 'webhook';
  target_id: string;
  target_config: Record<string, unknown>;
  retry_on_failure: boolean;
  max_retries: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  interval_seconds?: number;
  timezone?: string;
  start_at?: string;
  max_runs?: number;
  target_type: CronSchedule['target_type'];
  target_id: string;
  target_config?: Record<string, unknown>;
  retry_on_failure?: boolean;
  max_retries?: number;
}

export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failed' | 'skipped';
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  attempt: number;
}

export interface ScheduleStats {
  total_schedules: number;
  active_schedules: number;
  paused_schedules: number;
  total_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  next_upcoming: CronSchedule[];
}

/* ------------------------------------------------------------------ */
/*  Cron Expression Parser (lightweight, no external deps)             */
/* ------------------------------------------------------------------ */

interface CronParts {
  minute: number[];
  hour: number[];
  dayOfMonth: number[];
  month: number[];
  dayOfWeek: number[];
}

function parseCronField(field: string, min: number, max: number): number[] {
  const values: number[] = [];

  for (const part of field.split(',')) {
    if (part === '*') {
      for (let i = min; i <= max; i++) values.push(i);
    } else if (part.includes('/')) {
      const [range, stepStr] = part.split('/');
      const step = parseInt(stepStr, 10);
      const start = range === '*' ? min : parseInt(range, 10);
      for (let i = start; i <= max; i += step) values.push(i);
    } else if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      for (let i = start; i <= end; i++) values.push(i);
    } else {
      values.push(parseInt(part, 10));
    }
  }

  return [...new Set(values)].sort((a, b) => a - b);
}

export function parseCronExpression(expr: string): CronParts {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Invalid cron expression: expected 5 fields, got ${parts.length}`);
  }

  return {
    minute: parseCronField(parts[0], 0, 59),
    hour: parseCronField(parts[1], 0, 23),
    dayOfMonth: parseCronField(parts[2], 1, 31),
    month: parseCronField(parts[3], 1, 12),
    dayOfWeek: parseCronField(parts[4], 0, 6),
  };
}

export function getNextCronRun(expr: string, after: Date = new Date()): Date {
  const cron = parseCronExpression(expr);
  const next = new Date(after.getTime());
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  const MAX_ITERATIONS = 366 * 24 * 60;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    if (
      cron.month.includes(next.getMonth() + 1) &&
      cron.dayOfMonth.includes(next.getDate()) &&
      cron.dayOfWeek.includes(next.getDay()) &&
      cron.hour.includes(next.getHours()) &&
      cron.minute.includes(next.getMinutes())
    ) {
      return next;
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  throw new Error('Could not find next cron run within 1 year');
}

export function describeCronExpression(expr: string): string {
  const presets: Record<string, string> = {
    '* * * * *': 'Every minute',
    '*/5 * * * *': 'Every 5 minutes',
    '*/15 * * * *': 'Every 15 minutes',
    '*/30 * * * *': 'Every 30 minutes',
    '0 * * * *': 'Every hour',
    '0 */2 * * *': 'Every 2 hours',
    '0 */6 * * *': 'Every 6 hours',
    '0 0 * * *': 'Daily at midnight',
    '0 9 * * *': 'Daily at 9:00 AM',
    '0 9 * * 1-5': 'Weekdays at 9:00 AM',
    '0 0 * * 0': 'Weekly on Sunday',
    '0 0 * * 1': 'Weekly on Monday',
    '0 0 1 * *': 'Monthly on the 1st',
    '0 0 1 1 *': 'Yearly on Jan 1st',
  };

  return presets[expr] ?? `Custom: ${expr}`;
}

/* ------------------------------------------------------------------ */
/*  CRUD Operations                                                    */
/* ------------------------------------------------------------------ */

export async function createSchedule(
  input: CreateScheduleInput,
): Promise<CronSchedule> {
  let next_run_at: string | null = null;

  if (input.frequency === 'once' && input.start_at) {
    next_run_at = input.start_at;
  } else if (input.frequency === 'cron' && input.cron_expression) {
    next_run_at = getNextCronRun(input.cron_expression).toISOString();
  } else if (input.frequency === 'interval' && input.interval_seconds) {
    const next = new Date();
    next.setSeconds(next.getSeconds() + input.interval_seconds);
    next_run_at = next.toISOString();
  } else if (input.frequency === 'daily') {
    next_run_at = getNextCronRun('0 0 * * *').toISOString();
  } else if (input.frequency === 'weekly') {
    next_run_at = getNextCronRun('0 0 * * 1').toISOString();
  } else if (input.frequency === 'monthly') {
    next_run_at = getNextCronRun('0 0 1 * *').toISOString();
  }

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id ?? null;

  const record = {
    name: input.name,
    description: input.description ?? '',
    frequency: input.frequency,
    cron_expression: input.cron_expression ?? null,
    interval_seconds: input.interval_seconds ?? null,
    timezone: input.timezone ?? 'America/Sao_Paulo',
    next_run_at,
    status: 'active' as ScheduleStatus,
    target_type: input.target_type,
    target_id: input.target_id,
    target_config: input.target_config ?? {},
    retry_on_failure: input.retry_on_failure ?? true,
    max_retries: input.max_retries ?? 3,
    max_runs: input.max_runs ?? null,
    run_count: 0,
    created_by: userId,
  };

  const { data, error } = await fromTable('cron_schedules').insert(record).select().single();
  if (error) throw error;
  return data as CronSchedule;
}

export async function listSchedules(
  status?: ScheduleStatus,
): Promise<CronSchedule[]> {
  let query = fromTable('cron_schedules').select('*').order('next_run_at', { ascending: true });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CronSchedule[];
}

export async function getSchedule(id: string): Promise<CronSchedule | null> {
  const { data, error } = await fromTable('cron_schedules').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as CronSchedule | null;
}

export async function updateSchedule(
  id: string,
  updates: Partial<CreateScheduleInput> & { status?: ScheduleStatus },
): Promise<CronSchedule> {
  const patch: Record<string, unknown> = { ...updates, updated_at: new Date().toISOString() };

  if (updates.cron_expression) {
    patch.next_run_at = getNextCronRun(updates.cron_expression).toISOString();
  }

  const { data, error } = await fromTable('cron_schedules').update(patch).eq('id', id).select().single();
  if (error) throw error;
  return data as CronSchedule;
}

export async function pauseSchedule(id: string): Promise<CronSchedule> {
  return updateSchedule(id, { status: 'paused' });
}

export async function resumeSchedule(id: string): Promise<CronSchedule> {
  return updateSchedule(id, { status: 'active' });
}

export async function deleteSchedule(id: string): Promise<void> {
  const { error } = await fromTable('cron_schedules').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Execution History                                                  */
/* ------------------------------------------------------------------ */

export async function recordExecution(
  scheduleId: string,
  status: ScheduleExecution['status'],
  result?: Record<string, unknown>,
  errorMsg?: string,
  durationMs?: number,
  attempt?: number,
): Promise<ScheduleExecution> {
  const { data, error } = await supabase
    .from('cron_schedule_executions')
    .insert({
      schedule_id: scheduleId,
      status,
      result: result ?? null,
      error: errorMsg ?? null,
      duration_ms: durationMs ?? null,
      attempt: attempt ?? 1,
      completed_at: status !== 'running' ? new Date().toISOString() : null,
    })
    .select()
    .single();
  if (error) throw error;

  if (status === 'success' || status === 'failed') {
    const schedule = await getSchedule(scheduleId);
    if (schedule) {
      const newRunCount = schedule.run_count + 1;
      const shouldComplete =
        schedule.max_runs !== null && newRunCount >= schedule.max_runs;

      const updatePayload: Record<string, unknown> = {
        run_count: newRunCount,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (shouldComplete) {
        updatePayload.status = 'completed';
        updatePayload.next_run_at = null;
      } else if (schedule.cron_expression) {
        updatePayload.next_run_at = getNextCronRun(
          schedule.cron_expression,
        ).toISOString();
      } else if (schedule.interval_seconds) {
        const next = new Date();
        next.setSeconds(next.getSeconds() + schedule.interval_seconds);
        updatePayload.next_run_at = next.toISOString();
      }

      await fromTable('cron_schedules').update(updatePayload).eq('id', scheduleId);
    }
  }

  return data as ScheduleExecution;
}

export async function getScheduleExecutions(
  scheduleId: string,
  limit: number = 50,
): Promise<ScheduleExecution[]> {
  const { data, error } = await supabase
    .from('cron_schedule_executions')
    .select('*')
    .eq('schedule_id', scheduleId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ScheduleExecution[];
}

/* ------------------------------------------------------------------ */
/*  Stats & Dashboard                                                  */
/* ------------------------------------------------------------------ */

export async function getScheduleStats(): Promise<ScheduleStats> {
  const allSchedules = await listSchedules();
  const active = allSchedules.filter((s) => s.status === 'active');
  const paused = allSchedules.filter((s) => s.status === 'paused');

  const { data: executions, error } = await supabase
    .from('cron_schedule_executions')
    .select('status, duration_ms')
    .order('started_at', { ascending: false })
    .limit(1000);
  if (error) throw error;

  const execs = executions ?? [];
  const successCount = execs.filter((e) => e.status === 'success').length;
  const durations = execs
    .map((e) => e.duration_ms)
    .filter((d): d is number => d !== null);

  const upcoming = active
    .filter((s) => s.next_run_at !== null)
    .sort(
      (a, b) =>
        new Date(a.next_run_at!).getTime() - new Date(b.next_run_at!).getTime(),
    )
    .slice(0, 5);

  return {
    total_schedules: allSchedules.length,
    active_schedules: active.length,
    paused_schedules: paused.length,
    total_executions: execs.length,
    success_rate: execs.length > 0 ? (successCount / execs.length) * 100 : 0,
    avg_duration_ms:
      durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0,
    next_upcoming: upcoming,
  };
}

/* ------------------------------------------------------------------ */
/*  Preset Templates                                                   */
/* ------------------------------------------------------------------ */

export const CRON_PRESETS: Record<
  string,
  { label: string; expression: string; description: string }
> = {
  every_minute: {
    label: 'A cada minuto',
    expression: '* * * * *',
    description: 'Executa a cada 60 segundos',
  },
  every_5_min: {
    label: 'A cada 5 minutos',
    expression: '*/5 * * * *',
    description: 'Ideal para monitoramento',
  },
  every_15_min: {
    label: 'A cada 15 minutos',
    expression: '*/15 * * * *',
    description: 'Sincronização frequente',
  },
  every_hour: {
    label: 'A cada hora',
    expression: '0 * * * *',
    description: 'Relatórios horários',
  },
  business_hours: {
    label: 'Horário comercial (9h-18h)',
    expression: '0 9-18 * * 1-5',
    description: 'Seg-Sex, das 9h às 18h',
  },
  daily_morning: {
    label: 'Diário às 9h',
    expression: '0 9 * * *',
    description: 'Relatório matinal',
  },
  daily_evening: {
    label: 'Diário às 18h',
    expression: '0 18 * * *',
    description: 'Fechamento diário',
  },
  weekly_monday: {
    label: 'Semanal (Segunda)',
    expression: '0 9 * * 1',
    description: 'Reunião semanal',
  },
  monthly_first: {
    label: 'Mensal (dia 1)',
    expression: '0 0 1 * *',
    description: 'Fechamento mensal',
  },
  monthly_last_workday: {
    label: 'Último dia útil',
    expression: '0 18 25-31 * 1-5',
    description: 'Último dia útil do mês',
  },
};
