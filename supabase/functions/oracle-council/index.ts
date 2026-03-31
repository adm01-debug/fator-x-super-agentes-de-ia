import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OracleRequest {
  query: string;
  members: Array<{ model: string; persona?: string }>;
  chairman_model?: string;
  enable_peer_review?: boolean;
  workspace_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: OracleRequest = await req.json();
    const { query, members, chairman_model, enable_peer_review = true } = body;

    if (!query || !members?.length || members.length < 2) {
      return new Response(JSON.stringify({ error: 'query and at least 2 members required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    const totalStartTime = Date.now();

    // ═══ STAGE 1: Parallel Polling ═══
    const stage1Start = Date.now();
    const stage1Promises = members.map(async (member, idx) => {
      const systemPrompt = member.persona
        ? `Você é ${member.persona}. Responda a pergunta de forma completa e fundamentada.`
        : 'Responda a pergunta de forma completa, precisa e fundamentada.';

      try {
        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': authHeader!,
            'apikey': supabaseKey,
          },
          body: JSON.stringify({
            model: member.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: query },
            ],
            temperature: 0.7,
            max_tokens: 3000,
          }),
        });
        const result = await response.json();
        return {
          index: idx,
          model: member.model,
          persona: member.persona || 'General',
          content: result.content || result.error || 'No response',
          tokens: result.tokens || { total: 0 },
          cost_usd: result.cost_usd || 0,
          latency_ms: result.latency_ms || 0,
          success: !result.error,
        };
      } catch (e: any) {
        return {
          index: idx,
          model: member.model,
          persona: member.persona || 'General',
          content: `Error: ${e.message}`,
          tokens: { total: 0 },
          cost_usd: 0,
          latency_ms: 0,
          success: false,
        };
      }
    });

    const stage1Results = await Promise.allSettled(stage1Promises);
    const stage1 = stage1Results
      .map(r => r.status === 'fulfilled' ? r.value : null)
      .filter(Boolean) as any[];

    const successfulResponses = stage1.filter(r => r.success);
    if (successfulResponses.length < 2) {
      return new Response(JSON.stringify({
        error: 'Insufficient responses. At least 2 models must respond.',
        stage1_results: stage1,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const stage1Latency = Date.now() - stage1Start;

    // ═══ STAGE 2: Peer Review ═══
    let stage2Results: any[] = [];
    let stage2Latency = 0;

    if (enable_peer_review && successfulResponses.length >= 2) {
      const stage2Start = Date.now();

      // Shuffle and anonymize
      const shuffled = [...successfulResponses].sort(() => Math.random() - 0.5);
      const anonymized = shuffled.map((r, i) => `## Resposta ${String.fromCharCode(65 + i)}\n${r.content}`).join('\n\n---\n\n');

      const reviewPrompt = `Avalie as seguintes respostas anônimas à pergunta: "${query}"

${anonymized}

Para CADA resposta, atribua scores de 0 a 100 nos critérios:
- Precisão: factualidade e correção
- Completude: abrangência da resposta
- Raciocínio: qualidade da argumentação
- Aplicabilidade: utilidade prática
- Clareza: facilidade de compreensão

Responda APENAS em JSON válido:
{
  "reviews": [
    { "response": "A", "scores": { "precisao": 85, "completude": 90, "raciocinio": 88, "aplicabilidade": 92, "clareza": 87 }, "total": 88.4 },
    ...
  ],
  "ranking": ["A", "B", "C"]
}`;

      const reviewModel = chairman_model || successfulResponses[0].model;
      const reviewResponse = await fetch(gatewayUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader!,
          'apikey': supabaseKey,
        },
        body: JSON.stringify({
          model: reviewModel,
          messages: [
            { role: 'system', content: 'Você é um avaliador imparcial e criterioso.' },
            { role: 'user', content: reviewPrompt },
          ],
          temperature: 0.3,
          max_tokens: 2000,
        }),
      });

      const reviewResult = await reviewResponse.json();
      try {
        const jsonMatch = (reviewResult.content || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          stage2Results = [JSON.parse(jsonMatch[0])];
        }
      } catch {
        stage2Results = [{ raw: reviewResult.content }];
      }
      stage2Latency = Date.now() - stage2Start;
    }

    // ═══ STAGE 3: Chairman Synthesis ═══
    const stage3Start = Date.now();
    const chairmanModel = chairman_model || successfulResponses[0].model;

    const responseSummary = successfulResponses
      .map((r, i) => `### Modelo ${i + 1} (${r.model}):\n${r.content}`)
      .join('\n\n---\n\n');

    const reviewInfo = stage2Results.length > 0
      ? `\n\n### Avaliação peer-review:\n${JSON.stringify(stage2Results[0], null, 2)}`
      : '';

    const synthesisPrompt = `Você é o Chairman de um conselho de IAs. Analise as respostas abaixo à pergunta:

"${query}"

${responseSummary}
${reviewInfo}

Sua tarefa:
1. Sintetize UMA resposta final que incorpore os melhores pontos de cada resposta
2. Identifique pontos de consenso e divergência
3. Atribua um score de confiança (0-100) baseado no grau de acordo entre os modelos

Responda em markdown com a seguinte estrutura:
## Resposta Sintetizada
(sua síntese aqui)

## Pontos de Consenso
- (pontos em que todos concordam)

## Divergências
- (pontos de discordância)

## Confiança: X/100
## Consenso: Y/100`;

    const synthesisResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader!,
        'apikey': supabaseKey,
      },
      body: JSON.stringify({
        model: chairmanModel,
        messages: [
          { role: 'system', content: 'Você é o Chairman do Oráculo — um conselho de múltiplas IAs. Sua síntese deve ser a melhor resposta possível.' },
          { role: 'user', content: synthesisPrompt },
        ],
        temperature: 0.5,
        max_tokens: 4000,
      }),
    });

    const synthesisResult = await synthesisResponse.json();
    const stage3Latency = Date.now() - stage3Start;

    // Extract confidence/consensus
    const finalContent = synthesisResult.content || '';
    const confidenceMatch = finalContent.match(/Confiança:\s*(\d+)/);
    const consensusMatch = finalContent.match(/Consenso:\s*(\d+)/);

    const totalLatency = Date.now() - totalStartTime;
    const totalCost = stage1.reduce((sum: number, r: any) => sum + (r.cost_usd || 0), 0) + (synthesisResult.cost_usd || 0);
    const totalTokens = stage1.reduce((sum: number, r: any) => sum + (r.tokens?.total || 0), 0) + (synthesisResult.tokens?.total || 0);

    return new Response(JSON.stringify({
      final_response: finalContent,
      confidence_score: confidenceMatch ? parseInt(confidenceMatch[1]) : 75,
      consensus_degree: consensusMatch ? parseInt(consensusMatch[1]) : 70,
      stage1_results: stage1,
      stage2_results: stage2Results,
      consensus_points: [],
      divergence_points: [],
      metrics: {
        total_latency_ms: totalLatency,
        stage1_latency_ms: stage1Latency,
        stage2_latency_ms: stage2Latency,
        stage3_latency_ms: stage3Latency,
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
        models_used: successfulResponses.length,
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
