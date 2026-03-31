import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface OracleRequest {
  query: string;
  mode: string;
  members: Array<{ model: string; persona?: string }>;
  chairman_model?: string;
  enable_peer_review?: boolean;
  enable_thinking?: boolean;
  preset_id?: string;
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
    const { query, mode = 'council', members, chairman_model, enable_peer_review = true, enable_thinking = false } = body;

    if (!query || !members?.length || members.length < 2) {
      return new Response(JSON.stringify({ error: 'query and at least 2 members required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    const totalStartTime = Date.now();

    // Build system prompt based on mode
    const buildSystemPrompt = (member: { model: string; persona?: string }) => {
      const thinkingInstructions = enable_thinking
        ? '\n\nAntes de dar sua resposta final, pense passo a passo:\n💭 Passo 1: Quais são os fatos relevantes?\n💭 Passo 2: Quais são as possíveis abordagens?\n💭 Passo 3: Quais são os riscos?\n💭 Passo 4: Minha recomendação e por quê?\n\nSepare claramente o raciocínio da resposta final usando "## Resposta" antes da resposta.'
        : '';

      const modeInstructions: Record<string, string> = {
        council: `Você é ${member.persona || 'um especialista'}. Responda de forma completa e fundamentada.${thinkingInstructions}`,
        researcher: `Você é ${member.persona || 'um pesquisador'}. Analise a questão em profundidade, cite dados e tendências relevantes. Estruture a resposta com seções claras.${thinkingInstructions}`,
        validator: `Você é ${member.persona || 'um verificador de fatos'}. Verifique a veracidade da afirmação/pergunta. Classifique como: CONFIRMADO, DISPUTADO ou NÃO VERIFICADO. Apresente evidências a favor e contra.${thinkingInstructions}`,
        executor: `Você é ${member.persona || 'um executor'}. Decomponha a tarefa em sub-tarefas concretas e acionáveis. Para cada sub-tarefa, indique: responsável sugerido, prazo estimado, e dependências.${thinkingInstructions}`,
        advisor: `Você é ${member.persona || 'um conselheiro'}. Analise a decisão apresentada. Liste prós e contras de cada opção, avalie riscos, e dê uma recomendação fundamentada com score de confiança.${thinkingInstructions}`,
      };
      return modeInstructions[mode] || modeInstructions.council;
    };

    // ═══ STAGE 1: Parallel Polling ═══
    const stage1Start = Date.now();
    const stage1Promises = members.map(async (member, idx) => {
      try {
        const response = await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader!, 'apikey': supabaseKey },
          body: JSON.stringify({
            model: member.model,
            messages: [
              { role: 'system', content: buildSystemPrompt(member) },
              { role: 'user', content: query },
            ],
            temperature: mode === 'validator' ? 0.3 : 0.7,
            max_tokens: 3000,
          }),
        });
        const result = await response.json();
        
        // Separate thinking from content
        let content = result.content || result.error || 'No response';
        let thinking = '';
        if (enable_thinking && content.includes('💭')) {
          const splitIdx = content.indexOf('## Resposta');
          if (splitIdx > -1) {
            thinking = content.substring(0, splitIdx).trim();
            content = content.substring(splitIdx).trim();
          }
        }

        return {
          index: idx, model: member.model, persona: member.persona || 'General',
          content, thinking,
          tokens: result.tokens || { total: 0 }, cost_usd: result.cost_usd || 0,
          latency_ms: result.latency_ms || 0, success: !result.error,
        };
      } catch (e: any) {
        return {
          index: idx, model: member.model, persona: member.persona || 'General',
          content: `Error: ${e.message}`, thinking: '',
          tokens: { total: 0 }, cost_usd: 0, latency_ms: 0, success: false,
        };
      }
    });

    const stage1Results = await Promise.allSettled(stage1Promises);
    const stage1 = stage1Results.map(r => r.status === 'fulfilled' ? r.value : null).filter(Boolean) as any[];
    const successfulResponses = stage1.filter(r => r.success);

    if (successfulResponses.length < 2) {
      return new Response(JSON.stringify({ error: 'Insufficient responses', stage1_results: stage1 }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stage1Latency = Date.now() - stage1Start;

    // ═══ STAGE 2: Peer Review (if enabled) ═══
    let stage2Results: any[] = [];
    let stage2Latency = 0;

    if (enable_peer_review && successfulResponses.length >= 2) {
      const stage2Start = Date.now();
      const shuffled = [...successfulResponses].sort(() => Math.random() - 0.5);
      const anonymized = shuffled.map((r, i) => `## Resposta ${String.fromCharCode(65 + i)}\n${r.content}`).join('\n\n---\n\n');

      const reviewPrompt = `Avalie as respostas anônimas à pergunta: "${query}"

${anonymized}

Para CADA resposta, atribua scores de 0 a 100 nos critérios:
- Precisão, Completude, Raciocínio, Aplicabilidade, Clareza

Também extraia os PONTOS DE CONSENSO e DIVERGÊNCIA entre as respostas.

Responda APENAS em JSON válido:
{
  "reviews": [
    { "response": "A", "scores": { "precisao": 85, "completude": 90, "raciocinio": 88, "aplicabilidade": 92, "clareza": 87 }, "total": 88.4 }
  ],
  "ranking": ["A", "B"],
  "consensus_points": [
    { "claim": "texto do ponto", "category": "fact", "consensus_level": "strong", "model_positions": [{ "response": "A", "position": "agree", "detail": "..." }] }
  ]
}`;

      const reviewModel = chairman_model || successfulResponses[0].model;
      const reviewResponse = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader!, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: reviewModel,
          messages: [
            { role: 'system', content: 'Você é um avaliador imparcial e criterioso. Responda SOMENTE em JSON válido.' },
            { role: 'user', content: reviewPrompt },
          ],
          temperature: 0.3, max_tokens: 3000,
        }),
      });

      const reviewResult = await reviewResponse.json();
      try {
        const jsonMatch = (reviewResult.content || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) stage2Results = [JSON.parse(jsonMatch[0])];
      } catch {
        stage2Results = [{ raw: reviewResult.content }];
      }
      stage2Latency = Date.now() - stage2Start;
    }

    // ═══ STAGE 3: Chairman Synthesis ═══
    const stage3Start = Date.now();
    const chairmanModel = chairman_model || successfulResponses[0].model;

    const responseSummary = successfulResponses.map((r, i) => `### Modelo ${i + 1} (${r.model}):\n${r.content}`).join('\n\n---\n\n');
    const reviewInfo = stage2Results.length > 0 ? `\n\n### Avaliação peer-review:\n${JSON.stringify(stage2Results[0], null, 2)}` : '';

    const modeSynthesisInstructions: Record<string, string> = {
      council: 'Sintetize UMA resposta final que incorpore os melhores pontos de cada resposta.',
      researcher: 'Compile um RELATÓRIO ESTRUTURADO com seções, dados-chave, e conclusões. Inclua metodologia e limitações.',
      validator: 'Emita um VEREDICTO: CONFIRMADO, DISPUTADO ou NÃO VERIFICADO. Liste evidências a favor e contra.',
      executor: 'Compile um PLANO DE AÇÃO consolidado com sub-tarefas priorizadas, responsáveis e cronograma.',
      advisor: 'Apresente uma MATRIZ DE DECISÃO com prós/contras, scores por critério, e RECOMENDAÇÃO FINAL.',
    };

    const synthesisPrompt = `Você é o Chairman de um conselho de IAs (Modo: ${mode}).

Pergunta: "${query}"

${responseSummary}
${reviewInfo}

Sua tarefa:
1. ${modeSynthesisInstructions[mode] || modeSynthesisInstructions.council}
2. Identifique pontos de consenso e divergência
3. Atribua score de confiança (0-100) e consenso (0-100)

Responda em markdown:
## Resposta Sintetizada
(síntese)

## Pontos de Consenso
- (pontos)

## Divergências
- (pontos)

## Confiança: X/100
## Consenso: Y/100`;

    const synthesisResponse = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': authHeader!, 'apikey': supabaseKey },
      body: JSON.stringify({
        model: chairmanModel,
        messages: [
          { role: 'system', content: 'Você é o Chairman do Oráculo — um conselho de múltiplas IAs. Sua síntese deve ser a melhor resposta possível.' },
          { role: 'user', content: synthesisPrompt },
        ],
        temperature: 0.5, max_tokens: 4000,
      }),
    });

    const synthesisResult = await synthesisResponse.json();
    const stage3Latency = Date.now() - stage3Start;

    const finalContent = synthesisResult.content || '';
    const confidenceMatch = finalContent.match(/Confiança:\s*(\d+)/);
    const consensusMatch = finalContent.match(/Consenso:\s*(\d+)/);

    // Extract consensus points from stage 2
    let consensusPoints: any[] = [];
    if (stage2Results[0]?.consensus_points) {
      consensusPoints = stage2Results[0].consensus_points.map((cp: any, i: number) => ({
        id: `cp-${i}`,
        claim: cp.claim,
        category: cp.category || 'opinion',
        modelPositions: (cp.model_positions || []).map((mp: any) => ({
          model: mp.response || mp.model || `Model ${i}`,
          position: mp.position || 'not_mentioned',
          detail: mp.detail || '',
          confidence: mp.confidence || 70,
        })),
        consensusLevel: cp.consensus_level || 'partial',
        resolution: cp.resolution,
      }));
    }

    const totalLatency = Date.now() - totalStartTime;
    const totalCost = stage1.reduce((s: number, r: any) => s + (r.cost_usd || 0), 0) + (synthesisResult.cost_usd || 0);
    const totalTokens = stage1.reduce((s: number, r: any) => s + (r.tokens?.total || 0), 0) + (synthesisResult.tokens?.total || 0);

    return new Response(JSON.stringify({
      final_response: finalContent,
      confidence_score: confidenceMatch ? parseInt(confidenceMatch[1]) : 75,
      consensus_degree: consensusMatch ? parseInt(consensusMatch[1]) : 70,
      stage1_results: stage1,
      stage2_results: stage2Results,
      consensus_points: consensusPoints,
      metrics: {
        total_latency_ms: totalLatency,
        stage1_latency_ms: stage1Latency,
        stage2_latency_ms: stage2Latency,
        stage3_latency_ms: stage3Latency,
        total_cost_usd: totalCost,
        total_tokens: totalTokens,
        models_used: successfulResponses.length,
      },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
