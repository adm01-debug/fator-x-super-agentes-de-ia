import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const ActionSchema = z.object({
  action: z.enum(['request_deletion', 'get_my_data', 'consent_grant', 'consent_revoke', 'deletion_status']),
  scope: z.enum(['all', 'traces', 'sessions', 'memories']).optional().default('all'),
  purpose: z.string().min(1).max(200).optional(),
  legal_basis: z.string().max(100).optional(),
});

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const raw = await req.json();
    const parsed = ActionSchema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);

    const { action, scope, purpose, legal_basis } = parsed.data;

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    if (action === 'request_deletion') {
      const { data: request, error } = await supabase.from('data_deletion_requests').insert({
        user_id: user.id, reason: scope, status: 'pending',
      }).select('id').single();
      if (error) throw new Error(error.message);

      let deleted = 0;
      try {
        if (scope === 'all' || scope === 'traces') {
          const { count } = await supabase.from('agent_traces').delete().eq('user_id', user.id);
          deleted += count || 0;
        }
        if (scope === 'all' || scope === 'sessions') {
          await supabase.from('sessions').delete().eq('user_id', user.id);
          deleted += 1;
        }
        if ((scope === 'all' || scope === 'memories') && wsId) {
          await supabase.from('agent_memories').delete().eq('workspace_id', wsId);
          deleted += 1;
        }
        if (scope === 'all') {
          await supabase.from('agent_usage').delete().eq('user_id', user.id);
          if (wsId) await supabase.from('usage_records').delete().eq('workspace_id', wsId);
        }
        await supabase.from('data_deletion_requests').update({ status: 'completed', completed_at: new Date().toISOString(), metadata: { items_deleted: deleted } } as Record<string, unknown>).eq('id', request.id);
      } catch (e: unknown) {
        await supabase.from('data_deletion_requests').update({ status: 'failed' } as Record<string, unknown>).eq('id', request.id);
        throw e;
      }

      return jsonResponse({ request_id: request.id, status: 'completed', items_deleted: deleted, scope });
    }

    if (action === 'get_my_data') {
      const [traces, sessions, memories, usage] = await Promise.all([
        supabase.from('agent_traces').select('id, event, created_at, input, output').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('sessions').select('id, status, started_at').eq('user_id', user.id).limit(50),
        wsId ? supabase.from('agent_memories').select('id, memory_type, content, created_at').eq('workspace_id', wsId).limit(100) : { data: [] },
        supabase.from('agent_usage').select('date, requests, tokens_input, tokens_output, total_cost_usd').eq('user_id', user.id).order('date', { ascending: false }).limit(90),
      ]);

      return jsonResponse({
        user_id: user.id, exported_at: new Date().toISOString(),
        traces: traces.data?.length || 0, sessions: sessions.data?.length || 0,
        memories: (memories as { data: unknown[] | null }).data?.length || 0, usage_days: usage.data?.length || 0,
        data: { traces: traces.data, sessions: sessions.data, memories: (memories as { data: unknown[] | null }).data, usage: usage.data },
      });
    }

    if (action === 'consent_grant' || action === 'consent_revoke') {
      if (!purpose) return jsonResponse({ error: 'purpose required for consent actions' }, 400);

      await supabase.from('consent_records').insert({
        user_id: user.id,
        consent_type: purpose,
        granted: action === 'consent_grant',
        metadata: { legal_basis: legal_basis || 'consent' },
      });

      return jsonResponse({ status: 'ok', action, purpose });
    }

    if (action === 'deletion_status') {
      const { data: requests } = await supabase.from('data_deletion_requests').select('*').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(10);
      return jsonResponse({ requests: requests || [] });
    }

    return jsonResponse({ error: 'Invalid action' }, 400);

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
