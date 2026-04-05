import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const TTS_MODEL = 'facebook/mms-tts-por'; // Portuguese TTS
const TTS_TIMEOUT_MS = 15000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return new Response(JSON.stringify({ error: 'HF_API_TOKEN not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { action, text, language, return_format } = body;

    // ═══ ACTION: clone_voice — Voice cloning with reference audio (#42) ═══
    if (action === 'clone_voice') {
      const { text: cloneText, reference_audio_base64, voice_description } = body;
      if (!cloneText) return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Approach 1: Use Qwen3-TTS via Gradio Space API (voice design via description)
      if (voice_description && !reference_audio_base64) {
        try {
          const spaceResp = await fetch('https://qwen-qwen3-tts.hf.space/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [cloneText, voice_description] }),
            signal: AbortSignal.timeout(30000),
          });
          if (spaceResp.ok) {
            const result = await spaceResp.json();
            return new Response(JSON.stringify({
              audio_url: result.data?.[0]?.url || null,
              model: 'Qwen/Qwen3-TTS',
              voice_description,
              cost_usd: 0,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } catch { /* fallback to standard TTS */ }
      }

      // Approach 2: Use XTTS-v2 via Gradio Space (voice cloning with reference)
      if (reference_audio_base64) {
        try {
          const spaceResp = await fetch('https://coqui-xtts.hf.space/api/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: [cloneText, { data: `data:audio/wav;base64,${reference_audio_base64}`, name: 'ref.wav' }, 'pt'] }),
            signal: AbortSignal.timeout(30000),
          });
          if (spaceResp.ok) {
            const result = await spaceResp.json();
            return new Response(JSON.stringify({
              audio_url: result.data?.[0]?.url || null,
              model: 'coqui/XTTS-v2',
              cost_usd: 0,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
          }
        } catch { /* fallback */ }
      }

      // Fallback: standard TTS
      return new Response(JSON.stringify({
        error: 'Voice cloning requires GPU Space. Falling back to standard TTS.',
        suggestion: 'Deploy XTTS-v2 or Qwen3-TTS on HF Inference Endpoint for production use.',
      }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ DEFAULT: Standard TTS ═══
    if (!text || typeof text !== 'string' || text.length < 1) {
      return new Response(JSON.stringify({ error: 'text is required (1-5000 chars)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: 'text too long (max 5000 chars)' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Select model based on language
    const langModels: Record<string, string> = {
      'pt': 'facebook/mms-tts-por',
      'pt-br': 'facebook/mms-tts-por',
      'en': 'facebook/mms-tts-eng',
      'es': 'facebook/mms-tts-spa',
    };
    const model = langModels[language || 'pt'] || TTS_MODEL;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
      body: JSON.stringify({ inputs: text }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!resp.ok) {
      const errorText = await resp.text();
      return new Response(JSON.stringify({ error: `TTS API error: ${resp.status}`, details: errorText }), { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Return audio directly or as base64
    if (return_format === 'base64') {
      const audioBuffer = await resp.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
      return new Response(JSON.stringify({
        audio_base64: base64,
        content_type: 'audio/wav',
        model,
        text_length: text.length,
        cost_usd: 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Return raw audio bytes
    const audioBytes = await resp.arrayBuffer();
    return new Response(audioBytes, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'audio/wav',
        'X-Model': model,
        'X-Text-Length': String(text.length),
      },
    });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
