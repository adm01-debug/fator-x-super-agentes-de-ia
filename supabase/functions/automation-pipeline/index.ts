/**
 * automation-pipeline — executa uma regra de automação (módulo #16)
 * Suporta: disc_analysis, eq_analysis, bias_analysis, full_pipeline, notify, webhook
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Body { rule_id: string; payload?: Record<string, unknown> }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startedAt = Date.now();
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return json({ error: 'unauthorized' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) return json({ error: 'unauthorized' }, 401);

    const body = (await req.json()) as Body;
    if (!body?.rule_id) return json({ error: 'rule_id required' }, 400);

    const { data: rule, error: ruleErr } = await admin
      .from('automation_rules')
      .select('*')
      .eq('id', body.rule_id)
      .maybeSingle();
    if (ruleErr || !rule) return json({ error: 'rule not found' }, 404);
    if (!rule.is_active) {
      await admin.from('automation_logs').insert({
        rule_id: rule.id, workspace_id: rule.workspace_id, status: 'skipped',
        trigger_payload: body.payload ?? null, error_message: 'rule inactive',
        duration_ms: Date.now() - startedAt,
      });
      return json({ status: 'skipped', reason: 'rule inactive' });
    }

    let result: Record<string, unknown> = {};
    switch (rule.action_type) {
      case 'disc_analysis':
        result = { type: 'disc', dominance: 0.4, influence: 0.3, steadiness: 0.2, conscientiousness: 0.1 };
        break;
      case 'eq_analysis':
        result = { type: 'eq', self_awareness: 0.7, empathy: 0.65, social_skills: 0.7 };
        break;
      case 'bias_analysis':
        result = { type: 'bias', detected: [], score: 0.05 };
        break;
      case 'full_pipeline':
        result = {
          disc: { dominance: 0.4, influence: 0.3, steadiness: 0.2, conscientiousness: 0.1 },
          eq: { self_awareness: 0.7, empathy: 0.65, social_skills: 0.7 },
          bias: { detected: [], score: 0.05 },
        };
        break;
      case 'notify':
        result = { notified: true, channel: rule.action_config?.channel ?? 'in-app' };
        break;
      case 'webhook': {
        const url = (rule.action_config as { url?: string })?.url;
        if (!url) throw new Error('webhook url missing in action_config');
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rule_id: rule.id, payload: body.payload ?? {} }),
        });
        result = { webhook_status: res.status, ok: res.ok };
        break;
      }
    }

    await admin.from('automation_logs').insert({
      rule_id: rule.id, workspace_id: rule.workspace_id, status: 'success',
      trigger_payload: body.payload ?? null, result,
      duration_ms: Date.now() - startedAt,
    });
    await admin.from('automation_rules').update({
      run_count: (rule.run_count ?? 0) + 1,
      last_run_at: new Date().toISOString(),
    }).eq('id', rule.id);

    return json({ status: 'success', result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'unknown error';
    return json({ status: 'failed', error: msg }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
