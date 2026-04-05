import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

const WHISPER_MODEL = 'openai/whisper-large-v3-turbo';
const WHISPER_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return jsonResponse({ error: 'HF_API_TOKEN not configured' }, 400);

    const body = await req.json();
    const { action, audio_base64, audio_url, language } = body;

    // ═══ ACTION: transcribe — Convert audio to text ═══
    if (action === 'transcribe' || !action) {
      let audioBytes: Uint8Array;

      if (audio_base64) {
        // Decode base64 audio
        const binaryStr = atob(audio_base64);
        audioBytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) audioBytes[i] = binaryStr.charCodeAt(i);
      } else if (audio_url) {
        // Fetch audio from URL
        const audioResp = await fetch(audio_url);
        if (!audioResp.ok) return jsonResponse({ error: `Failed to fetch audio: ${audioResp.status}` }, 400);
        audioBytes = new Uint8Array(await audioResp.arrayBuffer());
      } else {
        return jsonResponse({ error: 'audio_base64 or audio_url required' }, 400);
      }

      if (audioBytes.length > 25 * 1024 * 1024) {
        return jsonResponse({ error: 'Audio file too large (max 25MB)' }, 400);
      }

      // Call Whisper via HF Inference API
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${WHISPER_MODEL}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: audioBytes,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errorText = await resp.text();
        return jsonResponse({ error: `Whisper API error: ${resp.status}`, details: errorText }, 502);
      }

      const result = await resp.json();
      const transcription = result.text || '';

      return jsonResponse({
        text: transcription,
        language: language || 'auto',
        model: WHISPER_MODEL,
        audio_size_bytes: audioBytes.length,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: transcribe_batch — Batch transcription ═══
    if (action === 'transcribe_batch') {
      const { audio_urls } = body;
      if (!Array.isArray(audio_urls) || audio_urls.length === 0) {
        return jsonResponse({ error: 'audio_urls array required' }, 400);
      }
      if (audio_urls.length > 10) {
        return jsonResponse({ error: 'Max 10 audio files per batch' }, 400);
      }

      const results = await Promise.allSettled(audio_urls.map(async (url: string, idx: number) => {
        try {
          const audioResp = await fetch(url);
          if (!audioResp.ok) return { index: idx, error: `Fetch failed: ${audioResp.status}`, text: '' };
          const audioBytes = new Uint8Array(await audioResp.arrayBuffer());

          const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${WHISPER_MODEL}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${hfToken}` },
            body: audioBytes,
          });

          if (!resp.ok) return { index: idx, error: `Whisper error: ${resp.status}`, text: '' };
          const result = await resp.json();
          return { index: idx, text: result.text || '', error: null };
        } catch (e: unknown) {
          return { index: idx, error: e instanceof Error ? e.message : 'Unknown', text: '' };
        }
      }));

      const transcriptions = results.map(r => r.status === 'fulfilled' ? r.value : { index: -1, error: 'Promise rejected', text: '' });

      return jsonResponse({
        transcriptions,
        total: audio_urls.length,
        successful: transcriptions.filter((t: any) => !t.error).length,
        model: WHISPER_MODEL,
      });
    }

    // ═══ ACTION: transcribe_with_speakers — Transcription + Speaker Diarization (#32) ═══
    if (action === 'transcribe_with_speakers') {
      const { audio_base64: dAudio, audio_url: dUrl } = body;
      let audioBytes: Uint8Array;
      if (dAudio) {
        const raw = dAudio.replace(/^data:audio\/\w+;base64,/, '');
        audioBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      } else if (dUrl) {
        const resp = await fetch(dUrl);
        if (!resp.ok) return jsonResponse({ error: `Failed to fetch audio: ${resp.status}` }, 400);
        audioBytes = new Uint8Array(await resp.arrayBuffer());
      } else {
        return jsonResponse({ error: 'audio_base64 or audio_url required' }, 400);
      }

      // Step 1: Transcribe with Whisper (timestamps)
      const startTime = Date.now();
      const whisperResp = await fetch(HF_INFERENCE_URL, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'audio/flac' },
        body: audioBytes,
      });
      const transcription = whisperResp.ok ? await whisperResp.json() : { text: '' };

      // Step 2: Speaker diarization via pyannote (requires HF token with pyannote agreement)
      // Note: pyannote/speaker-diarization-3.1 requires accepting terms on HF Hub
      // Fallback: return transcription without speakers if diarization unavailable
      let speakers: Array<Record<string, unknown>> | null = null;
      try {
        const diarResp = await fetch('https://router.huggingface.co/hf-inference/models/pyannote/speaker-diarization-3.1', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'audio/flac' },
          body: audioBytes,
        });
        if (diarResp.ok) {
          speakers = await diarResp.json();
        }
      } catch { /* diarization optional */ }

      return jsonResponse({
        text: transcription.text || '',
        speakers: speakers || [],
        diarization_available: speakers !== null,
        latency_ms: Date.now() - startTime,
        model_stt: HF_MODEL_STT,
        model_diarization: 'pyannote/speaker-diarization-3.1',
        note: speakers === null ? 'Speaker diarization unavailable. Accept pyannote terms at huggingface.co/pyannote/speaker-diarization-3.1' : undefined,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: detect_emotion — Emotion detection from speech audio (#44) ═══
    if (action === 'detect_emotion') {
      const { audio_base64: eAudio, audio_url: eUrl } = body;
      let audioBytes: Uint8Array;
      if (eAudio) {
        const raw = eAudio.replace(/^data:audio\/\w+;base64,/, '');
        audioBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      } else if (eUrl) {
        const resp = await fetch(eUrl);
        audioBytes = new Uint8Array(await resp.arrayBuffer());
      } else {
        return jsonResponse({ error: 'audio_base64 or audio_url required' }, 400);
      }

      const emotionResp = await fetch('https://router.huggingface.co/hf-inference/models/ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: audioBytes,
      });

      if (!emotionResp.ok) {
        return jsonResponse({ error: `Emotion detection failed: ${emotionResp.status}` }, 502);
      }

      const emotions = await emotionResp.json();
      const sorted = Array.isArray(emotions) ? [...emotions].sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.score as number) - (a.score as number)) : [];

      return jsonResponse({
        dominant_emotion: sorted[0]?.label || 'unknown',
        confidence: sorted[0]?.score ? Math.round((sorted[0].score as number) * 100) / 100 : 0,
        all_emotions: sorted.map((e: Record<string, unknown>) => ({
          label: e.label,
          score: Math.round((e.score as number) * 100) / 100,
        })),
        model: 'ehcalabres/wav2vec2-lg-xlsr-en-speech-emotion-recognition',
        cost_usd: 0,
      });
    }

    // ═══ ACTION: classify_audio — Audio classification (speech/music/noise) (#50) ═══
    if (action === 'classify_audio') {
      const { audio_base64: cAudio, audio_url: cUrl } = body;
      let audioBytes: Uint8Array;
      if (cAudio) {
        const raw = cAudio.replace(/^data:audio\/\w+;base64,/, '');
        audioBytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
      } else if (cUrl) {
        const resp = await fetch(cUrl);
        audioBytes = new Uint8Array(await resp.arrayBuffer());
      } else {
        return jsonResponse({ error: 'audio_base64 or audio_url required' }, 400);
      }

      const classResp = await fetch('https://router.huggingface.co/hf-inference/models/MIT/ast-finetuned-audioset-10-10-0.4593', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: audioBytes,
      });

      if (!classResp.ok) {
        return jsonResponse({ error: `Audio classification failed: ${classResp.status}` }, 502);
      }

      const categories = await classResp.json();
      const top5 = Array.isArray(categories) ? categories.slice(0, 5).map((c: Record<string, unknown>) => ({
        label: c.label, score: Math.round((c.score as number) * 1000) / 1000,
      })) : [];
      const isSpeech = top5.some((c: Record<string, string>) => c.label?.toLowerCase().includes('speech') || c.label?.toLowerCase().includes('talk'));

      return jsonResponse({
        categories: top5,
        is_speech: isSpeech,
        should_transcribe: isSpeech,
        model: 'MIT/ast-finetuned-audioset-10-10-0.4593',
        cost_usd: 0,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
