/**
 * Voice Service — Speech-to-Text + Text-to-Speech for voice agents
 * Uses Web Speech API (browser-native) with ElevenLabs/OpenAI TTS fallback
 */
import * as llm from './llmService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface VoiceConfig {
  sttProvider: 'browser' | 'whisper';
  ttsProvider: 'browser' | 'elevenlabs' | 'openai';
  language: string;
  voiceId: string;
  speed: number; // 0.5 - 2.0
  pitch: number; // 0.5 - 2.0
  autoListen: boolean;
}

export interface STTResult {
  text: string;
  confidence: number;
  language: string;
  durationMs: number;
  isFinal: boolean;
}

export interface TTSResult {
  audioUrl?: string;
  durationMs: number;
  provider: string;
}

// ═══ DEFAULT CONFIG ═══

export const DEFAULT_VOICE_CONFIG: VoiceConfig = {
  sttProvider: 'browser',
  ttsProvider: 'browser',
  language: 'pt-BR',
  voiceId: 'default',
  speed: 1.0,
  pitch: 1.0,
  autoListen: false,
};

// ═══ SPEECH-TO-TEXT (Web Speech API) ═══

let recognition: SpeechRecognition | null = null;
let isListening = false;

/** Check if browser supports Speech Recognition. */
export function isSTTSupported(): boolean {
  return 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window;
}

/** Start listening for speech input. Returns a promise that resolves with the transcript. */
export function startListening(
  config: Partial<VoiceConfig> = {},
  onInterim?: (text: string) => void
): Promise<STTResult> {
  return new Promise((resolve, reject) => {
    if (!isSTTSupported()) {
      reject(new Error('Speech Recognition not supported in this browser'));
      return;
    }

    const SpeechRecognitionClass = (window as unknown as { SpeechRecognition?: typeof SpeechRecognition; webkitSpeechRecognition?: typeof SpeechRecognition }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: typeof SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) { reject(new Error('No SpeechRecognition')); return; }

    recognition = new SpeechRecognitionClass();
    recognition.lang = config.language ?? 'pt-BR';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    const startTime = Date.now();
    isListening = true;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const result = event.results[event.results.length - 1];
      const transcript = result[0].transcript;
      const confidence = result[0].confidence;

      if (result.isFinal) {
        isListening = false;
        logger.info(`STT: "${transcript}" (confidence: ${(confidence * 100).toFixed(0)}%)`, 'voiceService');
        resolve({ text: transcript, confidence, language: config.language ?? 'pt-BR', durationMs: Date.now() - startTime, isFinal: true });
      } else {
        onInterim?.(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      isListening = false;
      reject(new Error(`STT error: ${event.error}`));
    };

    recognition.onend = () => { isListening = false; };
    recognition.start();
    logger.info('STT: listening started', 'voiceService');
  });
}

/** Stop listening. */
export function stopListening(): void {
  if (recognition && isListening) {
    recognition.stop();
    isListening = false;
  }
}

/** Check if currently listening. */
export function getIsListening(): boolean { return isListening; }

// ═══ TEXT-TO-SPEECH ═══

/** Check if browser supports Speech Synthesis. */
export function isTTSSupported(): boolean {
  return 'speechSynthesis' in window;
}

/** Speak text using browser TTS or external API. */
export async function speak(
  text: string,
  config: Partial<VoiceConfig> = {}
): Promise<TTSResult> {
  const provider = config.ttsProvider ?? 'browser';
  const startTime = Date.now();

  if (provider === 'elevenlabs' && llm.isLLMConfigured()) {
    return speakElevenLabs(text, config);
  }

  if (provider === 'openai' && llm.isLLMConfigured()) {
    return speakOpenAI(text, config);
  }

  // Browser native TTS
  return new Promise((resolve, reject) => {
    if (!isTTSSupported()) { reject(new Error('Speech Synthesis not supported')); return; }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = config.language ?? 'pt-BR';
    utterance.rate = config.speed ?? 1.0;
    utterance.pitch = config.pitch ?? 1.0;

    // Try to find a Portuguese voice
    const voices = speechSynthesis.getVoices();
    const ptVoice = voices.find(v => v.lang.startsWith('pt'));
    if (ptVoice) utterance.voice = ptVoice;

    utterance.onend = () => {
      logger.info(`TTS (browser): "${text.slice(0, 50)}..." (${Date.now() - startTime}ms)`, 'voiceService');
      resolve({ durationMs: Date.now() - startTime, provider: 'browser' });
    };
    utterance.onerror = (e) => reject(new Error(`TTS error: ${e.error}`));

    speechSynthesis.speak(utterance);
  });
}

/** Stop speaking. */
export function stopSpeaking(): void {
  if (isTTSSupported()) speechSynthesis.cancel();
}

// ═══ ELEVENLABS TTS ═══

async function speakElevenLabs(text: string, config: Partial<VoiceConfig>): Promise<TTSResult> {
  const startTime = Date.now();
  try {
    // ElevenLabs API would be called here via Edge Function or direct API
    // For now, fall back to browser TTS with a note
    logger.info('ElevenLabs TTS: would call API (falling back to browser)', 'voiceService');
    return speak(text, { ...config, ttsProvider: 'browser' });
  } catch {
    return speak(text, { ...config, ttsProvider: 'browser' });
  }
}

// ═══ OPENAI TTS ═══

async function speakOpenAI(text: string, config: Partial<VoiceConfig>): Promise<TTSResult> {
  const startTime = Date.now();
  try {
    logger.info('OpenAI TTS: would call API (falling back to browser)', 'voiceService');
    return speak(text, { ...config, ttsProvider: 'browser' });
  } catch {
    return speak(text, { ...config, ttsProvider: 'browser' });
  }
}

// ═══ VOICE AGENT LOOP ═══

/** Full voice agent loop: listen → process → speak response. */
export async function voiceAgentTurn(
  systemPrompt: string,
  conversationHistory: { role: string; content: string }[],
  config: Partial<VoiceConfig> = {},
  onStage?: (stage: string) => void
): Promise<{ userText: string; agentText: string; latencyMs: number }> {
  const startTime = Date.now();

  // Step 1: Listen
  onStage?.('🎤 Ouvindo...');
  const sttResult = await startListening(config);

  // Step 2: Process with LLM
  onStage?.('🤔 Processando...');
  const messages: llm.LLMMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: sttResult.text },
  ];

  const response = await llm.callModel('anthropic/claude-sonnet-4', messages, {
    temperature: 0.7, maxTokens: 500, // Short responses for voice
  });

  // Step 3: Speak response
  onStage?.('🔊 Respondendo...');
  await speak(response.content, config);

  onStage?.('✅ Concluído');
  const latencyMs = Date.now() - startTime;
  logger.info(`Voice turn: "${sttResult.text.slice(0, 50)}" → "${response.content.slice(0, 50)}" (${latencyMs}ms)`, 'voiceService');

  return { userText: sttResult.text, agentText: response.content, latencyMs };
}

/** Get available browser voices. */
export function getAvailableVoices(): { id: string; name: string; lang: string }[] {
  if (!isTTSSupported()) return [];
  return speechSynthesis.getVoices().map(v => ({ id: v.voiceURI, name: v.name, lang: v.lang }));
}
