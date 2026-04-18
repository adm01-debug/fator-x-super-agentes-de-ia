// Sprint 33: Incident Orchestrator — executes playbook actions sequentially
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Action = {
  type: 'notify' | 'disable_chaos' | 'pause_agent' | 'switch_provider' | 'page_oncall';
  config?: Record<string, unknown>;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { playbook_id, trigger_event, triggered_by } = await req.json();
    if (!playbook_id) {
      return new Response(JSON.stringify({ error: 'playbook_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Create run (returns null if cooldown)
    const { data: runId, error: runErr } = await supabase.rpc('create_incident_run', {
      p_playbook_id: playbook_id,
      p_triggered_by: triggered_by ?? 'orchestrator',
      p_trigger_event: trigger_event ?? {},
    });
    if (runErr) throw runErr;
    if (!runId) {
      return new Response(JSON.stringify({ skipped: true, reason: 'cooldown_or_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load playbook
    const { data: pb } = await supabase.from('incident_playbooks').select('*').eq('id', playbook_id).single();
    if (!pb) throw new Error('playbook not found');

    const actions: Action[] = pb.actions || [];
    const results: Array<Record<string, unknown>> = [];
    let overallStatus: 'succeeded' | 'failed' | 'partial' = 'succeeded';

    for (const [idx, action] of actions.entries()) {
      const startedAt = new Date().toISOString();
      try {
        let outcome: Record<string, unknown> = { ok: true };
        switch (action.type) {
          case 'notify':
            outcome = { ok: true, message: action.config?.message ?? 'Incident notification' };
            break;
          case 'disable_chaos': {
            const { data, error } = await supabase
              .from('chaos_experiments')
              .update({ enabled: false })
              .eq('workspace_id', pb.workspace_id)
              .eq('enabled', true)
              .select('id');
            if (error) throw error;
            outcome = { ok: true, disabled_count: data?.length ?? 0 };
            break;
          }
          case 'pause_agent': {
            const agentId = action.config?.agent_id as string | undefined;
            const query = supabase.from('agents').update({ status: 'paused' }).eq('workspace_id', pb.workspace_id);
            const { data, error } = agentId ? await query.eq('id', agentId).select('id') : await query.eq('status', 'active').select('id');
            if (error) throw error;
            outcome = { ok: true, paused_count: data?.length ?? 0 };
            break;
          }
          case 'switch_provider':
            outcome = { ok: true, switched_to: action.config?.provider ?? 'fallback', note: 'logged for manual config' };
            break;
          case 'page_oncall': {
            const { data } = await supabase.rpc('get_current_oncall', { p_workspace_id: pb.workspace_id });
            outcome = { ok: true, paged: data ?? [] };
            break;
          }
          default:
            outcome = { ok: false, error: `unknown action type: ${action.type}` };
            overallStatus = 'partial';
        }
        results.push({ idx, type: action.type, started_at: startedAt, ended_at: new Date().toISOString(), ...outcome });
      } catch (e) {
        overallStatus = 'partial';
        results.push({ idx, type: action.type, started_at: startedAt, ended_at: new Date().toISOString(), ok: false, error: String(e) });
      }
    }

    if (results.length > 0 && results.every((r) => !r.ok)) overallStatus = 'failed';

    await supabase.rpc('update_incident_run', {
      p_run_id: runId,
      p_status: overallStatus,
      p_action_results: results,
      p_notes: null,
    });

    return new Response(JSON.stringify({ run_id: runId, status: overallStatus, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('orchestrator error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
