import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflight, getCorsHeaders, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);
  const corsHeaders = getCorsHeaders(req);

  const rateCheck = checkRateLimit(getRateLimitIdentifier(req), RATE_LIMITS.standard);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, corsHeaders);

  try {
    const body = await req.json().catch(() => ({}));
    const queueId = body.queue_id as string | undefined;
    const workerId = body.worker_id as string ?? `worker-${crypto.randomUUID().slice(0, 8)}`;
    const batchSize = Math.min(body.batch_size as number ?? 5, 20);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get queue config
    let queues: Array<Record<string, unknown>> = [];
    if (queueId) {
      const { data } = await supabase.from('task_queues').select('*').eq('id', queueId).eq('is_paused', false);
      queues = data ?? [];
    } else {
      const { data } = await supabase.from('task_queues').select('*').eq('is_paused', false);
      queues = data ?? [];
    }

    const results: Array<{ queue: string; items_processed: number; successes: number; failures: number }> = [];

    for (const queue of queues) {
      // Check concurrency
      const { data: processing } = await supabase
        .from('queue_items')
        .select('id')
        .eq('queue_id', queue.id)
        .eq('status', 'processing');

      const currentProcessing = processing?.length ?? 0;
      const maxConcurrency = (queue.max_concurrency as number) ?? 5;
      const slotsAvailable = Math.max(0, maxConcurrency - currentProcessing);
      const toFetch = Math.min(batchSize, slotsAvailable);

      if (toFetch === 0) continue;

      // Determine order
      const strategy = (queue.strategy as string) ?? 'fifo';
      const orderCol = strategy === 'priority' ? 'priority' : 'created_at';
      const ascending = strategy !== 'lifo' && strategy !== 'priority';

      // Fetch pending items
      const now = new Date();
      const { data: pendingItems } = await supabase
        .from('queue_items')
        .select('*')
        .eq('queue_id', queue.id)
        .eq('status', 'pending')
        .order(orderCol, { ascending })
        .limit(toFetch);

      const items = pendingItems ?? [];
      let successes = 0;
      let failures = 0;

      for (const item of items) {
        // Lock item
        const lockUntil = new Date(now.getTime() + ((item.timeout_ms as number) ?? 30000));
        await supabase.from('queue_items').update({
          status: 'processing',
          started_at: now.toISOString(),
          attempt: ((item.attempt as number) ?? 0) + 1,
          locked_by: workerId,
          locked_until: lockUntil.toISOString(),
        }).eq('id', item.id).eq('status', 'pending');

        // Process item (dispatch to target if specified in payload)
        const startTime = Date.now();
        try {
          const payload = item.payload as Record<string, unknown>;
          const targetFn = payload._target_function as string | undefined;

          if (targetFn) {
            const fnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${targetFn}`;
            const resp = await fetch(fnUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify(payload),
            });
            if (!resp.ok) throw new Error(`Function ${targetFn} returned ${resp.status}`);
            const result = await resp.json();

            await supabase.from('queue_items').update({
              status: 'completed',
              result,
              completed_at: new Date().toISOString(),
              locked_by: null,
              locked_until: null,
            }).eq('id', item.id);
            successes++;
          } else {
            // No target function — mark as completed (processed by consumer later)
            await supabase.from('queue_items').update({
              status: 'completed',
              completed_at: new Date().toISOString(),
              locked_by: null,
              locked_until: null,
            }).eq('id', item.id);
            successes++;
          }
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e);
          const attempt = ((item.attempt as number) ?? 0) + 1;
          const maxRetries = (item.max_retries as number) ?? 3;
          const shouldRetry = attempt < maxRetries;

          await supabase.from('queue_items').update({
            status: shouldRetry ? 'pending' : 'dead_letter',
            error: errorMsg,
            locked_by: null,
            locked_until: null,
            completed_at: shouldRetry ? null : new Date().toISOString(),
          }).eq('id', item.id);

          failures++;
        }
      }

      // Update queue stats
      if (items.length > 0) {
        await supabase.from('task_queues').update({
          processed_count: ((queue.processed_count as number) ?? 0) + successes,
          failed_count: ((queue.failed_count as number) ?? 0) + failures,
          current_size: Math.max(0, ((queue.current_size as number) ?? 0) - successes - failures),
          updated_at: new Date().toISOString(),
        }).eq('id', queue.id);
      }

      results.push({
        queue: queue.name as string,
        items_processed: items.length,
        successes,
        failures,
      });
    }

    return new Response(
      JSON.stringify({
        worker_id: workerId,
        queues_processed: results.length,
        results,
        processed_at: new Date().toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
