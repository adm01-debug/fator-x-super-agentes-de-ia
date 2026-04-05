import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const WHISPER_MODEL = 'openai/whisper-large-v3-turbo';
const WHISPER_TIMEOUT_MS = 30000;

const TranscribeInput = z.object({
  action: z.enum(['transcribe', 'translate']).default('transcribe'),
  audio_base64: z.string().min(100).optional(),
  audio_url: z.string().url().optional(),
  language: z.string().min(2).max(5).default('pt'),
  format: z.enum(['text', 'srt', 'vtt', 'json']).default('text'),
}).refine(d => d.audio_base64 || d.audio_url, {
  message: 'Either audio_base64 or audio_url is required',
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.heavy);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, TranscribeInput);
    if (parsed.error) return parsed.error;
    const { action, audio_base64, audio_url, language, format } = parsed.data;

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return errorResponse(req, 'HF_API_TOKEN not configured', 503);

    let audioBytes: Uint8Array;

    if (audio_base64) {
      const raw = atob(audio_base64);
      audioBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) audioBytes[i] = raw.charCodeAt(i);
    } else if (audio_url) {
      const resp = await fetch(audio_url);
      if (!resp.ok) return errorResponse(req, `Failed to fetch audio: ${resp.status}`, 400);
      audioBytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      return errorResponse(req, 'No audio provided', 400);
    }

    if (audioBytes.length > 25 * 1024 * 1024) {
      return errorResponse(req, 'Audio file exceeds 25MB limit', 413);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), WHISPER_TIMEOUT_MS);

    try {
      const hfUrl = `https://router.huggingface.co/hf-inference/models/${WHISPER_MODEL}`;
      const resp = await fetch(hfUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBytes,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        return errorResponse(req, `Whisper API error: ${errText}`, resp.status);
      }

      const result = await resp.json();
      const text = (result as Record<string, string>).text || '';

      return jsonResponse(req, {
        text: text.trim(),
        language,
        action,
        format,
        model: WHISPER_MODEL,
        audio_size_bytes: audioBytes.length,
      });
    } finally {
      clearTimeout(timeout);
    }

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
