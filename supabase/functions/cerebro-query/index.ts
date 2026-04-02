import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { query } = body;

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();

    // ═══ Gather context from LOCAL Supabase tables ═══
    const facts: string[] = [];

    // Count agents
    const { count: agentCount } = await supabase.from('agents').select('id', { count: 'exact', head: true });
    if (agentCount) facts.push(`Temos ${agentCount} agentes configurados na plataforma`);

    // Count knowledge bases
    const { count: kbCount } = await supabase.from('knowledge_bases').select('id', { count: 'exact', head: true });
    if (kbCount) facts.push(`Temos ${kbCount} bases de conhecimento`);

    // Count traces (last 24h)
    const yesterday = new Date(Date.now() - 86400000).toISOString();
    const { count: traceCount } = await supabase.from('agent_traces').select('id', { count: 'exact', head: true }).gte('created_at', yesterday);
    if (traceCount) facts.push(`${traceCount} interações nas últimas 24h`);

    // Get recent usage
    const { data: usage } = await supabase.from('agent_usage').select('total_cost_usd, requests').order('date', { ascending: false }).limit(7);
    if (usage && usage.length > 0) {
      const totalCost = usage.reduce((s: number, u: any) => s + (u.total_cost_usd || 0), 0);
      const totalReqs = usage.reduce((s: number, u: any) => s + (u.requests || 0), 0);
      facts.push(`Últimos 7 dias: ${totalReqs} requests, custo total $${totalCost.toFixed(4)}`);
    }

    // Get budget status
    if (member?.workspace_id) {
      const { data: budgets } = await supabase.from('budgets').select('name, limit_usd, current_usd').eq('workspace_id', member.workspace_id).eq('is_active', true);
      if (budgets) {
        for (const b of budgets) {
          facts.push(`Budget "${b.name}": $${Number(b.current_usd || 0).toFixed(2)} / $${b.limit_usd} (${(Number(b.current_usd || 0) / Number(b.limit_usd) * 100).toFixed(0)}%)`);
        }
      }
    }

    // ═══ Gather context from external DBs via workspace secrets ═══
    // External queries use Supabase REST API (URL + anon key stored as secrets)
    const externalFacts: string[] = [];
    if (member?.workspace_id) {
      const extDbs = [
        { urlKey: 'ext_clientes_url', anonKey: 'ext_clientes_anon', label: 'CRM Clientes', queries: [
          { table: 'companies', filter: 'is_customer.eq.true,status.eq.ativo', countLabel: 'clientes ativos' },
          { table: 'companies', filter: 'is_supplier.eq.true,status.eq.ativo', countLabel: 'fornecedores ativos' },
        ]},
        { urlKey: 'ext_produtos_url', anonKey: 'ext_produtos_anon', label: 'Catálogo', queries: [
          { table: 'products', filter: '', countLabel: 'produtos no catálogo' },
        ]},
      ];

      for (const db of extDbs) {
        try {
          const { data: urlSecret } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', member.workspace_id).eq('key_name', db.urlKey).single();
          const { data: anonSecret } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', member.workspace_id).eq('key_name', db.anonKey).single();
          if (urlSecret?.key_value && anonSecret?.key_value) {
            const extClient = createClient(urlSecret.key_value, anonSecret.key_value);
            for (const q of db.queries) {
              let query = extClient.from(q.table).select('id', { count: 'exact', head: true });
              if (q.filter) {
                for (const f of q.filter.split(',')) {
                  const [col, op, val] = f.split('.');
                  if (op === 'eq') query = query.eq(col, val === 'true' ? true : val);
                }
              }
              const { count } = await query;
              if (count !== null) externalFacts.push(`${count} ${q.countLabel}`);
            }
          }
        } catch { /* skip failed external connections */ }
      }
    }

    // ═══ RAG context from knowledge base chunks ═══
    let ragContext = '';
    try {
      const { data: chunks } = await supabase.from('chunks').select('content').eq('embedding_status', 'done').limit(10);
      if (chunks && chunks.length > 0) ragContext = chunks.map((c: any) => c.content).join('\n---\n').substring(0, 3000);
    } catch { /* no RAG data */ }

    // ═══ Build system prompt ═══
    const allFacts = [...facts, ...externalFacts];
    const systemPrompt = `Você é o Super Cérebro da Promo Brindes — a inteligência central da empresa.

## Dados da Plataforma Fator X
${allFacts.length > 0 ? allFacts.map(f => `- ${f}`).join('\n') : '- Nenhum dado carregado ainda'}

${externalFacts.length > 0 ? `## Dados dos Bancos Externos\n${externalFacts.map(f => '- ' + f).join('\n')}` : ''}

${ragContext ? `## Base de Conhecimento (RAG)\n${ragContext}` : ''}

## Instruções
- Responda com base nos dados reais disponíveis acima
- Se não tiver dados, diga claramente
- Use português do Brasil`;

    // Call LLM Gateway
    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    const resp = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
      body: JSON.stringify({
        model: 'claude-sonnet-4.6',
        messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
        temperature: 0.5, max_tokens: 4000,
      }),
    });
    const result = await resp.json();

    return new Response(JSON.stringify({
      response: result.content || result.error,
      facts_loaded: allFacts.length,
      external_facts: externalFacts.length,
      rag_chunks_used: ragContext.length > 0,
      model: result.model, tokens: result.tokens, cost_usd: result.cost_usd,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
