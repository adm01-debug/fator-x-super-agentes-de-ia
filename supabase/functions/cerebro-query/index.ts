import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// External DB connections (resolved via workspace secrets)
const DB_CONNECTIONS: Record<string, { secretName: string; description: string }> = {
  bancodadosclientes: { secretName: 'supabase_clientes_url', description: 'CRM - Clientes, Fornecedores, Transportadoras' },
  'supabase-fuchsia-kite': { secretName: 'supabase_produtos_url', description: 'Catálogo de Produtos' },
  gestao_time_promo: { secretName: 'supabase_rh_url', description: 'RH - Colaboradores, Ponto, Departamentos' },
  backupgiftstore: { secretName: 'supabase_whatsapp_url', description: 'WhatsApp - Conversas e Contatos' },
};

// Auto-facts queries
const AUTO_FACTS = [
  { connection: 'bancodadosclientes', query: "SELECT COUNT(*) as v FROM companies WHERE is_customer AND status='ativo'", template: 'Temos {v} clientes ativos' },
  { connection: 'bancodadosclientes', query: "SELECT COUNT(*) as v FROM companies WHERE is_supplier AND status='ativo'", template: 'Temos {v} fornecedores ativos' },
  { connection: 'bancodadosclientes', query: "SELECT COUNT(*) as v FROM companies WHERE is_carrier AND status='ativo'", template: 'Temos {v} transportadoras ativas' },
  { connection: 'supabase-fuchsia-kite', query: 'SELECT COUNT(*) as v FROM products', template: 'Temos {v} produtos no catálogo' },
];

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
    const { query, mode = 'chat' } = body;

    // Get workspace
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();

    // Gather auto-facts context from external Supabase projects
    const facts: string[] = [];
    if (member?.workspace_id) {
      for (const af of AUTO_FACTS) {
        try {
          const conn = DB_CONNECTIONS[af.connection];
          if (!conn) continue;
          const { data: secret } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', member.workspace_id).eq('key_name', conn.secretName).single();
          if (secret?.key_value) {
            // Format: "supabaseUrl|anonKey"
            const parts = secret.key_value.split('|');
            if (parts.length !== 2) continue;
            const extSupabase = createClient(parts[0].trim(), parts[1].trim());
            // Use table-based queries instead of raw SQL (rpc('sql') doesn't exist by default)
            if (af.connection === 'bancodadosclientes') {
              if (af.template.includes('clientes')) {
                const { count } = await extSupabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_customer', true).eq('status', 'ativo');
                if (count !== null) facts.push(af.template.replace('{v}', String(count)));
              } else if (af.template.includes('fornecedores')) {
                const { count } = await extSupabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_supplier', true).eq('status', 'ativo');
                if (count !== null) facts.push(af.template.replace('{v}', String(count)));
              } else if (af.template.includes('transportadoras')) {
                const { count } = await extSupabase.from('companies').select('id', { count: 'exact', head: true }).eq('is_carrier', true).eq('status', 'ativo');
                if (count !== null) facts.push(af.template.replace('{v}', String(count)));
              }
            } else if (af.connection === 'supabase-fuchsia-kite') {
              const { count } = await extSupabase.from('products').select('id', { count: 'exact', head: true });
              if (count !== null) facts.push(af.template.replace('{v}', String(count)));
            }
          }
        } catch { /* skip failed connections */ }
      }
    }

    // Load knowledge base chunks (semantic search if available)
    let ragContext = '';
    try {
      const { data: kbs } = await supabase.from('knowledge_bases').select('id').limit(3);
      if (kbs) {
        for (const kb of kbs) {
          const { data: chunks } = await supabase.from('chunks').select('content').eq('embedding_status', 'done').limit(5);
          if (chunks) ragContext += chunks.map(c => c.content).join('\n---\n');
        }
      }
    } catch { /* no RAG */ }

    // Load business rules
    let rulesContext = '';
    try {
      const { data: rules } = await supabase.from('config_regras_negocio').select('chave, valor, descricao').limit(20);
      if (rules) rulesContext = rules.map(r => `${r.descricao || r.chave}: ${r.valor}`).join('\n');
    } catch { /* no rules table */ }

    // Build enriched system prompt
    const systemPrompt = `Você é o Super Cérebro da Promo Brindes — a inteligência central da empresa.

## Fatos Atualizados
${facts.length > 0 ? facts.join('\n') : 'Nenhum fato auto-calculado disponível (configure as conexões externas em Settings)'}

${rulesContext ? `## Regras de Negócio\n${rulesContext}` : ''}

${ragContext ? `## Contexto da Base de Conhecimento\n${ragContext.substring(0, 3000)}` : ''}

## Instruções
- Responda com base nos dados reais disponíveis
- Se não tiver dados suficientes, diga claramente o que falta
- Use números e fatos concretos quando disponíveis
- Responda em português do Brasil`;

    // Call LLM Gateway
    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    const resp = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
      body: JSON.stringify({
        model: 'claude-sonnet-4.6',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query },
        ],
        temperature: 0.5, max_tokens: 4000,
      }),
    });

    const result = await resp.json();

    return new Response(JSON.stringify({
      response: result.content || result.error,
      facts_loaded: facts.length,
      rag_chunks_used: ragContext ? true : false,
      rules_loaded: rulesContext ? true : false,
      model: result.model,
      tokens: result.tokens,
      cost_usd: result.cost_usd,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
