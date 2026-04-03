import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { action } = body;
    // actions: 'request_deletion', 'get_my_data', 'consent_grant', 'consent_revoke', 'deletion_status'

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    if (action === 'request_deletion') {
      const scope = body.scope || 'all'; // 'all', 'traces', 'sessions', 'memories'
      const { data: request, error } = await (supabase as any).from('data_deletion_requests').insert({
        user_id: user.id, workspace_id: wsId, scope, status: 'processing',
      }).select('id').single();
      if (error) throw error;

      // Execute deletion
      let deleted = 0;
      try {
        if (scope === 'all' || scope === 'traces') {
          const { count } = await supabase.from('agent_traces').delete().eq('user_id', user.id);
          deleted += count || 0;
        }
        if (scope === 'all' || scope === 'sessions') {
          await (supabase as any).from('session_traces').delete().in('session_id',
            (supabase as any).from('sessions').select('id').eq('user_id', user.id)
          );
          await (supabase as any).from('sessions').delete().eq('user_id', user.id);
          deleted += 1; // approximate
        }
        if (scope === 'all' || scope === 'memories') {
          const { count } = await (supabase as any).from('agent_memories').delete().eq('workspace_id', wsId).select('id', { count: 'exact', head: true });
          deleted += count || 0;
        }
        if (scope === 'all') {
          await supabase.from('agent_usage').delete().eq('user_id', user.id);
          await supabase.from('usage_records').delete().eq('workspace_id', wsId);
        }
        await (supabase as any).from('data_deletion_requests').update({ status: 'completed', items_deleted: deleted, completed_at: new Date().toISOString() }).eq('id', request.id);
      } catch (e) {
        await (supabase as any).from('data_deletion_requests').update({ status: 'failed', error: (e as Error).message }).eq('id', request.id);
        throw e;
      }

      return new Response(JSON.stringify({ request_id: request.id, status: 'completed', items_deleted: deleted, scope }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_my_data') {
      const [traces, sessions, memories, usage] = await Promise.all([
        supabase.from('agent_traces').select('id, event, created_at, input, output').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
        (supabase as any).from('sessions').select('id, status, created_at').eq('user_id', user.id).limit(50),
        (supabase as any).from('agent_memories').select('id, memory_type, content, created_at').eq('workspace_id', wsId).limit(100),
        supabase.from('agent_usage').select('date, requests, tokens_input, tokens_output, total_cost_usd').eq('user_id', user.id).order('date', { ascending: false }).limit(90),
      ]);

      return new Response(JSON.stringify({
        user_id: user.id, exported_at: new Date().toISOString(),
        traces: traces.data?.length || 0, sessions: sessions.data?.length || 0,
        memories: memories.data?.length || 0, usage_days: usage.data?.length || 0,
        data: { traces: traces.data, sessions: sessions.data, memories: memories.data, usage: usage.data },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'consent_grant' || action === 'consent_revoke') {
      const { purpose, legal_basis } = body;
      if (!purpose) return new Response(JSON.stringify({ error: 'purpose required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await (supabase as any).from('consent_records').insert({
        user_id: user.id, workspace_id: wsId, purpose,
        legal_basis: legal_basis || 'consent',
        granted: action === 'consent_grant',
        granted_at: action === 'consent_grant' ? new Date().toISOString() : null,
        revoked_at: action === 'consent_revoke' ? new Date().toISOString() : null,
      });

      return new Response(JSON.stringify({ status: 'ok', action, purpose }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'deletion_status') {
      const { data: requests } = await (supabase as any).from('data_deletion_requests').select('*').eq('user_id', user.id).order('requested_at', { ascending: false }).limit(10);
      return new Response(JSON.stringify({ requests: requests || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use: request_deletion, get_my_data, consent_grant, consent_revoke, deletion_status' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
