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
    const { text, language, return_format } = body;

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
