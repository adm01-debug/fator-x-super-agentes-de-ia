/**
 * Nexus Agents Studio — Audio Service
 * Wraps the audio-transcribe and text-to-speech Edge Functions.
 *
 * - transcribeAudio(): JSON-in/JSON-out via supabase.functions.invoke
 * - synthesizeSpeech(): returns a Blob (audio/wav) via direct fetch,
 *   because functions.invoke does not surface binary responses cleanly.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ─────────────────────────────────────────────
// Transcribe (Whisper Large v3 Turbo via HF)
// ─────────────────────────────────────────────

export type TranscribeAction = 'transcribe' | 'translate';
export type TranscribeFormat = 'text' | 'srt' | 'vtt' | 'json';

export interface TranscribeOptions {
  audioBase64?: string;
  audioUrl?: string;
  language?: string;
  action?: TranscribeAction;
  format?: TranscribeFormat;
}

export interface TranscribeResult {
  text: string;
  language: string;
  action: TranscribeAction;
  format: TranscribeFormat;
  model: string;
  audio_size_bytes: number;
}

export async function transcribeAudio(opts: TranscribeOptions): Promise<TranscribeResult> {
  if (!opts.audioBase64 && !opts.audioUrl) {
    throw new Error('Either audioBase64 or audioUrl is required');
  }

  const { data, error } = await supabase.functions.invoke('audio-transcribe', {
    body: {
      audio_base64: opts.audioBase64,
      audio_url: opts.audioUrl,
      language: opts.language ?? 'pt',
      action: opts.action ?? 'transcribe',
      format: opts.format ?? 'text',
    },
  });

  if (error) {
    logger.error('audio-transcribe failed', { error: error.message });
    throw new Error(error.message);
  }
  return data as TranscribeResult;
}

/**
 * Helper: convert a File/Blob to a base64 string (without the data: prefix).
 * Throws if the file exceeds 25MB (Whisper's hard limit).
 */
export async function fileToBase64(file: File | Blob): Promise<string> {
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('Arquivo de áudio excede 25MB');
  }
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // strip "data:audio/xxx;base64," prefix
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

// ─────────────────────────────────────────────
// Text-to-Speech (Facebook MMS-TTS via HF)
// ─────────────────────────────────────────────

export type TTSLanguage = 'pt' | 'en' | 'es';

export interface TTSOptions {
  text: string;
  language?: TTSLanguage;
}

/**
 * Calls text-to-speech and returns a Blob (audio/wav) ready to play
 * via URL.createObjectURL() or upload elsewhere.
 */
export async function synthesizeSpeech(opts: TTSOptions): Promise<Blob> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
  if (!supabaseUrl || !anonKey) {
    throw new Error('Supabase env vars não configuradas');
  }

  const { data: { session } } = await supabase.auth.getSession();
  const authToken = session?.access_token ?? anonKey;

  const resp = await fetch(`${supabaseUrl}/functions/v1/text-to-speech`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'apikey': anonKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: opts.text,
      language: opts.language ?? 'pt',
    }),
  });

  if (!resp.ok) {
    let message = `TTS HTTP ${resp.status}`;
    try {
      const errBody = await resp.json();
      message = (errBody as { error?: string }).error ?? message;
    } catch {
      // body wasn't json
    }
    logger.error('text-to-speech failed', { status: resp.status, message });
    throw new Error(message);
  }

  return await resp.blob();
}

/**
 * Convenience: synthesize and return an Object URL ready for <audio src=...>.
 * Caller is responsible for revoking it via URL.revokeObjectURL when done.
 */
export async function synthesizeSpeechToUrl(opts: TTSOptions): Promise<string> {
  const blob = await synthesizeSpeech(opts);
  return URL.createObjectURL(blob);
}
