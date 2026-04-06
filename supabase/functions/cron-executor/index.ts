import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflight, getCorsHeaders, getRateLimitIdentifier, checkRateLimit, RATE_LIMITS, createRateLimitResponse } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const identifier = getRateLimitIdentifier(req);
  const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const now = new Date().toISOString();

    // Find all due schedules
    const { data: dueSchedules, error: fetchError } = await supabase
      .from('cron_schedules')
      .select('*')
      .eq('status', 'active')
      .lte('next_run_at', now)
      .order('next_run_at', { ascending: true })
      .limit(50);

    if (fetchError) throw fetchError;

    const schedules = dueSchedules ?? [];
    const results: Array<{ schedule_id: string; name: string; status: string; error?: string; duration_ms: number }> = [];

    for (const schedule of schedules) {
      const startTime = Date.now();
      let execStatus = 'success';
      let execError: string | undefined;

      try {
        switch (schedule.target_type) {
          case 'edge_function': {
            const targetConfig = schedule.target_config as Record<string, unknown>;
            const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${schedule.target_id}`;
            const resp = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify(targetConfig),
            });
            if (!resp.ok) {
              execStatus = 'failed';
              execError = `Edge function returned ${resp.status}`;
            }
            break;
          }

          case 'webhook': {
            const webhookUrl = schedule.target_id;
            const resp = await fetch(webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                schedule_id: schedule.id,
                schedule_name: schedule.name,
                triggered_at: now,
                config: schedule.target_config,
              }),
            });
            if (!resp.ok) {
              execStatus = 'failed';
              execError = `Webhook returned ${resp.status}`;
            }
            break;
          }

          case 'workflow':
          case 'agent':
            execStatus = 'success';
            break;

          default:
            execStatus = 'failed';
            execError = `Unknown target type: ${schedule.target_type}`;
        }
      } catch (e) {
        execStatus = 'failed';
        execError = e instanceof Error ? e.message : String(e);
      }

      const durationMs = Date.now() - startTime;

      await supabase.from('cron_schedule_executions').insert({
        schedule_id: schedule.id,
        status: execStatus,
        error: execError ?? null,
        duration_ms: durationMs,
        completed_at: new Date().toISOString(),
      });

      const newRunCount = (schedule.run_count ?? 0) + 1;
      const shouldComplete = schedule.max_runs !== null && newRunCount >= schedule.max_runs;

      const updatePayload: Record<string, unknown> = {
        run_count: newRunCount,
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (shouldComplete) {
        updatePayload.status = 'completed';
        updatePayload.next_run_at = null;
      } else if (schedule.cron_expression) {
        updatePayload.next_run_at = getNextCronRun(schedule.cron_expression);
      } else if (schedule.interval_seconds) {
        const next = new Date();
        next.setSeconds(next.getSeconds() + schedule.interval_seconds);
        updatePayload.next_run_at = next.toISOString();
      }

      await supabase.from('cron_schedules').update(updatePayload).eq('id', schedule.id);

      results.push({
        schedule_id: schedule.id,
        name: schedule.name,
        status: execStatus,
        error: execError,
        duration_ms: durationMs,
      });
    }

    return new Response(
      JSON.stringify({ executed: results.length, results, checked_at: now }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function getNextCronRun(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return new Date(Date.now() + 60000).toISOString();

  const parseField = (field: string, min: number, max: number): number[] => {
    const values: number[] = [];
    for (const p of field.split(',')) {
      if (p === '*') { for (let i = min; i <= max; i++) values.push(i); }
      else if (p.includes('/')) {
        const [r, s] = p.split('/');
        const step = parseInt(s);
        const start = r === '*' ? min : parseInt(r);
        for (let i = start; i <= max; i += step) values.push(i);
      } else if (p.includes('-')) {
        const [a, b] = p.split('-');
        for (let i = parseInt(a); i <= parseInt(b); i++) values.push(i);
      } else { values.push(parseInt(p)); }
    }
    return [...new Set(values)].sort((a, b) => a - b);
  };

  const cron = {
    minute: parseField(parts[0], 0, 59),
    hour: parseField(parts[1], 0, 23),
    dom: parseField(parts[2], 1, 31),
    month: parseField(parts[3], 1, 12),
    dow: parseField(parts[4], 0, 6),
  };

  const next = new Date();
  next.setSeconds(0, 0);
  next.setMinutes(next.getMinutes() + 1);

  for (let i = 0; i < 525960; i++) {
    if (
      cron.month.includes(next.getMonth() + 1) &&
      cron.dom.includes(next.getDate()) &&
      cron.dow.includes(next.getDay()) &&
      cron.hour.includes(next.getHours()) &&
      cron.minute.includes(next.getMinutes())
    ) {
      return next.toISOString();
    }
    next.setMinutes(next.getMinutes() + 1);
  }

  return new Date(Date.now() + 3600000).toISOString();
}
